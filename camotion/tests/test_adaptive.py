"""Spatial depth / destination / VP motion weights on the radial field."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from camotion.adaptive import (
    DEST_CORE_MOTION,
    DEST_POINT_RADIUS,
    DEPTH_FAR_MOTION,
    DEPTH_NEAR_MOTION,
    VP_CORE_MOTION,
    combined_motion_weight,
    depth_motion_weight,
    destination_protection_weight,
    vanishing_point_protection_weight,
)
from camotion.depth import normalize_relative_depth, resize_near_weight
from camotion.estimate_depth import fit_inference_size
from camotion.exposure import apply_multisample_exposure
from camotion.flow import forward_radial_motion_field
from camotion.plan import CameraMotionPlan
from camotion.render import render


def _plan(
    *,
    vanishing_point: tuple[float, float] = (0.5, 0.5),
    destination: dict | None = None,
    strength: float = 0.08,
    samples: int = 16,
    forward: float = 1.0,
) -> CameraMotionPlan:
    data: dict = {
        "version": 1,
        "camera": {"vanishing_point": list(vanishing_point), "forward": forward},
        "exposure": {"strength": strength, "samples": samples},
    }
    if destination is not None:
        data["destination"] = destination
    return CameraMotionPlan.model_validate(data)


def _gradient(height: int = 41, width: int = 41) -> np.ndarray:
    return np.arange(height * width, dtype=np.float64).reshape(height, width)


def test_normalize_relative_depth_is_far_zero_near_one() -> None:
    raw = np.array([[1.0, 5.0], [9.0, 13.0]], dtype=np.float64)
    near = normalize_relative_depth(raw)
    assert near[0, 0] == pytest.approx(0.0)
    assert near[1, 1] == pytest.approx(1.0)
    assert near[0, 1] == pytest.approx(4.0 / 12.0)
    inverted = normalize_relative_depth(raw, invert=True)
    assert inverted[0, 0] == pytest.approx(1.0)
    assert inverted[1, 1] == pytest.approx(0.0)


def test_constant_depth_is_far() -> None:
    assert np.allclose(normalize_relative_depth(np.full((3, 3), 4.0)), 0.0)


def test_near_regions_receive_stronger_weight_than_far() -> None:
    depth = np.zeros((9, 9), dtype=np.float64)
    depth[0, 0] = 1.0
    depth[4, 4] = 0.5
    weight = depth_motion_weight(depth, 9, 9)
    assert weight[0, 0] == pytest.approx(DEPTH_NEAR_MOTION)
    assert weight[8, 8] == pytest.approx(DEPTH_FAR_MOTION)
    assert weight[0, 0] > weight[4, 4] > weight[8, 8]
    assert DEPTH_FAR_MOTION > 0.0


def test_missing_depth_is_uniform_full_weight() -> None:
    assert np.allclose(depth_motion_weight(None, 5, 6), 1.0)


def test_destination_bbox_reduces_motion_and_feathers() -> None:
    dest = _plan(
        destination={"point": [0.5, 0.5], "protect": True, "bbox": [0.4, 0.4, 0.6, 0.6]}
    ).destination
    weight = destination_protection_weight(41, 41, dest)
    assert weight[20, 20] == pytest.approx(DEST_CORE_MOTION)
    assert weight[0, 0] == pytest.approx(1.0)
    assert weight[20, 20] < weight[20, 25] < weight[0, 0]
    adjacent = np.abs(np.diff(weight, axis=1))
    assert float(adjacent.max()) < 0.35


def test_point_only_destination_uses_soft_radial_protection() -> None:
    dest = _plan(destination={"point": [0.2, 0.8], "protect": True}).destination
    weight = destination_protection_weight(51, 51, dest)
    ys, xs = np.indices(weight.shape)
    cx, cy = 0.2 * 50, 0.8 * 50
    dist = np.hypot(xs - cx, ys - cy)
    core = weight[dist <= DEST_POINT_RADIUS * 50 * 0.4]
    far = weight[dist >= 0.35 * 50]
    assert float(core.mean()) == pytest.approx(DEST_CORE_MOTION, abs=0.05)
    assert float(far.mean()) == pytest.approx(1.0, abs=0.05)
    assert dest is not None and dest.bbox is None


def test_vp_protection_is_weaker_than_destination() -> None:
    dest = _plan(
        destination={"point": [0.5, 0.5], "protect": True, "bbox": [0.35, 0.35, 0.65, 0.65]}
    ).destination
    dest_w = destination_protection_weight(41, 41, dest)
    vp_w = vanishing_point_protection_weight(41, 41, (0.5, 0.5))
    assert dest_w[20, 20] < vp_w[20, 20]
    assert vp_w[20, 20] == pytest.approx(VP_CORE_MOTION)
    assert vp_w[0, 0] == pytest.approx(1.0)
    assert VP_CORE_MOTION > DEST_CORE_MOTION


def test_combined_masks_are_smooth_and_bounded() -> None:
    plan = _plan(
        vanishing_point=(0.45, 0.55),
        destination={"point": [0.6, 0.4], "protect": True, "bbox": [0.5, 0.3, 0.7, 0.5]},
    )
    depth = np.linspace(0.0, 1.0, 41 * 41, dtype=np.float64).reshape(41, 41)
    weights = combined_motion_weight(41, 41, plan, depth)
    combined = weights["combined"]
    assert combined.min() >= 0.0
    assert combined.max() <= 1.0
    assert float(np.abs(np.diff(combined, axis=0)).max()) < 0.35
    assert float(np.abs(np.diff(combined, axis=1)).max()) < 0.35
    assert combined[20, 20] < weights["depth"][20, 20]


def test_pace_still_controls_base_exposure() -> None:
    image = _gradient(25, 25)
    near = np.full((25, 25), 0.7, dtype=np.float64)
    dest = {"point": [0.85, 0.15], "protect": True, "bbox": [0.75, 0.05, 0.95, 0.25]}
    slow = _plan(strength=0.025, destination=dest)
    fast = _plan(strength=0.060, destination=dest)
    slow_out = render(image, slow, near_weight=near, adaptive=True)
    fast_out = render(image, fast, near_weight=near, adaptive=True)
    mid = (18, 6)
    assert abs(fast_out[mid] - image[mid]) > abs(slow_out[mid] - image[mid])
    assert slow.exposure.samples == 16
    assert fast.exposure.samples == 16


def test_unavailable_depth_falls_back_without_blocking() -> None:
    image = _gradient(21, 21)
    plan = _plan(destination={"point": [0.5, 0.5], "protect": True})
    fallback = render(image, plan, adaptive=True, near_weight=None)
    v1 = render(image, plan, adaptive=False)
    assert fallback.shape == image.shape
    assert np.all(np.isfinite(fallback))
    assert not np.array_equal(fallback, v1)


def test_adaptive_output_keeps_canonical_dimensions() -> None:
    image = np.zeros((18, 64, 3), dtype=np.uint8)
    image[:, :, 0] = 40
    image[:, 50:, 1] = 200
    depth = resize_near_weight(np.linspace(0.0, 1.0, 8 * 16).reshape(8, 16), 64, 18)
    assert depth.shape == (18, 64)
    result = render(
        image,
        _plan(destination={"point": [0.8, 0.5], "protect": True}),
        near_weight=depth,
        adaptive=True,
    )
    assert result.shape == image.shape
    assert result.dtype == image.dtype


def test_inference_working_size_downscales_2k_but_not_1k() -> None:
    assert fit_inference_size(2048, 1152) == (1024, 576)
    assert fit_inference_size(1024, 576) == (1024, 576)


def test_debug_maps_write_expected_artifacts(tmp_path: Path) -> None:
    image = _gradient(16, 16)
    plan = _plan(destination={"point": [0.4, 0.6], "protect": True})
    render(image, plan, adaptive=True, debug_dir=tmp_path)
    for name in ("depth.png", "destination-protection.png", "vp-protection.png", "motion-weight.png"):
        path = tmp_path / name
        assert path.is_file()
        with Image.open(path) as preview:
            assert preview.size == (16, 16)
            assert preview.mode == "L"


def test_adaptive_false_matches_frozen_v1() -> None:
    image = _gradient(21, 21)
    plan = _plan(destination={"point": [0.5, 0.5], "protect": True, "bbox": [0.4, 0.4, 0.6, 0.6]})
    field = forward_radial_motion_field(21, 21, plan.camera.vanishing_point, plan.camera.forward)
    exposed = apply_multisample_exposure(image, field, plan.exposure.strength, plan.exposure.samples)
    from camotion.masks import apply_protection_blend, destination_protection_mask

    expected = apply_protection_blend(
        image,
        exposed,
        destination_protection_mask(21, 21, plan.destination),
    )
    assert np.array_equal(render(image, plan, adaptive=False), expected)
