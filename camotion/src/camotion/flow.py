"""Compute the normalized forward radial motion field for a camera translation."""

from __future__ import annotations

import numpy as np


def _validate_dimensions(width: int, height: int) -> tuple[int, int]:
    """Validate image dimensions and keep the degenerate single-pixel case explicit."""
    if isinstance(width, bool) or isinstance(height, bool):
        raise ValueError("width and height must be integers >= 1")
    if not isinstance(width, int) or not isinstance(height, int):
        raise ValueError("width and height must be integers >= 1")
    if width < 1 or height < 1:
        raise ValueError("width and height must be >= 1")
    return width, height


def _validate_vanishing_point(vanishing_point: tuple[float, float] | list[float] | np.ndarray) -> tuple[float, float]:
    """Ensure the focus of expansion remains in normalized image space."""
    if not isinstance(vanishing_point, (tuple, list, np.ndarray)) or len(vanishing_point) != 2:
        raise ValueError("vanishing_point must be a 2-item [x, y] pair")

    x = float(vanishing_point[0])
    y = float(vanishing_point[1])
    if not np.isfinite(x) or not np.isfinite(y):
        raise ValueError("vanishing_point must be finite")
    if not (0.0 <= x <= 1.0 and 0.0 <= y <= 1.0):
        raise ValueError("vanishing_point must be in [0, 1] for both axes")
    return (x, y)


def _validate_forward(forward: float) -> float:
    """Validate the scalar forward translation magnitude."""
    if isinstance(forward, bool) or not isinstance(forward, (int, float, np.integer, np.floating)):
        raise ValueError("forward must be a finite number in [0, 1]")

    value = float(forward)
    if not np.isfinite(value):
        raise ValueError("forward must be a finite number in [0, 1]")
    if not 0.0 <= value <= 1.0:
        raise ValueError("forward must be in [0, 1]")
    return value


def forward_radial_motion_field(
    width: int,
    height: int,
    vanishing_point: tuple[float, float] | list[float] | np.ndarray,
    forward: float,
) -> np.ndarray:
    """Return the normalized forward radial motion field for a camera translation."""
    width, height = _validate_dimensions(width, height)
    focus_x, focus_y = _validate_vanishing_point(vanishing_point)
    forward = _validate_forward(forward)

    # Single-pixel dimensions collapse to a single normalized coordinate value, 0.0,
    # which avoids division-by-zero and keeps the geometry deterministic.
    x_coords = np.array([0.0], dtype=np.float64) if width == 1 else np.linspace(0.0, 1.0, width, dtype=np.float64)
    y_coords = np.array([0.0], dtype=np.float64) if height == 1 else np.linspace(0.0, 1.0, height, dtype=np.float64)

    xs, ys = np.meshgrid(x_coords, y_coords, indexing="xy")
    dx = forward * (xs - focus_x)
    dy = forward * (ys - focus_y)

    field = np.empty((height, width, 2), dtype=np.float64)
    field[..., 0] = dx
    field[..., 1] = dy
    return field


def generate_forward_radial_motion_field(
    width: int,
    height: int,
    vanishing_point: tuple[float, float] | list[float] | np.ndarray,
    forward: float,
) -> np.ndarray:
    """Alias for forward_radial_motion_field."""
    return forward_radial_motion_field(width, height, vanishing_point, forward)


__all__ = ["forward_radial_motion_field", "generate_forward_radial_motion_field"]
