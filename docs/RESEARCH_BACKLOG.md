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

**UNTESTED 01.11 question:** 01.11 should characterize what spatial
signal the current Camotion exposure operator actually produces
before choosing a fix.

A future still-only diagnostic may compare existing 01.8 / 01.9
exposure behavior with alternative exposure / operator families,
using both Ghost Library artifact regions and simple synthetic
fixtures such as points, lines, and small structured shapes. The
purpose is to understand the exposure primitive / empirical
point-spread behavior, not yet to select a new renderer.

Possible alternatives such as temporal weighting, line/PSF-style
integration, or prefiltering remain untested candidates, not a
chosen intervention. Do not begin 01.11 from this file.

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

Do not begin Camotion 01.11 from this file.
