# Forest Shot Evaluator Experiment 03: Post-Generation Shot Evaluation

Research / evidence. Not a product milestone. Production Cinematographer
code was not changed. Experiments 01 and 02 were not modified.

This is a **Shot Evaluator**, not the Cinematographer. It observes
generated footage. It does not plan how to shoot.

Evaluation used **sampled frames, not native video.** Production
`ReasoningProvider` is images-only. The same Replicate model
(`google/gemini-3.1-pro`) advertises `videos[]`, but Buffer and File
uploads failed technically (unknown mime type). Four native-video
attempts per pair were recorded, then the experiment fell back to a
deterministic frame sequence through the existing images path. The
model was not switched.

Sampling: ffmpeg output-seek (`-ss` after `-i`), JPEG `q:v 2`. First
frame, every 1.0s, plus last frame near duration. Typical timestamps:
`0, 1, 2, 3, 4, 5, ~5.99s`. Image order: canonical start, canonical
end, then shot samples in time order. Exact hashes are in each pair’s
`input.json`.

A→B sampled-frame attempt 1 timed out (Gemini E004); attempt 2
succeeded. That is a technical retry, not a quality reroll.

Harness: `media/experiments/forest-a-to-f/cinematographer-shot-evaluation.ts`  
Prompt: `media/experiments/forest-a-to-f/cinematographer-shot-evaluation-prompt.ts`

Run: `2026-09-08T16:57:28.711Z` → `2026-09-08T17:01:26.728Z` (sampled-frame
evaluations; earlier mime failures from ~16:52).  
Git: `9b10bc70e1546a7ac26ac655230e403dd15f46f5`

## Phase 1 — evaluator results (frozen)

Recorded before consulting human Forest evidence or Experiments 01/02.

| Pair | Result | Locomotion | Endpoint arrival | Spatial solidity | Transition mode | Summary |
| --- | --- | --- | --- | --- | --- | --- |
| A→B | `successful_traversal` | `strong` | `strong` | `preserved` | `traversal` | Camera travels the path, through a dark root tunnel, to the intended destination. |
| C→D | `successful_traversal` | `strong` | `strong` | `preserved` | `traversal` | Continuous forward down the tunnel; mushrooms pass; crystal grows to an exact match. |
| D→E | `successful_traversal` | `strong` | `strong` | `preserved` | `traversal` | Forward push through the crystal, darker tunnel beyond, then into the destination corridor. |
| E→F | `failed_traversal` | `ambiguous` | `strong` | `broken` | `replacement` | Push toward the portal, then a hard cut replaces the corridor with the void. Arrival is strong; travel is not. |

| Pair | Prediction | Elapsed (successful call) |
| --- | --- | --- |
| A-B | `9gx5qzre0xrmw0d0g7v85n0v1c` | 18499 ms |
| C-D | `41p7mxtpysrmt0d0g7v8hkt6gr` | 25580 ms |
| D-E | `xregvv5z1nrmw0d0g7v9hcxbhw` | 36661 ms |
| E-F | `46fdbxaht5rmy0d0g7vr170d68` | 28390 ms |

These four judgments are frozen. Raw JSON is in each pair’s `raw.txt`.

## Phase 2 — comparison with existing Forest video evidence

Consulted only after Phase 1. Source:
[`../../REPORT.md`](../../REPORT.md).

### A→B — aligned

Human: strongest locomotion; gateway entered; trunks pass; travel not
dissolve; end matches B′.

Evaluator: `successful_traversal`, strong locomotion and arrival,
preserved solidity, mode `traversal`. Observations (parallax mushrooms/
roots, tunnel translation, final-frame match) agree with that clip.

### C→D — contradicted on replacement; partial on forward motion

Human: weakest start-frame hold. C′ abandoned early; crystal as
destination pull; C replaced more than traversed.

Evaluator: `successful_traversal` / `traversal`. It treats mushrooms
leaving frame and the crystal growing as camera travel, with no
failure modes.

There is forward-looking scale change in the clip, so “some motion”
is not empty. The human failure mode — C’s identity not traversed —
is not detected. Frozen result left unchanged.

### D→E — partially aligned

Human: best threshold grammar; next space visible through an opening;
crystal never physically passed around; material language changes.

Evaluator: `successful_traversal`. It describes pushing **through**
the crystal until facets fill the frame, then a darker tunnel opening
into the corridor. That matches “no sidestep” and “opening beyond,”
and it rates arrival strong. It does not flag the crystal as an
unresolved obstacle or the root→mirror material jump as
transformation. Overall success agrees; crystal/material caveats do
not.

### E→F — aligned

Human: spatial break; portal not crossed as a doorway; warp/replace;
F not a physical continuation.

Evaluator: `failed_traversal`, `replacement`, solidity `broken`,
locomotion `ambiguous`, **endpoint arrival `strong`**. It separates
getting the last frame right from actually traveling. Hard-cut /
environment vanish at ~t=3s matches the observed collapse.

## Phase 3 — Experiments 01, 02, and 03

| Pair | 01 physical-set (stills) | 02 generative-traversal (stills) | 03 Shot Evaluator (footage samples) | Observed Seedance |
| --- | --- | --- | --- | --- |
| A→B | `not_shootable` | `needs_review` | `successful_traversal` | Strong walk |
| C→D | `not_shootable` | `not_shootable` | `successful_traversal` | Replace / destination pull |
| D→E | `not_shootable` | `not_shootable` | `successful_traversal` | Best threshold; crystal not passed around |
| E→F | `shootable` | `shootable` | `failed_traversal` | Warp / replace |

1. **Can the Shot Evaluator tell actual locomotion from scene
   transformation?**
   On this set, yes for A→B and E→F, no for C→D. E→F is the clean
   demonstration: it names replacement and a hard cut instead of
   portal-as-travel.

2. **Does it detect C→D-style replacement when watching the footage?**
   Not in this run. 01/02 predicted replacement from stills; 03 called
   the clip a successful traversal. Watching samples did not recover
   that still-to-still diagnosis.

3. **Does it recognize successful traversal in cases static CM
   rejected?**
   Yes for A→B (01 veto, 02 review, 03 success, matching video). D→E
   is also 01/02 veto vs 03 success, closer to the working clip than
   endpoint CM was.

4. **Does it detect spatial breakdown even when a semantic
   threshold/portal makes the transition narratively plausible?**
   Yes for E→F. Arrival is strong; solidity is broken; mode is
   replacement. That is the portal trap 01/02 fell into.

5. **Can it independently distinguish traversal quality, endpoint
   fidelity, and spatial solidity?**
   Yes on E→F (three different values). A→B/C→D/D→E collapsed all
   three to the success pole.

6. **Is post-generation observation substantially more reliable than
   pre-generation shootability on this evidence?**
   More reliable on the pairs that inverted 01/02 (A→B and E→F). Less
   reliable than 01/02 on C→D. Not a complete replacement for
   endpoint reasoning.

7. **Does this support separating Cinematographer and Shot Evaluator?**
   Yes. Cinematographer: how might these actual sets be filmed.
   Shot Evaluator: what the generated footage did. The same model,
   given footage rather than endpoints, reversed E→F and A→B relative
   to stills-only CM.

8. **Does this support an eventual loop Director → Cinematographer →
   generate → Shot Evaluator → accept / retry / replan?**
   As architecture, yes: prediction and observation are different
   jobs, and observation corrected the worst stills-only inversions.
   This experiment does not implement that loop, and C→D shows the
   observer can still miss replacement.

9. **How does this compare with Terran Boylan’s manual TunnelVision
   workflow?**
   Terran Boylan originated TunnelVision as a manual filmmaking
   technique: successive generated viewpoints, carried forward when
   they preserve convincing spatial travel, rejected when they do not.
   Human review of generated clips is part of that craft. A Shot
   Evaluator is an agentic attempt at that review step — watch the
   shot, keep travel, reject morph/replace — not a replacement for
   Terran’s original technique, and not his code.

Sampled-frame evaluation is a limitation: 1 Hz stills can hide
sub-second dissolves and can make destination-pull look like smooth
scale change (relevant to C→D). Native video remains preferred if the
upload path can be made to work without productizing it.

Do not add ShotEvaluation to production domain types from this report.

## Recommendation

**PROMOTE SHOT EVALUATION AS DISTINCT ARCHITECTURAL ROLE**

The capability exists well enough to belong in the architecture as a
separate observer, not as a Cinematographer prompt variant and not as
a product feature in this experiment. Endpoint-only CM is not
sufficient (A→B/E→F). More evidence would still help (C→D miss,
sampled frames vs native video), but that is the next research step,
not a reason to fold evaluation back into stills-only shootability.
