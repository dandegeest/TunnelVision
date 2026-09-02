"""Tests for outgoing multisample exposure."""

from __future__ import annotations

import numpy as np
import pytest

from camotion.exposure import (
    apply_multisample_exposure,
    apply_terminal_at_canonical_exposure,
    bilinear_sample,
)
from camotion.flow import forward_radial_motion_field


def _uniform_field(height: int, width: int, dx: float, dy: float) -> np.ndarray:
    field = np.zeros((height, width, 2), dtype=np.float64)
    field[..., 0] = dx
    field[..., 1] = dy
    return field


def test_strength_zero_returns_original() -> None:
    image = np.arange(20, dtype=np.float64).reshape(4, 5)
    field = _uniform_field(4, 5, 0.4, -0.2)
    result = apply_multisample_exposure(image, field, strength=0.0, samples=8)
    assert result.shape == image.shape
    assert np.allclose(result, image)


def test_zero_motion_field_returns_original() -> None:
    image = np.arange(12, dtype=np.float64).reshape(3, 4)
    field = np.zeros((3, 4, 2), dtype=np.float64)
    for strength in (0.0, 0.5, 1.0):
        result = apply_multisample_exposure(image, field, strength=strength, samples=5)
        assert np.allclose(result, image)


def test_samples_include_both_endpoints() -> None:
    image = np.array(
        [[0.0, 1.0, 2.0, 3.0, 4.0]],
        dtype=np.float64,
    )
    field = _uniform_field(1, 5, 0.25, 0.0)
    strength = 1.0
    two = apply_multisample_exposure(image, field, strength=strength, samples=2)

    pixel_x = np.arange(5, dtype=np.float64)
    dx_pixels = 0.25 * (5 - 1)
    t0 = bilinear_sample(image, pixel_x, np.zeros(5))
    t1 = bilinear_sample(image, pixel_x - dx_pixels * strength, np.zeros(5))
    assert np.allclose(two, 0.5 * (t0 + t1))


def test_horizontal_impulse_smears_in_field_direction() -> None:
    image = np.zeros((5, 5), dtype=np.float64)
    image[2, 2] = 1.0
    field = _uniform_field(5, 5, 0.25, 0.0)
    result = apply_multisample_exposure(image, field, strength=1.0, samples=2)
    # Uniform +dx looks backward (left) when inverse-sampling, so the
    # impulse appears smeared to the right of its origin.
    assert result[2, 2] == pytest.approx(0.5)
    assert result[2, 3] == pytest.approx(0.5)
    assert result[2, 1] == pytest.approx(0.0)
    assert result[2, 4] == pytest.approx(0.0)


def test_terminal_at_canonical_smears_opposite_side() -> None:
    image = np.zeros((5, 5), dtype=np.float64)
    image[2, 2] = 1.0
    field = _uniform_field(5, 5, 0.25, 0.0)
    origin = apply_multisample_exposure(image, field, strength=1.0, samples=2)
    terminal = apply_terminal_at_canonical_exposure(
        image, field, strength=1.0, samples=2
    )
    assert origin[2, 2] == pytest.approx(0.5)
    assert origin[2, 3] == pytest.approx(0.5)
    assert origin[2, 1] == pytest.approx(0.0)
    assert terminal[2, 2] == pytest.approx(0.5)
    assert terminal[2, 1] == pytest.approx(0.5)
    assert terminal[2, 3] == pytest.approx(0.0)
    assert np.allclose(origin[2, :], terminal[2, ::-1])
    assert not np.allclose(origin, terminal)
    assert origin.sum() == pytest.approx(terminal.sum())
    assert origin.max() == pytest.approx(terminal.max())


def test_reversing_sample_iteration_does_not_change_outgoing_set() -> None:
    image = np.array([[0.0, 0.0, 8.0, 0.0, 0.0]], dtype=np.float64)
    field = _uniform_field(1, 5, 0.25, 0.0)
    strength = 1.0
    samples = 3
    dx_pixels = 0.25 * 4
    pixel_x = np.arange(5, dtype=np.float64)
    pixel_y = np.zeros(5, dtype=np.float64)

    forward_acc = np.zeros_like(image)
    reverse_acc = np.zeros_like(image)
    for index in range(samples):
        t = index / (samples - 1)
        forward_acc += bilinear_sample(
            image, pixel_x - dx_pixels * strength * t, pixel_y
        )
    for index in range(samples - 1, -1, -1):
        t = index / (samples - 1)
        reverse_acc += bilinear_sample(
            image, pixel_x - dx_pixels * strength * t, pixel_y
        )
    assert np.allclose(forward_acc / samples, reverse_acc / samples)
    outgoing = apply_multisample_exposure(image, field, strength, samples)
    assert np.allclose(outgoing, forward_acc / samples)


def test_zero_motion_matches_both_orientations() -> None:
    image = np.arange(12, dtype=np.float64).reshape(3, 4)
    field = np.zeros((3, 4, 2), dtype=np.float64)
    origin = apply_multisample_exposure(image, field, strength=1.0, samples=5)
    terminal = apply_terminal_at_canonical_exposure(
        image, field, strength=1.0, samples=5
    )
    assert np.allclose(origin, image)
    assert np.allclose(terminal, image)
    assert np.array_equal(origin, terminal)


def test_terminal_orientation_is_deterministic() -> None:
    image = np.linspace(0.0, 1.0, 25, dtype=np.float64).reshape(5, 5)
    field = forward_radial_motion_field(5, 5, (0.5, 0.5), 1.0)
    first = apply_terminal_at_canonical_exposure(image, field, 0.5, 8)
    second = apply_terminal_at_canonical_exposure(image, field, 0.5, 8)
    assert np.array_equal(first, second)
    assert first.shape == image.shape
    assert first.dtype == image.dtype


def test_radial_center_stable_surroundings_integrate_outward() -> None:
    image = np.zeros((5, 5), dtype=np.float64)
    image[2, 2] = 1.0
    field = forward_radial_motion_field(5, 5, (0.5, 0.5), 1.0)
    result = apply_multisample_exposure(image, field, strength=1.0, samples=4)
    assert result[2, 2] == pytest.approx(1.0)
    assert result[2, 3] > 0.0
    assert result[2, 1] > 0.0
    assert result[1, 2] > 0.0
    assert result[3, 2] > 0.0


def test_increasing_strength_increases_smear() -> None:
    image = np.zeros((5, 5), dtype=np.float64)
    image[2, 2] = 1.0
    field = _uniform_field(5, 5, 0.25, 0.0)
    weak = apply_multisample_exposure(image, field, strength=0.25, samples=4)
    strong = apply_multisample_exposure(image, field, strength=1.0, samples=4)
    assert strong[2, 3] > weak[2, 3]


def test_increasing_samples_keeps_path_endpoints() -> None:
    image = np.array([[0.0, 0.0, 8.0, 0.0, 0.0]], dtype=np.float64)
    field = _uniform_field(1, 5, 0.25, 0.0)
    strength = 1.0
    dx_pixels = 0.25 * 4
    pixel_x = np.arange(5, dtype=np.float64)
    pixel_y = np.zeros(5, dtype=np.float64)

    start = bilinear_sample(image, pixel_x, pixel_y)
    end = bilinear_sample(image, pixel_x - dx_pixels * strength, pixel_y)
    mid = bilinear_sample(image, pixel_x - dx_pixels * strength * 0.5, pixel_y)
    two = apply_multisample_exposure(image, field, strength=strength, samples=2)
    three = apply_multisample_exposure(image, field, strength=strength, samples=3)

    assert np.allclose(start, image)
    assert np.allclose(two, 0.5 * (start + end))
    assert np.allclose(three, (start + mid + end) / 3.0)


def test_bilinear_known_fractional_coordinate() -> None:
    image = np.array([[1.0, 3.0], [5.0, 7.0]], dtype=np.float64)
    sampled = bilinear_sample(image, np.array([[0.5]]), np.array([[0.5]]))
    assert sampled[0, 0] == pytest.approx(4.0)


def test_boundary_clamping() -> None:
    image = np.array([[10.0, 20.0], [30.0, 40.0]], dtype=np.float64)
    left = bilinear_sample(image, np.array([[-8.0]]), np.array([[0.0]]))
    right = bilinear_sample(image, np.array([[99.0]]), np.array([[0.0]]))
    top = bilinear_sample(image, np.array([[0.0]]), np.array([[-3.0]]))
    bottom = bilinear_sample(image, np.array([[0.0]]), np.array([[50.0]]))
    assert left[0, 0] == pytest.approx(10.0)
    assert right[0, 0] == pytest.approx(20.0)
    assert top[0, 0] == pytest.approx(10.0)
    assert bottom[0, 0] == pytest.approx(30.0)

    field = _uniform_field(2, 2, 2.0, 0.0)
    result = apply_multisample_exposure(image, field, strength=1.0, samples=2)
    assert np.all(np.isfinite(result))


def test_grayscale_hw_input() -> None:
    image = np.arange(9, dtype=np.float64).reshape(3, 3)
    field = forward_radial_motion_field(3, 3, (0.5, 0.5), 0.5)
    result = apply_multisample_exposure(image, field, strength=0.5, samples=3)
    assert result.shape == (3, 3)
    assert result.ndim == 2


def test_multichannel_hwc_input() -> None:
    image = np.zeros((3, 3, 3), dtype=np.float64)
    image[..., 0] = 1.0
    image[..., 1] = 2.0
    image[..., 2] = 3.0
    field = _uniform_field(3, 3, 0.1, 0.0)
    result = apply_multisample_exposure(image, field, strength=0.5, samples=4)
    assert result.shape == (3, 3, 3)
    assert np.allclose(result[1, 1, :], [1.0, 2.0, 3.0], atol=0.15)


def test_integer_dtype_is_clipped_not_wrapped() -> None:
    image = np.array([[250, 255], [0, 5]], dtype=np.uint8)
    field = _uniform_field(2, 2, 0.0, 0.0)
    result = apply_multisample_exposure(image, field, strength=1.0, samples=2)
    assert result.dtype == np.uint8
    assert result.tolist() == [[250, 255], [0, 5]]


def test_float_dtype_stays_floating() -> None:
    image = np.array([[0.25, 0.5], [0.75, 1.0]], dtype=np.float32)
    field = _uniform_field(2, 2, 0.0, 0.0)
    result = apply_multisample_exposure(image, field, strength=0.8, samples=3)
    assert np.issubdtype(result.dtype, np.floating)
    terminal = apply_terminal_at_canonical_exposure(image, field, strength=0.8, samples=3)
    assert terminal.dtype == image.dtype


def test_finite_output_values() -> None:
    image = np.linspace(0.0, 1.0, 49).reshape(7, 7)
    field = forward_radial_motion_field(7, 7, (0.2, 0.8), 1.0)
    result = apply_multisample_exposure(image, field, strength=1.0, samples=8)
    assert np.all(np.isfinite(result))


def test_invalid_inputs() -> None:
    image = np.zeros((4, 5), dtype=np.float64)
    field = _uniform_field(4, 5, 0.1, 0.0)

    with pytest.raises(ValueError, match="shape"):
        apply_multisample_exposure(image, np.zeros((3, 5, 2)), 0.5, 4)
    with pytest.raises(ValueError, match="shape"):
        apply_multisample_exposure(image, np.zeros((4, 5, 3)), 0.5, 4)
    with pytest.raises(ValueError, match="samples"):
        apply_multisample_exposure(image, field, 0.5, 1)
    with pytest.raises(ValueError, match="strength"):
        apply_multisample_exposure(image, field, -0.1, 4)
    with pytest.raises(ValueError, match="strength"):
        apply_multisample_exposure(image, field, 1.1, 4)


def test_synthetic_diagnostic(capsys: pytest.CaptureFixture[str]) -> None:
    image = np.zeros((9, 9), dtype=np.float64)
    image[4, :] = 1.0
    image[:, 4] = 1.0
    field = forward_radial_motion_field(9, 9, (0.5, 0.5), 1.0)
    result = apply_multisample_exposure(image, field, strength=0.5, samples=8)
    np.set_printoptions(precision=3, suppress=True, linewidth=120)
    print("input:")
    print(image)
    print("exposure strength=0.5 samples=8:")
    print(result)
    assert result.shape == (9, 9)
    assert result[4, 4] == pytest.approx(1.0)
    assert np.all(np.isfinite(result))
    captured = capsys.readouterr()
    assert "input:" in captured.out
