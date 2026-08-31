"""Camotion: deterministic graphics for motion-conditioned stills.

Not an AI agent. CameraMotionPlan v1 is validated here; ``render``
turns an image plus that plan into a motion-conditioned still.
"""

from camotion.coordinates import normalized_bbox_to_pixel, normalized_to_pixel
from camotion.plan import CameraMotionPlan, load_plan
from camotion.render import render

__all__ = [
    "CameraMotionPlan",
    "load_plan",
    "normalized_bbox_to_pixel",
    "normalized_to_pixel",
    "render",
]
