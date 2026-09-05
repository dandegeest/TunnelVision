# TunnelVision Data Model

This document freezes **CameraMotionPlan v1** as the Camotion
experiment contract. Other named objects are later application types
and are **not** specified here.

## Design rules

-   TunnelVision owns schemas. Provider objects are normalized at
    adapter boundaries and must not appear in Camotion state.
-   JSON is the language-neutral interchange format. Files remain
    human-readable.
-   Semantic filmmaking data (`ShotPlan`, prompts, journey state) stays
    separate from deterministic rendering parameters
    (`CameraMotionPlan`).
-   **Camotion v1 implementation source of truth:** Python / Pydantic,
    matching this spec. Camotion must have **no TypeScript or Node
    dependency**.
-   TypeScript / Zod may later mirror this contract or consume JSON
    Schema generated from the Pydantic models. That is an application
    concern, not a Camotion v1 concern.
-   Keep v1 small. Do not add depth, segmentation, rotation, curved
    paths, virtual shutter, lateral translation / strafing, turning /
    yaw, or `B_in` / `B_out` to this version.

## Coordinate convention

All image coordinates in this contract are normalized.

-   `(0, 0)` is the **top-left** of the image.
-   `(1, 1)` is the **bottom-right** of the image.
-   `x` increases to the right. `y` increases downward.

For an image of width `W` and height `H` pixels:

``` text
pixel_x = normalized_x * (W - 1)
pixel_y = normalized_y * (H - 1)
```

Bounding boxes are `[left, top, right, bottom]` in the same normalized
space.

-   `left < right`
-   `top < bottom`
-   every component is in `[0, 1]`
-   the box is axis-aligned

Points are `[x, y]` with both components in `[0, 1]`.

## CameraMotionPlan v1

Camotion public contract:

``` text
image + CameraMotionPlan JSON -> shooting-frame image
```

An optional near-weight / depth image may be supplied **beside** the
JSON as a renderer/CLI input. It is **not** a CameraMotionPlan field.
If omitted, output matches the radial-only path.

Camotion v1 is a **radial-exposure experiment**. It approximates and
extends aspects of Terran Boylan's original TunnelVision
motion-conditioning workflow (continuous locomotion plus
destination protection). It is **not** a recreation or port of Terran
Boylan's depth-aware Photoshop workflow. See
[IMPLEMENTATION.md](IMPLEMENTATION.md).

### Example

``` json
{
  "version": 1,
  "camera": {
    "vanishing_point": [0.52, 0.44],
    "forward": 0.8
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

### Required fields

| Field | Type | Constraints |
| --- | --- | --- |
| `version` | integer | Must be `1` for this contract. |
| `camera` | object | Required. |
| `camera.vanishing_point` | `[x, y]` | Each in `[0, 1]`. |
| `camera.forward` | number | `[0, 1]`. |
| `exposure` | object | Required. |
| `exposure.strength` | number | `[0, 1]`. |
| `exposure.samples` | integer | `2` .. `64` inclusive. |

### Optional fields

| Field | Type | Default | Constraints |
| --- | --- | --- | --- |
| `destination` | object | omitted | If omitted, no destination protection. |
| `destination.point` | `[x, y]` | none | Required if `destination` is present. Each in `[0, 1]`. |
| `destination.protect` | boolean | `true` | Only meaningful if `destination` is present. |
| `destination.bbox` | `[left, top, right, bottom]` | omitted | Valid bbox if present. |

No other fields are part of v1.

### `version`

-   Required.
-   Camotion v1 **accepts only** `1`.
-   Missing, non-integer, or any other value is a validation error.
-   Camotion v1 must not coerce other versions to v1.

### Motion terminology (v1)

Camotion v1 models **only forward camera translation**, represented as
radial expansion around a supplied focus of expansion.

-   **`forward`** — forward camera translation. The intended v1 field
    (not implemented in this contract pass) is:

    ``` text
    radial_vector(x, y) =
        camera.forward * (
            [x, y] - camera.vanishing_point
        )
    ```

    Coordinates are normalized image coordinates. Do not implement this
    field in this documentation/schema pass.

-   **Lateral translation / strafing** — sideways camera translation.
    Out of scope for v1. Not a turning model.

-   **Turning / yaw** — changing facing while traveling. Out of scope
    for v1.

Strafing and turning are **different** camera motions and must not be
conflated. A previous `camera.lateral` field described strafing; it is
not part of v1. An off-center supplied focus of expansion is **valid v1
geometry**, but v1 does not claim that this is a physically accurate
model of a camera turn.

How a future Cinematographer derives changing camera geometry while
turning toward a user-selected destination is an **open question**. Do
not design that solution here.

### `camera.vanishing_point`

The focus of expansion for the v1 radial motion field: the image point
pixels recede from as the camera advances.

This is **perspective / motion geometry**, not the narrative
destination. Camotion does not infer it; the plan must supply it. The
two may be close or offset; offset is allowed and is still forward
radial expansion, not yaw.

### `camera.forward`

Unitless v1 magnitude of **forward camera translation** encoded as
radial expansion around `vanishing_point`.

-   `0` — no radial motion in the field.
-   `1` — maximum radial displacement Camotion v1 will encode.

This is **not** meters, millimeters, a calibrated camera transform,
strafe, or yaw.

`forward` sets the field. It is not the shutter. Smear amount along
that field is `exposure.strength`.

### `exposure.strength`

How far to integrate along the motion field. Analogous to shutter
time, not camera speed.

-   `0` — output equals the source image (no smear), aside from
    trivial resampling if any.
-   `1` — accumulate along the full v1 motion vectors.

### `exposure.samples`

Number of discrete taps along each motion path, including the unmoved
source sample.

-   Integer, `2` .. `64`.
-   Higher values smooth the streak and cost more compute.
-   v1 equal-weights samples in whatever working color space it uses.
    Linear-light accumulation is **not** a v1 requirement.

### `destination.protect`

When `destination` is present and `protect` is `true`, Camotion reduces
or removes motion accumulation in the protected region so that area
stays comparatively sharp — the v1 stand-in for destination protection.

When `protect` is `false`, the motion field is applied across the whole
frame. `destination.bbox`, if present, is ignored.

When `destination` is omitted, there is no protection (same visual
result as `protect: false`).

### `destination.bbox` absent

If `destination` is present, `protect` is `true`, and `bbox` is omitted:

-   Protect a default axis-aligned square centered on
    `destination.point`.
-   Half-extent is `0.10` in normalized coordinates on each axis
    (full side `0.20`).
-   Clip the square to `[0, 1]`.
-   Edge feather is an implementation detail, not a JSON field.

If `bbox` is present, protect that rectangle (with implementation
feather), not the default square.

### Unknown fields

Camotion v1 **must ignore** unknown keys at any object level.

-   Do not fail the plan because a future field is present
    (`depth`, `masks`, `B_out`, and so on).
-   Do not consume unknown fields.
-   Do not require them.

This keeps the JSON forward-compatible. v1 still **rejects** invalid
known fields (wrong types, out of range, malformed points/bboxes,
`version` ≠ `1`).

### Out of scope for v1

Do not add to this contract:

-   depth maps or Z
-   segmentation / instance masks
-   lateral translation / strafing
-   turning / yaw
-   rotation, roll, 6-DOF, or curved paths
-   separate arrival / departure plans (`B_in` / `B_out`)
-   provider, prompt, or LLM fields
-   image paths (the image, and any optional near-weight map, are
    CLI/API inputs beside the JSON)

## Destination vs vanishing point

**Destination** (`destination.point`) is where the Director or user
wants to go.

**Vanishing point / focus of expansion** (`camera.vanishing_point`)
describes the radial motion geometry Camotion v1 uses.

The UI, when it exists, exposes destination. Something later
(human, experiment, or Cinematographer) derives geometry. Camotion
only reads the numbers. Deriving a changing focus of expansion while
**turning** toward a destination is an open question, not a v1 feature.

## Canonical vs shooting frames

A **canonical** frame is pristine authoritative world state on the
storyboard. A **shooting frame** is a Camotion derivative produced
from an image plus a `CameraMotionPlan` (and optional near-weight).
TunnelVision currently supplies a canonical frame as that image.
Camotion does not know what a canonical frame is.

Canonical frames remain important. They are **not** currently supplied
to the video model. Video generation currently receives shooting
frames as start and end images.

Whether a later system should emit distinct `B_in` and `B_out`
derivatives, and whether those can hand off invisibly, is an **open
question**. v1 produces **one** output image per run.

## ShotPlan (not a Camotion input)

`ShotPlan` is a later semantic object for Cinematographer / prompt
templating. It is **not** consumed by Camotion. The example below is
illustrative only and is **not** a frozen contract.

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

## Later application types (unspecified)

Do **not** design these until a later milestone needs them:

-   Journey, CanonicalFrame, CandidateFrame, DirectorDecision
-   PreferenceState
-   duration → shot count
-   automated traversal scores
-   Screenwriter beats / journey-structure schemas
-   per-shot duration or velocity-continuity fields
-   intermediate-canonical insertion as a typed decision

`VideoGenerationRequest`, `GeneratedVideo`, `ImageGenerationRequest`,
`GeneratedImage`, and `MediaInput` now exist as TunnelVision-owned
provider-boundary types in `media/src/types.ts`.
They are not Camotion types and must not appear in CameraMotionPlan.

Current video inputs: start shooting frame, optional end shooting
frame, prompt, optional duration. Extra pristine/canonical reference
images are not part of the current architecture. Model- and
provider-specific knobs stay behind the adapter.

## Open questions

-   `B_in` / `B_out` handoff strategy
-   PreferenceState schema
-   duration → shot count
-   whether shot duration and camera velocity should vary across a
    journey, including exit/entry continuity at shot boundaries
-   how vanishing point is derived from a destination (human vs model
    vs code)
-   how a future Cinematographer derives changing camera geometry while
    turning toward a user-selected destination (not strafing; not v1)
-   whether a more photographic depth-dependent renderer should replace
    current radial exposure (open; not a plan-schema question)
-   whether shootability requires a traversable intermediate spatial
    story, including optional intermediate canonicals
-   a possible Screenwriter agent upstream of the Director (not a v1
    type)
-   endpoint / edit-boundary fidelity scores (not specified)
