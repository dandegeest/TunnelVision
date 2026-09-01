"""Compose a motion-conditioned still from an image and CameraMotionPlan."""

from __future__ import annotations

import numpy as np

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
) -> np.ndarray:
    """Return a motion-conditioned image from ``image`` and a validated plan.

    Pipeline: forward radial field → optional near-weight scaling →
    outgoing multisample exposure → destination protection mask →
    blend pristine destination over the exposed image. Absent destination
    or ``protect=false`` yields a zero mask, so the result is the fully
    exposed image. ``near_weight=None`` skips scaling and preserves
    current no-depth behavior.
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
    if near_weight is not None:
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
