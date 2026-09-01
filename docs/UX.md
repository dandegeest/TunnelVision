# TunnelVision UX Plan

This is the intended product workspace. It is **not** the current
implementation. Current code is Camotion v1
(`image + CameraMotionPlan JSON` → shooting-frame still; optional
near-weight sidecar). Do not scaffold this UI yet.

## Primary workspace

The primary workspace is a clean left-to-right storyboard of **canonical
frames**:

`A → B → C → D → E → F`

The storyboard is the path; do not duplicate it with a separate reel.
Clicking a frame opens a large viewer, with arrows to move through
canonical frames for spatial-continuity review.

## Opening state

Minimum brief: - starting frame --- upload or generate; - story /
journey idea --- freeform; - approximate duration.

How duration maps to shot/viewpoint count is an **open question**. Do
not invent a formula in order to start Camotion or the later Director
slice.

## Canonical vs candidates

Only selected frames permanently occupy the storyboard. Candidates are
transient editing material. Opening canonical C can reveal
`C1 C2 C3 C4`, with the Director recommendation marked. Choosing another
candidate replaces C. Downstream frames can become provisional and be
re-evaluated.

> **TunnelVision presents decisions, not generations.**

**Canonical vs shooting frames.** The storyboard shows
**canonical / pristine** frames: authoritative world-state images.
Camotion derives **shooting frames** from them. Video generation
currently receives those shooting frames. Canonical images remain on
the storyboard; they are not currently passed to the video model.

## Frame modes

**Variations** --- alternate candidate viewpoints.

**Direction** --- large canonical image plus Director destination
marker. The user clicks/drags elsewhere to mean **go there**. The user
manipulates a destination, not a vanishing point.

**Motion** --- Cinematographer interpretation and Camotion shooting-frame
preview.

Depth maps, masks and confidence values belong under Inspect/Advanced.
Camotion does not estimate depth. Optional near-weight maps are a
sidecar input beside CameraMotionPlan, not a plan field.

## Destination interaction

Coordinates are normalized `0..1` with `(0, 0)` top-left and `(1, 1)`
bottom-right. See [DATA_MODEL.md](DATA_MODEL.md).

The user manipulates a **destination**. Vanishing point / focus of
expansion is derived later (human, experiment, or Cinematographer).
How that derivation works, including any use of depth, is an **open
question**. Camotion does not estimate depth or infer vanishing
point; the plan supplies the vanishing point. Depth estimation and CV
scene analysis stay outside Camotion.

For straight-ahead travel, destination and focus of expansion may
nearly coincide. They may also be offset. An off-center supplied
focus of expansion is valid Camotion v1 geometry; v1 does **not**
treat that offset as a physically accurate camera turn. Lateral
translation / strafing and turning / yaw are out of scope for v1 and
must not be conflated. How a future Cinematographer derives changing
camera geometry while turning toward a user-selected destination is
an **open question**.

## Variable autonomy

Use one Director loop: - collaborative --- frequent human choices; -
supervised --- pause at uncertainty/branch points; - autonomous ---
direct the full journey.

Human changes are preference signals. PreferenceState schema is an
**open question** --- do not design it for Camotion v1.

## Expensive-generation boundary

Approve still exploration before expensive video rendering. A later
primary action can be **Shoot Journey**.

## First product vertical slice (later)

The first useful *product* need not generate video. It should accept a
start frame/brief, generate a next viewpoint, show alternatives,
accept/replace a candidate, append it to the storyboard, allow
destination redirection, and repeat.

That slice depends on a MediaProvider contract and is **not** the
current milestone. Current research is Camotion and shooting-frame
experiments, with no UI.
