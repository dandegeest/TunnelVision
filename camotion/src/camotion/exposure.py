"""Outgoing multisample exposure along a normalized motion field.

Camotion v1 inverse-samples the source image at equal-weight taps from
t=0 (pristine) to t=1 (full displacement). The motion field is in
normalized image units; displacement is converted to pixels with
``(width - 1)`` / ``(height - 1)`` before sampling. Out-of-bounds
source coordinates clamp to the nearest valid edge pixel. Averaging
uses the image's existing encoded values (no color-space conversion).
"""

from __future__ import annotations

from typing import Any

import numpy as np

_MIN_STRENGTH = 0.0
_MAX_STRENGTH = 1.0
_MIN_SAMPLES = 2
_MAX_SAMPLES = 64


def _as_float(value: Any, *, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float, np.integer, np.floating)):
        raise ValueError(f"{name} must be a finite number")
    result = float(value)
    if not np.isfinite(result):
        raise ValueError(f"{name} must be a finite number")
    return result


def _validate_strength(strength: Any) -> float:
    value = _as_float(strength, name="strength")
    if not (_MIN_STRENGTH <= value <= _MAX_STRENGTH):
        raise ValueError("strength must be in [0, 1]")
    return value


def _validate_samples(samples: Any) -> int:
    if isinstance(samples, bool) or not isinstance(samples, (int, np.integer)):
        raise ValueError(f"samples must be an integer in [{_MIN_SAMPLES}, {_MAX_SAMPLES}]")
    value = int(samples)
    if value != samples:
        raise ValueError(f"samples must be an integer in [{_MIN_SAMPLES}, {_MAX_SAMPLES}]")
    if not (_MIN_SAMPLES <= value <= _MAX_SAMPLES):
        raise ValueError(f"samples must be an integer in [{_MIN_SAMPLES}, {_MAX_SAMPLES}]")
    return value


def _validate_image(image: np.ndarray) -> np.ndarray:
    array = np.asarray(image)
    if array.dtype == np.bool_ or not (
        np.issubdtype(array.dtype, np.floating) or np.issubdtype(array.dtype, np.integer)
    ):
        raise ValueError("image must be a floating-point or integer array")
    if array.ndim not in (2, 3):
        raise ValueError("image must have shape H x W or H x W x C")
    if array.shape[0] < 1 or array.shape[1] < 1:
        raise ValueError("image height and width must be >= 1")
    if array.ndim == 3 and array.shape[2] < 1:
        raise ValueError("image channel count must be >= 1")
    return array


def _validate_motion_field(motion_field: np.ndarray, height: int, width: int) -> np.ndarray:
    field = np.asarray(motion_field)
    if field.shape != (height, width, 2):
        raise ValueError(
            f"motion_field must have shape ({height}, {width}, 2), got {field.shape}"
        )
    if not np.issubdtype(field.dtype, np.floating) and not np.issubdtype(field.dtype, np.integer):
        raise ValueError("motion_field must be numeric")
    return np.asarray(field, dtype=np.float64)


def bilinear_sample(image: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """Bilinear-sample ``image`` at pixel coordinates ``(x, y)``.

    Coordinates outside ``[0, width - 1]`` x ``[0, height - 1]`` are
    clamped to that rectangle before interpolation, so out-of-bounds
    lookups read the nearest valid edge pixel.
    """
    height, width = image.shape[:2]
    x = np.clip(np.asarray(x, dtype=np.float64), 0.0, width - 1.0)
    y = np.clip(np.asarray(y, dtype=np.float64), 0.0, height - 1.0)

    x0 = np.floor(x).astype(np.intp)
    y0 = np.floor(y).astype(np.intp)
    x1 = np.minimum(x0 + 1, width - 1)
    y1 = np.minimum(y0 + 1, height - 1)

    wx = x - x0
    wy = y - y0
    if image.ndim == 3:
        wx = wx[..., np.newaxis]
        wy = wy[..., np.newaxis]

    top = image[y0, x0] * (1.0 - wx) + image[y0, x1] * wx
    bottom = image[y1, x0] * (1.0 - wx) + image[y1, x1] * wx
    return top * (1.0 - wy) + bottom * wy


def _restore_dtype(values: np.ndarray, dtype: np.dtype) -> np.ndarray:
    if np.issubdtype(dtype, np.floating):
        return values.astype(dtype, copy=False)
    info = np.iinfo(dtype)
    return np.clip(np.rint(values), info.min, info.max).astype(dtype)


def apply_multisample_exposure(
    image: np.ndarray,
    motion_field: np.ndarray,
    strength: float,
    samples: int,
) -> np.ndarray:
    """Average bilinear samples along an outgoing motion-field exposure.

    For sample ``i`` of ``N``, ``t_i = i / (N - 1)``. Each destination
    pixel ``p`` is sampled from

        p - (motion_field[p] * strength * t_i)

    after converting the normalized field to pixel displacement with
    ``(width - 1)`` and ``(height - 1)``.
    """
    image = _validate_image(image)
    strength = _validate_strength(strength)
    samples = _validate_samples(samples)
    height, width = image.shape[:2]
    field = _validate_motion_field(motion_field, height, width)

    working = np.asarray(image, dtype=np.float64)
    pixel_y, pixel_x = np.indices((height, width), dtype=np.float64)
    dx_pixels = field[..., 0] * (width - 1)
    dy_pixels = field[..., 1] * (height - 1)

    accumulated = np.zeros_like(working, dtype=np.float64)
    for index in range(samples):
        t = index / (samples - 1)
        source_x = pixel_x - dx_pixels * strength * t
        source_y = pixel_y - dy_pixels * strength * t
        accumulated += bilinear_sample(working, source_x, source_y)

    averaged = accumulated / samples
    return _restore_dtype(averaged, image.dtype)
