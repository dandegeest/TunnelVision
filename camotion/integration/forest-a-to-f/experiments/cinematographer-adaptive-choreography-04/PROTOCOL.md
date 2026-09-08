# Forest Cinematographer Experiment 04: Adaptive Camera Choreography

Research / evidence. Not a product PR. Does not overwrite Experiments
01–03. Does not modify production Cinematographer, Camotion, Director,
or Shot Evaluator.

TunnelVision extends filmmaker **Terran Boylan's** original
TunnelVision technique and manual workflow. The frozen locomotion
baseline inherits an important idea from Terran's shooting vocabulary:
continuous forward movement through a spatially contiguous environment
while negotiating doors, corners, fog, objects, and other geography as
necessary to maintain travel. Adaptive Cinematographer choreography is
**not** Terran's technique; it is the new TunnelVision research
question tested here.

## Question

Can the Cinematographer inspect actual canonical start/end sets and
devise useful segment-specific camera choreography that adapts the
camera path to the geography, rather than relying entirely on
TunnelVision's generic linear-forward locomotion prompt?

Hypothesis: actual A/B sets → CM observes geography → CM devises camera
choreography → segment-specific prompt addition → baseline + addition
→ (later) video generation.

This experiment tests whether CM can **direct the shot**, not predict
whether Seedance will succeed.

## Phase 1 (this checkpoint)

Blind choreography only. No treatment videos. No Camotion changes.
No CameraMotionPlan. Camotion remains radial-forward.

Pairs: A→B, C→D, D→E, E→F. Exact existing Forest canonical stills.

CM receives the stills, Forest fixture intents/story, and the frozen
locomotion baseline. It does not receive Experiments 01–03, human
Forest evaluations, or prior Seedance outcomes.

One run per pair. Retry only technical failures.

## Phases 2–5 (generation and evaluation)

Phase 1 remains frozen. Later phases did not regenerate choreography.

Phase 2: matched Seedance 2.5 control vs treatment. Forest shooting
frames, Forest locomotion baseline, frozen `segmentPromptAddition`
appended verbatim. Same seed within pair. Eight videos, one run each.

Phase 3: Experiment 03 Shot Evaluator unchanged. Sampled frames. Blind
to condition and choreography.

Phase 4: choreography adherence on treatments only, after evaluator
freeze.

Phase 5: control vs treatment on traversal quality and camera path,
kept as separate dimensions.

See `REPORT.md`. Do not implement the recommendation.
