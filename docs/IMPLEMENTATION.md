# TunnelVision Implementation Plan

## Strategy

Build uncertain technical ideas as small experiments before building
infrastructure around them. Two tracks meet through stable JSON
contracts:

1.  **Camotion/Cinematographer experiments** --- prove structured camera
    geometry can produce useful motion-conditioned anchors.
2.  **Director/product implementation** --- automate the canonical
    still-journey loop.

## Phase 0 --- docs and boundaries

Create `docs/`, `web/`, `server/`, `camotion/` and `workspace/`. Do not
populate unnecessary services/provider implementations.

## Phase 1 --- Camotion prototype

Suggested package:

``` text
camotion/
  pyproject.toml
  src/camotion/
    __init__.py
    __main__.py
    plan.py
    coordinates.py
    flow.py
    exposure.py
    masks.py
    render.py
  tests/
  examples/
```

CLI:

``` bash
python -m camotion --image input.png --plan shot.json --output output.png
```

v1: - load PNG/JPEG; - validate CameraMotionPlan; - convert normalized
coordinates; - generate radial forward-motion vectors around supplied
vanishing/focus point; - create spatially varying multisample
exposure; - feather a rectangular protected destination; - save
output; - test validation, coordinates, flow direction and destination
protection.

Do **not** initially add depth estimation, LLM calls, media APIs, UI,
arbitrary 6-DOF motion, segmentation, GPU rendering or video.

First prove:

`VP -> radial flow -> multisample exposure -> protected destination`

## Phase 2 --- manual vision-to-JSON experiment

Use a known frame. Manually ask a multimodal reasoning model to emit
ShotPlan and CameraMotionPlan JSON.

Compare human-selected geometry, LLM-selected geometry and resulting
Camotion outputs.

This separately tests: 1. can vision reasoning infer useful cinematic
geometry? 2. can deterministic code turn it into useful motion
conditioning?

## Phase 3 --- depth-aware Camotion

Only after v1 is useful: add a supplied/estimated depth map,
depth-scaled motion, protected distant regions, linear-light
accumulation, and compare radial exposure with depth-aware
warp/accumulate techniques.

Longer-term model:

`image + depth + virtual camera movement -> subframe warps -> accumulation -> conditioned anchor`

## Phase 4 --- Director vertical slice

1.  story + starting image;
2.  scene analysis to validated JSON;
3.  Director proposes next move;
4.  media provider generates candidates;
5.  evaluator recommends;
6.  storyboard accepts canonical frame;
7.  user opens alternatives;
8.  user points to a new destination;
9.  repeat.

Video is not required.

## Phase 5 --- provider abstraction

Implement TunnelVision-owned types plus **ReplicateProvider** first. Add
RunwayProvider for the hackathon if accepted/rules permit. KreaProvider
remains optional.

## Phase 6 --- Cinematographer integration

For accepted frame pairs: analyze route/geometry, emit ShotPlan, derive
CameraMotionPlan, invoke Camotion, fill stable locomotion template, call
video provider, and evaluate traversal rather than endpoint resemblance.

## Phase 7 --- Shoot Journey

Plan/review canonical storyboard, create shot plans, condition anchors,
render video, assemble in canonical order and surface failures for
regeneration.

## Development tools

**Cursor:** repo-wide context, docs/architecture consistency,
scaffolding, UI and cross-module refactors.

**GitHub Copilot CLI:** bounded engineering tasks, especially Camotion
modules, tests, numerical/image-processing debugging and refactoring.

Avoid asking either tool to "build TunnelVision." Give milestone-sized
tasks.

## Hackathon strategy

Before the event: research, genesis log, Camotion, JSON contracts,
Director experiments, provider abstraction and appropriate UI
prototypes.

If accepted: confirm rules on pre-existing code; integrate native
Runway; tune against Runway models; assemble the strongest end-to-end
demo.

An original slow dark-ride-style journey is a useful benchmark because
route failures are obvious, but it is a test scenario rather than the
product definition.

## Immediate next milestone

> **Take an image and a CameraMotionPlan JSON file and make the pixels
> convincingly communicate forward camera motion.**
