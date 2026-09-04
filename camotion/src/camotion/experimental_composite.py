"""Experimental depth-banded, motion-aware multi-exposure compositor.

This is a controlled research path. It is not CameraMotionPlan v1, not
the default ``render()`` pipeline, and not a Photoshop port.

Pipeline:

    unscaled radial field
    strong image  = expose(source, field, strength)
    medium image  = expose(source, field, strength * MEDIUM_STRENGTH_RATIO)
    strong mask   = expose(gaussian(near_weight), field, strength)
    medium mask   = gaussian(near-to-mid ramp of near_weight)
    composite     = strong over medium over pristine
    optional 01.8 route-preservation attenuates strong/medium masks
        in a geometric corridor (off by default; 01.5 unchanged)
    optional 01.9 adaptive exposure densifies taps along that same
        trajectory (off by default; 01.5/01.8 unchanged)
    then existing destination-protection blend

``near_weight`` is Camotion convention: 1.0 = near, 0.0 = far.
Do not invert Terran's Photoshop Invert when the input is already
near_weight.

Experimental constants below are local to this module. They are not
plan fields.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from camotion.exposure import (
    ADAPTIVE_MAX_STEP_PIXELS,
    adaptive_sample_counts,
    apply_adaptive_multisample_exposure,
    apply_adaptive_terminal_at_canonical_exposure,
    apply_multisample_exposure,
    apply_terminal_at_canonical_exposure,
)
from camotion.flow import forward_radial_motion_field
from camotion.masks import apply_protection_blend, destination_protection_mask
from camotion.plan import CameraMotionPlan

# Photoshop Zoom amounts 12 (strong) and 8 (medium) as a ratio applied to
# the plan's existing exposure.strength. Ghost Library 01.4 uses 0.08, so
# strong = 0.08 and medium = 0.08 * 8/12.
MEDIUM_STRENGTH_RATIO = 8.0 / 12.0

# Approximate Terran Gaussian 10 / Gaussian 2 in pixels. Numpy sigma, not
# a public Camotion shutter unit.
STRONG_MASK_SOFTEN_SIGMA = 10.0
MEDIUM_MASK_SOFTEN_SIGMA = 2.0

# Terran Levels input [203, 243] on black-near / white-far uint8, then
# invert. In Camotion near_weight (white=near):
#   far cut    = 1 - 243/255  →  medium visibility 0
#   near full  = 1 - 203/255  →  medium visibility 1
MEDIUM_FAR_CUT = 1.0 - 243.0 / 255.0
MEDIUM_NEAR_FULL = 1.0 - 203.0 / 255.0

# 01.8 route-preservation corridor. Experimental-only; not plan fields.
# Strength 1.0 would fully suppress motion in the corridor center; keep
# below that so the route attenuates rather than becoming a hard hole.
ROUTE_PRESERVATION_STRENGTH = 0.70
# Full widths in normalized image x. Narrow near the vanishing point,
# wider toward the bottom/foreground.
ROUTE_CORRIDOR_TOP_WIDTH = 0.14
ROUTE_CORRIDOR_BOTTOM_WIDTH = 0.48
ROUTE_CORRIDOR_FEATHER = 0.10


def _restore_dtype(values: np.ndarray, dtype: np.dtype) -> np.ndarray:
    if np.issubdtype(dtype, np.floating):
        return values.astype(dtype, copy=False)
    info = np.iinfo(dtype)
    return np.clip(np.rint(values), info.min, info.max).astype(dtype)


def _validate_near_weight(near_weight: np.ndarray, height: int, width: int) -> np.ndarray:
    weight = np.asarray(near_weight, dtype=np.float64)
    if weight.ndim != 2 or weight.shape != (height, width):
        raise ValueError(
            f"near_weight shape {tuple(weight.shape)} does not match image {(height, width)}"
        )
    if np.any(~np.isfinite(weight)):
        raise ValueError("near_weight values must be finite")
    return np.clip(weight, 0.0, 1.0)


def gaussian_blur(image: np.ndarray, sigma: float) -> np.ndarray:
    """Separable reflect-padded Gaussian. ``sigma <= 0`` is a no-op copy."""
    array = np.asarray(image, dtype=np.float64)
    if array.ndim != 2:
        raise ValueError("gaussian_blur expects an H x W array")
    if sigma <= 0.0:
        return array.copy()

    radius = max(1, int(np.ceil(3.0 * sigma)))
    offsets = np.arange(-radius, radius + 1, dtype=np.float64)
    kernel = np.exp(-(offsets * offsets) / (2.0 * sigma * sigma))
    kernel /= kernel.sum()

    def _convolve_1d(values: np.ndarray, axis: int) -> np.ndarray:
        pad_width = [(0, 0)] * values.ndim
        pad_width[axis] = (radius, radius)
        padded = np.pad(values, pad_width, mode="reflect")
        acc = np.zeros(values.shape, dtype=np.float64)
        slicer: list[Any] = [slice(None)] * values.ndim
        for index, coeff in enumerate(kernel):
            slicer[axis] = slice(index, index + values.shape[axis])
            acc += coeff * padded[tuple(slicer)]
        return acc

    blurred = _convolve_1d(array, axis=1)
    blurred = _convolve_1d(blurred, axis=0)
    return blurred


def medium_visibility_mask(
    near_weight: np.ndarray,
    *,
    far_cut: float = MEDIUM_FAR_CUT,
    near_full: float = MEDIUM_NEAR_FULL,
    soften_sigma: float = MEDIUM_MASK_SOFTEN_SIGMA,
) -> np.ndarray:
    """Near/mid band: 1 near, ramp through mid, 0 at the furthest range."""
    weight = np.asarray(near_weight, dtype=np.float64)
    if weight.ndim != 2:
        raise ValueError("near_weight must have shape H x W")
    if near_full <= far_cut:
        raise ValueError("near_full must be greater than far_cut")

    ramp = (weight - far_cut) / (near_full - far_cut)
    mask = np.clip(ramp, 0.0, 1.0)
    if soften_sigma > 0.0:
        mask = np.clip(gaussian_blur(mask, soften_sigma), 0.0, 1.0)
    return mask


def strong_visibility_mask(
    near_weight: np.ndarray,
    motion_field: np.ndarray,
    strength: float,
    samples: int,
    *,
    soften_sigma: float = STRONG_MASK_SOFTEN_SIGMA,
    expose=apply_multisample_exposure,
) -> tuple[np.ndarray, np.ndarray]:
    """Return ``(softened_before_exposure, motion_treated_mask)`` in ``[0, 1]``.

    ``expose`` must match the image-branch exposure used in the same
    render so the strong mask and strong image share orientation.
    """
    weight = np.clip(np.asarray(near_weight, dtype=np.float64), 0.0, 1.0)
    softened = np.clip(gaussian_blur(weight, soften_sigma), 0.0, 1.0)
    exposed = expose(softened, motion_field, strength, samples)
    treated = np.clip(np.asarray(exposed, dtype=np.float64), 0.0, 1.0)
    return softened, treated


def _normalized_grid(width: int, height: int) -> tuple[np.ndarray, np.ndarray]:
    xs = (
        np.array([0.0], dtype=np.float64)
        if width == 1
        else np.linspace(0.0, 1.0, width, dtype=np.float64)
    )
    ys = (
        np.array([0.0], dtype=np.float64)
        if height == 1
        else np.linspace(0.0, 1.0, height, dtype=np.float64)
    )
    return np.meshgrid(xs, ys, indexing="xy")


def _smoothstep(edge0: np.ndarray | float, edge1: np.ndarray | float, value: np.ndarray) -> np.ndarray:
    span = np.asarray(edge1, dtype=np.float64) - np.asarray(edge0, dtype=np.float64)
    span = np.where(np.abs(span) < 1e-12, 1.0, span)
    t = np.clip((value - edge0) / span, 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def route_preservation_mask(
    width: int,
    height: int,
    vanishing_point: tuple[float, float],
    destination_point: tuple[float, float] | None = None,
    *,
    top_width: float = ROUTE_CORRIDOR_TOP_WIDTH,
    bottom_width: float = ROUTE_CORRIDOR_BOTTOM_WIDTH,
    feather: float = ROUTE_CORRIDOR_FEATHER,
) -> np.ndarray:
    """Soft perspective corridor. 1 = preserve canonical, 0 = keep motion.

    Apex at the vanishing point. Centerline passes through the destination
    point when supplied. Width interpolates from ``top_width`` at the apex
    to ``bottom_width`` at the bottom of the image. Edges are feathered.
    """
    if width < 1 or height < 1:
        raise ValueError("width and height must be >= 1")
    if top_width < 0.0 or bottom_width < 0.0:
        raise ValueError("corridor widths must be >= 0")
    if feather < 0.0:
        raise ValueError("feather must be >= 0")

    apex_x, apex_y = float(vanishing_point[0]), float(vanishing_point[1])
    if destination_point is None:
        dest_x, dest_y = apex_x, min(1.0, apex_y + 0.05)
    else:
        dest_x, dest_y = float(destination_point[0]), float(destination_point[1])

    xs, ys = _normalized_grid(width, height)
    denom = dest_y - apex_y
    if abs(denom) < 1e-6:
        center_x = np.full_like(xs, apex_x)
    else:
        center_x = apex_x + (dest_x - apex_x) * (ys - apex_y) / denom

    progress = np.clip((ys - apex_y) / max(1.0 - apex_y, 1e-6), 0.0, 1.0)
    full_width = top_width + progress * (bottom_width - top_width)
    half_width = full_width * 0.5
    distance = np.abs(xs - center_x)

    inner = np.maximum(half_width - 0.5 * feather, 0.0)
    outer = half_width + 0.5 * feather
    preserve = 1.0 - _smoothstep(inner, outer, distance)
    return np.clip(preserve, 0.0, 1.0)


def _apply_route_preservation(
    mask: np.ndarray,
    route_mask: np.ndarray,
    strength: float,
) -> np.ndarray:
    factor = 1.0 - float(strength) * np.clip(route_mask, 0.0, 1.0)
    return np.clip(np.asarray(mask, dtype=np.float64) * factor, 0.0, 1.0)


def _composite_layers(
    pristine: np.ndarray,
    medium_exposed: np.ndarray,
    strong_exposed: np.ndarray,
    medium_mask: np.ndarray,
    strong_mask: np.ndarray,
) -> np.ndarray:
    base = np.asarray(pristine, dtype=np.float64)
    medium = np.asarray(medium_exposed, dtype=np.float64)
    strong = np.asarray(strong_exposed, dtype=np.float64)
    medium_a = np.clip(np.asarray(medium_mask, dtype=np.float64), 0.0, 1.0)
    strong_a = np.clip(np.asarray(strong_mask, dtype=np.float64), 0.0, 1.0)
    if base.ndim == 3:
        medium_a = medium_a[..., np.newaxis]
        strong_a = strong_a[..., np.newaxis]

    medium_composite = medium * medium_a + base * (1.0 - medium_a)
    return strong * strong_a + medium_composite * (1.0 - strong_a)


def effective_compositor_weights(
    strong_mask: np.ndarray,
    medium_mask: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Per-pixel weights implied by ``_composite_layers``.

    Strong over (medium over pristine):

        w_strong   = S
        w_medium   = M * (1 - S)
        w_pristine = (1 - M) * (1 - S)

    These sum to 1. Not a CameraMotionPlan field. Diagnostic only.
    """
    strong_a = np.clip(np.asarray(strong_mask, dtype=np.float64), 0.0, 1.0)
    medium_a = np.clip(np.asarray(medium_mask, dtype=np.float64), 0.0, 1.0)
    if strong_a.shape != medium_a.shape:
        raise ValueError(
            f"strong_mask shape {strong_a.shape} does not match medium_mask {medium_a.shape}"
        )
    w_strong = strong_a
    w_medium = medium_a * (1.0 - strong_a)
    w_pristine = (1.0 - medium_a) * (1.0 - strong_a)
    return w_strong, w_medium, w_pristine


def render_depth_banded(
    image: np.ndarray,
    plan: CameraMotionPlan,
    near_weight: np.ndarray,
    *,
    return_diagnostics: bool = False,
    strong_mask_soften_sigma: float = STRONG_MASK_SOFTEN_SIGMA,
    medium_mask_soften_sigma: float = MEDIUM_MASK_SOFTEN_SIGMA,
    terminal_at_canonical: bool = False,
    route_preservation: bool = False,
    route_preservation_strength: float = ROUTE_PRESERVATION_STRENGTH,
    route_corridor_top_width: float = ROUTE_CORRIDOR_TOP_WIDTH,
    route_corridor_bottom_width: float = ROUTE_CORRIDOR_BOTTOM_WIDTH,
    route_corridor_feather: float = ROUTE_CORRIDOR_FEATHER,
    adaptive_exposure: bool = False,
    adaptive_max_step_pixels: float = ADAPTIVE_MAX_STEP_PIXELS,
) -> np.ndarray | tuple[np.ndarray, dict[str, np.ndarray]]:
    """Depth-banded composite, then existing destination protection.

    Does not scale the motion field by near_weight. Depth enters only
    through the two visibility masks. Soften sigmas default to the
    experimental constants; overrides are for tests, not plan fields.

    ``terminal_at_canonical=False`` is the 01.5 outgoing sample set
    (``p - field*t``). ``True`` uses the opposite set (``p + field*t``)
    for the strong image, medium image, and strong mask together.

    ``route_preservation`` is the 01.8 experimental modifier. Off by
    default so 01.5 behavior is unchanged. When on, a geometric corridor
    attenuates strong/medium visibility before compositing. Destination
    protection still runs afterward, unchanged.

    ``adaptive_exposure`` is the 01.9 experimental modifier. Off by
    default so 01.5/01.8 sampling stays fixed. When on, strong/medium
    images and the strong mask use path-length-adaptive tap density
    along the same trajectory. ``plan.exposure.samples`` is unused for
    those integrations.
    """
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
    if adaptive_exposure:
        adaptive_expose = (
            apply_adaptive_terminal_at_canonical_exposure
            if terminal_at_canonical
            else apply_adaptive_multisample_exposure
        )

        def expose(image_branch, motion, strength, _samples):
            return adaptive_expose(
                image_branch,
                motion,
                strength,
                max_step_pixels=adaptive_max_step_pixels,
            )
    else:
        expose = (
            apply_terminal_at_canonical_exposure
            if terminal_at_canonical
            else apply_multisample_exposure
        )

    strong_exposed = expose(array, field, strong_strength, samples)
    medium_exposed = expose(array, field, medium_strength, samples)
    strong_before, strong_mask = strong_visibility_mask(
        weight,
        field,
        strong_strength,
        samples,
        soften_sigma=strong_mask_soften_sigma,
        expose=expose,
    )
    medium_mask = medium_visibility_mask(
        weight, soften_sigma=medium_mask_soften_sigma
    )

    route_mask = None
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
        strong_mask = _apply_route_preservation(strong_mask, route_mask, strength)
        medium_mask = _apply_route_preservation(medium_mask, route_mask, strength)

    composited = _composite_layers(
        array, medium_exposed, strong_exposed, medium_mask, strong_mask
    )
    composited = _restore_dtype(composited, array.dtype)
    protection_mask = destination_protection_mask(width, height, plan.destination)
    output = apply_protection_blend(array, composited, protection_mask)

    if not return_diagnostics:
        return output
    diagnostics = {
        "strong_mask_before": strong_before,
        "strong_mask_after": strong_mask,
        "medium_mask": medium_mask,
    }
    if route_mask is not None:
        diagnostics["route_preservation_mask"] = route_mask
    if adaptive_exposure:
        diagnostics["adaptive_sample_counts"] = adaptive_sample_counts(
            field,
            strong_strength,
            height,
            width,
            max_step_pixels=adaptive_max_step_pixels,
        )
    return output, diagnostics
