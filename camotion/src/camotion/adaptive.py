"""Spatial motion weights on the existing radial Camotion field.

Camotion near-weight convention (unchanged from ``depth.py`` and the
Depth Anything V2 Small tuning experiment):

    0.0  far
    1.0  near

This module does **not** change radial-field geometry, sample count,
``forward``, or the post-exposure destination-protection blend. It
only answers how much of the plan's pace exposure each pixel should
receive:

    motion_weight = depth_weight × destination_protection × vp_protection

Destination-Aware / non-radial VP→D fields are out of scope.
01.8/01.9/01.10 compositor research is not revived here.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

from camotion.masks import distance_outside_bbox, effective_destination_bbox, normalized_grid
from camotion.plan import CameraMotionPlan, Destination

# Depth → motion. Far never goes to zero; travel still reads in the background.
DEPTH_FAR_MOTION = 0.30
DEPTH_NEAR_MOTION = 1.0
DEPTH_GAMMA = 0.85

# Destination protection (motion remaining at the protected core).
DEST_CORE_MOTION = 0.20
DEST_POINT_RADIUS = 0.10
DEST_POINT_FEATHER = 0.08
DEST_BBOX_FEATHER_FRACTION = 0.50

# Vanishing-point protection is weaker than explicit destination protection.
VP_CORE_MOTION = 0.65
VP_RADIUS = 0.055
VP_FEATHER = 0.07


def _smoothstep(edge0: float, edge1: float, values: np.ndarray) -> np.ndarray:
    """Hermite smoothstep; ``edge0 == edge1`` collapses to a step at that edge."""
    if edge1 <= edge0:
        return np.where(values <= edge0, 0.0, 1.0).astype(np.float64)
    t = np.clip((values - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def _radial_protection(width: int, height: int, center: tuple[float, float], radius: float, feather: float) -> np.ndarray:
    """Soft disk: 1.0 inside ``radius``, 0.0 outside ``radius + feather``."""
    xs, ys = normalized_grid(width, height)
    distance = np.hypot(xs - float(center[0]), ys - float(center[1]))
    return 1.0 - _smoothstep(float(radius), float(radius) + float(feather), distance)


def depth_motion_weight(near_weight: np.ndarray | None, height: int, width: int) -> np.ndarray:
    """Map a near-weight depth field to a smooth motion scale.

    ``None`` skips depth attenuation (all 1.0) so missing depth falls
    back to dest/VP weights only.
    """
    if near_weight is None:
        return np.ones((height, width), dtype=np.float64)
    depth = np.asarray(near_weight, dtype=np.float64)
    if depth.shape != (height, width):
        raise ValueError(f"near_weight shape {tuple(depth.shape)} does not match image {(height, width)}")
    if np.any(~np.isfinite(depth)):
        raise ValueError("near_weight values must be finite")
    depth = np.clip(depth, 0.0, 1.0)
    curved = np.power(depth, DEPTH_GAMMA)
    return DEPTH_FAR_MOTION + (DEPTH_NEAR_MOTION - DEPTH_FAR_MOTION) * curved


def destination_protection_weight(width: int, height: int, destination: Destination | None) -> np.ndarray:
    """Motion remaining after destination protection, in ``[DEST_CORE_MOTION, 1]``.

    Bbox is the primary protected region when present. Point-only uses a
    soft radial disk around D. ``protect=False`` or absent destination
    leaves motion unattenuated.
    """
    ones = np.ones((height, width), dtype=np.float64)
    if destination is None or not destination.protect:
        return ones
    if destination.bbox is not None:
        bbox = effective_destination_bbox(destination)
        smaller = min(bbox[2] - bbox[0], bbox[3] - bbox[1])
        feather = max(DEST_BBOX_FEATHER_FRACTION * smaller, 1e-6)
        xs, ys = normalized_grid(width, height)
        distance = distance_outside_bbox(xs, ys, bbox)
        protect = 1.0 - _smoothstep(0.0, feather, distance)
    else:
        protect = _radial_protection(
            width,
            height,
            destination.point,
            DEST_POINT_RADIUS,
            DEST_POINT_FEATHER,
        )
    return 1.0 - (1.0 - DEST_CORE_MOTION) * protect


def vanishing_point_protection_weight(
    width: int,
    height: int,
    vanishing_point: tuple[float, float],
) -> np.ndarray:
    """Modest soft protection around the focus of expansion."""
    protect = _radial_protection(width, height, vanishing_point, VP_RADIUS, VP_FEATHER)
    return 1.0 - (1.0 - VP_CORE_MOTION) * protect


def combined_motion_weight(
    width: int,
    height: int,
    plan: CameraMotionPlan,
    near_weight: np.ndarray | None = None,
) -> dict[str, np.ndarray]:
    """Return each factor and the combined map, all clipped to ``[0, 1]``."""
    depth = depth_motion_weight(near_weight, height, width)
    destination = destination_protection_weight(width, height, plan.destination)
    vanishing = vanishing_point_protection_weight(width, height, plan.camera.vanishing_point)
    combined = np.clip(depth * destination * vanishing, 0.0, 1.0)
    return {
        "depth": np.clip(depth, 0.0, 1.0),
        "destination": np.clip(destination, 0.0, 1.0),
        "vanishing_point": np.clip(vanishing, 0.0, 1.0),
        "combined": combined,
    }


def write_weight_preview(path: Path | str, weight: np.ndarray) -> None:
    """Write a grayscale PNG preview (white = more motion)."""
    array = np.clip(np.asarray(weight, dtype=np.float64), 0.0, 1.0)
    gray = (array * 255.0).round().astype(np.uint8)
    Image.fromarray(gray, mode="L").save(path)


def write_adaptive_debug_maps(directory: Path | str, weights: dict[str, np.ndarray]) -> dict[str, str]:
    """Write depth / dest / VP / combined previews into a Camotion work dir."""
    root = Path(directory)
    root.mkdir(parents=True, exist_ok=True)
    names = {
        "depth": "depth.png",
        "destination": "destination-protection.png",
        "vanishing_point": "vp-protection.png",
        "combined": "motion-weight.png",
    }
    written: dict[str, str] = {}
    for key, filename in names.items():
        path = root / filename
        write_weight_preview(path, weights[key])
        written[key] = str(path)
    return written
