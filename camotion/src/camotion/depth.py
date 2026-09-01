"""Optional near-weight scaling of an existing forward radial motion field.

Camotion's internal contract is ``1.0`` = near = full motion and
``0.0`` = far = no motion. A supplied grayscale image is interpreted
directly in that convention (black → 0, white → 1). This module does
not estimate depth, invert maps, or change radial-field geometry.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

_LUMA = (0.299, 0.587, 0.114)


def near_weight_from_image(image: np.ndarray) -> np.ndarray:
    """Convert a depth/near-weight image to an ``H x W`` float64 map in ``[0, 1]``.

    Integer arrays are divided by the dtype maximum (``uint8`` white
    ``255`` → ``1.0``). Floating-point arrays are treated as already
    normalized and clipped to ``[0, 1]``. Multichannel images use
    Rec. 601 luma of the first three channels; alpha is ignored.
    """
    array = np.asarray(image)
    if array.dtype == np.bool_ or not (
        np.issubdtype(array.dtype, np.floating) or np.issubdtype(array.dtype, np.integer)
    ):
        raise ValueError("near-weight image must be a floating-point or integer array")
    if array.ndim == 3:
        if array.shape[2] == 1:
            array = array[..., 0]
        elif array.shape[2] in (3, 4):
            rgb = np.asarray(array[..., :3], dtype=np.float64)
            if np.issubdtype(array[..., :3].dtype, np.integer):
                rgb = rgb / float(np.iinfo(array.dtype).max)
            luma = _LUMA[0] * rgb[..., 0] + _LUMA[1] * rgb[..., 1] + _LUMA[2] * rgb[..., 2]
            if np.any(~np.isfinite(luma)):
                raise ValueError("near-weight values must be finite")
            return np.clip(luma, 0.0, 1.0)
        else:
            raise ValueError(
                "near-weight image must have shape H x W or H x W x C with C in (1, 3, 4)"
            )
    if array.ndim != 2:
        raise ValueError("near-weight image must have shape H x W or H x W x C")
    if array.shape[0] < 1 or array.shape[1] < 1:
        raise ValueError("near-weight height and width must be >= 1")

    working = np.asarray(array, dtype=np.float64)
    if np.issubdtype(array.dtype, np.integer):
        working = working / float(np.iinfo(array.dtype).max)
    if np.any(~np.isfinite(working)):
        raise ValueError("near-weight values must be finite")
    return np.clip(working, 0.0, 1.0)


def load_near_weight(path: Path | str) -> np.ndarray:
    """Load a depth/near-weight image with Pillow and normalize to ``[0, 1]``."""
    with Image.open(path) as im:
        im.load()
        gray = im.convert("L")
        return near_weight_from_image(np.array(gray))


def apply_near_weight(motion_field: np.ndarray, near_weight: np.ndarray) -> np.ndarray:
    """Return ``motion_field[y, x] * near_weight[y, x]`` as a new ``H x W x 2`` field."""
    field = np.asarray(motion_field, dtype=np.float64)
    if field.ndim != 3 or field.shape[2] != 2:
        raise ValueError(
            f"motion_field must have shape (H, W, 2), got {field.shape}"
        )
    if field.shape[0] < 1 or field.shape[1] < 1:
        raise ValueError("motion_field height and width must be >= 1")

    weight = np.asarray(near_weight, dtype=np.float64)
    height, width = field.shape[:2]
    if weight.shape != (height, width):
        raise ValueError(
            f"near_weight shape {weight.shape} does not match motion field {(height, width)}"
        )
    if np.any(~np.isfinite(weight)):
        raise ValueError("near_weight values must be finite")

    weight = np.clip(weight, 0.0, 1.0)
    return field * weight[..., np.newaxis]
