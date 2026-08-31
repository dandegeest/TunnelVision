# TunnelVision Data Model

All image coordinates are normalized to `0..1`. Use Zod as the
TypeScript source of truth for runtime-validated contracts.

## Design rules

TunnelVision owns schemas, JSON remains human-readable, provider objects
are normalized at boundaries, and semantic filmmaking data stays
separate from deterministic rendering parameters.

## ShotPlan

Semantic Cinematographer interpretation:

``` json
{
  "version": 1,
  "environment": "old library",
  "route": "forward through the central aisle toward the open doorway",
  "destination": {
    "description": "courtyard beyond the doorway",
    "point": [0.55, 0.47]
  },
  "foreground_occluders": ["bookshelves", "skeletal figures", "door frame"],
  "atmospheric_motion": ["dust", "translucent ghostly forms"],
  "motion": {
    "direction": "forward",
    "turn": "slight_right",
    "speed": "fast"
  }
}
```

## CameraMotionPlan

Formal Camotion input contract:

``` json
{
  "version": 1,
  "camera": {
    "vanishing_point": [0.52, 0.44],
    "forward": 0.8,
    "lateral": 0.0
  },
  "destination": {
    "point": [0.55, 0.46],
    "protect": true,
    "bbox": [0.46, 0.32, 0.68, 0.82]
  },
  "exposure": {
    "strength": 0.75,
    "samples": 16
  }
}
```

Initial Camotion consumes only numeric/geometric fields it needs.

Potential later additions: depth-map reference, segmentation mask,
moving focus of expansion, rotation, virtual shutter, curved path and
separate arrival/departure conditioning. Do not add them before
experiments justify them.

## Destination vs vanishing point

**Destination** is where the Director/user wants to go.

**Vanishing point / focus of expansion** describes perspective/motion
geometry.

They may be close for straight travel and diverge during turns. The UI
exposes destination; the Cinematographer derives geometry.

## Canonical vs conditioned frames

A canonical frame is pristine authoritative world state.
Motion-conditioned assets are derivatives.

A pristine B may eventually produce `B_in` and `B_out` for
arrival/departure. Whether differing derivatives can hand off invisibly
is unresolved and must not be treated as solved.

## Coordinates

For image width `W`, height `H`:

``` text
pixel_x = normalized_x * W
pixel_y = normalized_y * H
```

Bounding boxes are `[left, top, right, bottom]`.
