# TunnelVision Implementation Plan

## Strategy

Build uncertain technical ideas as small experiments before building
infrastructure around them.

**Current track (now):** Camotion v1 --- prove that a frozen
`CameraMotionPlan` plus deterministic radial exposure can make a still
communicate forward camera motion.

**Later track (not now):** Director / product --- automate the canonical
still-journey loop, then Cinematographer / video. Those tracks must not
be scaffolded until Camotion v1 is real.

Do not bundle Cinematographer into the Camotion experiment. Camotion is
graphics code with a JSON contract. Cinematographer module boundaries
remain an open question.

## What exists vs what to scaffold

Planning docs in `docs/` are the current plan.

**After this documentation pass, the next code step is to scaffold
`camotion/` only.**

Do **not** create `web/`, `server/`, `providers/`, Director modules,
Cinematographer modules, PreferenceState, journey workspace layout, or
other application scaffolding in that step.

## Camotion v1 is an experiment, not TunnelTV

Terran Boylan's original **TunnelTV** motion-conditioning workflow, as
described in the genesis log, preprocessed keyframes in Photoshop so
they already looked like the camera was moving. That known workflow
included:

-   Z / depth information
-   two different blur operations
-   protection of the intended destination area from blur

together with continuous-motion **prompt** language.

Camotion v1 is **not** a recreation, port, or reverse-engineering of
that Photoshop script. It is a **radial-exposure experiment inspired
by those findings**: can a small geometric JSON plan plus a radial
motion field, multisample exposure, and a protected destination make
pixels communicate forward motion?

Credit for motion-conditioned keyframes, depth-aware blur, destination
protection, and the generic continuous-motion prompting strategy remains
with Terran Boylan / TunnelTV. Camotion v1 tests a simpler, depth-free
stand-in so we can learn whether that class of cue is useful before
attempting depth-aware methods.

## Current code milestone

> **Take an image and a CameraMotionPlan JSON file and make the pixels
> convincingly communicate forward camera motion.**

``` text
image + CameraMotionPlan JSON
  → radial motion field
  → multisample exposure
  → protected destination
  → output image
```

CLI:

``` bash
python -m camotion --image input.png --plan camera-motion.json --output output.png
```

`--plan` is a **CameraMotionPlan** JSON file, not a `ShotPlan`.

Contract: [DATA_MODEL.md](DATA_MODEL.md). Implementation language:
Python / Pydantic. No TypeScript, Node, LLM, or media-provider
dependency.

Suggested package (when scaffolding `camotion/`):

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

v1 should: load PNG/JPEG; validate CameraMotionPlan v1; convert
normalized coordinates; generate a radial forward-motion field around
the supplied vanishing / focus point, mixed with `camera.lateral`;
run spatially varying multisample exposure scaled by
`exposure.strength` / `exposure.samples`; apply destination protection
as specified; write the output; test validation, coordinates, flow
direction, and protection.

Do **not** add to this milestone: depth estimation, LLM calls, media
APIs, UI, 6-DOF, segmentation, GPU rendering, video, `ShotPlan`,
`B_in` / `B_out`.

## Later phases (not current work)

These are ordered so that **the MediaProvider contract exists before
Director code depends on it**. None of them are part of the Camotion
milestone. Do not implement providers, Director, or Cinematographer
while building Camotion v1.

### After Camotion v1 --- optional manual vision-to-JSON

Use a known frame. Manually ask a multimodal model to emit a
CameraMotionPlan (and, separately if useful, an illustrative ShotPlan).
Compare human-selected geometry, model-selected geometry, and Camotion
outputs via the CLI.

This tests two questions without an application: (1) can vision
reasoning infer useful geometry? (2) can the v1 renderer turn it into
a useful motion cue?

### After Camotion v1 --- MediaProvider contract, then adapters

Specify TunnelVision-owned image/video request types **before** any
Director implementation calls a generator.

The video request, when designed, must be able to represent:

-   start frame
-   end frame
-   optional additional reference images
-   prompt
-   model / provider-specific capabilities **hidden behind the adapter**

Do **not** fully design that schema in this Camotion pass.

Then implement **ReplicateProvider** first. Add RunwayProvider if/when
the hackathon requires it. KreaProvider remains optional. Do not
scaffold unused adapters.

Director work must depend on the MediaProvider contract, not on a
raw Replicate/Runway/Krea client.

### After providers --- Director vertical slice

1.  story + starting image;
2.  scene analysis to validated JSON;
3.  Director proposes next move;
4.  MediaProvider generates candidates;
5.  evaluator recommends;
6.  storyboard accepts a canonical frame;
7.  user opens alternatives;
8.  user points to a new destination;
9.  repeat.

Video is not required for that slice. PreferenceState, duration → shot
count, and automated displacement scoring remain open questions --- do
not invent schemas to unblock the slice.

### Depth-aware Camotion

Only if v1 is useful **and** experiments justify it. Terran's original
workflow used depth; v1 deliberately does not. A later depth-aware
method is an **open implementation question**, not a scheduled v1
follow-on with a designed algorithm.

### Cinematographer integration

Open question: module boundaries. Intended *role*: for accepted frame
pairs, analyze route/geometry, emit ShotPlan, derive CameraMotionPlan,
invoke Camotion, fill a locomotion template, call the video provider,
and judge traversal rather than endpoint resemblance. Do not scaffold
this until the role is needed and the MediaProvider video request
exists.

### Shoot Journey

Later product action: plan/review canonical storyboard, condition
anchors, render video, assemble in canonical order, surface failures.

## Experimental artifact --- continuous-locomotion prompt

Genesis video tests found that destination-matching prompts often
**dissolved** one still into another, while Terran Boylan's TunnelTV
continuous-motion language produced convincing travel on **Seedance
2.5 via Krea**.

This is an experimental artifact, not a frozen product template and
**not** claimed to be model-independent. Scene-specific nouns in the
passing prompt are fill-in, not the locomotion principle. A later
Cinematographer should fill a stable grammar from structured scene
data rather than freely rewriting the whole prompt. That templating
system is not designed yet.

Provenance: TunnelTV motion-prompting (Terran Boylan); documented in
`genesis/TunnelVision_Prototype_Exploration_Log.html` Test 08
(controlled B→D pass; same anchors as a failing destination-oriented
prompt). Test 09 used the same locomotion grammar on motion-conditioned
library anchors; accidental ravine language still produced a strong
traversal, which is evidence that **motion grammar + conditioned
endpoints** outweighed scene-specific prose **on that model**.

### Test 08 prompt (passing artifact)

``` text
First person POV camera continuously moving forward through a
spatially-contiguous environment at a constant, fast speed, traveling
deeper through the earthen ravine in uninterrupted forward motion,
turning corners or passing beneath roots or around earthen banks or
through vegetation, dust, fog, mist, or foreground objects if necessary
to continue moving forward. The camera never stops advancing through
the environment. Nearby roots, trees, rocks, and terrain pass beside
the camera and move behind it as new terrain is continuously revealed
ahead. Leaves, dust, and loose particles move naturally through the air
as the camera passes. No music, no soundtrack, no dialogue.
```

Locomotion grammar (stable): continuous forward travel; never stop
moving; spatially contiguous environment; foreground objects pass
beside/behind the camera; new terrain revealed ahead; incidental
particles; no soundtrack.

Scene-specific (not universal): "earthen ravine", roots, banks,
vegetation.

Krea `@img-1` extra references appeared in later tests. That is a
**provider capability**, to be hidden behind a future adapter, not
baked into Camotion or the core journey model.

## Development tools

**Cursor:** docs/architecture consistency, later scaffolding, UI and
cross-module refactors.

**GitHub Copilot CLI:** bounded engineering tasks, especially Camotion
modules, tests, numerical/image-processing debugging.

Avoid asking either tool to "build TunnelVision." Give milestone-sized
tasks. The current milestone is Camotion v1 only.

## Hackathon strategy

Before the event: genesis log, Camotion v1, JSON contracts, then ---
only as needed --- MediaProvider contract, Replicate, Director
experiments, UI prototypes.

If accepted: confirm rules on pre-existing code; add native Runway
behind the same MediaProvider contract; tune against Runway models;
assemble the strongest end-to-end demo.

An original slow dark-ride-style journey is a useful **test scenario**,
not the product definition.

## Open questions

Do not resolve these in Camotion v1 or by inventing schemas now:

-   `B_in` / `B_out` handoff strategy
-   automated traversal scoring
-   PreferenceState schema
-   duration → shot count
-   depth estimation implementation
-   final Cinematographer module boundaries
