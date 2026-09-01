# TunnelVision Filmmaking Roles

Use real filmmaking responsibilities rather than implementation-oriented
agent names.

## Director --- where do we go next?

Inputs: current/prior canonical frames, journey brief, remaining
duration, preference state and optional user destination.

Responsibilities: understand the world, propose meaningful next camera
positions, preserve continuity, create discovery, avoid same-composition
scene evolution, request/evaluate candidates, learn from human choices
and audit the canonical sequence.

Candidate evaluation can include continuity, perceptible camera
displacement, novelty, navigability, preference fit and discovery.
Automated scoring of displacement or traversal is an **open question**.
PreferenceState schema is an **open question**. The Director is not
being implemented in the Camotion v1 milestone.

## Cinematographer --- how do we physically get there?

Inputs: accepted start/end **canonical** frames, intended
destination/route, scene analysis and user overrides.

Responsibilities (intended role, not a current module): infer
perspective/route geometry, identify destination and useful
focus-of-expansion geometry, identify parallax-producing foreground
objects and protected regions, produce ShotPlan and CameraMotionPlan
JSON, request any CV/depth observation **outside** Camotion, invoke
Camotion to produce shooting frames, fill a stable locomotion template,
and evaluate actual traversal.

Video currently receives those shooting frames plus the locomotion
prompt. Canonical frames stay storyboard/world-state authority; they
are not currently video inputs.

**Final Cinematographer module boundaries are an open question.** Do
not scaffold a Cinematographer package alongside Camotion.

## Camotion Engine

Camotion is **not an agent**. It is deterministic graphics code. The
Cinematographer role (later) decides what motion should mean; Camotion
performs the math.

The frozen v1 **plan** contract is `image + CameraMotionPlan JSON` and
emits one shooting-frame still. See [DATA_MODEL.md](DATA_MODEL.md).
An optional near-weight image may be supplied beside that contract.
Camotion does not estimate depth, run CV, or call generators.

Camotion v1 is a **radial-exposure experiment** (forward radial motion
field around a supplied focus of expansion, scaled by `camera.forward`,
multisample exposure, protected destination, optional near-weight
scaling of that same field). It is inspired by TunnelTV
motion-conditioning findings. It is **not** a recreation or port of
Terran Boylan's depth-aware Photoshop workflow, which used Z / depth,
two blur operations, and destination protection.

v1 does not implement lateral translation / strafing or turning / yaw.

Camotion must not call LLMs or generation providers and must have no
TypeScript or Node dependency.

## No Edit agent

Do not initially model an Editor. The storyboard handoff is the
canonical frame. Video currently uses Camotion shooting frames as
start/end images. Distinct `B_in` / `B_out` derivatives and whether
they can hand off invisibly remain an **open question**.

## Stable locomotion principle

Generated motion prioritizes uninterrupted physical travel: camera
continuously advances; foreground objects pass beside/behind it; strong
parallax reveals new space ahead; thresholds, turns, occlusions and
atmosphere can help preserve continuous locomotion.

The genesis prompt that demonstrated this on Seedance 2.5 / Krea is
recorded as an experimental artifact in
[IMPLEMENTATION.md](IMPLEMENTATION.md). Preserve Terran Boylan /
TunnelTV provenance. Do not treat that text as model-independent or as
a Camotion input.
