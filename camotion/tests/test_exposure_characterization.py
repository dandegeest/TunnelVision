"""01.11 research-only exposure characterization.

Does not change CameraMotionPlan, default ``render()``, 01.8 sampling,
or 01.9 adaptive gather.
"""

from __future__ import annotations

import numpy as np
import pytest

from camotion.exposure import (
    apply_adaptive_multisample_exposure,
    apply_multisample_exposure,
)
from camotion.exposure_characterization import (
    PREFILTER_SIGMA,
    SYNTHETIC_STRENGTH,
    apply_forward_line_exposure,
    apply_named_operator,
    apply_prefiltered_adaptive_exposure,
    apply_weighted_adaptive_exposure,
    energy_stats,
    make_synthetic_fixture,
    profile_metrics,
    synthetic_motion_field,
)
from camotion.flow import forward_radial_motion_field
from camotion.plan import CameraMotionPlan
from camotion.render import render


def _uniform_field(height: int, width: int, dx: float, dy: float) -> np.ndarray:
    field = np.zeros((height, width, 2), dtype=np.float64)
    field[..., 0] = dx
    field[..., 1] = dy
    return field


def _plan() -> CameraMotionPlan:
    return CameraMotionPlan.model_validate(
        {
            "version": 1,
            "camera": {"vanishing_point": [0.5, 0.5], "forward": 1.0},
            "exposure": {"strength": 0.5, "samples": 4},
            "destination": {
                "point": [0.5, 0.5],
                "protect": True,
                "bbox": [0.4, 0.4, 0.6, 0.6],
            },
        }
    )


def test_synthetic_fixture_is_deterministic() -> None:
    first, meta_a = make_synthetic_fixture()
    second, meta_b = make_synthetic_fixture()
    assert np.array_equal(first, second)
    assert first.shape == (256, 256, 3)
    assert first.dtype == np.uint8
    assert first[32, 32, 0] == 255
    assert first[128, 128, 0] == 0
    assert meta_a["point"]["xy"] == meta_b["point"]["xy"]


def test_fixed_16_matches_production_exposure() -> None:
    image, _meta = make_synthetic_fixture()
    field = synthetic_motion_field()
    named = apply_named_operator("01_fixed_16_box", image, field, SYNTHETIC_STRENGTH, samples=16)
    direct = apply_multisample_exposure(image, field, SYNTHETIC_STRENGTH, 16)
    assert np.array_equal(named, direct)


def test_dense_box_matches_existing_adaptive() -> None:
    image, _meta = make_synthetic_fixture()
    field = synthetic_motion_field()
    named = apply_named_operator("02_dense_box", image, field, SYNTHETIC_STRENGTH)
    direct = apply_adaptive_multisample_exposure(image, field, SYNTHETIC_STRENGTH)
    assert np.array_equal(named, direct)


def test_characterization_does_not_change_default_render() -> None:
    image = np.arange(21 * 21, dtype=np.float64).reshape(21, 21)
    plan = _plan()
    before = render(image, plan)
    field = forward_radial_motion_field(21, 21, (0.5, 0.5), 1.0)
    apply_weighted_adaptive_exposure(image, field, 0.5)
    apply_forward_line_exposure(image, field, 0.5)
    apply_prefiltered_adaptive_exposure(image, field, 0.5)
    after = render(image, plan)
    assert np.array_equal(before, after)
    assert np.array_equal(
        apply_multisample_exposure(image, field, 0.5, 4),
        apply_multisample_exposure(image, field, 0.5, 4),
    )


def test_zero_motion_weighted_and_line_match_source() -> None:
    image = np.arange(16, dtype=np.float64).reshape(4, 4)
    field = _uniform_field(4, 4, 0.0, 0.0)
    assert np.allclose(apply_weighted_adaptive_exposure(image, field, 1.0), image)
    assert np.allclose(apply_forward_line_exposure(image, field, 1.0), image)


def test_zero_motion_prefilter_is_blur_not_identity() -> None:
    image = np.zeros((9, 9), dtype=np.float64)
    image[4, 4] = 1.0
    field = _uniform_field(9, 9, 0.0, 0.0)
    result = apply_prefiltered_adaptive_exposure(image, field, 1.0, sigma=PREFILTER_SIGMA)
    assert result[4, 4] < 1.0
    assert result[4, 5] > 0.0
    assert result.sum() == pytest.approx(1.0, rel=1e-6)


def test_candidates_are_deterministic() -> None:
    image, _meta = make_synthetic_fixture()
    field = synthetic_motion_field()
    for name in ("03_weighted_dense", "04_forward_line", "05_prefilter_dense"):
        first = apply_named_operator(name, image, field, SYNTHETIC_STRENGTH)
        second = apply_named_operator(name, image, field, SYNTHETIC_STRENGTH)
        assert np.array_equal(first, second)
        assert first.shape == image.shape
        assert first.dtype == image.dtype


def test_weighted_is_convex_combination_on_uniform() -> None:
    image = np.full((8, 8), 40.0, dtype=np.float64)
    field = _uniform_field(8, 8, 0.2, 0.1)
    result = apply_weighted_adaptive_exposure(image, field, 0.5)
    assert np.allclose(result, image)


def test_profile_metrics_count_separated_peaks() -> None:
    distance = np.arange(21, dtype=np.float64)
    profile = np.zeros(21, dtype=np.float64)
    profile[2] = 1.0
    profile[10] = 1.0
    profile[18] = 1.0
    metrics = profile_metrics(distance, profile)
    assert metrics["peak_count"] == pytest.approx(3.0)
    assert metrics["path_length_pixels"] == pytest.approx(20.0)


def test_energy_stats_on_fixture() -> None:
    image, _meta = make_synthetic_fixture()
    stats = energy_stats(image)
    assert stats["max"] == pytest.approx(255.0)
    assert stats["mean"] > 0.0
    assert stats["nonzero_fraction"] < 0.05
