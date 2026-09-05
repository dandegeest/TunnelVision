"""01.12 research-only baked-exposure operating window.

Does not change CameraMotionPlan, default ``render()``, or 01.8 gather.
"""

from __future__ import annotations

import numpy as np
import pytest

from camotion.exposure import apply_multisample_exposure
from camotion.flow import forward_radial_motion_field
from camotion.operating_window import (
    PREFILTER_SIGMA,
    SAMPLES,
    STRENGTHS,
    apply_operating_window_exposure,
    apply_sigma1_source,
    path_length_summary,
    path_lengths_for_strength,
)
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


def test_strength_matrix_is_exact() -> None:
    assert STRENGTHS == (0.02, 0.04, 0.06, 0.08)
    assert SAMPLES == 16
    assert PREFILTER_SIGMA == 1.0


def test_pristine_matches_01_8_gather() -> None:
    image = np.arange(32, dtype=np.float64).reshape(4, 8)
    field = _uniform_field(4, 8, 0.2, -0.1)
    named = apply_operating_window_exposure(image, field, 0.08, "pristine")
    direct = apply_multisample_exposure(image, field, 0.08, 16)
    assert np.array_equal(named, direct)


def test_operating_window_does_not_change_default_render() -> None:
    image = np.arange(21 * 21, dtype=np.float64).reshape(21, 21)
    plan = _plan()
    before = render(image, plan)
    field = forward_radial_motion_field(21, 21, (0.5, 0.5), 1.0)
    apply_operating_window_exposure(image, field, 0.08, "pristine")
    apply_operating_window_exposure(image, field, 0.08, "sigma1")
    after = render(image, plan)
    assert np.array_equal(before, after)


def test_sigma1_is_not_identity_at_zero_motion() -> None:
    image = np.zeros((9, 9), dtype=np.float64)
    image[4, 4] = 1.0
    field = _uniform_field(9, 9, 0.0, 0.0)
    result = apply_operating_window_exposure(image, field, 1.0, "sigma1")
    assert result[4, 4] < 1.0
    assert result[4, 5] > 0.0
    assert result.sum() == pytest.approx(1.0, rel=1e-6)


def test_conditions_are_deterministic() -> None:
    image = np.arange(48, dtype=np.uint8).reshape(4, 4, 3)
    field = _uniform_field(4, 4, 0.15, 0.05)
    for bandwidth in ("pristine", "sigma1"):
        first = apply_operating_window_exposure(image, field, 0.04, bandwidth)
        second = apply_operating_window_exposure(image, field, 0.04, bandwidth)
        assert np.array_equal(first, second)
        assert first.dtype == image.dtype
        assert first.shape == image.shape


def test_path_length_scales_with_strength() -> None:
    field = forward_radial_motion_field(32, 48, (0.5, 0.56), 1.0)
    half = path_lengths_for_strength(field, 0.04)
    full = path_lengths_for_strength(field, 0.08)
    assert np.allclose(half, 0.5 * full)
    summary = path_length_summary(full)
    assert summary["max"] >= summary["p95"] >= summary["p90"] >= summary["median"]
    assert summary["mean"] > 0.0


def test_sigma1_source_uses_documented_sigma() -> None:
    image = np.zeros((9, 9), dtype=np.float64)
    image[4, 4] = 1.0
    blurred = apply_sigma1_source(image)
    assert blurred[4, 4] < 1.0
    assert PREFILTER_SIGMA == 1.0
