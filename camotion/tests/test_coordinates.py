"""Tests for normalized → pixel coordinate conversion."""

from __future__ import annotations

import pytest

from camotion.coordinates import normalized_bbox_to_pixel, normalized_to_pixel


def test_image_edges() -> None:
    width, height = 1920, 1080
    assert normalized_to_pixel(0.0, 0.0, width, height) == (0.0, 0.0)
    assert normalized_to_pixel(1.0, 1.0, width, height) == (1919.0, 1079.0)
    assert normalized_to_pixel(1.0, 0.0, width, height) == (1919.0, 0.0)
    assert normalized_to_pixel(0.0, 1.0, width, height) == (0.0, 1079.0)


def test_center_of_odd_dimensions() -> None:
    assert normalized_to_pixel(0.5, 0.5, 101, 51) == (50.0, 25.0)


def test_bbox_edges() -> None:
    left, top, right, bottom = normalized_bbox_to_pixel(
        (0.0, 0.0, 1.0, 1.0),
        100,
        50,
    )
    assert (left, top, right, bottom) == (0.0, 0.0, 99.0, 49.0)


def test_rejects_non_positive_size() -> None:
    with pytest.raises(ValueError):
        normalized_to_pixel(0.0, 0.0, 0, 10)
    with pytest.raises(ValueError):
        normalized_to_pixel(0.0, 0.0, 10, 0)
