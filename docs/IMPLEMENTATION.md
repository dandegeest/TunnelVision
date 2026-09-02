# TunnelVision Implementation Plan

## Strategy

Build uncertain technical ideas as small experiments before building
infrastructure around them.

**Current track (now):** Camotion v1 exists. A frozen
`CameraMotionPlan` plus radial exposure produces shooting frames.
Optional near-weight scaling is an experimental sidecar. Reverse
engineering of Terran Boylan's original TunnelTV Photoshop Action is
complete enough to stop Action forensics. The next Camotion milestone
is a **controlled renderer experiment** (not a replacement, not this
documentation task): depth-banded, motion-aware, multi-exposure
compositing versus the current continuous near-weight renderer, on the
existing Ghost Library fixture.

**Later track (not now):** Director / product --- automate the canonical
still-journey loop, then Cinematographer / video. After the Camotion
renderer experiment (and any justified baseline freeze), the already
planned next product-research milestone remains Automated
Cinematographer + Camotion Benchmark Harness. Do not scaffold those
tracks in this documentation checkpoint.

Do not bundle Cinematographer into the Camotion experiment. Camotion is
graphics code with a JSON contract. Cinematographer module boundaries
remain an open question.

## What exists vs what not to scaffold

Planning docs in `docs/` describe current architecture.
`camotion/` is implemented.

Do **not** create `web/`, `server/`, `providers/`, Director modules,
Cinematographer modules, PreferenceState, journey workspace layout, or
other application scaffolding in this research stage.

## Camotion v1 is an experiment, not TunnelTV

Terran Boylan's original **TunnelTV** motion-conditioning workflow, as
described in the genesis log, preprocessed keyframes in Photoshop so
they already looked like the camera was moving. That known workflow
included:

-   Z / depth information
-   two different blur operations
-   protection of the intended destination area from blur

together with continuous-motion **prompt** language.

Camotion v1 is **not** a recreation or port of that Photoshop Action.
The Action has now been reverse-engineered as **reference research**;
that research does not make Camotion a reimplementation of Terran's
script. Implemented Camotion remains a **radial-exposure experiment
inspired by TunnelTV findings**: can a small geometric JSON plan plus
a radial motion field, optional near-weight scaling, multisample
exposure, and a protected destination make pixels communicate forward
motion?

Credit for motion-conditioned keyframes, depth-aware blur, destination
protection, and the generic continuous-motion prompting strategy remains
with Terran Boylan / TunnelTV. Camotion architecture, interpretation,
and the compositor hypothesis below are ours, not Terran's claims.
Optional near-weight scaling lives **outside** CameraMotionPlan;
Camotion still does not estimate depth.

## Current code --- Camotion v1

> **Take an image and a CameraMotionPlan JSON file and produce a
> shooting frame that communicates forward camera motion.**

``` text
image + CameraMotionPlan
  → forward radial motion field around supplied focus of expansion
  → optional near-weight multiplication (if --depth supplied)
  → multisample exposure
  → protected destination
  → shooting-frame image
```

v1 does **not** implement lateral translation / strafing or turning /
yaw. Those are different motions; do not encode a turn as a strafe.

CLI:

``` bash
python -m camotion --image input.png --plan camera-motion.json --output output.png
python -m camotion --image input.png --plan camera-motion.json --depth near-weight.png --output output.png
```

`--plan` is a **CameraMotionPlan** JSON file, not a `ShotPlan`.
`--depth` is optional. CameraMotionPlan v1 stays frozen: no depth
field.

Contract: [DATA_MODEL.md](DATA_MODEL.md). Implementation language:
Python / Pydantic. No TypeScript, Node, LLM, or media-provider
dependency.

Package:

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
    depth.py
    render.py
  tests/
  examples/
  tuning/
```

`depth.py` scales the existing radial field by a supplied near-weight
map. It does not estimate depth. Experimental map generation (Depth
Anything V2 Small, relative per-image near-weight) lives outside the
engine, currently as a `tuning/` utility.

Do **not** add to Camotion: depth estimation, LLM calls, media APIs,
UI, 6-DOF, segmentation, GPU rendering, video, `ShotPlan`, `B_in` /
`B_out`, lateral translation / strafing, or turning / yaw.

## Later phases (not current work)

Intended Camotion / Cinematographer research order:

1.  Reverse-engineer Terran Boylan's TunnelTV Photoshop Action ---
    **complete enough to proceed** (this checkpoint).
2.  Controlled Camotion renderer experiment: deterministic
    depth-banded, motion-aware, multi-exposure compositing versus the
    current continuous near-weight renderer, compared on the existing
    Ghost Library fixture before any replacement decision.
3.  Validate / freeze an updated Camotion baseline **if** that
    experiment justifies it. Do not assume it will.
4.  Automated Cinematographer + Camotion Benchmark Harness.
5.  Cross-style / cross-model experiments.

Do **not** implement any of those remaining milestones in this
documentation checkpoint. CameraMotionPlan v1 stays frozen. Do not add
Photoshop-specific fields, blur amounts, depth bands, or renderer
selection to the plan.

These later product phases remain ordered so that **the MediaProvider
contract exists before Director code depends on it**. Do not implement
providers, Director, or Cinematographer while the Camotion renderer
experiment is still open.

The current intended video path is shooting-frame start, shooting-frame
end, and locomotion prompt. Extra pristine/canonical reference images
are not part of the current architecture.

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

The video request, when designed, should represent:

-   start shooting frame
-   end shooting frame
-   prompt
-   model / provider-specific capabilities **hidden behind the adapter**

Do **not** fully design that schema in this Camotion pass. Extra
pristine reference images are not current architecture.

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

### Optional depth weighting (implemented experimental sidecar)

CameraMotionPlan v1 stays frozen. Near-weight is a sidecar renderer
input: white / 1.0 = near = full motion; black / 0.0 = far = reduced
motion. Depth estimation stays outside Camotion.

On the Ghost Library still (`tuning/01.jpeg`), radial-only `01.3` is
the baseline; `01.4` uses the same plan plus a relative near-weight
map. The depth-weighted still improved foreground/background motion
ordering, especially far-field architecture. That does **not** make
depth weighting a required production feature. Do not remove this
path.

A video run from conditioned start/end shooting frames, with no extra
pristine reference, still showed a recursive-library artifact. Terran
Boylan's original TunnelTV Ghost Library motion frame also uses strong
near-field motion and stable far architecture, which weakened the
hypothesis that depth weighting itself caused the recursion.

### Terran Action reverse-engineering (closed enough to proceed)

Terran supplied the original Photoshop `.ATN` and then a batchPlay /
ActionJSON-style export. Primary evidence lives at
`camotion/tuning/async function auto3DRadialBlurSave.json`
(binary Action: `camotion/tuning/Auto-3D-Radial-Blur-Save-Close.ATN`).
Do not treat the following as Camotion spec or as something Terran
claimed about Camotion.

**Observed Action behavior (conceptual reduction):** a strong Zoom
Blur 12 layer and a medium Zoom Blur 8 layer, each with a
depth-derived mask, composited over the pristine source. Photoshop
Neural Filters generate/refine depth. The strong image **and** its
mask both receive Zoom Blur 12; the medium mask uses Levels input
`[203, 243]`, invert, and a light Gaussian. Working depth polarity
appears to be black = near, white = far before Terran's inversion
(same polarity as the available Ghost Library depth proxy).

**Our interpretation:** depth-banded, motion-aware exposure
compositing, not "radial blur multiplied continuously by depth."

**Our hypothesis, unproven in Camotion:** spreading the strong mask
along the exposure direction may read as photographic motion rather
than stretched geometry, and the recursive-space video artifact may
relate more to the character of the current continuously depth-scaled
radial exposure than to depth itself.

A diagnostic PNG at
`camotion/tuning/analysis/01-terran-mask-polarity-analysis.png`
reconstructs approximate mask polarity/spatial behavior using the
existing Ghost Library depth proxy and an approximate zoom-blur. It
is **not** Photoshop Neural Filter depth, **not** Photoshop Radial
Blur, **not** a pixel-faithful Action recreation, and **not** a
Camotion renderer result.

### Next Camotion milestone --- controlled compositor experiment

Test a deterministic depth-banded + motion-aware + multi-exposure
compositor against the current renderer on the Ghost Library fixture
**before** any replacement decision. Experimental path only. Preserve
Cinematographer-selected vanishing point, destination protection,
external/interchangeable depth, normalized geometry, and
deterministic/testable processing. Do not hardcode Photoshop values
as the permanent public contract. Do not implement `B_in` / `B_out`,
turning/yaw/strafe, Neural Filters, or video-architecture changes in
that experiment.

### Cinematographer integration

Open question: module boundaries. Intended *role*: for accepted frame
pairs, analyze route/geometry, emit ShotPlan, derive CameraMotionPlan,
invoke Camotion, fill a locomotion template, call the video provider,
and judge traversal rather than endpoint resemblance. Do not scaffold
this until the role is needed and the MediaProvider video request
exists.

### Shoot Journey

Later product action: plan/review canonical storyboard, derive shooting
frames, render video from those shooting frames, assemble in canonical
order, surface failures.

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

Krea `@img-1` extra pristine references appeared in later genesis
tests. That is a **provider capability**. A subsequent control without
the extra reference still showed the recursive-library artifact, so
that extra reference is **not** current architecture and is **not**
treated as the cause of the artifact. Do not bake extra pristine refs
into Camotion or the core journey model.

## Development tools

**Cursor:** docs/architecture consistency, later scaffolding, UI and
cross-module refactors.

**GitHub Copilot CLI:** bounded engineering tasks, especially Camotion
modules, tests, numerical/image-processing debugging.

Avoid asking either tool to "build TunnelVision." Give milestone-sized
tasks. This checkpoint is documentation only. The next Camotion
engineering milestone is the controlled compositor experiment, not a
silent replacement of the current renderer.

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
-   depth estimation as CV outside Camotion
-   whether depth-banded, motion-aware multi-exposure compositing
    outperforms the current continuous near-weight renderer (next
    experiment; not implemented)
-   recursive-space / reconstituted-environment video artifacts
-   final Cinematographer module boundaries
-   how a future Cinematographer derives changing camera geometry while
    turning toward a user-selected destination
