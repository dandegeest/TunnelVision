"""Tests for optional near-weight / depth scaling."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from camotion.depth import apply_near_weight, load_near_weight, near_weight_from_image
from camotion.flow import forward_radial_motion_field
from camotion.plan import CameraMotionPlan
from camotion.render import render


def _plan(*, destination: dict | None = None) -> CameraMotionPlan:
    data: dict = {
        "version": 1,
        "camera": {"vanishing_point": [0.5, 0.5], "forward": 1.0},
        "exposure": {"strength": 1.0, "samples": 4},
    }
    if destination is not None:
        data["destination"] = destination
    return CameraMotionPlan.model_validate(data)


def test_apply_near_weight_scales_vectors_per_pixel() -> None:
    field = np.zeros((2, 3, 2), dtype=np.float64)
    field[0, 0] = [1.0, -2.0]
    field[0, 1] = [4.0, 6.0]
    field[0, 2] = [8.0, 8.0]
    field[1, 0] = [0.5, 0.5]
    weight = np.array(
        [
            [1.0, 0.5, 0.0],
            [0.25, 1.0, 0.0],
        ],
        dtype=np.float64,
    )
    original = field.copy()
    scaled = apply_near_weight(field, weight)
    assert np.array_equal(field, original)
    assert np.allclose(scaled[0, 0], [1.0, -2.0])
    assert np.allclose(scaled[0, 1], [2.0, 3.0])
    assert np.allclose(scaled[0, 2], [0.0, 0.0])
    assert np.allclose(scaled[1, 0], [0.125, 0.125])


def test_apply_near_weight_rejects_dimension_mismatch() -> None:
    field = forward_radial_motion_field(5, 4, (0.5, 0.5), 1.0)
    with pytest.raises(ValueError, match="near_weight shape"):
        apply_near_weight(field, np.ones((4, 4), dtype=np.float64))


def test_grayscale_normalization_black_white_midpoint() -> None:
    black = np.zeros((3, 4), dtype=np.uint8)
    white = np.full((3, 4), 255, dtype=np.uint8)
    mid = np.full((3, 4), 128, dtype=np.uint8)
    assert np.allclose(near_weight_from_image(black), 0.0)
    assert np.allclose(near_weight_from_image(white), 1.0)
    assert np.allclose(near_weight_from_image(mid), 128.0 / 255.0)


def test_load_near_weight_normalizes_pillow_grayscale(tmp_path: Path) -> None:
    path = tmp_path / "depth.png"
    Image.new("L", (5, 3), color=128).save(path)
    loaded = load_near_weight(path)
    assert loaded.shape == (3, 5)
    assert loaded.dtype == np.float64
    assert np.allclose(loaded, 128.0 / 255.0)


def test_render_without_near_weight_matches_explicit_none() -> None:
    image = np.arange(21 * 21, dtype=np.float64).reshape(21, 21)
    plan = _plan()
    omitted = render(image, plan)
    explicit = render(image, plan, near_weight=None)
    assert np.array_equal(omitted, explicit)


def test_all_ones_near_weight_matches_no_depth() -> None:
    image = np.arange(21 * 21, dtype=np.float64).reshape(21, 21)
    plan = _plan()
    ones = np.ones((21, 21), dtype=np.float64)
    assert np.array_equal(render(image, plan, near_weight=ones), render(image, plan))


def test_all_zero_near_weight_returns_pristine() -> None:
    image = np.arange(21 * 21, dtype=np.float64).reshape(21, 21)
    plan = _plan(
        destination={
            "point": [0.5, 0.5],
            "protect": True,
            "bbox": [0.4, 0.4, 0.6, 0.6],
        }
    )
    zeros = np.zeros((21, 21), dtype=np.float64)
    result = render(image, plan, near_weight=zeros)
    assert np.array_equal(result, image)


def test_render_rejects_near_weight_dimension_mismatch() -> None:
    image = np.zeros((8, 8), dtype=np.float64)
    plan = _plan()
    with pytest.raises(ValueError, match="does not match image"):
        render(image, plan, near_weight=np.ones((8, 7), dtype=np.float64))
    with pytest.raises(ValueError, match="does not match image"):
        render(image, plan, near_weight=np.ones((7, 8), dtype=np.float64))
