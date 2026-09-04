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

**UNTESTED 01.12 question:** 01.12 should determine whether a
useful baked-exposure regime exists where trajectory displacement
remains strong enough to provide a meaningful Camotion motion cue
while structured-object duplication remains acceptable.

Characterize path length / exposure strength against source spatial
bandwidth, using the existing 01.8 gather and a very small
controlled matrix. Do not treat this as parameter optimization.

If no useful regime exists, that would motivate leaving
exposure-operator tuning rather than continuing to search for
another integration kernel. Do not begin 01.12 from this file.

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
    duration a traversal deserves.
-   **Export-stage boundary finishing:** `A′ | A→B | B′` with possible
    hard bookends, short dissolves, or future interpolation /
    Smooth-Cut-like treatment.

Do not begin Camotion 01.12 from this file.
