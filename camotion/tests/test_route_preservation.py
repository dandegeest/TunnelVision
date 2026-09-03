"""01.8 experimental route-preservation corridor.

Does not change CameraMotionPlan or default ``render()``.
"""

from __future__ import annotations

import numpy as np
import pytest

from camotion.experimental_composite import (
    ROUTE_CORRIDOR_BOTTOM_WIDTH,
    ROUTE_CORRIDOR_FEATHER,
    ROUTE_CORRIDOR_TOP_WIDTH,
    ROUTE_PRESERVATION_STRENGTH,
    render_depth_banded,
    route_preservation_mask,
)
from camotion.plan import CameraMotionPlan
from camotion.render import render


def _plan(
    *,
    vanishing_point: tuple[float, float] = (0.5, 0.5),
    destination_point: tuple[float, float] = (0.5, 0.6),
    protect: bool = True,
    strength: float = 1.0,
    samples: int = 4,
    destination: dict | None | object = ...,
) -> CameraMotionPlan:
    data: dict = {
        "version": 1,
        "camera": {"vanishing_point": list(vanishing_point), "forward": 1.0},
        "exposure": {"strength": strength, "samples": samples},
    }
    if destination is not ...:
        if destination is not None:
            data["destination"] = destination
    else:
        data["destination"] = {
            "point": list(destination_point),
            "protect": protect,
            "bbox": [0.4, 0.4, 0.6, 0.6],
        }
    return CameraMotionPlan.model_validate(data)


def _gradient(height: int = 21, width: int = 21) -> np.ndarray:
    return np.arange(height * width, dtype=np.float64).reshape(height, width)


def test_route_preservation_off_matches_existing_banded_path() -> None:
    image = _gradient()
    plan = _plan()
    weight = np.linspace(0.0, 1.0, 21 * 21, dtype=np.float64).reshape(21, 21)
    baseline = render_depth_banded(image, plan, weight)
    omitted = render_depth_banded(image, plan, weight)
    explicit_off = render_depth_banded(image, plan, weight, route_preservation=False)
    assert np.array_equal(baseline, omitted)
    assert np.array_equal(baseline, explicit_off)


def test_zero_preservation_strength_matches_existing_behavior() -> None:
    image = _gradient()
    plan = _plan()
    weight = np.ones((21, 21), dtype=np.float64)
    baseline = render_depth_banded(image, plan, weight)
    zero = render_depth_banded(
        image, plan, weight, route_preservation=True, route_preservation_strength=0.0
    )
    assert np.array_equal(baseline, zero)


def test_route_mask_is_deterministic_and_normalized() -> None:
    first = route_preservation_mask(32, 24, (0.5, 0.4), (0.5, 0.55))
    second = route_preservation_mask(32, 24, (0.5, 0.4), (0.5, 0.55))
    assert np.array_equal(first, second)
    assert first.shape == (24, 32)
    assert float(first.min()) >= 0.0
    assert float(first.max()) <= 1.0
    assert np.all(np.isfinite(first))


def test_corridor_preserves_center_more_than_periphery() -> None:
    mask = route_preservation_mask(
        41,
        41,
        (0.5, 0.4),
        (0.5, 0.55),
        top_width=0.14,
        bottom_width=0.48,
        feather=0.10,
    )
    center = float(mask[32, 20])
    left = float(mask[32, 2])
    right = float(mask[32, 38])
    assert center > left
    assert center > right
    assert center > 0.5
    assert left < 0.15
    assert right < 0.15


def test_corridor_feather_is_soft_not_binary() -> None:
    mask = route_preservation_mask(
        41,
        41,
        (0.5, 0.4),
        (0.5, 0.55),
        top_width=0.14,
        bottom_width=0.48,
        feather=0.10,
    )
    unique = np.unique(np.round(mask, 5))
    assert unique.size > 2
    assert np.any((mask > 0.05) & (mask < 0.95))


def test_enabled_route_preservation_changes_unprotected_pixels() -> None:
    image = _gradient()
    plan = _plan()
    weight = np.ones((21, 21), dtype=np.float64)
    baseline = render_depth_banded(image, plan, weight)
    preserved = render_depth_banded(image, plan, weight, route_preservation=True)
    assert preserved.shape == baseline.shape
    assert preserved.dtype == baseline.dtype
    assert not np.array_equal(baseline, preserved)


def test_destination_protection_still_restores_protected_pixels() -> None:
    image = _gradient()
    plan = _plan()
    ones = np.ones((21, 21), dtype=np.float64)
    result = render_depth_banded(image, plan, ones, route_preservation=True)
    assert result[10, 10] == pytest.approx(image[10, 10])
    assert result[0, 0] != pytest.approx(image[0, 0])


def test_default_render_unchanged_when_route_preservation_exists() -> None:
    image = _gradient()
    plan = _plan()
    weight = np.linspace(0.0, 1.0, 21 * 21, dtype=np.float64).reshape(21, 21)
    assert np.array_equal(render(image, plan), render(image, plan, near_weight=None))
    zeros = np.zeros((21, 21), dtype=np.float64)
    assert np.array_equal(render(image, plan, near_weight=zeros), image)
    experimental = render_depth_banded(image, plan, weight, route_preservation=True)
    current = render(image, plan, near_weight=weight)
    assert not np.array_equal(current, experimental)


def test_experimental_constants_are_the_01_8_values() -> None:
    assert ROUTE_PRESERVATION_STRENGTH == pytest.approx(0.70)
    assert ROUTE_CORRIDOR_TOP_WIDTH == pytest.approx(0.14)
    assert ROUTE_CORRIDOR_BOTTOM_WIDTH == pytest.approx(0.48)
    assert ROUTE_CORRIDOR_FEATHER == pytest.approx(0.10)
