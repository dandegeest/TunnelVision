"""Camotion: deterministic graphics for motion-conditioned stills.

Not an AI agent. CameraMotionPlan v1 is validated here; rendering is
implemented separately.
"""

from camotion.coordinates import normalized_bbox_to_pixel, normalized_to_pixel
from camotion.plan import CameraMotionPlan, load_plan

__all__ = [
    "CameraMotionPlan",
    "load_plan",
    "normalized_bbox_to_pixel",
    "normalized_to_pixel",
]
