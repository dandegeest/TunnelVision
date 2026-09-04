"""01.10 diagnostic compositor ablation.

Does not change CameraMotionPlan, default ``render()``, or 01.8 output.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from camotion.compositor_ablation import (
    MATERIAL_ACTIVE_THRESHOLD,
    collect_depth_banded_ablation,
    extract_crop,
    overlap_stats,
    reconstruct_from_weights,
    weight_sum_error,
)
from camotion.experimental_composite import (
    effective_compositor_weights,
    render_depth_banded,
)
from camotion.masks import destination_protection_mask
from camotion.plan import CameraMotionPlan
from camotion.render import render

TUNING = Path(__file__).resolve().parents[1] / "tuning"
COMMITTED_01_8 = TUNING / "01.8-route-preserved-result.png"
SOURCE = TUNING / "01.jpeg"
PLAN = TUNING / "01.4-plan.json"
DEPTH = TUNING / "01-depth.png"


def _plan(
    *,
    vanishing_point: tuple[float, float] = (0.5, 0.5),
    forward: float = 1.0,
    strength: float = 1.0,
    samples: int = 4,
    destination: dict | None = ...,
) -> CameraMotionPlan:
    data: dict = {
        "version": 1,
        "camera": {
            "vanishing_point": list(vanishing_point),
            "forward": forward,
        },
        "exposure": {"strength": strength, "samples": samples},
    }
    if destination is not ...:
        if destination is not None:
            data["destination"] = destination
    else:
        data["destination"] = {
            "point": [0.5, 0.5],
            "protect": True,
            "bbox": [0.4, 0.4, 0.6, 0.6],
        }
    return CameraMotionPlan.model_validate(data)


def _gradient(height: int = 21, width: int = 21, dtype=np.float64) -> np.ndarray:
    return np.arange(height * width, dtype=dtype).reshape(height, width)


def test_effective_weights_match_compositor_and_sum_to_one() -> None:
    strong = np.array([[0.0, 0.25], [0.8, 1.0]], dtype=np.float64)
    medium = np.array([[1.0, 0.5], [0.2, 0.0]], dtype=np.float64)
    w_s, w_m, w_p = effective_compositor_weights(strong, medium)
    assert np.allclose(w_s, strong)
    assert np.allclose(w_m, medium * (1.0 - strong))
    assert np.allclose(w_p, (1.0 - medium) * (1.0 - strong))
    summed = weight_sum_error(w_s, w_m, w_p)
    assert summed["sums_to_one"]
    assert summed["max_abs_error_from_one"] <= 1e-12


def test_reconstruction_matches_pre_route_composite() -> None:
    image = _gradient()
    plan = _plan(destination=None)
    weight = np.linspace(0.0, 1.0, 21 * 21, dtype=np.float64).reshape(21, 21)
    states = collect_depth_banded_ablation(
        image, plan, weight, route_preservation=False
    )
    reconstructed = reconstruct_from_weights(
        states["00_source"],
        states["02_medium_exposure"],
        states["01_strong_exposure"],
        states["09_effective_pristine"],
        states["08_effective_medium"],
        states["07_effective_strong"],
    )
    assert np.allclose(reconstructed, states["pre_route_float"], atol=1e-12)
    assert np.array_equal(states["16_full_depth_banded"], states["17_route_preserved"])
    assert np.array_equal(states["16_full_depth_banded"], states["18_final_01_8"])


def test_ablation_final_matches_render_depth_banded() -> None:
    image = _gradient()
    plan = _plan()
    weight = np.linspace(0.0, 1.0, 21 * 21, dtype=np.float64).reshape(21, 21)
    states = collect_depth_banded_ablation(
        image, plan, weight, route_preservation=True
    )
    expected = render_depth_banded(
        image,
        plan,
        weight,
        route_preservation=True,
        adaptive_exposure=False,
    )
    assert np.array_equal(states["18_final_01_8"], expected)
    omitted = render_depth_banded(image, plan, weight, route_preservation=True)
    assert np.array_equal(states["18_final_01_8"], omitted)


def test_ablation_does_not_change_normal_render() -> None:
    image = _gradient()
    plan = _plan()
    weight = np.linspace(0.0, 1.0, 21 * 21, dtype=np.float64).reshape(21, 21)
    before = render(image, plan, near_weight=weight)
    collect_depth_banded_ablation(image, plan, weight, route_preservation=True)
    after = render(image, plan, near_weight=weight)
    assert np.array_equal(before, after)
    assert np.array_equal(render(image, plan), render(image, plan, near_weight=None))


def test_ablation_is_deterministic() -> None:
    image = _gradient()
    plan = _plan()
    weight = np.linspace(0.0, 1.0, 21 * 21, dtype=np.float64).reshape(21, 21)
    first = collect_depth_banded_ablation(image, plan, weight, route_preservation=True)
    second = collect_depth_banded_ablation(image, plan, weight, route_preservation=True)
    for key in (
        "01_strong_exposure",
        "02_medium_exposure",
        "05_strong_mask_after_motion",
        "07_effective_strong",
        "16_full_depth_banded",
        "17_route_preserved",
        "18_final_01_8",
    ):
        assert np.array_equal(first[key], second[key])


def test_destination_protection_unchanged() -> None:
    image = _gradient()
    plan = _plan()
    ones = np.ones((21, 21), dtype=np.float64)
    states = collect_depth_banded_ablation(
        image, plan, ones, route_preservation=True
    )
    expected = render_depth_banded(image, plan, ones, route_preservation=True)
    assert np.array_equal(states["18_final_01_8"], expected)
    assert states["18_final_01_8"][10, 10] == pytest.approx(image[10, 10])
    protection = destination_protection_mask(
        image.shape[1], image.shape[0], plan.destination
    )
    assert np.allclose(states["protection_mask"], protection)
    assert states["18_final_01_8"][0, 0] != pytest.approx(image[0, 0])


def test_existing_diagnostics_remain_post_route_when_enabled() -> None:
    image = _gradient()
    plan = _plan()
    weight = np.linspace(0.0, 1.0, 21 * 21, dtype=np.float64).reshape(21, 21)
    _output, diagnostics = render_depth_banded(
        image,
        plan,
        weight,
        return_diagnostics=True,
        route_preservation=True,
    )
    states = collect_depth_banded_ablation(
        image, plan, weight, route_preservation=True
    )
    assert np.allclose(diagnostics["strong_mask_before"], states["04_strong_mask_before_motion"])
    assert np.allclose(diagnostics["strong_mask_after"], states["05_strong_mask_after_route"])
    assert np.allclose(diagnostics["medium_mask"], states["06_medium_mask_after_route"])
    assert not np.allclose(
        diagnostics["strong_mask_after"], states["05_strong_mask_after_motion"]
    )


def test_overlap_threshold_is_diagnostic_only() -> None:
    w_s = np.array([[0.20, 0.05], [0.40, 0.00]], dtype=np.float64)
    w_m = np.array([[0.11, 0.50], [0.09, 0.30]], dtype=np.float64)
    w_p = np.array([[0.69, 0.45], [0.51, 0.70]], dtype=np.float64)
    stats = overlap_stats(w_s, w_m, w_p, threshold=MATERIAL_ACTIVE_THRESHOLD)
    assert stats["threshold"] == pytest.approx(0.10)
    assert stats["strong_and_medium_fraction"] == pytest.approx(0.25)
    assert stats["all_three_fraction"] == pytest.approx(0.25)


def test_extract_crop_is_unaltered_slice() -> None:
    image = np.arange(24, dtype=np.uint8).reshape(4, 6)
    crop = extract_crop(image, {"x": 2, "y": 1, "width": 3, "height": 2})
    assert np.array_equal(crop, image[1:3, 2:5])


@pytest.mark.skipif(
    not (SOURCE.is_file() and PLAN.is_file() and DEPTH.is_file() and COMMITTED_01_8.is_file()),
    reason="01.8 Ghost Library fixtures are not present",
)
def test_fixture_final_is_byte_identical_to_committed_01_8() -> None:
    from camotion.__main__ import _load_image
    from camotion.depth import load_near_weight
    from camotion.plan import load_plan

    plan = load_plan(PLAN)
    image = _load_image(SOURCE)
    near_weight = load_near_weight(DEPTH)
    states = collect_depth_banded_ablation(
        image, plan, near_weight, route_preservation=True
    )
    committed = np.array(Image.open(COMMITTED_01_8))
    assert np.array_equal(states["18_final_01_8"], committed)
