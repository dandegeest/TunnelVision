"""01.9 path-length-adaptive exposure.

Does not change CameraMotionPlan, default ``render()``, or 01.8 sampling.
"""

from __future__ import annotations

import numpy as np
import pytest

from camotion.experimental_composite import render_depth_banded
from camotion.exposure import (
    ADAPTIVE_MAX_STEP_PIXELS,
    adaptive_sample_counts,
    apply_adaptive_multisample_exposure,
    apply_multisample_exposure,
    bilinear_sample,
    exposure_path_length_pixels,
)
from camotion.flow import forward_radial_motion_field
from camotion.plan import CameraMotionPlan
from camotion.render import render


def _uniform_field(height: int, width: int, dx: float, dy: float) -> np.ndarray:
    field = np.zeros((height, width, 2), dtype=np.float64)
    field[..., 0] = dx
    field[..., 1] = dy
    return field


def _plan(
    *,
    strength: float = 1.0,
    samples: int = 4,
    protect: bool = True,
) -> CameraMotionPlan:
    return CameraMotionPlan.model_validate(
        {
            "version": 1,
            "camera": {"vanishing_point": [0.5, 0.5], "forward": 1.0},
            "exposure": {"strength": strength, "samples": samples},
            "destination": {
                "point": [0.5, 0.5],
                "protect": protect,
                "bbox": [0.4, 0.4, 0.6, 0.6],
            },
        }
    )


def test_zero_motion_field_returns_original() -> None:
    image = np.arange(12, dtype=np.float64).reshape(3, 4)
    field = np.zeros((3, 4, 2), dtype=np.float64)
    for strength in (0.0, 0.5, 1.0):
        result = apply_adaptive_multisample_exposure(image, field, strength=strength)
        assert np.allclose(result, image)


def test_near_zero_motion_remains_stable() -> None:
    image = np.linspace(0.0, 1.0, 20, dtype=np.float64).reshape(4, 5)
    field = _uniform_field(4, 5, 1e-12, -1e-12)
    result = apply_adaptive_multisample_exposure(image, field, strength=1.0)
    assert np.allclose(result, image, atol=1e-9)


def test_strength_zero_returns_original() -> None:
    image = np.arange(20, dtype=np.float64).reshape(4, 5)
    field = _uniform_field(4, 5, 0.4, -0.2)
    result = apply_adaptive_multisample_exposure(image, field, strength=0.0)
    assert np.allclose(result, image)


def test_longer_paths_use_more_samples_than_shorter_paths() -> None:
    field = np.zeros((3, 8, 2), dtype=np.float64)
    field[:, :4, 0] = 0.10
    field[:, 4:, 0] = 0.50
    counts = adaptive_sample_counts(field, strength=1.0, height=3, width=8)
    short = int(counts[1, 1])
    long = int(counts[1, 6])
    assert long > short
    short_len = float(exposure_path_length_pixels(field, 1.0, 3, 8)[1, 1])
    long_len = float(exposure_path_length_pixels(field, 1.0, 3, 8)[1, 6])
    assert long_len > short_len
    assert short == max(2, int(np.ceil(short_len / ADAPTIVE_MAX_STEP_PIXELS)) + 1)
    assert long == max(2, int(np.ceil(long_len / ADAPTIVE_MAX_STEP_PIXELS)) + 1)


def test_maximum_spatial_sample_spacing_is_respected() -> None:
    field = _uniform_field(5, 11, 0.40, 0.15)
    strength = 1.0
    max_step = ADAPTIVE_MAX_STEP_PIXELS
    path = exposure_path_length_pixels(field, strength, 5, 11)
    counts = adaptive_sample_counts(field, strength, 5, 11, max_step_pixels=max_step)
    spacing = path / np.maximum(counts - 1, 1)
    assert np.all(spacing <= max_step + 1e-12)
    assert int(counts.min()) >= 2


def test_known_path_length_matches_formula() -> None:
    width = 11
    field = _uniform_field(1, width, 0.50, 0.0)
    strength = 1.0
    path = float(exposure_path_length_pixels(field, strength, 1, width)[0, 0])
    assert path == pytest.approx(0.50 * (width - 1))
    counts = adaptive_sample_counts(field, strength, 1, width)
    expected = max(2, int(np.ceil(path / ADAPTIVE_MAX_STEP_PIXELS)) + 1)
    assert int(counts[0, 0]) == expected
    assert path / (expected - 1) <= ADAPTIVE_MAX_STEP_PIXELS + 1e-12


def test_uniform_field_matches_fixed_sample_exposure() -> None:
    image = np.array([[0.0, 0.0, 8.0, 0.0, 0.0, 1.0, 2.0]], dtype=np.float64)
    field = _uniform_field(1, 7, 0.25, 0.0)
    n = int(adaptive_sample_counts(field, 1.0, 1, 7)[0, 0])
    assert 2 <= n <= 64
    adaptive = apply_adaptive_multisample_exposure(image, field, strength=1.0)
    fixed = apply_multisample_exposure(image, field, strength=1.0, samples=n)
    assert np.allclose(adaptive, fixed)


def test_adaptive_output_is_deterministic() -> None:
    image = np.linspace(0.0, 1.0, 25, dtype=np.float64).reshape(5, 5)
    field = forward_radial_motion_field(5, 5, (0.5, 0.5), 1.0)
    first = apply_adaptive_multisample_exposure(image, field, strength=0.5)
    second = apply_adaptive_multisample_exposure(image, field, strength=0.5)
    assert np.array_equal(first, second)
    assert first.shape == image.shape
    assert first.dtype == image.dtype


def test_adaptive_uses_bilinear_endpoints() -> None:
    image = np.array([[0.0, 1.0, 2.0, 3.0, 4.0]], dtype=np.float64)
    field = _uniform_field(1, 5, 0.25, 0.0)
    n = int(adaptive_sample_counts(field, 1.0, 1, 5)[0, 0])
    result = apply_adaptive_multisample_exposure(image, field, strength=1.0)
    pixel_x = np.arange(5, dtype=np.float64)
    dx_pixels = 0.25 * 4
    acc = np.zeros_like(image)
    for index in range(n):
        t = index / (n - 1)
        acc += bilinear_sample(image, pixel_x - dx_pixels * t, np.zeros(5))
    assert np.allclose(result, acc / n)


def test_destination_protection_unchanged_with_adaptive_banded() -> None:
    image = np.arange(21 * 21, dtype=np.float64).reshape(21, 21)
    plan = _plan()
    ones = np.ones((21, 21), dtype=np.float64)
    result = render_depth_banded(
        image, plan, ones, route_preservation=True, adaptive_exposure=True
    )
    assert result[10, 10] == pytest.approx(image[10, 10])
    assert result[0, 0] != pytest.approx(image[0, 0])


def test_adaptive_flag_off_matches_existing_banded_path() -> None:
    image = np.arange(21 * 21, dtype=np.float64).reshape(21, 21)
    plan = _plan()
    weight = np.linspace(0.0, 1.0, 21 * 21, dtype=np.float64).reshape(21, 21)
    baseline = render_depth_banded(image, plan, weight, route_preservation=True)
    omitted = render_depth_banded(image, plan, weight, route_preservation=True)
    explicit_off = render_depth_banded(
        image, plan, weight, route_preservation=True, adaptive_exposure=False
    )
    assert np.array_equal(baseline, omitted)
    assert np.array_equal(baseline, explicit_off)


def test_adaptive_flag_changes_unprotected_pixels() -> None:
    image = np.arange(21 * 21, dtype=np.float64).reshape(21, 21)
    plan = _plan(strength=1.0, samples=4)
    ones = np.ones((21, 21), dtype=np.float64)
    sparse = render_depth_banded(image, plan, ones, route_preservation=True)
    dense = render_depth_banded(
        image, plan, ones, route_preservation=True, adaptive_exposure=True
    )
    assert dense.shape == sparse.shape
    assert dense.dtype == sparse.dtype
    assert not np.array_equal(sparse, dense)


def test_default_render_unchanged_by_adaptive_exposure() -> None:
    image = np.arange(21 * 21, dtype=np.float64).reshape(21, 21)
    plan = _plan()
    weight = np.linspace(0.0, 1.0, 21 * 21, dtype=np.float64).reshape(21, 21)
    assert np.array_equal(render(image, plan), render(image, plan, near_weight=None))
    experimental = render_depth_banded(
        image, plan, weight, route_preservation=True, adaptive_exposure=True
    )
    current = render(image, plan, near_weight=weight)
    assert not np.array_equal(current, experimental)


def test_integer_dtype_is_clipped_not_wrapped() -> None:
    image = np.array([[250, 255], [0, 5]], dtype=np.uint8)
    field = _uniform_field(2, 2, 0.0, 0.0)
    result = apply_adaptive_multisample_exposure(image, field, strength=1.0)
    assert result.dtype == np.uint8
    assert result.tolist() == [[250, 255], [0, 5]]


def test_invalid_max_step_pixels() -> None:
    image = np.zeros((3, 3), dtype=np.float64)
    field = _uniform_field(3, 3, 0.1, 0.0)
    with pytest.raises(ValueError, match="max_step_pixels"):
        apply_adaptive_multisample_exposure(image, field, 0.5, max_step_pixels=0.0)
    with pytest.raises(ValueError, match="max_step_pixels"):
        adaptive_sample_counts(field, 1.0, 3, 3, max_step_pixels=-1.0)
