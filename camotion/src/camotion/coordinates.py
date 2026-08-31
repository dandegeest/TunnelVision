"""Normalized CameraMotionPlan coordinates → pixel coordinates.

(0, 0) is top-left; (1, 1) is bottom-right.

    pixel_x = normalized_x * (width - 1)
    pixel_y = normalized_y * (height - 1)
"""

from __future__ import annotations


def normalized_to_pixel(
    x: float,
    y: float,
    width: int,
    height: int,
) -> tuple[float, float]:
    """Convert a normalized point to pixel coordinates."""
    if width < 1 or height < 1:
        raise ValueError("width and height must be >= 1")
    return (x * (width - 1), y * (height - 1))


def normalized_bbox_to_pixel(
    bbox: tuple[float, float, float, float],
    width: int,
    height: int,
) -> tuple[float, float, float, float]:
    """Convert a normalized [left, top, right, bottom] box to pixel coordinates."""
    left, top, right, bottom = bbox
    pixel_left, pixel_top = normalized_to_pixel(left, top, width, height)
    pixel_right, pixel_bottom = normalized_to_pixel(right, bottom, width, height)
    return (pixel_left, pixel_top, pixel_right, pixel_bottom)
