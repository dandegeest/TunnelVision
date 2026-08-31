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

## Cinematographer --- how do we physically get there?

Inputs: accepted start/end canonical frames, intended destination/route,
scene analysis and user overrides.

Responsibilities: infer perspective/route geometry, identify destination
and useful focus-of-expansion geometry, identify parallax-producing
foreground objects and protected regions, produce ShotPlan and
CameraMotionPlan JSON, fill a stable locomotion template, invoke
Camotion, and evaluate actual traversal.

## Camotion Engine

Camotion is **not an agent**. It is deterministic graphics code. The
Cinematographer decides what motion should mean; Camotion performs the
math.

## No Edit agent

Do not initially model an Editor. Adjacent clips should share exact
canonical handoff frames and preserve perceived motion. Assembly should
become nearly mechanical.

## Stable locomotion principle

Generated motion prioritizes uninterrupted physical travel: camera
continuously advances; foreground objects pass beside/behind it; strong
parallax reveals new space ahead; thresholds, turns, occlusions and
atmosphere can help preserve continuous locomotion.
