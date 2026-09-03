# TunnelVision Implementation Plan

## Strategy

Build uncertain technical ideas as small experiments before building
infrastructure around them.

**Current track (now):** Camotion v1 exists. Default `render()` remains
the continuous near-weight radial-exposure path. On Ghost Library /
Seedance 2.5, the experimental depth-banded compositor with
**outgoing** start-frame exposure at **strength 0.08**
(`tuning/01.5-banded-result.png`, `tuning/01.5-banded-video.mp4`)
remains the current **video-tested** working baseline for **directed
A→B** research. It is **not** the default renderer and is **not** a
universal/frozen replacement. 01.6 rejected terminal-at-canonical
start exposure. 01.7 halved strength to 0.04: obvious initial
recursion disappeared, but starting-geometry fidelity got worse.
**0.04 is not promoted.** 01.8 added experimental route-preserved
exposure at the same 0.08 strength. The still behaved spatially as
intended. Seedance 2.5 via Krea later produced a real 01.8 video
(`tuning/01.8-route-preserved-video.mp4`): the camera initially
moved backward / retreated, then transitioned into forward
traversal. That is an observation, not a promotion. **01.8 is not
the directed baseline.** Do not treat route preservation as
architecture.

**Later track (not now):** Next planned engineering is a reusable
Replicate MediaProvider plus experiment runner, then controlled
reruns of the historical Camotion experiments. That work has **not
started**. After Camotion renderer research (and any justified
baseline freeze), the already planned product-research milestone
remains Automated Cinematographer + Camotion Benchmark Harness. Do
not scaffold those tracks in this documentation checkpoint.

Do not bundle Cinematographer into the Camotion experiment. Camotion is
graphics code with a JSON contract. Cinematographer module boundaries
remain an open question.

## What exists vs what not to scaffold

Planning docs in `docs/` describe current architecture.
`camotion/` is implemented.

Do **not** create `web/`, `server/`, `providers/`, Director modules,
Cinematographer modules, PreferenceState, journey workspace layout, or
other application scaffolding in this research stage.

## Camotion v1 is an experiment, not Terran's Photoshop Action

Terran Boylan's original **TunnelVision** motion-conditioning workflow, as
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
that approximates and extends aspects of Terran's original TunnelVision
workflow**: can a small geometric JSON plan plus
a radial motion field, optional near-weight scaling, multisample
exposure, and a protected destination make pixels communicate forward
motion?

Credit for motion-conditioned keyframes, depth-aware blur, destination
protection, and the generic continuous-motion prompting strategy remains
with Terran Boylan and original TunnelVision. Camotion architecture, interpretation,
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
    experimental_composite.py
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

1.  Reverse-engineer Terran Boylan's original TunnelVision Photoshop Action ---
    **complete enough**.
2.  Controlled depth-banded, motion-aware compositor experiment ---
    **completed successfully enough to continue** (Ghost Library 01.5
    outgoing orientation; current working experimental baseline, not a
    permanent/universal renderer replacement).
3.  Controlled start-frame temporal-orientation experiment ---
    **completed; rejected on Ghost Library**. Terminal-at-canonical
    start exposure worsened the initial reconstruction. Keep the
    experimental code and evidence; do not adopt that orientation.
4.  Controlled start-frame strength reduction (0.08 → 0.04) ---
    **completed on Ghost Library / Seedance 2.5**. Obvious initial
    recursion disappeared; source-geometry authority got worse.
    **0.04 not promoted.** 01.5 / 0.08 remains the directed A→B
    video-tested working baseline. Not cross-scene or cross-model.
5.  Controlled route-preserved exposure (01.8) --- **completed on
    Ghost Library / Seedance 2.5; not promoted**. Same 01.5
    compositor and 0.08 strength. A geometric traversal corridor
    attenuates strong/medium exposure inside the route. Still:
    stronger peripheral motion retained, more canonical geometry
    in the central corridor. Compact central features such as
    candles appeared less discretely duplicated --- an
    observation, not a proven mechanism, and not claimed to have
    caused any video behavior. Direct comparison with Terran's
    original Ghost Library reference suggested the largest change
    was in the intended central region; do not treat pixel
    similarity as an optimization target. Transient Krea
    rejections of 01.8, and of a 01.5 control rerun, are not
    evidence against 01.8. Krea later accepted 01.8. The video
    preserved enough motion conditioning to produce strong
    forward traversal, but the opening showed an apparent
    backward/retreat camera movement before transitioning into
    forward travel. That is materially different from the desired
    behavior. It raises the possibility that still-image exposure
    cues may communicate motion magnitude, axis, and depth
    without unambiguously communicating temporal direction. That
    hypothesis is unproven and requires controlled follow-up. Keep
    the experimental code and evidence. Do not promote 01.8. Do
    not add route preservation to CameraMotionPlan. 01.5 / 0.08
    remains the directed A→B video-tested working baseline.
6.  Reusable Replicate MediaProvider + experiment runner, then
    controlled reruns of the historical Camotion experiments ---
    **planned next; not started**.
7.  Validate / freeze an updated Camotion baseline **if** justified.
    Do not assume it will. Do not call 01.5 the permanent baseline.
8.  Automated Cinematographer + Camotion Benchmark Harness.
9.  Cross-style / cross-model experiments.

CameraMotionPlan v1 stays frozen. Default `render()` stays the
continuous near-weight path. Do not formalize `A_in` / `A_out` or
`B_in` / `B_out`.

These later product phases remain ordered so that **the MediaProvider
contract exists before Director code depends on it**. Do not implement
providers, Director, or Cinematographer in this documentation
checkpoint.

The current intended video path is shooting-frame start, shooting-frame
end, and locomotion prompt. Extra pristine/canonical reference images
are not part of the current architecture.

For **directed A→B** traversal, the conditioned start and end frames
are authoritative shot endpoints. The generated video's boundary
frames should match those supplied endpoints as closely as the video
model permits, ideally pixel-perfect. Evaluation priority: (1)
endpoint fidelity, (2) coherent spatial traversal between endpoints,
(3) locomotion/parallax quality, (4) creative scene evolution only
insofar as it does not violate endpoint authority. This is an
evaluation/product requirement, not a CameraMotionPlan field.

That endpoint-authority requirement is specifically for directed
A→B. Future Discovery / open-exploration generation may intentionally
permit the model to invent future geometry after an authoritative
starting frame. Do not redesign architecture around that mode here.

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
Boylan's original TunnelVision Ghost Library motion frame also uses strong
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

The 01.5 experiment later provided supporting evidence for that
interpretation on one fixture; it did not prove it generally.

A diagnostic PNG at
`camotion/tuning/analysis/01-terran-mask-polarity-analysis.png`
reconstructs approximate mask polarity/spatial behavior using the
existing Ghost Library depth proxy and an approximate zoom-blur. It
is **not** Photoshop Neural Filter depth, **not** Photoshop Radial
Blur, **not** a pixel-faithful Action recreation, and **not** a
Camotion renderer result.

### Depth-banded compositor experiment (completed enough to continue)

An experimental path (`experimental_composite.py`, invoked via
`tuning/render_banded.py`, not default `render()`) composites:

``` text
pristine source
+ medium radial exposure × near/mid mask
+ strong radial exposure × motion-treated strong mask
→ destination protection
```

Ghost Library still: `tuning/01.5-banded-result.png` (not a frozen
baseline). Diagnostic masks live under `tuning/analysis/`. Corresponding
video: `tuning/01.5-banded-video.mp4`.

On that fixture, the still read as more photographic than continuous
near_weight 01.4, and the video **materially reduced** the previous
multi-second recursive/reconstructed-space behavior. A shorter
reconstruction artifact remained during approximately the first second.
One fixture; default renderer not replaced. **01.5 outgoing
orientation remains the working experimental baseline.**

### Start-frame temporal-orientation experiment (completed; rejected)

One-variable A/B on Ghost Library: same 01.5 compositor, plan, depth,
strengths, masks, destination, end shooting frame, and locomotion
setup; only the start-frame sample set changed from outgoing
`p - field*t` to terminal-at-canonical `p + field*t`.

Still: `tuning/01.6-terminal-start-result.png`. Video:
`tuning/01.6-terminal-start-video.mp4`. Diagnostic:
`tuning/analysis/01.6-vs-01.5-absdiff.png`.

On that fixture, reversing start-frame orientation **worsened** the
initial spatial reconstruction: a stronger collapse/retreat, then
reconstruction, before coherent forward traversal. Reject
terminal-at-canonical start exposure as the working hypothesis here.
Retain 01.5 outgoing orientation. Keep the experimental helper and
evidence; do not tune 01.6; do not introduce `A_in` / `A_out` or
`B_in` / `B_out`; do not replace default `render()`. One fixture; not
cross-scene validation.

### Reduced-strength start-frame experiment (completed; 0.04 not promoted)

One-variable A/B on Ghost Library / Seedance 2.5: same 01.5
depth-banded outgoing compositor, depth, masks, softening, VP,
destination protection, sample count, end shooting frame, locomotion
prompt, and model/settings; only start-frame `exposure.strength`
changed from **0.08** to **0.04**. Medium remains `strength × 8/12`.
Plan fixture: `tuning/01.7-banded-strength-004-plan.json`. Still:
`tuning/01.7-banded-strength-004-result.png`. Video:
`tuning/01.7-banded-strength-004-video.mp4`.

01.7 **removed** the obvious initial recursive/reconstructed-space
event seen in 01.5. It is **not** simply a success: Seedance
immediately reinterpreted/warped the starting spatial geometry more
substantially (a different/narrower inferred corridor) instead of
preserving the authored starting geometry as closely as directed A→B
requires. Later forward traversal and doorway crossing remained
coherent.

Do not describe 01.7 simply as worse either. It exposed a
**conditioning-authority tradeoff** on this fixture: weaker
conditioning reduced obvious recursion but also reduced authority over
source geometry. **0.04 is not promoted over 0.08.** 01.5 / 0.08
remains the current working baseline for directed A→B research. One
fixture and one video model; no cross-scene or cross-model claim. Do
not add a strength-architecture field; do not replace default
`render()`.

### Cinematographer integration

Open question: module boundaries. Intended *role*: for accepted frame
pairs, analyze route/geometry, emit ShotPlan, derive CameraMotionPlan,
invoke Camotion, fill a locomotion template, call the video provider,
and judge directed A→B shots by endpoint fidelity first, then
traversal. Do not scaffold this until the role is needed and the
MediaProvider video request exists.

### Shoot Journey

Later product action: plan/review canonical storyboard, derive shooting
frames, render video from those shooting frames, assemble in canonical
order, surface failures.

## Experimental artifact --- continuous-locomotion prompt

Genesis video tests found that destination-matching prompts often
**dissolved** one still into another, while Terran Boylan's original
TunnelVision continuous-motion language produced convincing travel on **Seedance
2.5 via Krea**.

This is an experimental artifact, not a frozen product template and
**not** claimed to be model-independent. Scene-specific nouns in the
passing prompt are fill-in, not the locomotion principle. A later
Cinematographer should fill a stable grammar from structured scene
data rather than freely rewriting the whole prompt. That templating
system is not designed yet.

Provenance: Terran Boylan's original TunnelVision motion-prompting;
documented in
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
tasks. This checkpoint is documentation of the 01.7 strength
tradeoff. Do not start another Camotion renderer experiment here, and
do not silently replace default `render()`.

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
-   start-frame temporal orientation: **rejected on Ghost Library**
    (terminal-at-canonical worsened the initial reconstruction; 01.5
    outgoing remains the working experimental baseline; not
    cross-scene)
-   start-frame exposure strength: **0.04 not promoted** on Ghost
    Library / Seedance 2.5 (obvious recursion gone; starting-geometry
    fidelity worse; 01.5 / 0.08 remains directed A→B working
    baseline; conditioning-authority tradeoff; not cross-scene or
    cross-model)
-   recursive-space / reconstituted-environment video artifacts
    (reduced on Ghost Library 01.5 outgoing, not eliminated; 01.6
    made the start-of-shot behavior worse; 01.7 removed the obvious
    initial event at the cost of endpoint geometry authority)
-   final Cinematographer module boundaries
-   how a future Cinematographer derives changing camera geometry while
    turning toward a user-selected destination
