# TunnelVision UX Plan

Product development has started. [`web/`](../web/) is a fixture-driven
Story | Timeline shell using Wardrobe Loop stills and videos. Camotion
v1 and the Integration Test 01 pipeline in `media/` are unchanged.
Generation is not connected from the UI yet.

## Primary interaction (current product direction)

The first product surface is **Story | Timeline**, not a storyboard
strip and not a large NLE.

1.  User gives TunnelVision a story / journey concept (Story).
2.  Destinations and journeys appear on a locked timeline.
3.  Optional cheap destination intervention: Approve, Redo, possibly
    Redo With Note / Adjust (Directed policy).
4.  User presses **Shoot This Shot** or **Shoot Movie**.
5.  Cinematographer planning, Camotion, video generation,
    evaluation/retry, and deterministic assembly run (not wired in
    the current slice).

The timeline is a readable representation of the crew's decisions. It
should reveal filmmaking intent without requiring filmmaking
vocabulary.

> **TunnelVision presents decisions, not generations.**

A redo of destination D invalidates adjacent journeys C→D and D→E.
Invalidation is displayable; regeneration is not implemented in this
slice.

## Primary workspace

Primary nav is **Story | Timeline**.

Timeline has two locked lanes on one time axis:

- **Destinations** — generated sets. Loop closure may show another
  **occurrence** of destination A (`A | B | C | D | E | (A)`), not a
  sixth generated world.
- **Journeys** — shots between those occurrences. Destination frame
  **centers** sit on journey **boundaries**.

Preview sits above the timeline. A contextual inspector sits beside
it. Directed vs Autonomous is one project policy flag, not two UIs.

Shootability is **relational**: the Cinematographer judges whether an
intended journey between actual generated sets is shootable. Evidence
lives on the route. The UI may highlight the destination occurrence
that cannot be reached (the loop arrival at A) without marking
destination E as intrinsically unshootable.

A blocked journey is not automatically a Cinematographer repair.
Some failures should return to Plan so the Director can revise the
Destination design, then generate and inspect a new actual set. Plan
is where spatial filmmaking intent can be revised when production
evidence shows the planned movie cannot be physically shot as
intended. One later manual revised-E checkpoint recorded that loop;
it did not replace canonical E. See
[PRODUCT.md](PRODUCT.md) and
`camotion/integration/wardrobe-loop-01/experiments/upstream-e-replanning/`.

## Opening state

Minimum brief: a story / journey idea. Starting-frame upload and
approximate duration are later collaborative controls.

Slice 1 uses a uniform journey duration of 6 seconds as fixture
geometry. Variable duration remains later: destination times are
derived from the sum of prior journey durations.

## Canonical vs candidates

Only selected frames permanently occupy the destination lane.
Candidates are transient editing material. Opening destination C can
reveal `C1 C2 C3 C4`, with the Director recommendation marked.
Choosing another candidate replaces C. Downstream frames can become
provisional and be re-evaluated.

> **TunnelVision presents decisions, not generations.**

**Canonical vs shooting frames.** Destinations show **canonical /
pristine** frames: authoritative world-state images. Camotion derives
**shooting frames** from them. Video generation currently receives
those shooting frames. Canonical images remain the destination
authority; they are not currently passed to the video model.

For **directed A→B** shots, the supplied start and end frames
(currently Camotion shooting frames derived from canonical A and B)
are the shot endpoints. Generated boundary frames should match those
endpoints as closely as the video model permits. Future Discovery /
open-exploration generation is a different mode (`endDestinationId:
null`) and is not the current planned-timeline contract.

## Frame modes

**Variations** --- alternate candidate viewpoints.

**Direction** --- large destination image plus Director destination
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

Use one project and one UI. `agency` is a policy flag:

- directed --- pause for human approval at meaningful gates;
- autonomous --- the same actions auto-advance unless blocked.

Human changes are preference signals. PreferenceState schema is an
**open question** --- do not design it for Camotion v1.

Blocked shootability always surfaces. Autonomous mode cannot silently
ignore an unshootable journey.

## Expensive-generation boundary

Approve still exploration before expensive video rendering. The
current primary action names are **Shoot This Shot** and **Shoot
Movie**. Destination Keep / Redo happens before those actions. In the
current slice those production actions are labeled and disabled.
Intended later Cinematographer review of actual canonicals (PASS /
REGEN / REPAIR) is recorded in
[RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md) and is **not** implemented.

## First product vertical slice (started)

`web/` is a fixture shell: Wardrobe Loop vision JPEGs, playable
A-B / B-C / D-E, C-D rendered but needs review, E-A not shootable.
No providers, no Camotion subprocess, no Discovery. Integration Test
01 already exercised the unattended filmmaking path after canonicals
exist.

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
intermediate volume is completed evidence; the product shell now
surfaces E→A as a blocked journey, not as an intrinsic property of
destination E. Unvalidated cinematographer control ideas (pace,
embodiment, Prompt Only vs Auto, velocity continuity) remain in
[RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md).
