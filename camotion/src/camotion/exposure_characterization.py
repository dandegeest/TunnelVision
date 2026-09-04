"""01.11 research-only exposure-operator characterization.

Does not change CameraMotionPlan, default ``render()``, or
``apply_multisample_exposure``. Depth, masks, route preservation, and
destination protection are not used.

Existing production/research gather operators reused as controls:

    dest[p] = (1/N) Σ_i source[p - v[p] * strength * t_i]

with bilinear sampling. 01.8 uses N=16. 01.9 uses per-pixel N so
adjacent taps are at most one pixel apart. Both use equal weights.

Research-only candidates below are diagnostic. They are not a
replacement exposure primitive.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from camotion.experimental_composite import gaussian_blur
from camotion.exposure import (
    ADAPTIVE_MAX_STEP_PIXELS,
    ADAPTIVE_MIN_SAMPLES,
    _restore_dtype,
    _validate_image,
    _validate_max_step_pixels,
    _validate_motion_field,
    _validate_strength,
    apply_adaptive_multisample_exposure,
    apply_multisample_exposure,
    bilinear_sample,
    exposure_path_length_pixels,
)
from camotion.flow import forward_radial_motion_field

# Synthetic fixture. Strength is larger than Ghost Library 0.08 so
# primitives away from the FoE have a useful path length on 256².
SYNTHETIC_SIZE = 256
SYNTHETIC_VANISHING_POINT = (0.50, 0.50)
SYNTHETIC_FORWARD = 1.0
SYNTHETIC_STRENGTH = 0.40
SYNTHETIC_POINT_XY = (32, 32)

# Modest prefilter: one pixel sigma. Intended to suppress source
# frequencies finer than 01.9's 1 px tap spacing. Not a searched radius.
PREFILTER_SIGMA = 1.0

GHOST_LIBRARY_STRENGTH = 0.08
GHOST_LIBRARY_SAMPLES = 16
CROP_PAD_PIXELS = 128


def synthetic_motion_field(size: int = SYNTHETIC_SIZE) -> np.ndarray:
    return forward_radial_motion_field(
        size,
        size,
        SYNTHETIC_VANISHING_POINT,
        SYNTHETIC_FORWARD,
    )


def make_synthetic_fixture(size: int = SYNTHETIC_SIZE) -> tuple[np.ndarray, dict[str, Any]]:
    """Dark 8-bit RGB board with separated high-contrast primitives."""
    if size < 64:
        raise ValueError("synthetic fixture size must be >= 64")
    image = np.zeros((size, size, 3), dtype=np.uint8)
    primitives: dict[str, Any] = {
        "point": {"xy": (32, 32), "kind": "point"},
        "vertical_line": {"x": 32, "y0": 96, "y1": 160, "kind": "vline"},
        "horizontal_line": {"y": 32, "x0": 96, "x1": 176, "kind": "hline"},
        "outlined_square": {"x": 176, "y": 40, "size": 20, "kind": "outline"},
        "filled_square": {"x": 40, "y": 176, "size": 16, "kind": "filled"},
    }
    image[32, 32] = 255
    image[96:161, 32] = 255
    image[32, 96:177] = 255
    image[40, 176:196] = 255
    image[59, 176:196] = 255
    image[40:60, 176] = 255
    image[40:60, 195] = 255
    image[176:192, 40:56] = 255
    return image, primitives


def _triangle_weights(count: int) -> np.ndarray:
    """Discrete triangular shutter. Endpoints stay positive.

    ``w_i ∝ (c + 1) - |i - c|`` with ``c = (n-1)/2``, then normalized
    to sum to 1 so the operator remains a convex combination.
    """
    n = int(count)
    if n < 2:
        raise ValueError("need at least 2 samples for triangular weights")
    index = np.arange(n, dtype=np.float64)
    center = (n - 1) * 0.5
    weights = (center + 1.0) - np.abs(index - center)
    return weights / weights.sum()


def apply_weighted_adaptive_exposure(
    image: np.ndarray,
    motion_field: np.ndarray,
    strength: float,
    *,
    max_step_pixels: float = ADAPTIVE_MAX_STEP_PIXELS,
) -> np.ndarray:
    """01.9 trajectory and tap density, triangular temporal weights."""
    image = _validate_image(image)
    strength = _validate_strength(strength)
    max_step = _validate_max_step_pixels(max_step_pixels)
    height, width = image.shape[:2]
    field = _validate_motion_field(motion_field, height, width)

    working = np.asarray(image, dtype=np.float64)
    pixel_y, pixel_x = np.indices((height, width), dtype=np.float64)
    signed_dx = -field[..., 0] * (width - 1) * strength
    signed_dy = -field[..., 1] * (height - 1) * strength
    path_length = np.hypot(-signed_dx, -signed_dy)
    counts = np.ceil(path_length / max_step).astype(np.int32) + 1
    counts = np.maximum(counts, ADAPTIVE_MIN_SAMPLES)
    n_max = int(counts.max())
    denom = np.maximum(counts - 1, 1).astype(np.float64)

    accumulated = np.zeros_like(working, dtype=np.float64)
    weight_sum = np.zeros((height, width), dtype=np.float64)
    for index in range(n_max):
        active = counts > index
        t = np.where(active, index / denom, 0.0)
        center = denom * 0.5
        raw = (center + 1.0) - np.abs(index - center)
        weight = np.where(active, raw, 0.0)
        sampled = bilinear_sample(
            working,
            pixel_x + signed_dx * t,
            pixel_y + signed_dy * t,
        )
        if working.ndim == 3:
            accumulated += sampled * weight[..., np.newaxis]
        else:
            accumulated += sampled * weight
        weight_sum += weight

    if working.ndim == 3:
        averaged = accumulated / weight_sum[..., np.newaxis]
    else:
        averaged = accumulated / weight_sum
    return _restore_dtype(averaged, image.dtype)


def _splat_bilinear(
    dest: np.ndarray,
    x: np.ndarray,
    y: np.ndarray,
    values: np.ndarray,
) -> None:
    height, width = dest.shape[:2]
    x = np.clip(np.asarray(x, dtype=np.float64), 0.0, width - 1.0)
    y = np.clip(np.asarray(y, dtype=np.float64), 0.0, height - 1.0)
    x0 = np.floor(x).astype(np.intp)
    y0 = np.floor(y).astype(np.intp)
    x1 = np.minimum(x0 + 1, width - 1)
    y1 = np.minimum(y0 + 1, height - 1)
    wx = x - x0
    wy = y - y0
    if dest.ndim == 3:
        wx = wx[..., np.newaxis]
        wy = wy[..., np.newaxis]
        v00 = values * (1.0 - wx) * (1.0 - wy)
        v10 = values * wx * (1.0 - wy)
        v01 = values * (1.0 - wx) * wy
        v11 = values * wx * wy
        for channel in range(dest.shape[2]):
            np.add.at(dest[..., channel], (y0, x0), v00[..., channel])
            np.add.at(dest[..., channel], (y0, x1), v10[..., channel])
            np.add.at(dest[..., channel], (y1, x0), v01[..., channel])
            np.add.at(dest[..., channel], (y1, x1), v11[..., channel])
        return
    np.add.at(dest, (y0, x0), values * (1.0 - wx) * (1.0 - wy))
    np.add.at(dest, (y0, x1), values * wx * (1.0 - wy))
    np.add.at(dest, (y1, x0), values * (1.0 - wx) * wy)
    np.add.at(dest, (y1, x1), values * wx * wy)


def apply_forward_line_exposure(
    image: np.ndarray,
    motion_field: np.ndarray,
    strength: float,
    *,
    max_step_pixels: float = ADAPTIVE_MAX_STEP_PIXELS,
) -> np.ndarray:
    """Forward line-splat along each source pixel's motion segment.

    Mathematical operation: each source pixel ``q`` deposits its
    intensity uniformly along the segment ``q → q + v[q]*strength``
    (pixel space, outgoing smear direction), using bilinear scatter.
    Deposit count is ``max(2, ceil(L / max_step_pixels) + 1)`` so the
    line is spatially continuous at the 01.9 spacing.

    This is not inverse multisample accumulation. Gather uses
    ``v`` at the destination and averages transformed copies of the
    whole image. This operator uses ``v`` at the source and reconstructs
    a line kernel.
    """
    image = _validate_image(image)
    strength = _validate_strength(strength)
    max_step = _validate_max_step_pixels(max_step_pixels)
    height, width = image.shape[:2]
    field = _validate_motion_field(motion_field, height, width)

    working = np.asarray(image, dtype=np.float64)
    pixel_y, pixel_x = np.indices((height, width), dtype=np.float64)
    # Outgoing gather smears an impulse in +v. Forward deposit matches that.
    signed_dx = field[..., 0] * (width - 1) * strength
    signed_dy = field[..., 1] * (height - 1) * strength
    path_length = np.hypot(signed_dx, signed_dy)
    counts = np.ceil(path_length / max_step).astype(np.int32) + 1
    counts = np.maximum(counts, ADAPTIVE_MIN_SAMPLES)
    n_max = int(counts.max())
    denom = np.maximum(counts - 1, 1).astype(np.float64)

    dest = np.zeros_like(working, dtype=np.float64)
    for index in range(n_max):
        active = counts > index
        t = np.where(active, index / denom, 0.0)
        deposit = np.where(active, 1.0 / counts.astype(np.float64), 0.0)
        if working.ndim == 3:
            values = working * deposit[..., np.newaxis]
        else:
            values = working * deposit
        _splat_bilinear(
            dest,
            pixel_x + signed_dx * t,
            pixel_y + signed_dy * t,
            values,
        )
    return _restore_dtype(dest, image.dtype)


def _blur_channels(image: np.ndarray, sigma: float) -> np.ndarray:
    array = np.asarray(image, dtype=np.float64)
    if array.ndim == 2:
        return gaussian_blur(array, sigma)
    channels = [
        gaussian_blur(array[..., index], sigma) for index in range(array.shape[2])
    ]
    return np.stack(channels, axis=-1)


def apply_prefiltered_adaptive_exposure(
    image: np.ndarray,
    motion_field: np.ndarray,
    strength: float,
    *,
    sigma: float = PREFILTER_SIGMA,
    max_step_pixels: float = ADAPTIVE_MAX_STEP_PIXELS,
) -> np.ndarray:
    """Modest Gaussian prefilter, then 01.9 dense equal-weight gather."""
    image = _validate_image(image)
    blurred = _blur_channels(image, sigma)
    if not np.issubdtype(image.dtype, np.floating):
        blurred = _restore_dtype(blurred, image.dtype)
    else:
        blurred = blurred.astype(image.dtype, copy=False)
    return apply_adaptive_multisample_exposure(
        blurred,
        motion_field,
        strength,
        max_step_pixels=max_step_pixels,
    )


def luminance(image: np.ndarray) -> np.ndarray:
    array = np.asarray(image, dtype=np.float64)
    if array.ndim == 2:
        return array
    return 0.2126 * array[..., 0] + 0.7152 * array[..., 1] + 0.0722 * array[..., 2]


def energy_stats(image: np.ndarray) -> dict[str, float]:
    values = np.asarray(image, dtype=np.float64)
    luma = luminance(values)
    return {
        "mean": float(luma.mean()),
        "max": float(luma.max()),
        "sum": float(luma.sum()),
        "nonzero_fraction": float((luma > 0.5).mean()),
    }


def sample_profile_along_segment(
    image: np.ndarray,
    start_xy: tuple[float, float],
    end_xy: tuple[float, float],
    *,
    step_pixels: float = 1.0,
) -> tuple[np.ndarray, np.ndarray]:
    """Luminance samples from ``start`` to ``end`` at ``step_pixels`` spacing."""
    luma = luminance(image)
    x0, y0 = float(start_xy[0]), float(start_xy[1])
    x1, y1 = float(end_xy[0]), float(end_xy[1])
    length = float(np.hypot(x1 - x0, y1 - y0))
    count = max(2, int(np.ceil(length / step_pixels)) + 1)
    t = np.linspace(0.0, 1.0, count, dtype=np.float64)
    xs = x0 + (x1 - x0) * t
    ys = y0 + (y1 - y0) * t
    samples = bilinear_sample(luma, xs, ys)
    distance = t * length
    return distance, np.asarray(samples, dtype=np.float64)


def local_maxima(profile: np.ndarray, *, relative_floor: float = 0.10) -> np.ndarray:
    values = np.asarray(profile, dtype=np.float64)
    if values.size < 3:
        return np.array([], dtype=np.intp)
    peak = float(values.max())
    if peak <= 0.0:
        return np.array([], dtype=np.intp)
    floor = relative_floor * peak
    left = values[1:-1] > values[:-2]
    right = values[1:-1] >= values[2:]
    strong = values[1:-1] >= floor
    return np.nonzero(left & right & strong)[0] + 1


def _trapz(values: np.ndarray, path: np.ndarray) -> float:
    if path.size < 2:
        return 0.0
    if hasattr(np, "trapezoid"):
        return float(np.trapezoid(values, path))
    return float(np.trapz(values, path))


def profile_metrics(
    distance: np.ndarray,
    profile: np.ndarray,
    *,
    active_floor: float = 0.05,
) -> dict[str, float]:
    values = np.asarray(profile, dtype=np.float64)
    path = np.asarray(distance, dtype=np.float64)
    peak = float(values.max()) if values.size else 0.0
    active = values >= (active_floor * peak) if peak > 0.0 else np.zeros_like(values, dtype=bool)
    active_vals = values[active]
    peaks = local_maxima(values)
    n = int(values.size)
    source = values[: max(1, n // 10)].mean() if n else 0.0
    far = values[max(0, n - max(1, n // 10)) :].mean() if n else 0.0
    if active_vals.size:
        peak_to_valley = float(
            (active_vals.max() - active_vals.min()) / max(active_vals.max(), 1e-12)
        )
    else:
        peak_to_valley = 0.0
    return {
        "path_length_pixels": float(path[-1]) if path.size else 0.0,
        "sample_count": float(n),
        "peak_count": float(peaks.size),
        "peak_to_valley": peak_to_valley,
        "active_fraction": float(active.mean()) if n else 0.0,
        "integrated_intensity": _trapz(values, path),
        "source_end_mean": float(source),
        "far_end_mean": float(far),
        "source_over_far": float(source / far) if far > 1e-12 else float("inf"),
        "max": peak,
        "mean": float(values.mean()) if n else 0.0,
    }


def point_smear_segment(
    field: np.ndarray,
    point_xy: tuple[int, int],
    strength: float,
) -> tuple[tuple[float, float], tuple[float, float], float]:
    """Source point and outgoing smear endpoint in pixel coordinates."""
    x, y = int(point_xy[0]), int(point_xy[1])
    height, width = field.shape[:2]
    dx = float(field[y, x, 0]) * (width - 1) * float(strength)
    dy = float(field[y, x, 1]) * (height - 1) * float(strength)
    start = (float(x), float(y))
    end = (float(x) + dx, float(y) + dy)
    return start, end, float(np.hypot(dx, dy))


def padded_crop_box(
    box: dict[str, int],
    width: int,
    height: int,
    pad: int = CROP_PAD_PIXELS,
) -> dict[str, int]:
    x0 = max(int(box["x"]) - pad, 0)
    y0 = max(int(box["y"]) - pad, 0)
    x1 = min(int(box["x"]) + int(box["width"]) + pad, width)
    y1 = min(int(box["y"]) + int(box["height"]) + pad, height)
    return {"x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0}


def extract_box(image: np.ndarray, box: dict[str, int]) -> np.ndarray:
    x = int(box["x"])
    y = int(box["y"])
    return np.asarray(image)[y : y + int(box["height"]), x : x + int(box["width"])]


OPERATORS: dict[str, Any] = {
    "01_fixed_16_box": {
        "label": "01.8 fixed-16 box",
        "kind": "control",
    },
    "02_dense_box": {
        "label": "01.9 dense box",
        "kind": "control",
    },
    "03_weighted_dense": {
        "label": "triangular weighted dense",
        "kind": "candidate",
    },
    "04_forward_line": {
        "label": "forward line splat",
        "kind": "candidate",
    },
    "05_prefilter_dense": {
        "label": "prefilter σ=1 + dense box",
        "kind": "candidate",
    },
}


def apply_named_operator(
    name: str,
    image: np.ndarray,
    field: np.ndarray,
    strength: float,
    *,
    samples: int = GHOST_LIBRARY_SAMPLES,
) -> np.ndarray:
    if name == "01_fixed_16_box":
        return apply_multisample_exposure(image, field, strength, samples)
    if name == "02_dense_box":
        return apply_adaptive_multisample_exposure(image, field, strength)
    if name == "03_weighted_dense":
        return apply_weighted_adaptive_exposure(image, field, strength)
    if name == "04_forward_line":
        return apply_forward_line_exposure(image, field, strength)
    if name == "05_prefilter_dense":
        return apply_prefiltered_adaptive_exposure(image, field, strength)
    raise KeyError(name)
