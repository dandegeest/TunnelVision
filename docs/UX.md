# TunnelVision UX Plan

This is the intended product workspace. It is **not** the current
implementation. Current code is Camotion v1
(`image + CameraMotionPlan JSON` → shooting-frame still; optional
near-weight sidecar), plus the Integration Test 01 pipeline in
`media/` (image generation, vision reasoning, thin cinematographer
planning, Seedance). Do not scaffold this UI yet.

## Primary interaction (current product direction)

The first product surface is a **simple autonomous storyboard**, not a
large interactive editor.

1.  User gives TunnelVision a story / journey concept.
2.  TunnelVision plans the film.
3.  Storyboard frames appear progressively as generation completes.
4.  Optional cheap canonical intervention: Keep, Redo, possibly Redo
    With Note / Adjust.
5.  User presses **SHOOT MOVIE**.
6.  Cinematographer planning, Camotion, video generation,
    evaluation/retry, and deterministic assembly run unattended.

The storyboard is a readable representation of the autonomous crew's
decisions. It should reveal filmmaking intent without requiring
filmmaking vocabulary.

> **TunnelVision presents decisions, not generations.**

A redo of canonical D invalidates and recomputes adjacent shot
reasoning for C→D and D→E. Do not build this UI in the current
checkpoint.

## Primary workspace

The primary workspace is a clean left-to-right storyboard of **canonical
frames**:

`A → B → C → D → E → F`

The storyboard is the path; do not duplicate it with a separate reel.
Later, clicking a frame may open a large viewer for spatial-continuity
review. Destination pointing (**go there**) remains a later
collaborative mode, not the opening contract.

## Opening state

Minimum brief: a story / journey idea. Starting-frame upload and
approximate duration are later collaborative controls.

How duration maps to shot/viewpoint count, and whether individual
shots should use different supported durations, are **open
questions**. Do not invent a formula or schema in this checkpoint.

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

For **directed A→B** shots, the supplied start and end frames
(currently Camotion shooting frames derived from canonical A and B)
are the shot endpoints. Generated boundary frames should match those
endpoints as closely as the video model permits. Future Discovery /
open-exploration generation is a different mode and is not the
current storyboard contract.

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

Approve still exploration before expensive video rendering. The
current primary action name is **SHOOT MOVIE** (formerly described as
Shoot Journey). Canonical Keep / Redo happens before that action.
Intended later Cinematographer review of actual canonicals (PASS /
REGEN / REPAIR) is recorded in
[RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md) and is **not** implemented.

## First product vertical slice (later)

The first useful *product* is the autonomous storyboard plus SHOOT
MOVIE, not a manual destination editor. Integration Test 01 already
exercised the unattended filmmaking path after canonicals exist. The
storyboard UI itself is **not** the current milestone.

That slice now has MediaProvider image and video contracts in
`media/`. Current research also includes Camotion shooting frames, a
Replicate video runner, Integration Test 01, and a completed Wardrobe
A→B Seedance 2×2 (seed 70). A controlled
01.3–01.8 series exists. 01.5 remains the conservative
directed-traversal baseline. 01.8 Route-Preserved Exposure remains
the current Camotion baseline and is retained for Phase 1 as
motion-state conditioning complementary to Cinematographer locomotion
prompts. Scene-aware bounded strength `{0.02, 0.04, 0.08}` is preferred
over fixed `0.08`. **Camotion Phase 1 is frozen.** 01.9, 01.10, 01.11,
and 01.12 are still-only evidence and are not promoted.
**TunnelVision Research Phase 1 is complete.** Shootability /
intermediate volume is completed evidence, not current UI.
Unvalidated cinematographer control ideas (pace, embodiment, Prompt Only vs Auto,
velocity continuity) remain in
[RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md). There is no UI.
