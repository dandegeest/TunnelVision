# TunnelVision research / product backlog

Unvalidated ideas. Not architecture. Not a committed roadmap.
Do not implement schemas, enums, UI, or Cinematographer modules from
this file until controlled experiments justify them.

**Discipline:** idea emerges → capture it here → label it unvalidated
→ return to the current controlled experiment.

Authoritative current-code facts live in
[ARCHITECTURE.md](ARCHITECTURE.md) and
[IMPLEMENTATION.md](IMPLEMENTATION.md). Observed Seedance
prompt-control evidence is recorded there. This file keeps
brainstorms from derailing Camotion work.

## Conditioning-channel hypothesis

Different cinematographic controls may ultimately require different
conditioning channels. Not a production schema.

| Concern | Current evidence / hypothesis |
| --- | --- |
| Route / direction / spatial traversal | Camotion provides deterministic visual conditioning |
| Apparent camera pace | Linguistic conditioning looked promising on one Seedance Ghost Library traversal (`seedance-slow`) |
| Camera embodiment / physical observer | Linguistic conditioning alone looked weak in `seedance-slow-embodied`; open research problem |
| Shot duration | Separate cinematographic variable / temporal budget |

A future Cinematographer might translate a simple user-facing control
into one or more implementation mechanisms: linguistic prompt
conditioning, Camotion visual conditioning, shot duration,
canonical-frame composition, route geometry, or other
model/provider controls. The UI abstraction should not expose or
depend on which mechanism is used.

## User prompt philosophy

**Working principle, unvalidated:** the user describes the movie;
TunnelVision handles the filmmaking vocabulary.

User-authored prompts should primarily describe story, world, mood,
visual style, and creative intent. Users should not normally need to
write technical locomotion language such as "strong natural parallax"
or "never stops advancing." A later Cinematographer can translate
higher-level filmmaking controls into model-specific conditioning.

## Camera pace

Potential future user-facing semantic control. **Brainstorming
labels, not a committed enum:**

-   Prompt Only --- TunnelVision does not inject its own camera-pace
    instruction. Pace may emerge from the user's creative prompt,
    visual conditioning, and model behavior.
-   Slow
-   Walking
-   Brisk
-   Fast
-   Mixed --- the user asks for intentionally varied pacing across a
    journey; the Cinematographer decides where variation occurs.
-   Auto --- the Cinematographer actively reasons about the story/shot
    and chooses an appropriate pace.

Do not equate Prompt Only with Auto.

Today's Seedance test is one stochastic generation with no fixed
seed. It does not prove deterministic or cross-model pace control.

## Camera embodiment / physical observer

Open question: what kind of physical observer does the camera
represent?

Examples discussed, not a taxonomy to implement:

-   eye-level person walking
-   crawling person
-   body / chest-mounted camera
-   handheld operator
-   dolly / Steadicam
-   car / windshield / vehicle-mounted camera
-   boat
-   sledding downhill
-   spacecraft / cockpit
-   drone / aerial camera
-   other physically situated platforms

Embodiment may later imply camera height, allowed motion, route
geometry, stabilization character, foreground interaction, whether
hands/body/vehicle structure appear, and model-specific linguistic
or visual conditioning.

The tested Seedance embodiment prompt did **not** clearly produce
recognizable footstep-driven walking. That is not a claim that
Seedance cannot produce walking motion.

## Camera height / eye level

Potentially derive height from embodiment by default (walking →
eye-level, crawling → near ground, car → seated/cabin, drone →
aerial). Possible future manual override. Brainstorm only.

## Camera motion character / stabilization

Potentially distinct from pace and embodiment. Provisional labels,
not an enum:

-   Prompt Only
-   Smooth
-   Natural
-   Handheld
-   Shaky
-   Auto

Today's pair of Seedance tests is evidence that pace and motion
character should not automatically be treated as the same control.

## Motion-state visual conditioning

Open research hypothesis, motivated by `seedance-slow-embodied`. Not
supported by current Camotion. Not CameraMotionPlan v1. Not a current
renderer experiment.

**Observation.** The explicit Seedance prompt requesting subtle
rhythmic vertical bob, gentle side-to-side body sway, physically
grounded human walking, and non-dolly / non-Steadicam motion did not
visibly produce strong embodied walking mechanics.

**Hypothesis.** Camotion may eventually encode not only *where* the
camera is moving, but aspects of *how* the camera is physically
moving at the conditioned instant. Possible motion-state dimensions
include vertical displacement / lift, pitch, yaw, roll, lateral
sway, camera height, stabilization character, embodiment / physical
platform, and instantaneous velocity. Examples that motivated the
idea (walking, crawling, bodycam, handheld, vehicle, boat, sled,
drone, spacecraft) are illustrations, not supported modes.

A still conditioning frame can communicate an instantaneous motion
state. Periodic motion such as a human gait is inherently temporal.
The open question is whether a video model can extrapolate a desired
temporal motion pattern from visual conditioning that represents one
or more motion-state cues in A′ and/or B′.

**Future experiment only.** A later controlled comparison could hold
all other variables constant and contrast:

-   linguistic walking conditioning + ordinary Camotion A′
-   the same linguistic walking conditioning + A′ that visually
    encodes a walking-related motion state

Do not add schema fields. Do not implement pitch, yaw, roll, or
height controls. Do not alter CameraMotionPlan v1. Do not treat this
as a current Camotion renderer experiment.

## Where the repeated-object appearance first emerges

01.10 Depth-Compositor Ablation is completed diagnostic evidence
against the 01.8 baseline. Not a renderer promotion. No video test.
See `docs/IMPLEMENTATION.md` and
`camotion/tuning/analysis/01.10-compositor-ablation.json`.

**Observation.** On Ghost Library / 0.08, discrete repeated copies
are already visible in the strong exposed image. Medium exposure
also shows copies. The four foreground artifact crops have no
material pristine contribution and are unchanged by route
preservation and destination protection.

**Interpretation, not proof.** Classification A, with E also
supported. The multi-layer compositor hypothesis is **not
supported as the origin of first appearance** on this fixture.
01.9 already found that densifying equal-weight taps did not
clearly remove the copies.

01.11 Exposure Operator Characterization is completed still-only
diagnostic evidence against the 01.8 baseline. Not a renderer
promotion. No video test. See
`camotion/tuning/analysis/01.11-exposure-characterization.json`.

**Observation.** On a 256² synthetic fixture, 01.8 fixed-16 gather
produces discrete beads / stepped copies. 01.9 dense equal-weight
gather fills the local point path into a continuous (rippled)
streak. Ghost Library artifact crops still read as stacked copies
under dense gather. Triangular temporal weighting does not
materially change that structured-object appearance. A research-only
forward line-splat is a different operator, not a better
reconstruction of the existing dest-gather integral. Modest Gaussian
prefilter (σ=1) then dense gather most reduces readable copies, by
softening source structure, with crop energy remaining comparable.

**Interpretation, not proof.** Classifications A, E, and F.
Sampling density itself is not the remaining problem. Repeated
appearance of structured content is emerging from integrating
transformed copies along a long single-frame path. Prefiltering is
a bandwidth effect, not a chosen intervention. No 01.11 candidate
is promoted.

01.12 Baked-Exposure Operating Window is completed still-only
diagnostic evidence against the 01.8 baseline. Not a renderer
promotion. No video test. See
`camotion/tuning/analysis/01.12-operating-window.json`.

**Observation.** 01.12 tested the existing 01.8 fixed-16
destination-gather exposure at strengths 0.02, 0.04, 0.06, and
0.08, each with the pristine source and with sigma=1 prefiltering
as a diagnostic control only. 0.02 preserved structured content
reasonably well but produced only a weak directional motion cue,
especially near the FoE. 0.04 produced a meaningfully useful
peripheral directional cue, but recognizable repeated structure was
already clearly present in fingers, flames, and other artifact
features. 0.06 and 0.08 produced strong directional cues but
objectionable structured-content duplication. Sigma=1 reduced copy
readability across strengths by reducing source spatial detail. It
did not establish a sharp-detail operating window. Path length
scales linearly (whole-image mean 12.6 / 25.2 / 37.8 / 50.4 px).

**Interpretation, not proof.** Classification **C + D**. No useful
pristine-source operating window was observed on the Ghost Library
fixture: the motion cue becomes useful at approximately the same
point that structured duplication becomes objectionable.
Prefiltering remains diagnostic evidence and is **not** a proposed
Camotion pipeline change. The 01.12 stop rule applies: do not
search additional strengths, sigma values, shutter weightings,
integration kernels, or compositors. This closes the current
exposure-operator tuning branch. No 01.12 condition is promoted.

**UNTESTED later question, not a Phase 1 Camotion task:** How can
Camotion communicate useful camera direction/motion to the video
model without integrating a long trajectory of recognizable scene
structure into a single shooting frame? This question is **above**
the current baked-exposure primitive. Do not choose or implement a
replacement mechanism yet. Do not prematurely promote motion fields,
auxiliary conditioning, overlays, multiple frames, or another
specific representation into the architecture. Do **not** call any
next Camotion experiment 01.13. **Camotion Phase 1 is frozen.**

## Integration Test 01 — traversable intermediate volume

Completed movie evidence, not a schema. Human review of the Wardrobe
Loop found that a destination object is not enough: the shot needs
**traversable depth through the transition**. The best transitions
provided somewhere for the camera to exist BETWEEN canonicals
(wardrobe interior, forest corridor, stairway/portal). The weakest
shot (E→A) approached a flat bedroom door, then the world became the
bedroom.

**Later Phase 1 experiment, completed.** Shootability / intermediate
spatial volume:
`camotion/integration/wardrobe-loop-01/experiments/shootability-intermediate-volume/`.

The Cinematographer independently judged direct E→A
NEEDS_INTERMEDIATE (the prompt did not tell it to reject). It
specified one physical camera position X (wardrobe interior looking
out), generated exactly one X, inspected the actual still, and
rejected both E→X and X→A. Protocol stopped before video. That stop
is the result, not an experiment failure.

Do not mechanically request X for every transition. Do not accept a
proposed X as canonical without inspecting the actual generated set.
Do not implement a generalized production planner from this file.

## Movie-level velocity and variable duration

Assembling Integration Test 01 with hard butts made accidental
perceived camera-speed jumps visible, especially at A→B / B→C.
Hypothesis: Cinematographer planning should eventually consider exit
velocity from one shot and entry velocity into the next. Deliberate
acceleration/deceleration may be narratively useful. Accidental
speed jumps should not simply be repaired in post.

Related improvement over the original manual TunnelVision / DITD
workflow: shot duration should not necessarily be globally fixed.
The ~5-second generative cadence in DITD became a perceptible
rhythm. Unvalidated split: Screenwriter owns narrative pacing / beat
importance; Cinematographer decides practical shot duration and
physical camera pace within provider-supported durations. If a move
cannot be covered naturally in one supported duration, subdivide
rather than forcing it. No schema in this checkpoint.

## Scene-aware Camotion operating range

**Completed.** Last bounded Camotion experiment for Phase 1. Not
Camotion 01.13. The 01.8 operator was unchanged. 01.12 was not
reopened.

Evidence:
`camotion/integration/wardrobe-loop-01/experiments/scene-aware-camotion-strength/`.

Three already-shootable Wardrobe Loop pairs (A→B seed 80, B→C seed 81,
D→E seed 82). Control: fixed `.08`. Adaptive: Cinematographer-selected
per-canonical strength from `{.02, .04, .08}`, frozen before Seedance.
Human verdict 3–0 adaptive; independent second review 3–0 adaptive.
Qualitative: same-or-better perceived traversal, strong geometry, less
noticeable conditioning smear; `.08` did not show a compensating
locomotion advantage in these three pairs.

**Phase 1 behavior:** the Cinematographer inspects each actual
canonical and chooses LIGHT `.02` / MEDIUM `.04` / STRONG `.08`.
Strength is per canonical, not necessarily one value per shot. Use
the minimum bounded conditioning needed to establish useful motion
state. Do not allow arbitrary strength values. Do not claim `.02` is
globally best or that `.08` is obsolete.

**Camotion Phase 1 is frozen.** Do not start `.06`, new kernels,
sample-count sweeps, compositor experiments, alternate blur operators,
new exposure weighting, more Ghost Library tuning, or cross-seed
Camotion sweeps unless a concrete later movie failure provides reason.

Shootability / traversable intermediate volume is a **completed**
later Phase 1 experiment, not remaining Camotion work. See the
section above and
`camotion/integration/wardrobe-loop-01/experiments/shootability-intermediate-volume/`.

## Screenwriter agent

Unvalidated crew hypothesis. Do not create `ScreenwriterAgent`.

User → Screenwriter → Director → canonical generation → CM review /
shootability → Camotion → video model → review → final movie.

Screenwriter interprets story, beats, spatial journey, thresholds,
and dramatic emphasis without knowing Camotion or provider geometry.
Director determines visual interpretation and canonical positions.
Cinematographer asks, from actual frames, whether the move can be
shot.

## Canonical review before expensive video

Likely owner: Cinematographer, not a new reviewer agent. Possible
decisions: PASS, REGEN, REPAIR. Guideline: regeneration preserves
exploration; editing preserves composition. REGEN is preferred
during discovery if concept/geography is wrong. REPAIR may fit a
strong composition with a localized violation (for example an
unwanted person in Wardrobe Loop B). Review + shot planning may later
share one reasoning call when PASS. Do not implement in this
checkpoint.

## Simple autonomous storyboard

Current **product direction**, not a backlog experiment to design
here. See [PRODUCT.md](PRODUCT.md) and [UX.md](UX.md). Do not build
the UI in this checkpoint.

## Runway last-frame discovery

Hackathon research branch, not current architecture. Investigate
whether the actual final world-state of a generated shot can become
the starting point for deciding where to go next. Not a replacement
for pre-planned canonical journeys until validated. Do not
restructure the application around it.

## FUTURE / TALKING POINT — Runway GWM / world model

Not implemented. Not experimentally validated. Not Phase 1.

TunnelVision's shootability research exposed a fundamental problem:
two keyframes may not contain enough evidence of the physical space
between them.

Today, the Cinematographer detects this and can request an
intermediate canonical X to establish traversable volume.

A world model such as Runway GWM could potentially solve this more
naturally by exploring or simulating the missing space, allowing
TunnelVision to discover X through camera movement rather than
inventing X as an image first.

Conceptual distinction only:

-   current: infer missing space → generate X → inspect X
-   possible world-model future: explore missing space →
    observe/discover X

This is a future integration / hackathon discussion point, not part
of the Phase 1 implementation. Do not claim current GWM API
capabilities.

## Camotion conditioning overlay / Cinematographer Inspector

Future UI and debugging concept. Names are provisional
("Cinematographer Inspector", "Camotion Conditioning Overlay"). No
implementation during current Camotion tuning.

Working idea: keep the actual image frame visually dominant while
optionally overlaying conditioning data derived from the real
CameraMotionPlan and Camotion renderer / intermediate data.

Potential independently toggleable layers:

-   vanishing point / focus of expansion
-   destination point
-   destination protection bounding box
-   route-preservation corridor
-   depth regions and/or depth map
-   motion / exposure vectors
-   forward direction / center axis
-   active conditioning strength and other relevant parameters

The visualization must use the **actual** canonical / A′ frame and
the **actual** conditioning values used by Camotion. It must not be
an illustrative or reconstructed approximation.

Presentation preference: cinematic technical overlay, not a dense
engineering dump. The frame stays primary. Restrained high-contrast
lines and markers. Perspective guides converge on the actual FoE /
vanishing point. Compact metadata / legend around the edges.

Potential uses: Camotion tuning and debugging; inspecting
Cinematographer spatial reasoning; helping advanced users see how
TunnelVision intends to move through a scene; a later
explanation/inspection mode.

## Spatial vs temporal continuity

Forward motion is not the same as continuous velocity through a shot
boundary. Across many Seedance tests the model appears to use a
temporal envelope: establish motion, perform the move, ease/resolve
toward the endpoint. That can make B a stop rather than a sample on
a continuing trajectory.

Evaluate separately:

-   **Spatial continuity:** does the camera physically traverse
    connected intermediate space, or reconcile worlds through a
    cut/dissolve/replacement?
-   **Temporal continuity:** does camera motion carry through the
    ending frame, or ease/decelerate/stop at B?

Canonical frames should behave as position samples, not stop points.
No schema.

## Endpoint / edit-boundary fidelity instrumentation

Unvalidated research instrumentation. Do not invent a score formula
yet. Because source PNGs are higher resolution than generated video,
literal pixel equality requires a documented deterministic resize
first.

Two related questions:

-   **Endpoint fidelity:** last decoded frame of A→B vs supplied B or
    B′; first decoded frame of B→C vs supplied B or B′.
-   **Actual edit-boundary continuity:** last decoded frame of A→B vs
    first decoded frame of B→C. This may matter more for the finished
    movie than absolute fidelity to B′.

Possible later metrics after normalization: MAE/RMSE, PSNR, SSIM,
optional LPIPS. Possible future name: Boundary Fidelity Score. Not
specified.

## Deterministic finishing / upscale

Product finishing hypothesis. Default:

native generated shots → deterministic concat → complete native-
resolution movie → deterministic upscale if required → final encode.

Prefer Lanczos/bicubic initially, not creative/AI upscaling.
Independent generative upscaling of adjacent clips could amplify tiny
shared-boundary differences. Identical native frames through the same
deterministic scaler remain identical.

"Generative models make filmmaking decisions; deterministic code
preserves them."

AI/video upscale is an optional later finishing experiment that must
show benefit without harming temporal/boundary continuity. Do not add
an AI upscaler to Phase 1.

## Earlier unvalidated ideas to preserve

-   **Perceptual / motion witnesses:** environmental motion (dust,
    leaves, fog, snow, fabric, birds, ghosts, and similar) can
    reinforce perceived camera locomotion. Observation/hypothesis
    from the Replicate 01.3–01.8 series, not a proven mechanism.
-   **Pruna Draft Journey / location scouting:** fast exploratory
    generation could let a user discover interesting locations or
    events and promote selected discoveries into canonical
    storyboard decisions.
-   **Draft → Full fixed-seed promotion** as a later experiment.
-   **Cinematographer screen-time reasoning:** how much of a shot's
    duration a traversal deserves. Integration Test 01 added
    movie-level evidence that duration should not be globally fixed
    and that exit/entry velocity may need to be planned.
-   **Export-stage boundary finishing:** `A′ | A→B | B′` with possible
    hard bookends, short dissolves, or future interpolation /
    Smooth-Cut-like treatment. Immediate assembly follow-up is
    deterministic hard-join concat only, not this finishing layer.

Do not begin a new Camotion experiment from this file. Do not start
Camotion 01.13. **Camotion Phase 1 is frozen.** Cinematographer
shootability / traversable intermediate volume is **completed** Phase 1
evidence. **TunnelVision Research Phase 1 is complete.** Remaining
items in this file stay backlog for product development and Movie #2
evidence, not dedicated Phase 1 experiments.
