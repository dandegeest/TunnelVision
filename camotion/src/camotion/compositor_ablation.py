"""01.10 diagnostic capture of the 01.8 depth-banded compositor.

Does not change CameraMotionPlan, default ``render()``, or 01.8 output.
Always uses fixed 16-tap ``apply_multisample_exposure``. Adaptive 01.9
integration is not used.

Actual 01.8 order, from ``render_depth_banded``:

    source
    → strong exposure (fixed taps)
    → medium exposure (fixed taps, strength * 8/12)
    → strong mask = expose(gaussian(near_weight))
    → medium mask = gaussian(near-to-mid ramp)
    → route preservation attenuates those masks (if enabled)
    → strong over (medium over pristine)
    → destination-protection blend

Route preservation is a pre-composite mask attenuation, not a
post-composite filter.
"""

from __future__ import annotations

import numpy as np

from camotion.experimental_composite import (
    MEDIUM_STRENGTH_RATIO,
    ROUTE_CORRIDOR_BOTTOM_WIDTH,
    ROUTE_CORRIDOR_FEATHER,
    ROUTE_CORRIDOR_TOP_WIDTH,
    ROUTE_PRESERVATION_STRENGTH,
    _apply_route_preservation,
    _composite_layers,
    _restore_dtype,
    _validate_near_weight,
    effective_compositor_weights,
    medium_visibility_mask,
    render_depth_banded,
    route_preservation_mask,
    strong_visibility_mask,
)
from camotion.exposure import apply_multisample_exposure
from camotion.flow import forward_radial_motion_field
from camotion.masks import apply_protection_blend, destination_protection_mask
from camotion.plan import CameraMotionPlan

MATERIAL_ACTIVE_THRESHOLD = 0.10


def _weighted_appearance(
    image: np.ndarray,
    weight: np.ndarray,
) -> np.ndarray:
    values = np.asarray(image, dtype=np.float64)
    alpha = np.clip(np.asarray(weight, dtype=np.float64), 0.0, 1.0)
    if values.ndim == 3:
        alpha = alpha[..., np.newaxis]
    return values * alpha


def reconstruct_from_weights(
    pristine: np.ndarray,
    medium_exposed: np.ndarray,
    strong_exposed: np.ndarray,
    w_pristine: np.ndarray,
    w_medium: np.ndarray,
    w_strong: np.ndarray,
) -> np.ndarray:
    """Linear reconstruction of ``_composite_layers`` from effective weights."""
    base = np.asarray(pristine, dtype=np.float64)
    med = np.asarray(medium_exposed, dtype=np.float64)
    st = np.asarray(strong_exposed, dtype=np.float64)
    wp = np.asarray(w_pristine, dtype=np.float64)
    wm = np.asarray(w_medium, dtype=np.float64)
    ws = np.asarray(w_strong, dtype=np.float64)
    if base.ndim == 3:
        wp = wp[..., np.newaxis]
        wm = wm[..., np.newaxis]
        ws = ws[..., np.newaxis]
    return st * ws + med * wm + base * wp


def extract_crop(image: np.ndarray, box: dict[str, int]) -> np.ndarray:
    x = int(box["x"])
    y = int(box["y"])
    width = int(box["width"])
    height = int(box["height"])
    if width < 1 or height < 1:
        raise ValueError("crop width and height must be >= 1")
    array = np.asarray(image)
    return array[y : y + height, x : x + width]


def collect_depth_banded_ablation(
    image: np.ndarray,
    plan: CameraMotionPlan,
    near_weight: np.ndarray,
    *,
    route_preservation: bool = True,
    route_preservation_strength: float = ROUTE_PRESERVATION_STRENGTH,
    route_corridor_top_width: float = ROUTE_CORRIDOR_TOP_WIDTH,
    route_corridor_bottom_width: float = ROUTE_CORRIDOR_BOTTOM_WIDTH,
    route_corridor_feather: float = ROUTE_CORRIDOR_FEATHER,
) -> dict[str, np.ndarray]:
    """Return real 01.8 intermediates. Never enables 01.9 adaptive exposure."""
    array = np.asarray(image)
    if array.ndim not in (2, 3):
        raise ValueError("image must have shape H x W or H x W x C")
    height = int(array.shape[0])
    width = int(array.shape[1])
    weight = _validate_near_weight(near_weight, height, width)

    field = forward_radial_motion_field(
        width,
        height,
        plan.camera.vanishing_point,
        plan.camera.forward,
    )
    strong_strength = float(plan.exposure.strength)
    medium_strength = strong_strength * MEDIUM_STRENGTH_RATIO
    samples = int(plan.exposure.samples)
    expose = apply_multisample_exposure

    strong_exposed = expose(array, field, strong_strength, samples)
    medium_exposed = expose(array, field, medium_strength, samples)
    strong_before, strong_mask_motion = strong_visibility_mask(
        weight,
        field,
        strong_strength,
        samples,
        expose=expose,
    )
    medium_mask_depth = medium_visibility_mask(weight)

    route_mask = None
    strong_mask_used = strong_mask_motion
    medium_mask_used = medium_mask_depth
    apply_route = bool(route_preservation) and float(route_preservation_strength) != 0.0
    if apply_route:
        dest_point = None if plan.destination is None else plan.destination.point
        route_mask = route_preservation_mask(
            width,
            height,
            plan.camera.vanishing_point,
            dest_point,
            top_width=route_corridor_top_width,
            bottom_width=route_corridor_bottom_width,
            feather=route_corridor_feather,
        )
        strength = float(np.clip(route_preservation_strength, 0.0, 1.0))
        strong_mask_used = _apply_route_preservation(
            strong_mask_motion, route_mask, strength
        )
        medium_mask_used = _apply_route_preservation(
            medium_mask_depth, route_mask, strength
        )

    w_s_pre, w_m_pre, w_p_pre = effective_compositor_weights(
        strong_mask_motion, medium_mask_depth
    )
    w_s_post, w_m_post, w_p_post = effective_compositor_weights(
        strong_mask_used, medium_mask_used
    )

    pre_route_float = _composite_layers(
        array, medium_exposed, strong_exposed, medium_mask_depth, strong_mask_motion
    )
    post_route_float = _composite_layers(
        array, medium_exposed, strong_exposed, medium_mask_used, strong_mask_used
    )
    pre_route = _restore_dtype(pre_route_float, array.dtype)
    post_route = _restore_dtype(post_route_float, array.dtype)
    protection_mask = destination_protection_mask(width, height, plan.destination)
    output = apply_protection_blend(array, post_route, protection_mask)

    states = {
        "00_source": array,
        "01_strong_exposure": strong_exposed,
        "02_medium_exposure": medium_exposed,
        "03_raw_near_weight": weight,
        "04_strong_mask_before_motion": strong_before,
        "05_strong_mask_after_motion": strong_mask_motion,
        "05_strong_mask_after_route": strong_mask_used,
        "06_medium_mask": medium_mask_depth,
        "06_medium_mask_after_route": medium_mask_used,
        "07_effective_strong": w_s_pre,
        "08_effective_medium": w_m_pre,
        "09_effective_pristine": w_p_pre,
        "07_effective_strong_after_route": w_s_post,
        "08_effective_medium_after_route": w_m_post,
        "09_effective_pristine_after_route": w_p_post,
        "10_strong_only": _restore_dtype(
            _weighted_appearance(strong_exposed, w_s_pre), array.dtype
        ),
        "11_medium_only": _restore_dtype(
            _weighted_appearance(medium_exposed, w_m_pre), array.dtype
        ),
        "12_pristine_only": _restore_dtype(
            _weighted_appearance(array, w_p_pre), array.dtype
        ),
        "13_strong_plus_medium": _restore_dtype(
            reconstruct_from_weights(
                np.zeros_like(array, dtype=np.float64),
                medium_exposed,
                strong_exposed,
                np.zeros_like(w_p_pre),
                w_m_pre,
                w_s_pre,
            ),
            array.dtype,
        ),
        "14_strong_plus_pristine": _restore_dtype(
            reconstruct_from_weights(
                array,
                np.zeros_like(array, dtype=np.float64),
                strong_exposed,
                w_p_pre,
                np.zeros_like(w_m_pre),
                w_s_pre,
            ),
            array.dtype,
        ),
        "15_medium_plus_pristine": _restore_dtype(
            reconstruct_from_weights(
                array,
                medium_exposed,
                np.zeros_like(array, dtype=np.float64),
                w_p_pre,
                w_m_pre,
                np.zeros_like(w_s_pre),
            ),
            array.dtype,
        ),
        "16_full_depth_banded": pre_route,
        "16_full_depth_banded_unexposed_strong_mask": _restore_dtype(
            _composite_layers(
                array,
                medium_exposed,
                strong_exposed,
                medium_mask_depth,
                strong_before,
            ),
            array.dtype,
        ),
        "17_route_preserved": post_route,
        "18_final_01_8": output,
        "pre_route_float": pre_route_float,
        "post_route_float": post_route_float,
        "protection_mask": protection_mask,
        "contribution_rgb": np.stack(
            [
                np.clip(w_s_pre, 0.0, 1.0),
                np.clip(w_m_pre, 0.0, 1.0),
                np.clip(w_p_pre, 0.0, 1.0),
            ],
            axis=-1,
        ),
        "contribution_rgb_after_route": np.stack(
            [
                np.clip(w_s_post, 0.0, 1.0),
                np.clip(w_m_post, 0.0, 1.0),
                np.clip(w_p_post, 0.0, 1.0),
            ],
            axis=-1,
        ),
    }
    if route_mask is not None:
        states["route_preservation_mask"] = route_mask
    return states


def weight_stats(weight: np.ndarray) -> dict[str, float]:
    array = np.asarray(weight, dtype=np.float64)
    return {
        "min": float(array.min()),
        "max": float(array.max()),
        "mean": float(array.mean()),
    }


def overlap_stats(
    w_strong: np.ndarray,
    w_medium: np.ndarray,
    w_pristine: np.ndarray,
    *,
    threshold: float = MATERIAL_ACTIVE_THRESHOLD,
) -> dict[str, float]:
    s = np.asarray(w_strong, dtype=np.float64) > threshold
    m = np.asarray(w_medium, dtype=np.float64) > threshold
    p = np.asarray(w_pristine, dtype=np.float64) > threshold
    return {
        "threshold": float(threshold),
        "strong_active_fraction": float(s.mean()),
        "medium_active_fraction": float(m.mean()),
        "pristine_active_fraction": float(p.mean()),
        "strong_and_medium_fraction": float((s & m).mean()),
        "strong_and_pristine_fraction": float((s & p).mean()),
        "medium_and_pristine_fraction": float((m & p).mean()),
        "all_three_fraction": float((s & m & p).mean()),
    }


def weight_sum_error(
    w_strong: np.ndarray,
    w_medium: np.ndarray,
    w_pristine: np.ndarray,
) -> dict[str, float]:
    total = (
        np.asarray(w_strong, dtype=np.float64)
        + np.asarray(w_medium, dtype=np.float64)
        + np.asarray(w_pristine, dtype=np.float64)
    )
    delta = np.abs(total - 1.0)
    return {
        "max_abs_error_from_one": float(delta.max()),
        "mean_abs_error_from_one": float(delta.mean()),
        "sums_to_one": bool(delta.max() <= 1e-12),
    }


def ablation_matches_render(
    image: np.ndarray,
    plan: CameraMotionPlan,
    near_weight: np.ndarray,
    *,
    route_preservation: bool = True,
) -> np.ndarray:
    """Final ablation frame; must match ``render_depth_banded`` exactly."""
    states = collect_depth_banded_ablation(
        image, plan, near_weight, route_preservation=route_preservation
    )
    expected = render_depth_banded(
        image,
        plan,
        near_weight,
        route_preservation=route_preservation,
        adaptive_exposure=False,
    )
    if not np.array_equal(states["18_final_01_8"], expected):
        raise AssertionError("01.10 ablation final does not match render_depth_banded")
    return states["18_final_01_8"]
