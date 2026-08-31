# TunnelVision UX Plan

This is the intended product workspace. It is **not** the current
implementation. The current code milestone is Camotion v1 only
(`image + CameraMotionPlan JSON → motion-conditioned still`). Do not
scaffold this UI yet.

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

## Frame modes

**Variations** --- alternate candidate viewpoints.

**Direction** --- large canonical image plus Director destination
marker. The user clicks/drags elsewhere to mean **go there**. The user
manipulates a destination, not a vanishing point.

**Motion** --- Cinematographer interpretation and conditioned preview.

Depth maps, masks and confidence values belong under Inspect/Advanced.

## Destination interaction

Coordinates are normalized `0..1` with `(0, 0)` top-left and `(1, 1)`
bottom-right. See [DATA_MODEL.md](DATA_MODEL.md).

The user manipulates a **destination**. Vanishing point / focus of
expansion is derived later (human, experiment, or Cinematographer).
How that derivation works, including any use of depth, is an **open
question**. Camotion v1 does not estimate depth or infer vanishing
point; the plan supplies it.

For straight motion, destination and focus of expansion may nearly
coincide. During a turn they may diverge.

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
current milestone. Current milestone: Camotion v1, no UI.
