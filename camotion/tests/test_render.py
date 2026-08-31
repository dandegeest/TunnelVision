"""Tests for Camotion v1 render orchestration."""

from __future__ import annotations

import numpy as np
import pytest

from camotion.exposure import apply_multisample_exposure
from camotion.flow import forward_radial_motion_field
from camotion.masks import destination_protection_mask
from camotion.plan import CameraMotionPlan
from camotion.render import render


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
        "exposure": {
            "strength": strength,
            "samples": samples,
        },
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


def _exposed(image: np.ndarray, plan: CameraMotionPlan) -> np.ndarray:
    height, width = image.shape[:2]
    field = forward_radial_motion_field(
        width,
        height,
        plan.camera.vanishing_point,
        plan.camera.forward,
    )
    return apply_multisample_exposure(
        image,
        field,
        plan.exposure.strength,
        plan.exposure.samples,
    )


def _gradient(height: int = 21, width: int = 21, dtype=np.float64) -> np.ndarray:
    return np.arange(height * width, dtype=dtype).reshape(height, width)


def test_render_preserves_shape() -> None:
    image = _gradient(11, 13)
    result = render(image, _plan())
    assert result.shape == image.shape


def test_forward_zero_returns_pristine() -> None:
    image = _gradient()
    result = render(image, _plan(forward=0.0))
    assert np.array_equal(result, image)


def test_strength_zero_returns_pristine() -> None:
    image = _gradient()
    result = render(image, _plan(strength=0.0))
    assert np.array_equal(result, image)


def test_destination_absent_equals_exposed() -> None:
    image = _gradient()
    plan = _plan(destination=None)
    result = render(image, plan)
    expected = _exposed(image, plan)
    assert np.array_equal(result, expected)
    assert not np.array_equal(result, image)


def test_protect_false_equals_exposed() -> None:
    image = _gradient()
    plan = _plan(
        destination={
            "point": [0.5, 0.5],
            "protect": False,
            "bbox": [0.2, 0.2, 0.8, 0.8],
        }
    )
    result = render(image, plan)
    expected = _exposed(image, plan)
    assert np.array_equal(result, expected)
    mask = destination_protection_mask(
        image.shape[1], image.shape[0], plan.destination
    )
    assert np.all(mask == 0.0)


def test_protected_destination_keeps_center_pristine() -> None:
    image = _gradient()
    plan = _plan()
    result = render(image, plan)
    exposed = _exposed(image, plan)
    mask = destination_protection_mask(
        image.shape[1], image.shape[0], plan.destination
    )

    assert mask[10, 10] == pytest.approx(1.0)
    assert result[10, 10] == pytest.approx(image[10, 10])
    assert result[10, 10] == pytest.approx(exposed[10, 10])

    assert mask[0, 0] == pytest.approx(0.0)
    assert result[0, 0] == pytest.approx(exposed[0, 0])
    assert result[0, 0] != pytest.approx(image[0, 0])
    assert mask[20, 20] == pytest.approx(0.0)
    assert result[20, 20] == pytest.approx(exposed[20, 20])
    assert result[20, 20] != pytest.approx(image[20, 20])


def test_grayscale_render() -> None:
    image = _gradient(9, 9)
    result = render(image, _plan())
    assert result.ndim == 2
    assert result.shape == (9, 9)


def test_rgb_render() -> None:
    gray = _gradient(9, 9)
    image = np.stack([gray, gray * 0.5, gray * 0.25], axis=-1)
    result = render(image, _plan())
    assert result.shape == (9, 9, 3)
    assert result[4, 4, 0] == pytest.approx(image[4, 4, 0])


def test_rgba_render_preserves_alpha_channel() -> None:
    gray = _gradient(9, 9, dtype=np.uint8)
    alpha = np.full((9, 9), 200, dtype=np.uint8)
    alpha[0, 0] = 40
    image = np.stack([gray, gray, gray, alpha], axis=-1)
    result = render(image, _plan(destination=None))

    assert result.shape == (9, 9, 4)
    assert result.dtype == np.uint8
    exposed = _exposed(image, _plan(destination=None))
    assert np.array_equal(result, exposed)
    assert np.array_equal(result[..., 3], exposed[..., 3])
    assert not np.array_equal(result[..., 3], np.full((9, 9), 255, dtype=np.uint8))


def test_rgba_protected_center_keeps_pristine_alpha() -> None:
    gray = _gradient(21, 21, dtype=np.uint8)
    alpha = np.arange(21 * 21, dtype=np.uint8).reshape(21, 21)
    image = np.stack([gray, gray, gray, alpha], axis=-1)
    plan = _plan()
    result = render(image, plan)
    assert result.shape == (21, 21, 4)
    assert np.array_equal(result[10, 10], image[10, 10])
    exposed = _exposed(image, plan)
    assert np.array_equal(result[0, 0], exposed[0, 0])
    assert not np.array_equal(result[0, 0], image[0, 0])


def test_integer_dtype_preservation() -> None:
    image = np.arange(48, dtype=np.uint8).reshape(4, 4, 3)
    result = render(image, _plan(forward=0.8, strength=0.7, destination=None))
    assert result.dtype == np.uint8
    assert result.shape == image.shape


def test_float_array_dtype_and_values() -> None:
    image = np.linspace(0.0, 1.0, 25, dtype=np.float32).reshape(5, 5)
    plan = _plan(forward=0.5, strength=0.5, destination=None)
    result = render(image, plan)
    assert result.dtype == np.float32
    assert result.shape == image.shape
    assert np.all(np.isfinite(result))
    expected = _exposed(image, plan)
    assert np.allclose(result, expected)
