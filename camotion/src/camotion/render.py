"""Compose a motion-conditioned still from an image and CameraMotionPlan."""

from __future__ import annotations

from pathlib import Path

import numpy as np

from camotion.adaptive import combined_motion_weight, write_adaptive_debug_maps
from camotion.depth import apply_near_weight
from camotion.exposure import apply_multisample_exposure
from camotion.flow import forward_radial_motion_field
from camotion.masks import apply_protection_blend, destination_protection_mask
from camotion.plan import CameraMotionPlan


def render(
    image: np.ndarray,
    plan: CameraMotionPlan,
    *,
    near_weight: np.ndarray | None = None,
    adaptive: bool = False,
    debug_dir: Path | str | None = None,
) -> np.ndarray:
    """Return a motion-conditioned image from ``image`` and a validated plan.

    Pipeline: forward radial field → optional near-weight or adaptive
    spatial weighting → outgoing multisample exposure → destination
    protection mask → blend pristine destination over the exposed image.

    ``adaptive=False`` (default) is the frozen v1 path: ``near_weight``
    scales the field when supplied, otherwise the field is unchanged.
    ``adaptive=True`` multiplies pace exposure by depth, destination,
    and vanishing-point weights without changing radial geometry.
    Missing depth then uses dest/VP weights only.
    """
    array = np.asarray(image)
    if array.ndim not in (2, 3):
        raise ValueError("image must have shape H x W or H x W x C")
    height = int(array.shape[0])
    width = int(array.shape[1])

    field = forward_radial_motion_field(
        width,
        height,
        plan.camera.vanishing_point,
        plan.camera.forward,
    )
    if adaptive:
        weights = combined_motion_weight(width, height, plan, near_weight)
        field = apply_near_weight(field, weights["combined"])
        if debug_dir is not None:
            write_adaptive_debug_maps(debug_dir, weights)
    elif near_weight is not None:
        weight = np.asarray(near_weight)
        if weight.ndim != 2 or weight.shape != (height, width):
            raise ValueError(
                f"near_weight shape {tuple(weight.shape)} does not match image {(height, width)}"
            )
        field = apply_near_weight(field, weight)
    exposed = apply_multisample_exposure(
        array,
        field,
        plan.exposure.strength,
        plan.exposure.samples,
    )
    protection_mask = destination_protection_mask(
        width,
        height,
        plan.destination,
    )
    return apply_protection_blend(array, exposed, protection_mask)
