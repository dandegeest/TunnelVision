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

from camotion.exposure import apply_multisample_exposure
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
) -> tuple[np.ndarray, np.ndarray]:
    """Return ``(softened_before_exposure, motion_treated_mask)`` in ``[0, 1]``."""
    weight = np.clip(np.asarray(near_weight, dtype=np.float64), 0.0, 1.0)
    softened = np.clip(gaussian_blur(weight, soften_sigma), 0.0, 1.0)
    exposed = apply_multisample_exposure(softened, motion_field, strength, samples)
    treated = np.clip(np.asarray(exposed, dtype=np.float64), 0.0, 1.0)
    return softened, treated


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


def render_depth_banded(
    image: np.ndarray,
    plan: CameraMotionPlan,
    near_weight: np.ndarray,
    *,
    return_diagnostics: bool = False,
    strong_mask_soften_sigma: float = STRONG_MASK_SOFTEN_SIGMA,
    medium_mask_soften_sigma: float = MEDIUM_MASK_SOFTEN_SIGMA,
) -> np.ndarray | tuple[np.ndarray, dict[str, np.ndarray]]:
    """Depth-banded composite, then existing destination protection.

    Does not scale the motion field by near_weight. Depth enters only
    through the two visibility masks. Soften sigmas default to the
    experimental constants; overrides are for tests, not plan fields.
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

    strong_exposed = apply_multisample_exposure(
        array, field, strong_strength, samples
    )
    medium_exposed = apply_multisample_exposure(
        array, field, medium_strength, samples
    )
    strong_before, strong_mask = strong_visibility_mask(
        weight,
        field,
        strong_strength,
        samples,
        soften_sigma=strong_mask_soften_sigma,
    )
    medium_mask = medium_visibility_mask(
        weight, soften_sigma=medium_mask_soften_sigma
    )

    composited = _composite_layers(
        array, medium_exposed, strong_exposed, medium_mask, strong_mask
    )
    composited = _restore_dtype(composited, array.dtype)
    protection_mask = destination_protection_mask(width, height, plan.destination)
    output = apply_protection_blend(array, composited, protection_mask)

    if not return_diagnostics:
        return output
    return output, {
        "strong_mask_before": strong_before,
        "strong_mask_after": strong_mask,
        "medium_mask": medium_mask,
    }
