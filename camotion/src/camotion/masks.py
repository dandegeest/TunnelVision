"""Feathered destination-protection masks and pristine/exposed blending.

Mask values are in ``[0, 1]``:

    1.0  use the pristine canonical image
    0.0  use the motion-exposed image

The default destination square (±0.10 normalized, clipped to ``[0, 1]``)
is a rendering behavior. This module does not mutate CameraMotionPlan.
Feather width is 25% of the smaller bbox side and is internal to v1.
"""

from __future__ import annotations

import numpy as np

from camotion.plan import Destination

_DEFAULT_HALF_EXTENT = 0.10
_FEATHER_FRACTION = 0.25


def _validate_dimensions(width: int, height: int) -> tuple[int, int]:
    if isinstance(width, bool) or isinstance(height, bool):
        raise ValueError("width and height must be integers >= 1")
    if not isinstance(width, int) or not isinstance(height, int):
        raise ValueError("width and height must be integers >= 1")
    if width < 1 or height < 1:
        raise ValueError("width and height must be >= 1")
    return width, height


def default_destination_bbox(
    point: tuple[float, float],
) -> tuple[float, float, float, float]:
    """Normalized default square around ``point``, clipped to ``[0, 1]``."""
    x, y = float(point[0]), float(point[1])
    left = min(max(x - _DEFAULT_HALF_EXTENT, 0.0), 1.0)
    top = min(max(y - _DEFAULT_HALF_EXTENT, 0.0), 1.0)
    right = min(max(x + _DEFAULT_HALF_EXTENT, 0.0), 1.0)
    bottom = min(max(y + _DEFAULT_HALF_EXTENT, 0.0), 1.0)
    if not (left < right and top < bottom):
        raise ValueError("default destination bbox is degenerate after clipping")
    return (left, top, right, bottom)


def effective_destination_bbox(
    destination: Destination,
) -> tuple[float, float, float, float]:
    """Bbox used for protection; does not write back onto ``destination``."""
    if destination.bbox is not None:
        return (
            float(destination.bbox[0]),
            float(destination.bbox[1]),
            float(destination.bbox[2]),
            float(destination.bbox[3]),
        )
    return default_destination_bbox(destination.point)


def feather_width(bbox: tuple[float, float, float, float]) -> float:
    """Outward feather width: 25% of the smaller normalized bbox side."""
    left, top, right, bottom = bbox
    smaller = min(right - left, bottom - top)
    width = _FEATHER_FRACTION * smaller
    if width <= 0.0:
        raise ValueError("feather width is zero; destination bbox is degenerate")
    return width


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


def _distance_outside_bbox(
    xs: np.ndarray,
    ys: np.ndarray,
    bbox: tuple[float, float, float, float],
) -> np.ndarray:
    left, top, right, bottom = bbox
    dx = np.maximum(np.maximum(left - xs, xs - right), 0.0)
    dy = np.maximum(np.maximum(top - ys, ys - bottom), 0.0)
    return np.hypot(dx, dy)


def destination_protection_mask(
    width: int,
    height: int,
    destination: Destination | None,
) -> np.ndarray:
    """Return an ``H x W`` protection mask in ``[0, 1]``.

    ``destination is None`` or ``protect=False`` yields all zeros (no
    pristine restoration). The default square is used only when
    ``protect`` is true and ``bbox`` is omitted.
    """
    width, height = _validate_dimensions(width, height)
    if destination is None or not destination.protect:
        return np.zeros((height, width), dtype=np.float64)

    bbox = effective_destination_bbox(destination)
    width_feather = feather_width(bbox)
    xs, ys = _normalized_grid(width, height)
    distance = _distance_outside_bbox(xs, ys, bbox)
    mask = np.clip(1.0 - distance / width_feather, 0.0, 1.0)
    return mask


def _validate_image(image: np.ndarray, *, name: str) -> np.ndarray:
    array = np.asarray(image)
    if array.dtype == np.bool_ or not (
        np.issubdtype(array.dtype, np.floating) or np.issubdtype(array.dtype, np.integer)
    ):
        raise ValueError(f"{name} must be a floating-point or integer array")
    if array.ndim not in (2, 3):
        raise ValueError(f"{name} must have shape H x W or H x W x C")
    if array.shape[0] < 1 or array.shape[1] < 1:
        raise ValueError(f"{name} height and width must be >= 1")
    if array.ndim == 3 and array.shape[2] < 1:
        raise ValueError(f"{name} channel count must be >= 1")
    return array


def _restore_dtype(values: np.ndarray, dtype: np.dtype) -> np.ndarray:
    if np.issubdtype(dtype, np.floating):
        return values.astype(dtype, copy=False)
    info = np.iinfo(dtype)
    return np.clip(np.rint(values), info.min, info.max).astype(dtype)


def apply_protection_blend(
    pristine: np.ndarray,
    exposed: np.ndarray,
    mask: np.ndarray,
) -> np.ndarray:
    """Blend ``output = exposed * (1 - mask) + pristine * mask``."""
    pristine = _validate_image(pristine, name="pristine")
    exposed = _validate_image(exposed, name="exposed")
    if pristine.shape != exposed.shape:
        raise ValueError(
            f"pristine shape {pristine.shape} does not match exposed shape {exposed.shape}"
        )
    height, width = pristine.shape[:2]
    mask_array = np.asarray(mask, dtype=np.float64)
    if mask_array.shape != (height, width):
        raise ValueError(
            f"mask shape {mask_array.shape} does not match image {(height, width)}"
        )
    if np.any(~np.isfinite(mask_array)):
        raise ValueError("mask values must be finite")

    mask_array = np.clip(mask_array, 0.0, 1.0)
    if pristine.ndim == 3:
        mask_array = mask_array[..., np.newaxis]

    blended = (
        np.asarray(exposed, dtype=np.float64) * (1.0 - mask_array)
        + np.asarray(pristine, dtype=np.float64) * mask_array
    )
    return _restore_dtype(blended, pristine.dtype)
