"""Tests for the normalized forward radial motion field."""

from __future__ import annotations

import numpy as np
import pytest

from camotion.flow import forward_radial_motion_field


def test_output_shape() -> None:
    field = forward_radial_motion_field(7, 9, (0.5, 0.5), 1.0)
    assert field.shape == (9, 7, 2)
    assert field.dtype == np.float64


def test_centered_foe_example() -> None:
    field = forward_radial_motion_field(5, 5, (0.5, 0.5), 1.0)
    assert field[2, 2].tolist() == [0.0, 0.0]
    assert field[0, 0].tolist() == [-0.5, -0.5]
    assert field[0, 4].tolist() == [0.5, -0.5]
    assert field[4, 0].tolist() == [-0.5, 0.5]
    assert field[4, 4].tolist() == [0.5, 0.5]


def test_cardinal_directions() -> None:
    field = forward_radial_motion_field(5, 5, (0.5, 0.5), 1.0)
    assert field[2, 0, 0] < 0.0  # left of FoE => negative dx
    assert field[2, 4, 0] > 0.0  # right of FoE => positive dx
    assert field[0, 2, 1] < 0.0  # above FoE => negative dy
    assert field[4, 2, 1] > 0.0  # below FoE => positive dy


def test_magnitude_increases_with_distance() -> None:
    field = forward_radial_motion_field(5, 5, (0.5, 0.5), 1.0)
    left_0 = np.linalg.norm(field[2, 0])
    left_1 = np.linalg.norm(field[2, 1])
    center = np.linalg.norm(field[2, 2])
    assert left_0 > left_1 > center

    top_0 = np.linalg.norm(field[0, 2])
    mid_0 = np.linalg.norm(field[1, 2])
    center = np.linalg.norm(field[2, 2])
    assert top_0 > mid_0 > center


def test_zero_forward_has_zero_field() -> None:
    field = forward_radial_motion_field(5, 5, (0.5, 0.5), 0.0)
    assert np.all(field == 0.0)


def test_forward_scaling() -> None:
    base = forward_radial_motion_field(5, 5, (0.5, 0.5), 1.0)
    scaled = forward_radial_motion_field(5, 5, (0.5, 0.5), 0.5)
    assert np.allclose(scaled, base * 0.5)


def test_off_center_foe_matches_formula() -> None:
    field = forward_radial_motion_field(5, 5, (0.25, 0.75), 1.0)
    assert field[0, 0].tolist() == [-0.25, -0.75]
    assert field[2, 2].tolist() == [0.25, -0.25]
    assert field[4, 4].tolist() == [0.75, 0.25]


def test_non_square_image_geometry() -> None:
    field = forward_radial_motion_field(6, 4, (0.5, 0.5), 1.0)
    # Normalized x positions are [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
    # normalized y positions are [0.0, 1/3, 2/3, 1.0]
    assert np.isclose(field[1, 4, 0], 0.3)
    assert np.isclose(field[1, 4, 1], -1.0 / 6.0)
    assert np.isclose(field[3, 0, 0], -0.5)
    assert np.isclose(field[3, 0, 1], 0.5)


def test_degenerate_dimensions_are_explicit() -> None:
    width_one = forward_radial_motion_field(1, 5, (0.5, 0.5), 1.0)
    assert width_one.shape == (5, 1, 2)
    assert width_one[:, 0, 0].tolist() == [-0.5, -0.5, -0.5, -0.5, -0.5]
    assert width_one[:, 0, 1].tolist() == [-0.5, -0.25, 0.0, 0.25, 0.5]

    height_one = forward_radial_motion_field(5, 1, (0.5, 0.5), 1.0)
    assert height_one.shape == (1, 5, 2)
    assert height_one[0, :, 0].tolist() == [-0.5, -0.25, 0.0, 0.25, 0.5]
    assert height_one[0, :, 1].tolist() == [-0.5, -0.5, -0.5, -0.5, -0.5]

    single_pixel = forward_radial_motion_field(1, 1, (0.5, 0.5), 1.0)
    assert single_pixel.shape == (1, 1, 2)
    assert single_pixel[0, 0].tolist() == [-0.5, -0.5]

    with pytest.raises(ValueError):
        forward_radial_motion_field(0, 5, (0.5, 0.5), 1.0)
    with pytest.raises(ValueError):
        forward_radial_motion_field(5, 0, (0.5, 0.5), 1.0)


def test_all_values_are_finite() -> None:
    field = forward_radial_motion_field(11, 7, (0.17, 0.83), 0.75)
    assert np.all(np.isfinite(field))
