# TunnelVision Implementation Plan

## Strategy

Build uncertain technical ideas as small experiments before building
infrastructure around them.

**Current track (now):** Camotion v1 exists. Default `render()` remains
the continuous near-weight radial-exposure path. On Ghost Library /
Seedance 2.5, the experimental depth-banded compositor with
**outgoing** start-frame exposure at **strength 0.08**
(`tuning/01.5-banded-result.png`) remains the conservative
**directed-traversal baseline**. It is **not** the default renderer
and is **not** a universal/frozen replacement. Historical Krea videos
remain prior evidence and must not be overwritten.

A controlled Replicate Seedance 2.5 series now exists for 01.3, 01.4,
01.5, 01.6, 01.7, and 01.8 under
`tuning/video-runs/replicate-bytedance-seedance-2.5/`. **01.8
Route-Preserved Exposure remains the current Camotion baseline.**
01.5 remains the conservative directed-traversal video baseline on
this fixture. 01.9 Adaptive Exposure Integration is completed
still-only evidence; the sparse-sampling hypothesis was **not
supported**. 01.9 is **not** promoted. 01.6 did not reproduce the
severe terminal-orientation collapse/retreat previously seen through
Krea. 01.8 did not reproduce the pronounced backward-then-forward
opening previously seen through Krea. Those Krea behaviors should not
currently be treated as intrinsic properties of the Camotion
variants.

A separate **prompt-control** family holds 01.8 shooting frames constant
and varies linguistic camera instruction. It is **not** Camotion 01.9.
On Ghost Library / Seedance 2.5, `seedance-slow` produced a perceptibly
slower traversal than the fast 01.8 control while remaining
dolly/Steadicam-like rather than literal walking.
`seedance-slow-embodied` did not clearly add footstep-driven human
locomotion. Those are one-run observations, not proof. Unvalidated
product ideas from this work live in
[RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md). 01.10 Depth-Compositor
Ablation is completed still-only diagnostic evidence; the
multi-layer compositor hypothesis was **not supported as the origin
of first appearance** on this fixture. 01.10 is **not** promoted.
01.11 Exposure Operator Characterization is completed still-only
diagnostic evidence; sparse trajectory sampling is **not** the
dominant remaining cause of structured Ghost Library copies. 01.11
is **not** promoted. 01.12 Baked-Exposure Operating Window is
completed still-only diagnostic evidence; no useful pristine-source
operating window was observed on Ghost Library. Classification
**C + D**. 01.12 is **not** promoted. This closes the current
exposure-operator tuning branch. Do not begin the next Camotion
experiment from this checkpoint. Do not call any next Camotion
experiment 01.13 from this checkpoint.

**Integration Test 01 — The Wardrobe Loop is completed.** First
unattended end-to-end TunnelVision movie experiment. Not Camotion
01.13. Independent FLUX 1.1 Pro Ultra canonicals A–E (F byte-identical
to A), Gemini 3.1 Pro vision shot plans, pinned Camotion 01.8 shooting
frames, Seedance 2.5 videos, zero video retries, no Camotion retuning.
Human-reviewed assembled movie:
`camotion/integration/wardrobe-loop-01/videos/ThoughTheWardrobe.mov`.
Do not characterize the test as Camotion solving or failing
traversal. Compelling traversals occurred; Camotion stills still show
baked-exposure artifacts. The movie-level metric is whether the model
shoots the route. See
`camotion/integration/wardrobe-loop-01/REPORT.md`.

**Later track (not now):** After Camotion renderer research (and any
justified baseline freeze), the already planned product-research
milestone remains Automated Cinematographer + Camotion Benchmark
Harness. Do not scaffold Director, Screenwriter, UI, or expand the
thin Integration Test 01 cinematographer into a product package in
this checkpoint.

Do not bundle Cinematographer into the Camotion experiment. Camotion is
graphics code with a JSON contract. Cinematographer module boundaries
remain an open question.

## What exists vs what not to scaffold

Planning docs in `docs/` describe current architecture.
`camotion/` is the Python renderer. `media/` is the MediaProvider
package (image + video), ReasoningProvider, and a thin cinematographer
pair planner used by Integration Test 01. Credentials are environment
variables (`REPLICATE_API_TOKEN` today), filled locally from gitignored
`.env.local` and injected by the deployment platform in CI. See
`media/README.md`.

Do **not** create `web/`, `server/`, Director modules, Screenwriter,
a full Cinematographer product package, PreferenceState, journey
workspace layout, or other application scaffolding in this research
stage.

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
    hypothesis is unproven. Keep the experimental code and evidence.
    Do not promote 01.8. Do not add route preservation to
    CameraMotionPlan. 01.5 / 0.08 remains the conservative directed
    A→B baseline. 01.8 is the leading experimental branch.
6.  Reusable Replicate MediaProvider + controlled historical
    reruns --- **completed on Ghost Library / Seedance 2.5 via
    Replicate.** The MediaProvider/batch pipeline works end-to-end.
    Frozen A′→B′ series: 01.3, 01.4, 01.5, 01.6, 01.7, 01.8 under
    `tuning/video-runs/replicate-bytedance-seedance-2.5/`. Same B′,
    prompt, duration, model, and settings; only Camotion A′ differs.
    Historical Krea videos were not overwritten.
    A parallel prompt-control family (`seedance-slow`,
    `seedance-slow-embodied`) varies linguistic camera instruction
    on frozen 01.8 A′/B′. That is not Camotion 01.9. See
    [RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md).
7.  Controlled adaptive exposure integration (01.9) --- **completed
    on Ghost Library still; hypothesis not supported; not
    promoted.** Same 01.8 compositor, source, depth, strength, route
    preservation, and destination protection. Only change:
    path-length-adaptive exposure taps. Keep the opt-in code and
    evidence. Do not start a Seedance/video test for 01.9.
8.  Diagnostic compositor ablation (01.10) --- **completed on Ghost
    Library still; classification A; compositor hypothesis not
    supported as the origin of first appearance; not promoted.**
    Same 01.8 source, geometry, 16-tap exposure, masks, route
    preservation, and destination protection. Only change:
    extraction of real 01.8 intermediates. Keep the diagnostic
    code and evidence. Do not start a Seedance/video test for
    01.10.
9.  Diagnostic exposure-operator characterization (01.11) ---
    **completed still-only; sparse sampling not the dominant
    remaining cause; no candidate promoted.** Same 01.8 trajectory
    geometry. Exposure only: no compositor, depth, masks, route, or
    destination protection. Keep the diagnostic code and evidence.
    Do not start a Seedance/video test for 01.11.
10. Diagnostic baked-exposure operating window (01.12) ---
    **completed still-only; classification C + D; no useful
    pristine window; exposure-operator tuning branch closed; not
    promoted.** Existing 01.8 fixed-16 gather only. Strengths
    0.02 / 0.04 / 0.06 / 0.08 × pristine / sigma=1 diagnostic
    control. Keep the diagnostic code and evidence. Do not start a
    Seedance/video test for 01.12. Do not search additional
    strengths, sigma values, shutter weightings, integration
    kernels, or compositors. Do not begin the next experiment from
    this checkpoint.
11. Integration Test 01 — The Wardrobe Loop --- **completed.** Not
    Camotion 01.13. Independent text-to-image canonicals, no
    reference-image chaining, F byte-identical to A, five shots, zero
    video retries, no human intervention between shot generations, no
    Camotion retuning, pinned 01.8. Human-reviewed assembled movie
    preserved as `videos/ThoughTheWardrobe.mov`. Browser playback
    derivative: `videos/ThoughTheWardrobe.mp4` (H.264 bitstream copy,
    audio omitted). Do not reopen 01.12 brute-force exposure tuning.
12. Deterministic final-video assembly --- **implementation
    follow-up, not done in this checkpoint.** Concatenate ordered
    successful shot videos into a final MP4. Hard butt joins. No
    transitions, optical flow, stabilization, or grading. Plumbing,
    not an Edit agent. Do not invent creative editing.
13. Validate / freeze an updated Camotion baseline **if** justified.
    Do not assume it will. Do not promote 01.9, 01.10, 01.11, or
    01.12. **01.8 remains the current Camotion baseline.** Do not
    start Camotion 01.13. Scene-aware Camotion strength selection is
    unvalidated backlog, not the next numbered Camotion experiment.
14. Automated Cinematographer + Camotion Benchmark Harness.
15. Cross-style / cross-model experiments.

CameraMotionPlan v1 stays frozen. Default `render()` stays the
continuous near-weight path. Do not formalize `A_in` / `A_out` or
`B_in` / `B_out`.

These later product phases remain ordered so that **the MediaProvider
contract exists before Director code depends on it**. Image and video
MediaProvider slices now live in `media/`. Do not implement Director
or Screenwriter in this checkpoint. Do not expand the thin Integration
Test 01 cinematographer into a product package.

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

### Controlled Replicate historical series (completed)

The Replicate MediaProvider, Seedance 2.5 adapter, and sequential
batch runner now work end-to-end. Evidence filenames are
self-identifying:
`<experiment>/<experiment>-result.mp4` and
`<experiment>/<experiment>-run.json`.

Frozen control (same for every run): Ghost Library locomotion prompt,
duration 6, 720p, `aspect_ratio` adaptive, `generate_audio` false,
`watermark` false, `output_format` mp4, seed omitted, and the same
historical B′
(`tuning/ghost-library-end-shooting-frame.jpeg`). Only the
Camotion-conditioned A′ differs.

| experiment | A′ | Replicate video |
| --- | --- | --- |
| 01.3 | `tuning/01.3-result.png` | `tuning/video-runs/replicate-bytedance-seedance-2.5/01.3/01.3-result.mp4` |
| 01.4 | `tuning/01.4-result.png` | `tuning/video-runs/replicate-bytedance-seedance-2.5/01.4/01.4-result.mp4` |
| 01.5 | `tuning/01.5-banded-result.png` | `tuning/video-runs/replicate-bytedance-seedance-2.5/01.5/01.5-result.mp4` |
| 01.6 | `tuning/01.6-terminal-start-result.png` | `tuning/video-runs/replicate-bytedance-seedance-2.5/01.6/01.6-result.mp4` |
| 01.7 | `tuning/01.7-banded-strength-004-result.png` | `tuning/video-runs/replicate-bytedance-seedance-2.5/01.7/01.7-result.mp4` |
| 01.8 | `tuning/01.8-route-preserved-result.png` | `tuning/video-runs/replicate-bytedance-seedance-2.5/01.8/01.8-result.mp4` |

**01.5 remains the conservative directed-traversal baseline.** **01.8
Route-Preserved Exposure remains the current Camotion baseline**, not
a CameraMotionPlan field. 01.9, 01.10, 01.11, and 01.12 are
still-only evidence and are not promoted.

On this Replicate series, 01.6 did **not** reproduce the severe
terminal-orientation collapse/retreat previously observed through
Krea. 01.8 did **not** reproduce the pronounced backward-then-forward
opening previously observed through Krea. Those Krea behaviors should
not currently be treated as intrinsic properties of the Camotion
variants. Historical Krea videos remain prior provider-specific
evidence.

01.8 produced especially compelling environmental ghost motion. 01.7
produced an interesting near-camera creepy-hand interaction. Emerging
observation, not a proven mechanism: environmental and foreground
motion can act as a **perceptual witness** to camera locomotion.
Preserve the distinction among canonical spatial authority, Camotion
motion conditioning, and generative-video improvisation.

Do not treat this as a Camotion renderer freeze. 01.9 Adaptive
Exposure Integration, 01.10 Depth-Compositor Ablation, 01.11
Exposure Operator Characterization, and 01.12 Baked-Exposure
Operating Window are recorded below as completed still-only
experiments; none is promoted. 01.12 closes the current
exposure-operator tuning branch.

### Prompt-control camera speed and embodiment

This family is **not** Camotion 01.9 and is **not** a member of the
01.3–01.8 A′ series. Camotion images and parameters are unchanged.
Fast Seedance video control remains
`tuning/video-runs/replicate-bytedance-seedance-2.5/01.8/`.
Settings for both runs: `bytedance/seedance-2.5`, duration 6, 720p,
`aspect_ratio` adaptive, audio off, watermark off, mp4, seed omitted.

**Observed (`seedance-slow`, prediction `yyyeyrq6vhrmy0d0dn2ad02q6g`).**
The generated traversal was perceptibly slower and more deliberate
than the fast 01.8 control while retaining continuous forward
locomotion and completing the library → doorway → courtyard
traversal. It still read as smooth dolly/Steadicam-like motion
rather than literal human walking.

**Interpretation, not proof.** With Camotion conditioning, A′/B′,
model, duration, and generation settings held constant, changing the
requested camera pace from fast to slow walking produced visibly
slower forward locomotion while preserving the intended traversal.
This supports treating camera pace as a possible Cinematographer-level
semantic control implemented through linguistic conditioning. One
stochastic generation with no fixed seed; no deterministic or
cross-model claim.

**Observed (`seedance-slow-embodied`, prediction
`1jhz8g41rdrmy0d0dp0s0fj260`).** Control was `seedance-slow`. The
requested embodied walking characteristics (eye-level walking POV,
rhythmic vertical bob, side-to-side sway, explicitly not
dolly/Steadicam) were not clearly perceptible. The traversal continued
to read primarily as smooth/floating/dolly-like camera motion rather
than recognizable footstep-driven human locomotion.

**Interpretation, not proof.** Prompt conditioning demonstrated useful
control over apparent camera pace in the tested Seedance traversal, but
the tested embodiment prompt did not visibly convert the
smooth/dolly-like traversal into natural human walking motion. This
suggests that camera pace and camera embodiment may be distinct
control problems and may require different conditioning mechanisms.
Do not write that Seedance cannot produce walking motion; say only
that the requested embodiment was not clearly expressed in this test.

Evidence:

`tuning/video-runs/prompt-control/camera-speed/replicate-bytedance-seedance-2.5/seedance-slow/`

`tuning/video-runs/prompt-control/camera-speed/replicate-bytedance-seedance-2.5/seedance-slow-embodied/`

Unvalidated product ideas (pace UI, embodiment, Prompt Only vs Auto,
and related brainstorms) are in
[RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md). Do not implement them
here. The later 01.10 diagnostic is recorded below.

### Adaptive exposure integration (01.9; completed still-only)

01.9 Adaptive Exposure Integration tested whether the repeated-object
/ ghost-copy appearance remaining in 01.8 was primarily caused by
sparse sampling of the exposure trajectory.

01.8 used 16 fixed taps. On the Ghost Library fixture, the longest
exposure trajectory left approximately 6.45 px between adjacent
samples.

01.9 changed **only** the exposure integration density by using
adaptive sampling:

``` text
n = max(2, ceil(L / 1.0) + 1)
```

where `L` is the exposure-path length in pixels. On the Ghost
Library / 0.08 fixture this produced 2–98 taps per pixel (mean
51.9), with maximum adjacent spacing `<= 1.0` px. All other
relevant 01.8 behavior remained unchanged: route geometry, depth
logic, destination protection, route preservation, motion strength,
outgoing orientation, and CameraMotionPlan v1.

**Result: the hypothesis was not supported by this fixture.** Despite
the large increase in exposure sampling density, 01.9 produced only
small pixel differences from 01.8 and did not clearly remove the
repeated-object appearance in candles, shelves, skeletons, and
similar high-contrast features.

Quantitative evidence vs 01.8 (uint8): MAE 0.251, RMSE 0.552, max
channel difference 7, mean delta +0.002. Center 200×200 MAE 0.0008.
Destination bbox identical. Route-preservation mask identical. 01.9
runtime approximately 50.05 s versus an 01.8 rerender of
approximately 10 s (~5×) without a correspondingly meaningful visual
change. Terran Boylan's original Ghost Library reference still was
not in the repository; no Terran OG comparison was invented.

**Observation.** Increasing trajectory sampling density from fixed 16
taps to adaptive `<= 1` px spacing did not clearly remove the
repeated-object appearance in this fixture.

**Interpretation, not proof.** Sparse exposure sampling is unlikely to
be the **dominant** cause of the remaining ghost-copy appearance in
the Ghost Library 01.8 result. Do not claim that sparse sampling can
never matter, that adaptive exposure is universally ineffective, that
the artifact's actual cause has been proven, that the compositor is
definitely responsible, or that Terran's Photoshop renderer has been
reproduced or explained.

**Baseline.** 01.8 Route-Preserved Exposure remains the current
Camotion baseline. 01.9 is preserved as experimental evidence and is
**not** promoted. No Seedance/video test is warranted for 01.9 based
on the still result. CameraMotionPlan v1 remains frozen. Default
`render()` remains the continuous near-weight path and still calls
`apply_multisample_exposure()`. `render_depth_banded()` defaults to
`adaptive_exposure=False`. A normal 01.8 rerender remained
byte-identical to the committed 01.8 result. Do not remove the opt-in
01.9 path; negative results are part of the Camotion research record.

Evidence:

-   `tuning/01.9-adaptive-exposure-result.png` (SHA-256
    `420f8c7c1a422685d8bf9c26dc24ef5af9fa521735d274dd9d4c2de4757c95e8`)
-   `tuning/01.9-adaptive-exposure-config.json`
-   `tuning/analysis/01.9-comparison.json`
-   `tuning/analysis/01.9-vs-01.8-absdiff.png`
-   `tuning/analysis/01.9-vs-01.5-absdiff.png`

The next research question --- where the repeated-object appearance
first emerges through compositor stages --- is recorded below as
completed 01.10 evidence. 01.11 and 01.12 are recorded after that.
Do not begin the next experiment here.

### Depth-compositor ablation (01.10; completed still-only diagnostic)

01.10 Depth-Compositor Ablation asked where the repeated-object /
ghost-copy appearance visible in the Ghost Library 01.8 conditioned
frame first emerges.

The working hypothesis going in was that multiple transformed
representations of the same scene feature might survive through
different exposure/depth layers (strong, medium, and pristine)
and remain perceptually distinct. That hypothesis was **untested**
before 01.10. 01.10 did not change CameraMotionPlan, default
`render()`, 01.8 parameters, or 01.9 adaptive integration. It used
the normal 01.8 fixed 16-tap exposure. The only purpose was to
expose real intermediate states already inside the 01.8
computation.

**Actual 01.8 order, from code, not the conceptual description:**
source → strong exposure → medium exposure → strong mask
(gaussian, then expose) → medium mask (ramp, then gaussian) →
**route preservation attenuates those masks** → strong over
(medium over pristine) → destination-protection blend. Route
preservation is a pre-composite mask attenuation, not a
post-composite filter.

Effective compositor weights implied by that over operator, and
they sum to 1.0 per pixel:

``` text
w_strong   = S
w_medium   = M * (1 - S)
w_pristine = (1 - M) * (1 - S)
```

**Result: classification A.** The repeated-object appearance is
already visible in the strong exposed image, independently of depth
compositing. Medium exposure also shows discrete copies. **E is
also supported:** the full pre-route depth-banded composite already
contains the artifact, and 01.8 route preservation does not create
it in the artifact-heavy foreground crops. The multi-layer
compositor hypothesis is **not supported as the origin of first
appearance** on this fixture.

**Observation.** On candles, shelf edges, and skeleton structure,
discrete radial copies are visible in `01-strong-exposure`. In the
four foreground artifact crops (left-skeleton, left-lower-candle,
right-skeleton, right-lower-candle), pristine effective weight
above the diagnostic threshold 0.10 is 0.0, and stages 13, 16, 17,
and 18 are byte-identical. Destination bbox vs source is identical.
The 01.10 final diagnostic PNG is byte-identical to committed 01.8
(SHA-256
`5f9c3bb8afb51cde59067f14349571cb2124db8c757307211f1b02912b5603d1`).
Pre-route weights reconstruct the depth-banded composite (max abs
error `8.53e-14`) and sum to 1.0 (max abs error `2.22e-16`).
Whole-image pre-route overlap at threshold > 0.10: strong∩medium
74.5%; all three 6.7%. Global 16 vs 17 MAE 0.46 is the route
corridor elsewhere, not those foreground copies. Destination
protection 17 vs 18 MAE 0.0017. Compositing with the unexposed
versus motion-processed strong mask is a small pixel change (global
MAE 0.123, max 4) and does not create the discrete object copies.

**Interpretation, not proof.** First appearance is upstream of
depth-layer compositing on this fixture. Do not claim that the
compositor can never matter, that strong/medium overlap is
harmless, that the exposure operator's exact mechanism is proven,
that 01.9 is contradicted, or that Terran's Photoshop renderer has
been reproduced. 01.9 already found that densifying equal-weight
taps did not clearly remove the copies; 01.10 localizes first
appearance to that same exposure stage rather than to later
compositing, route preservation, or destination protection.

**Baseline.** 01.8 Route-Preserved Exposure remains the current
Camotion baseline. 01.10 is preserved as diagnostic evidence and is
**not** promoted. It is not a new renderer version. No
Seedance/video test is warranted for 01.10 based on the still
result. CameraMotionPlan v1 remains frozen. Default `render()`
remains the continuous near-weight path. `render_depth_banded()`
behavior is unchanged. Do not remove the diagnostic path; negative
results are part of the Camotion research record.

Evidence:

-   `tuning/01.10-compositor-ablation-config.json`
-   `tuning/analysis/01.10-compositor-ablation.json`
-   `tuning/analysis/01.10/01.10-18-final-01.8.png` (byte-identical
    to committed 01.8)
-   `tuning/analysis/01.10/01.10-01-strong-exposure.png`
-   `tuning/analysis/01.10/01.10-contact-sheet.png`
-   `tuning/analysis/01.10/01.10-contribution-rgb.png`
-   `tuning/analysis/01.10/01.10-effective-contributions.npz`

The 01.11 exposure-operator characterization that followed this
diagnostic is recorded below. 01.12 follows 01.11.

### Exposure-operator characterization (01.11; completed still-only diagnostic)

01.11 Exposure Operator Characterization asked what spatial signal
Camotion's current exposure operator actually produces, and which
small family of alternative operators appear capable of a more
continuous photographic streak along the **same 01.8 trajectory**.

**Controlled variable.** Exposure operator only. Same 01.8 outgoing
gather geometry on Ghost Library (source, radial field, FoE
`(0.50, 0.56)`, strength `0.08`, bilinear sampling). Synthetic
fixture: 256², FoE `(0.50, 0.50)`, strength `0.40`, same gather
implementations. No depth, bands, masks, route preservation,
destination protection, or compositor. 01.8 and 01.9 gather
functions were reused, not rewritten. Research-only candidates were
not added to CameraMotionPlan or default `render()`.

Operators: 01.8 fixed-16 equal-weight box; 01.9 dense equal-weight
box (`N = max(2, ceil(L)+1)`); triangular weighted dense;
forward line-splat; Gaussian σ=1 then 01.9 dense.

**Observed.**

-   01.8 fixed-16 exposure contains discrete sampling artifacts.
-   01.9 dense ≤1 px sampling converts the local point response into
    a continuous, though rippled, streak.
-   Structured Ghost Library features nevertheless continue to read
    as transformed copies.
-   Therefore sparse trajectory sampling is not the dominant
    remaining cause.
-   Triangular temporal weighting did not materially reduce
    structured copies.
-   Forward line-splat is a different operator, not a better
    reconstruction of the existing destination-gather integral.
-   Sigma=1 prefiltering was the only tested family that reduced
    copy readability, and did so by softening source spatial
    structure.
-   No tested 01.11 operator produced a clearly superior continuous
    photographic streak while preserving structured content.

In-bounds synthetic point path (45.2 px of the 54.0 px geometric
segment; the `(32,32)` point at strength 0.40 exits the 256² frame):
01.8 peak-to-valley 0.94, active fraction 0.62, zeros between taps;
01.9 peak-to-valley 0.60, active fraction 1.0, no zero gaps.
Ghost Library 01.8 full strong exposure is byte-identical to the
01.10 strong-exposure intermediate. Candidate operators were
evaluated on padded 01.10 artifact crops, not full-resolution
Ghost Library permutations. Crop mean energy stayed in-family with
the dense gather; candidates did not look better by going darker.

**Interpretation, not proof.** Classifications A, E, and F.
Sampling density itself is not the remaining problem. Repeated
appearance of structured content is emerging from integrating
transformed copies along a long single-frame path. Prefiltering is
a bandwidth effect, not a chosen intervention. Do not claim that
sparse sampling can never matter, that prefiltering is a renderer
fix, that forward splat reconstructs the 01.8 integral, or that
Terran's Photoshop renderer has been reproduced.

**Baseline.** 01.8 Route-Preserved Exposure remains the current
Camotion baseline. 01.11 is preserved as diagnostic evidence and is
**not** promoted. No 01.11 candidate is promoted. It is not a new
renderer version. No Seedance/video test is warranted for 01.11
based on the still result. CameraMotionPlan v1 remains frozen.
Default `render()` remains the continuous near-weight path.
`apply_multisample_exposure()` remains the 01.8 gather.
`apply_adaptive_multisample_exposure()` remains the opt-in 01.9
path. Do not remove the diagnostic path; negative results are part
of the Camotion research record.

Evidence:

-   `tuning/01.11-exposure-characterization-config.json`
-   `tuning/characterize_exposure.py`
-   `src/camotion/exposure_characterization.py`
-   `tests/test_exposure_characterization.py`
-   `tuning/analysis/01.11-exposure-characterization.json`
-   `tuning/analysis/01.11/01.11-synthetic-contact-sheet.png`
-   `tuning/analysis/01.11/01.11-gl-01-fixed-16-box.png`
-   `tuning/analysis/01.11/01.11-contact-left-skeleton.png`
-   `tuning/analysis/01.11/01.11-point-profiles.json`

The 01.12 baked-exposure operating window that followed this
diagnostic is recorded below. Do not implement the next experiment
here.

### Baked-exposure operating window (01.12; completed still-only diagnostic)

01.12 Baked-Exposure Operating Window asked whether a useful
baked-exposure regime exists where displacement is strong enough
to provide a meaningful directional motion cue **and** structured
scene content does not develop objectionable repeated-object
appearance.

**Controlled variables.** Existing 01.8 fixed-16 destination-gather
only. Same Ghost Library source, radial field, FoE `(0.50, 0.56)`,
outgoing orientation, N=16, bilinear interpolation. No compositor,
masks, route, or destination protection in the primary matrix.
Varied only exposure strength (`0.02`, `0.04`, `0.06`, `0.08`) and
source spatial bandwidth (pristine vs sigma=1 Gaussian as a
**diagnostic control only**). Not parameter optimization. Not a
new operator.

**Observed.**

-   01.12 tested the existing 01.8 fixed-16 destination-gather
    exposure at strengths 0.02, 0.04, 0.06, and 0.08.
-   Each strength was tested with the pristine source and with
    sigma=1 prefiltering as a diagnostic control only.
-   0.02 preserved structured content reasonably well but produced
    only a weak directional motion cue, especially near the FoE.
-   0.04 produced a meaningfully useful peripheral directional cue,
    but recognizable repeated structure was already clearly present
    in fingers, flames, and other artifact features.
-   0.06 and 0.08 produced strong directional cues but objectionable
    structured-content duplication.
-   Therefore no useful pristine-source operating window was
    observed on the Ghost Library fixture: the motion cue becomes
    useful at approximately the same point that structured
    duplication becomes objectionable.
-   Sigma=1 prefiltering reduced copy readability across strengths
    by reducing source spatial detail. It did not establish a
    sharp-detail operating window.

Whole-image path length scales linearly with strength (mean 12.6 /
25.2 / 37.8 / 50.4 px). 0.08 pristine is byte-identical to the
01.10 strong-exposure intermediate.

**Interpretation, not proof.** Classification **C + D**. Prefiltering
remains diagnostic evidence and is **not** a proposed Camotion
pipeline change. The 01.12 stop rule applies: do not search
additional strengths, sigma values, shutter weightings, integration
kernels, or compositors. This closes the current exposure-operator
tuning branch. Do not claim that baked exposure can never matter
on another fixture, that sigma=1 should be added to Camotion, or
that a replacement conditioning mechanism has been chosen.

**Baseline.** 01.8 Route-Preserved Exposure remains the current
Camotion baseline. 01.12 is preserved as diagnostic evidence and is
**not** promoted. No 01.12 condition is promoted. It is not a new
renderer version. No Seedance/video test is warranted for 01.12
based on the still result. CameraMotionPlan v1 remains frozen.
Default `render()` remains the continuous near-weight path.
`apply_multisample_exposure()` remains the 01.8 gather.

Evidence:

-   `tuning/01.12-operating-window-config.json`
-   `tuning/characterize_operating_window.py`
-   `src/camotion/operating_window.py`
-   `tests/test_operating_window.py`
-   `tuning/analysis/01.12-operating-window.json`
-   `tuning/analysis/01.12/01.12-matrix-thumbs.png`
-   `tuning/analysis/01.12/01.12-contact-right-skeleton.png`
-   `tuning/analysis/01.12/01.12-contact-left-skeleton.png`
-   `tuning/analysis/01.12/01.12-s008-pristine.png`

The next research question is untested and is **above** the current
baked-exposure primitive: how can Camotion communicate useful
camera direction/motion to the video model without integrating a
long trajectory of recognizable scene structure into a single
shooting frame? Do not choose or implement a replacement mechanism
yet. Do not prematurely promote motion fields, auxiliary
conditioning, overlays, multiple frames, or another specific
representation into the architecture. Capture the question in
[RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md). Do not implement the
next experiment here.

### Cinematographer integration

Open question: module boundaries. Intended *role*: for accepted frame
pairs, analyze route/geometry, emit ShotPlan, derive CameraMotionPlan,
invoke Camotion, fill a locomotion template, call the video provider,
and judge directed A→B shots by endpoint fidelity first, then
traversal. Integration Test 01 used a thin pair planner in
`media/src/cinematographer/` against actual stills. The MediaProvider
image and video requests now exist in `media/`. Do not expand that
planner into a product package in this checkpoint.

### SHOOT MOVIE

Current product-direction name for the later action formerly called
Shoot Journey: plan/review canonical storyboard, derive shooting
frames, render video from those shooting frames, assemble in canonical
order, surface failures. Integration Test 01 ran the unattended path
after canonicals existed. Deterministic concat of ordered successful
shot videos is the immediate assembly follow-up (hard butts, no
creative editing). Do not create an Edit agent for this.

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
tasks. This checkpoint records Integration Test 01 — The Wardrobe Loop
as a completed unattended movie experiment, and 01.12 Baked-Exposure
Operating Window as completed still-only diagnostic. Classification
C + D. No useful pristine-source window. The current exposure-operator
tuning branch is closed. Keep 01.8 as the current Camotion
baseline. Do not start Camotion 01.13, and do not silently
replace default `render()`.

## Hackathon strategy

Product work continues from the current autonomous filmmaking
pipeline and continues using and improving Camotion: story →
autonomous canonical planning → shootable traversal → movie.

A separate Runway hackathon exploration is the **last-frame
discovery** experiment: whether the system can use the actual final
world-state produced by one generated shot as the starting point for
deciding where to go next. That is **not** a replacement for current
TunnelVision before it is validated. Do not restructure the current
application around it.

Conceptual evolution, not a roadmap:

-   Old TunnelVision: human chooses where to go next
-   Current TunnelVision: agents pre-plan where to go next
-   Hackathon question: the film discovers where it actually went,
    then decides where to go next

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
    (Krea 01.6 worsened the initial reconstruction; Replicate 01.6
    did not reproduce that severe collapse/retreat; 01.5 outgoing
    remains the conservative experimental baseline; not
    cross-scene)
-   start-frame exposure strength: **0.04 not promoted** on Ghost
    Library / Seedance 2.5 (obvious recursion gone; starting-geometry
    fidelity worse; 01.5 / 0.08 remains directed A→B working
    baseline; conditioning-authority tradeoff; not cross-scene or
    cross-model)
-   recursive-space / reconstituted-environment video artifacts
    (reduced on Ghost Library 01.5 outgoing, not eliminated; Krea
    01.6 made the start-of-shot behavior worse; Replicate 01.6 did
    not reproduce that severe collapse/retreat; 01.7 removed the
    obvious initial event at the cost of endpoint geometry
    authority)
-   whether environmental/foreground motion can serve as a perceptual
    witness to camera locomotion (observation from the Replicate
    series; not a proven mechanism)
-   apparent camera pace vs camera embodiment as possibly distinct
    Cinematographer controls (one Seedance pair; linguistic pace
    looked useful, linguistic walking embodiment did not clearly
    appear; not a schema)
-   remaining 01.8 repeated-object / ghost-copy appearance: 01.9
    adaptive sampling did not clearly remove it; 01.10 localized
    first appearance to strong exposure, not compositor / route /
    destination protection, on Ghost Library stills. 01.11 found
    discrete 01.8 sampling artifacts and a filled dense point
    streak, while structured Ghost Library features still read as
    transformed copies; sparse sampling is not the dominant
    remaining cause. 01.12 found no useful pristine baked-exposure
    operating window (classification C + D). The motion cue becomes
    useful at approximately the same point that structured
    duplication becomes objectionable. Exposure-operator tuning is
    closed. The next untested question is above the baked-exposure
    primitive. Do not begin a Camotion 01.13 experiment from this
    checkpoint. Scene-aware selection of a small known-safe Camotion
    exposure-strength range is a different unvalidated question; see
    [RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md)
-   final Cinematographer module boundaries
-   how a future Cinematographer derives changing camera geometry while
    turning toward a user-selected destination
-   whether shootability requires a traversable intermediate spatial
    story, including optional intermediate canonicals
-   shot-boundary velocity continuity and variable shot duration
-   a possible Screenwriter agent upstream of the Director
-   Cinematographer canonical review (PASS / REGEN / REPAIR) before
    expensive video
