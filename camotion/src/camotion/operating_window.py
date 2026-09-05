"""01.12 research-only baked-exposure operating window.

Uses the existing 01.8 fixed-16 destination-gather operator.
The sigma=1 Gaussian is a diagnostic source-bandwidth control, not a
pipeline change. Not CameraMotionPlan. Not default ``render()``.
"""

from __future__ import annotations

from typing import Literal

import numpy as np

from camotion.experimental_composite import gaussian_blur
from camotion.exposure import (
    _restore_dtype,
    _validate_image,
    apply_multisample_exposure,
    exposure_path_length_pixels,
)

STRENGTHS = (0.02, 0.04, 0.06, 0.08)
SAMPLES = 16
PREFILTER_SIGMA = 1.0
BANDWIDTHS = ("pristine", "sigma1")
Bandwidth = Literal["pristine", "sigma1"]


def _blur_channels(image: np.ndarray, sigma: float) -> np.ndarray:
    array = np.asarray(image, dtype=np.float64)
    if array.ndim == 2:
        return gaussian_blur(array, sigma)
    channels = [
        gaussian_blur(array[..., index], sigma) for index in range(array.shape[2])
    ]
    return np.stack(channels, axis=-1)


def apply_sigma1_source(image: np.ndarray, *, sigma: float = PREFILTER_SIGMA) -> np.ndarray:
    """Diagnostic sigma=1 Gaussian. Not a Camotion renderer stage."""
    image = _validate_image(image)
    blurred = _blur_channels(image, sigma)
    if not np.issubdtype(image.dtype, np.floating):
        return _restore_dtype(blurred, image.dtype)
    return blurred.astype(image.dtype, copy=False)


def apply_operating_window_exposure(
    image: np.ndarray,
    motion_field: np.ndarray,
    strength: float,
    bandwidth: Bandwidth,
    *,
    samples: int = SAMPLES,
) -> np.ndarray:
    """01.8 fixed-N gather, optionally after the sigma=1 diagnostic control."""
    if bandwidth == "pristine":
        source = image
    elif bandwidth == "sigma1":
        source = apply_sigma1_source(image)
    else:
        raise KeyError(bandwidth)
    return apply_multisample_exposure(source, motion_field, strength, samples)


def path_length_summary(lengths: np.ndarray) -> dict[str, float]:
    values = np.asarray(lengths, dtype=np.float64).reshape(-1)
    if values.size == 0:
        raise ValueError("path-length array is empty")
    return {
        "mean": float(values.mean()),
        "median": float(np.median(values)),
        "p90": float(np.percentile(values, 90)),
        "p95": float(np.percentile(values, 95)),
        "max": float(values.max()),
        "min": float(values.min()),
    }


def path_lengths_for_strength(
    motion_field: np.ndarray,
    strength: float,
) -> np.ndarray:
    height, width = motion_field.shape[:2]
    return exposure_path_length_pixels(motion_field, strength, height, width)


def mean_gradient_magnitude(image: np.ndarray) -> float:
    """Supporting high-frequency energy. Not a ghosting score."""
    array = np.asarray(image, dtype=np.float64)
    if array.ndim == 3:
        luma = 0.2126 * array[..., 0] + 0.7152 * array[..., 1] + 0.0722 * array[..., 2]
    else:
        luma = array
    gx = np.diff(luma, axis=1, prepend=luma[:, :1])
    gy = np.diff(luma, axis=0, prepend=luma[:1, :])
    return float(np.hypot(gx, gy).mean())


def condition_name(strength: float, bandwidth: Bandwidth) -> str:
    cents = int(round(strength * 100))
    return f"s{cents:03d}-{bandwidth}"
