"""Tests for the experimental depth-banded compositor.

Does not change current ``render()`` behavior.
"""

from __future__ import annotations

import numpy as np
import pytest

from camotion.experimental_composite import (
    MEDIUM_FAR_CUT,
    MEDIUM_NEAR_FULL,
    MEDIUM_STRENGTH_RATIO,
    gaussian_blur,
    medium_visibility_mask,
    render_depth_banded,
    strong_visibility_mask,
)
from camotion.exposure import (
    apply_multisample_exposure,
    apply_terminal_at_canonical_exposure,
)
from camotion.flow import forward_radial_motion_field
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


def _gradient(height: int = 21, width: int = 21, dtype=np.float64) -> np.ndarray:
    return np.arange(height * width, dtype=dtype).reshape(height, width)


def test_gaussian_blur_sigma_zero_is_copy() -> None:
    image = np.arange(12, dtype=np.float64).reshape(3, 4)
    blurred = gaussian_blur(image, 0.0)
    assert np.array_equal(blurred, image)
    blurred[0, 0] = -1.0
    assert image[0, 0] != -1.0


def test_gaussian_blur_spreads_impulse() -> None:
    image = np.zeros((9, 9), dtype=np.float64)
    image[4, 4] = 1.0
    blurred = gaussian_blur(image, 1.0)
    assert blurred[4, 4] < 1.0
    assert blurred[4, 5] > 0.0
    assert blurred[5, 4] > 0.0
    assert np.isclose(blurred.sum(), 1.0, rtol=1e-6)


def test_output_is_deterministic() -> None:
    image = _gradient()
    plan = _plan(destination=None)
    weight = np.linspace(0.0, 1.0, 21 * 21, dtype=np.float64).reshape(21, 21)
    first = render_depth_banded(image, plan, weight)
    second = render_depth_banded(image, plan, weight)
    assert np.array_equal(first, second)


def test_preserves_shape_and_dtype_float() -> None:
    image = _gradient(11, 13, dtype=np.float32)
    plan = _plan(destination=None)
    weight = np.ones((11, 13), dtype=np.float64)
    result = render_depth_banded(image, plan, weight)
    assert result.shape == image.shape
    assert result.dtype == np.float32


def test_preserves_shape_and_dtype_uint8_rgb() -> None:
    gray = np.arange(48, dtype=np.uint8).reshape(4, 4, 3)
    plan = _plan(forward=0.8, strength=0.7, destination=None)
    weight = np.full((4, 4), 0.6, dtype=np.float64)
    result = render_depth_banded(gray, plan, weight)
    assert result.dtype == np.uint8
    assert result.shape == gray.shape


def test_grayscale_and_rgba() -> None:
    plan = _plan(destination=None)
    gray = _gradient(9, 9)
    weight = np.ones((9, 9), dtype=np.float64)
    gray_out = render_depth_banded(gray, plan, weight)
    assert gray_out.ndim == 2
    assert gray_out.shape == (9, 9)

    alpha = np.full((9, 9), 200, dtype=np.uint8)
    rgba = np.stack(
        [gray.astype(np.uint8), gray.astype(np.uint8), gray.astype(np.uint8), alpha],
        axis=-1,
    )
    rgba_out = render_depth_banded(rgba, plan, weight)
    assert rgba_out.shape == (9, 9, 4)
    assert rgba_out.dtype == np.uint8


def test_all_zero_near_weight_is_pristine_before_protection() -> None:
    image = _gradient()
    plan = _plan(destination=None)
    zeros = np.zeros((21, 21), dtype=np.float64)
    result = render_depth_banded(image, plan, zeros)
    assert np.allclose(result, image)


def test_all_zero_near_weight_stays_pristine_with_protection() -> None:
    image = _gradient()
    plan = _plan()
    zeros = np.zeros((21, 21), dtype=np.float64)
    result = render_depth_banded(image, plan, zeros)
    assert np.allclose(result, image)


def test_all_one_near_weight_matches_strong_exposure_then_protection() -> None:
    image = _gradient()
    plan = _plan()
    ones = np.ones((21, 21), dtype=np.float64)
    result = render_depth_banded(image, plan, ones)

    field = forward_radial_motion_field(
        image.shape[1],
        image.shape[0],
        plan.camera.vanishing_point,
        plan.camera.forward,
    )
    strong = apply_multisample_exposure(
        image, field, plan.exposure.strength, plan.exposure.samples
    )
    from camotion.masks import apply_protection_blend, destination_protection_mask

    mask = destination_protection_mask(image.shape[1], image.shape[0], plan.destination)
    expected = apply_protection_blend(image, strong, mask)
    assert np.allclose(result, expected)


def test_far_geometry_changes_less_than_near() -> None:
    image = _gradient()
    plan = _plan(destination=None)
    weight = np.zeros((21, 21), dtype=np.float64)
    weight[:5, :] = 1.0
    weight[-5:, :] = 1.0
    result = render_depth_banded(
        image,
        plan,
        weight,
        strong_mask_soften_sigma=0.0,
        medium_mask_soften_sigma=0.0,
    )

    near_delta = np.mean(np.abs(result[:5] - image[:5]))
    far_delta = np.mean(np.abs(result[8:13, 8:13] - image[8:13, 8:13]))
    assert near_delta > far_delta
    assert far_delta == pytest.approx(0.0, abs=1e-9)


def test_strong_mask_is_changed_by_radial_exposure() -> None:
    weight = np.zeros((21, 21), dtype=np.float64)
    weight[:, :10] = 1.0
    field = forward_radial_motion_field(21, 21, (0.5, 0.5), 1.0)
    before, after = strong_visibility_mask(
        weight, field, strength=1.0, samples=8, soften_sigma=1.0
    )
    zero_strength, _ = strong_visibility_mask(
        weight, field, strength=0.0, samples=8, soften_sigma=1.0
    )
    assert np.allclose(before, zero_strength)
    assert not np.allclose(before, after)
    assert float(np.mean(np.abs(after - before))) > 1e-4


def test_medium_mask_fades_in_far_values() -> None:
    samples = np.array(
        [
            [
                1.0,
                MEDIUM_NEAR_FULL,
                0.5 * (MEDIUM_FAR_CUT + MEDIUM_NEAR_FULL),
                MEDIUM_FAR_CUT,
                0.0,
            ]
        ],
        dtype=np.float64,
    )
    mask = medium_visibility_mask(samples, soften_sigma=0.0)
    assert mask[0, 0] == pytest.approx(1.0)
    assert mask[0, 1] == pytest.approx(1.0)
    assert 0.0 < mask[0, 2] < 1.0
    assert mask[0, 3] == pytest.approx(0.0)
    assert mask[0, 4] == pytest.approx(0.0)


def test_destination_protection_restores_protected_pixels() -> None:
    image = _gradient()
    plan = _plan()
    ones = np.ones((21, 21), dtype=np.float64)
    result = render_depth_banded(image, plan, ones)
    assert result[10, 10] == pytest.approx(image[10, 10])
    assert result[0, 0] != pytest.approx(image[0, 0])
    assert result[20, 20] != pytest.approx(image[20, 20])


def test_rejects_near_weight_shape_mismatch() -> None:
    image = np.zeros((8, 8), dtype=np.float64)
    plan = _plan(destination=None)
    with pytest.raises(ValueError, match="does not match image"):
        render_depth_banded(image, plan, np.ones((8, 7), dtype=np.float64))


def test_current_render_path_unchanged_by_this_module() -> None:
    image = _gradient()
    plan = _plan()
    weight = np.linspace(0.0, 1.0, 21 * 21, dtype=np.float64).reshape(21, 21)
    current = render(image, plan, near_weight=weight)
    experimental = render_depth_banded(image, plan, weight)
    assert current.shape == experimental.shape
    assert not np.array_equal(current, experimental)
    assert np.array_equal(render(image, plan), render(image, plan, near_weight=None))
    zeros = np.zeros((21, 21), dtype=np.float64)
    assert np.array_equal(render(image, plan, near_weight=zeros), image)


def test_medium_strength_ratio_is_eight_over_twelve() -> None:
    assert MEDIUM_STRENGTH_RATIO == pytest.approx(8.0 / 12.0)


def test_default_banded_path_is_outgoing_orientation() -> None:
    image = _gradient()
    plan = _plan()
    weight = np.linspace(0.0, 1.0, 21 * 21, dtype=np.float64).reshape(21, 21)
    omitted = render_depth_banded(image, plan, weight)
    explicit = render_depth_banded(image, plan, weight, terminal_at_canonical=False)
    assert np.array_equal(omitted, explicit)


def test_terminal_banded_differs_but_preserves_shape_dtype() -> None:
    image = _gradient()
    plan = _plan(destination=None)
    weight = np.linspace(0.0, 1.0, 21 * 21, dtype=np.float64).reshape(21, 21)
    origin = render_depth_banded(image, plan, weight)
    terminal = render_depth_banded(image, plan, weight, terminal_at_canonical=True)
    assert terminal.shape == origin.shape
    assert terminal.dtype == origin.dtype
    assert not np.allclose(origin, terminal)
    again = render_depth_banded(image, plan, weight, terminal_at_canonical=True)
    assert np.array_equal(terminal, again)


def test_zero_motion_both_orientations_match_pristine() -> None:
    image = _gradient()
    plan = _plan(forward=0.0, destination=None)
    weight = np.ones((21, 21), dtype=np.float64)
    origin = render_depth_banded(image, plan, weight)
    terminal = render_depth_banded(image, plan, weight, terminal_at_canonical=True)
    assert np.allclose(origin, image)
    assert np.allclose(terminal, image)


def test_terminal_destination_protection_restores_protected_pixels() -> None:
    image = _gradient()
    plan = _plan()
    ones = np.ones((21, 21), dtype=np.float64)
    result = render_depth_banded(image, plan, ones, terminal_at_canonical=True)
    assert result[10, 10] == pytest.approx(image[10, 10])
    # Corner pixels clamp under p+field*t; use an interior unprotected pixel.
    assert result[5, 5] != pytest.approx(image[5, 5])


def test_strong_mask_uses_matching_terminal_orientation() -> None:
    weight = np.zeros((21, 21), dtype=np.float64)
    weight[:, :10] = 1.0
    plan = _plan(destination=None, samples=8, strength=1.0)
    field = forward_radial_motion_field(
        21, 21, plan.camera.vanishing_point, plan.camera.forward
    )
    _, origin_mask = strong_visibility_mask(
        weight,
        field,
        strength=1.0,
        samples=8,
        soften_sigma=1.0,
        expose=apply_multisample_exposure,
    )
    _, terminal_mask = strong_visibility_mask(
        weight,
        field,
        strength=1.0,
        samples=8,
        soften_sigma=1.0,
        expose=apply_terminal_at_canonical_exposure,
    )
    assert not np.allclose(origin_mask, terminal_mask)
    image = _gradient()
    _origin, origin_diag = render_depth_banded(
        image,
        plan,
        weight,
        return_diagnostics=True,
        terminal_at_canonical=False,
        strong_mask_soften_sigma=1.0,
    )
    _term, term_diag = render_depth_banded(
        image,
        plan,
        weight,
        return_diagnostics=True,
        terminal_at_canonical=True,
        strong_mask_soften_sigma=1.0,
    )
    assert np.allclose(origin_diag["strong_mask_after"], origin_mask)
    assert np.allclose(term_diag["strong_mask_after"], terminal_mask)
    assert np.allclose(origin_diag["medium_mask"], term_diag["medium_mask"])


def test_all_one_near_weight_terminal_matches_terminal_exposure_then_protection() -> None:
    image = _gradient()
    plan = _plan()
    ones = np.ones((21, 21), dtype=np.float64)
    result = render_depth_banded(image, plan, ones, terminal_at_canonical=True)
    field = forward_radial_motion_field(
        image.shape[1],
        image.shape[0],
        plan.camera.vanishing_point,
        plan.camera.forward,
    )
    strong = apply_terminal_at_canonical_exposure(
        image, field, plan.exposure.strength, plan.exposure.samples
    )
    from camotion.masks import apply_protection_blend, destination_protection_mask

    mask = destination_protection_mask(image.shape[1], image.shape[0], plan.destination)
    expected = apply_protection_blend(image, strong, mask)
    assert np.allclose(result, expected)
