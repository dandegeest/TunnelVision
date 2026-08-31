"""Tests for destination-protection masks and blending."""

from __future__ import annotations

import numpy as np
import pytest

from camotion.masks import (
    apply_protection_blend,
    default_destination_bbox,
    destination_protection_mask,
    effective_destination_bbox,
    feather_width,
)
from camotion.plan import Destination


def _destination(
    point: tuple[float, float] = (0.5, 0.5),
    *,
    bbox: tuple[float, float, float, float] | None = None,
    protect: bool = True,
) -> Destination:
    data: dict = {"point": list(point), "protect": protect}
    if bbox is not None:
        data["bbox"] = list(bbox)
    return Destination.model_validate(data)


def test_explicit_bbox_interior_is_one() -> None:
    dest = _destination(bbox=(0.25, 0.25, 0.75, 0.75))
    mask = destination_protection_mask(21, 21, dest)
    assert mask[10, 10] == pytest.approx(1.0)
    assert mask[8, 8] == pytest.approx(1.0)


def test_far_outside_region_is_zero() -> None:
    dest = _destination(bbox=(0.4, 0.4, 0.6, 0.6))
    mask = destination_protection_mask(21, 21, dest)
    assert mask[0, 0] == pytest.approx(0.0)
    assert mask[20, 20] == pytest.approx(0.0)
    assert mask[0, 10] == pytest.approx(0.0)


def test_feather_has_intermediate_values() -> None:
    dest = _destination(bbox=(0.3, 0.3, 0.7, 0.7))
    mask = destination_protection_mask(21, 21, dest)
    # x=0.2 is 0.1 outside left=0.3; feather = 0.25 * 0.4 = 0.10
    assert 0.0 < mask[10, 4] < 1.0


def test_feather_decreases_with_distance() -> None:
    dest = _destination(bbox=(0.3, 0.3, 0.7, 0.7))
    mask = destination_protection_mask(21, 21, dest)
    edge = mask[10, 6]
    nearer = mask[10, 5]
    farther = mask[10, 4]
    assert edge == pytest.approx(1.0)
    assert 1.0 > nearer > farther > 0.0


def test_corners_use_euclidean_distance_not_square_edge() -> None:
    dest = _destination(bbox=(0.3, 0.3, 0.7, 0.7))
    mask = destination_protection_mask(41, 41, dest)
    fw = feather_width((0.3, 0.3, 0.7, 0.7))
    xs = np.linspace(0.0, 1.0, 41)
    axis_x = 0.3 - 0.5 * fw
    diag_x = 0.3 - 0.5 * fw
    diag_y = 0.3 - 0.5 * fw
    axis_col = int(np.argmin(np.abs(xs - axis_x)))
    axis_row = int(np.argmin(np.abs(xs - 0.5)))
    diag_col = int(np.argmin(np.abs(xs - diag_x)))
    diag_row = int(np.argmin(np.abs(xs - diag_y)))
    assert mask[diag_row, diag_col] < mask[axis_row, axis_col]


def test_default_bbox_is_documented_square() -> None:
    dest = _destination(point=(0.5, 0.5))
    assert dest.bbox is None
    bbox = effective_destination_bbox(dest)
    assert bbox == pytest.approx((0.4, 0.4, 0.6, 0.6))
    assert dest.bbox is None
    mask = destination_protection_mask(11, 11, dest)
    assert mask[5, 5] == pytest.approx(1.0)
    assert mask[4, 4] == pytest.approx(1.0)
    assert mask[6, 6] == pytest.approx(1.0)


def test_default_bbox_clips_near_image_edge() -> None:
    dest = _destination(point=(0.05, 0.5))
    bbox = default_destination_bbox(dest.point)
    assert bbox == pytest.approx((0.0, 0.4, 0.15, 0.6))
    mask = destination_protection_mask(21, 21, dest)
    assert np.all(mask >= 0.0) and np.all(mask <= 1.0)
    assert mask[10, 1] == pytest.approx(1.0)


def test_protect_false_is_all_zero() -> None:
    dest = _destination(bbox=(0.2, 0.2, 0.8, 0.8), protect=False)
    mask = destination_protection_mask(15, 15, dest)
    assert mask.shape == (15, 15)
    assert np.all(mask == 0.0)


def test_missing_destination_is_all_zero() -> None:
    mask = destination_protection_mask(8, 8, None)
    assert np.all(mask == 0.0)


def test_resolution_independence() -> None:
    dest = _destination(bbox=(0.25, 0.25, 0.75, 0.75))
    small = destination_protection_mask(11, 11, dest)
    large = destination_protection_mask(21, 21, dest)
    assert small[5, 5] == pytest.approx(large[10, 10])
    assert small[0, 0] == pytest.approx(large[0, 0])
    assert small[5, 0] == pytest.approx(large[10, 0])


def test_blend_mask_zero_is_exposed() -> None:
    pristine = np.zeros((3, 3), dtype=np.float64)
    exposed = np.ones((3, 3), dtype=np.float64)
    mask = np.zeros((3, 3), dtype=np.float64)
    assert np.allclose(apply_protection_blend(pristine, exposed, mask), exposed)


def test_blend_mask_one_is_pristine() -> None:
    pristine = np.zeros((3, 3), dtype=np.float64)
    exposed = np.ones((3, 3), dtype=np.float64)
    mask = np.ones((3, 3), dtype=np.float64)
    assert np.allclose(apply_protection_blend(pristine, exposed, mask), pristine)


def test_blend_mask_half_is_midpoint() -> None:
    pristine = np.zeros((2, 2), dtype=np.float64)
    exposed = np.full((2, 2), 10.0, dtype=np.float64)
    mask = np.full((2, 2), 0.5, dtype=np.float64)
    result = apply_protection_blend(pristine, exposed, mask)
    assert np.allclose(result, 5.0)


def test_grayscale_blend_shape() -> None:
    pristine = np.arange(9, dtype=np.float64).reshape(3, 3)
    exposed = pristine + 1.0
    mask = np.full((3, 3), 0.25, dtype=np.float64)
    result = apply_protection_blend(pristine, exposed, mask)
    assert result.shape == (3, 3)
    assert np.allclose(result, exposed * 0.75 + pristine * 0.25)


def test_multichannel_blend_broadcasts_mask() -> None:
    pristine = np.zeros((3, 3, 3), dtype=np.float64)
    exposed = np.ones((3, 3, 3), dtype=np.float64)
    mask = np.full((3, 3), 0.25, dtype=np.float64)
    result = apply_protection_blend(pristine, exposed, mask)
    assert result.shape == (3, 3, 3)
    assert np.allclose(result, 0.75)


def test_integer_dtype_no_wrap() -> None:
    pristine = np.array([[250, 255], [0, 5]], dtype=np.uint8)
    exposed = np.array([[10, 20], [30, 40]], dtype=np.uint8)
    mask = np.array([[1.0, 1.0], [0.0, 0.5]], dtype=np.float64)
    result = apply_protection_blend(pristine, exposed, mask)
    assert result.dtype == np.uint8
    assert result.tolist() == [[250, 255], [30, 22]]


def test_float_dtype_preserved() -> None:
    pristine = np.array([[0.2, 0.4], [0.6, 0.8]], dtype=np.float32)
    exposed = np.array([[1.0, 1.0], [1.0, 1.0]], dtype=np.float32)
    mask = np.zeros((2, 2), dtype=np.float64)
    result = apply_protection_blend(pristine, exposed, mask)
    assert result.dtype == np.float32
    assert np.allclose(result, exposed)


def test_shape_mismatch_errors() -> None:
    pristine = np.zeros((4, 5), dtype=np.float64)
    exposed = np.zeros((3, 5), dtype=np.float64)
    mask = np.zeros((4, 5), dtype=np.float64)
    with pytest.raises(ValueError, match="shape"):
        apply_protection_blend(pristine, exposed, mask)
    with pytest.raises(ValueError, match="mask shape"):
        apply_protection_blend(
            np.zeros((4, 5)),
            np.zeros((4, 5)),
            np.zeros((4, 4)),
        )


def test_mask_values_finite_and_unit_interval() -> None:
    dest = _destination(point=(0.15, 0.85), bbox=None)
    mask = destination_protection_mask(32, 17, dest)
    assert np.all(np.isfinite(mask))
    assert np.all(mask >= 0.0)
    assert np.all(mask <= 1.0)


def test_synthetic_diagnostic(capsys: pytest.CaptureFixture[str]) -> None:
    dest = _destination(point=(0.5, 0.5))
    bbox = effective_destination_bbox(dest)
    fw = feather_width(bbox)
    mask = destination_protection_mask(11, 11, dest)
    np.set_printoptions(precision=2, suppress=True, linewidth=120)
    print("effective default bbox:", bbox)
    print("feather width:", fw)
    print("11x11 mask:")
    print(np.round(mask, 2))
    captured = capsys.readouterr()
    assert "11x11 mask:" in captured.out
    assert mask[5, 5] == pytest.approx(1.0)
