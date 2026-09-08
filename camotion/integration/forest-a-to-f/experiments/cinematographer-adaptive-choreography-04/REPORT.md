# Forest Cinematographer Experiment 04: Adaptive Camera Choreography

Research / evidence. Not a product milestone. Production Cinematographer,
Camotion, Director, and Shot Evaluator were not changed. Experiments
01–03 were not modified. No treatment videos were generated.

TunnelVision extends filmmaker **Terran Boylan's** original TunnelVision
technique and manual workflow. The frozen locomotion baseline
(`camotion/integration/forest-a-to-f/prompt.txt`) inherits continuous
forward movement through a spatially contiguous environment while
negotiating geography as necessary to maintain travel. Adaptive
Cinematographer choreography is **not** Terran's technique; it is the
research question of this experiment.

Phase 1 is blind choreography only. Camotion remains radial-forward.
No CameraMotionPlan.

Same four Forest canonical files, trusted media identities, destination
intents, journey story, and model (`google/gemini-3.1-pro`,
`thinking_level=high`) as earlier Forest CM experiments. CM did not
receive Experiments 01–03, human clip rankings, or prior video
outcomes.

One run per pair. Zero technical retries.

Harness: `media/experiments/forest-a-to-f/cinematographer-adaptive-choreography.ts`  
Prompt: `media/experiments/forest-a-to-f/cinematographer-adaptive-choreography-prompt.ts`

Run: `2026-09-08T17:15:19.377Z` → `2026-09-08T17:16:20.959Z`  
Git: `4c19f96379a3ee5566cb811ab0bb6fc969378bd4`

## Phase 1 — blind choreography (frozen)

| Pair | Route | Camera path | Key geometry | Transition strategy | Prompt addition |
| --- | --- | --- | --- | --- | --- |
| A→B | Forward along the stepping stones, through the midground root archway, toward the dark tunnel mouth. | Track forward along the path, passing the large right-side trunk and left-side root wall, steering slightly right to align with the tunnel opening. | stepping-stone path; massive right tree trunk; left root wall; midground root archway | Pass through the natural root archway; heavy trunks sweep past the lens into the darker enclosed tunnel. | Track forward along the glowing stone path, pass between the large left root wall and the right tree trunk, and move through the misty root archway toward the dark tunnel. |
| C→D | Straight forward along the central axis of the tunnel. | Push directly forward over the floor stones, passing glowing white mushrooms on the right, until the crystal cluster is centered ahead. | circular root walls; glowing white mushrooms; large glowing crystal cluster | Centered forward trajectory; foreground roots and mushrooms sweep past to reveal the crystal. | Push straight forward down the center of the root tunnel, passing the glowing white mushrooms on the floor to approach the massive glowing crystal cluster directly ahead. |
| D→E | Forward through the root tunnel, passing alongside the central crystal, into a sleek dark corridor. | Advance, veer right to skirt the crystal spire so its facets pass in extreme foreground, then recenter toward the vertical light portal. | large glowing crystal cluster; dark reflective walls; vertical light portal | Close crystal bypass uses light and facets to obscure tunnel walls while bridging organic texture into reflective corridor walls. | Approach the glowing crystal cluster and veer slightly right to pass closely alongside it. Allow the glowing facets to sweep past the lens in extreme foreground, transitioning the rough dirt environment into a smooth, dark, reflective corridor approaching a tall vertical light. |
| E→F | Straight forward down the reflective corridor, through the tall portal, into the open void. | Center-line forward. Pass between faceted walls, cross the bright vertical portal, continue through floating debris toward the central light. | dark faceted corridor walls; reflective floor; tall bright vertical portal; floating rock debris; central light source | Push through the portal; doorway bloom resolves into the destination star; corridor walls visually break apart into the debris field. | Move straight forward down the dark reflective corridor and pass directly through the tall, intensely bright vertical portal. Emerge into an expansive dark void, continuing forward through a field of floating rock debris toward a bright, distant central light. |

Exact `segmentPromptAddition` strings are in each pair’s
`choreography.json`. Raw model JSON is in `raw.txt`.

| Pair | Prediction | Elapsed |
| --- | --- | --- |
| A-B | `yemvpzv53nrmw0d0g829tcekhg` | 18931 ms |
| C-D | `0zyqdcdh1srmw0d0g82b8dtq3w` | 12629 ms |
| D-E | `kh9v56707hrmt0d0g82bwd27qg` | 16995 ms |
| E-F | `x2qh4f93tnrmw0d0g82tsfv1h4` | 12989 ms |

## Blind choreography observations

These notes describe what CM proposed from the stills. They do not
compare against generated-video outcomes.

CM did **not** invent a turn on every pair. C→D and E→F are mostly
straight-axis moves. A→B adds a slight right steer through a named
archway. D→E is the clear geography-aware non-linear proposal: veer
right, pass alongside the crystal, recenter.

A→B names path, trunks, root wall, and a misty root archway, and the
addition is a between-objects pass rather than a generic “keep going
forward.”

C→D treats the crystal as a destination ahead on the center line, not
as an object to negotiate around. The addition is still segment-
specific (mushrooms on the floor; approach the crystal) but the path
is linear.

D→E independently treats the crystal as negotiable geometry: skirt
it, extreme-foreground facet pass, then recenter to the portal. That
is adaptive choreography from the stills, not a restatement of the
baseline.

E→F stays on the center line through the portal. The addition is
specific (reflective corridor, bright vertical portal, debris, central
light). The written transition strategy also describes corridor walls
breaking apart into debris, which is a geography-to-destination story
rather than a lateral camera path.

Phase 1 is frozen. No treatment videos in this checkpoint.

## Phase 2 — Controlled Generation

Frozen Phase 1 choreography was not rerun, edited, or rephrased.
`segmentPromptAddition` was loaded from each pair’s `choreography.json`
and asserted against the frozen strings.

This is a matched Seedance 2.5 generation: baseline locomotion versus
the same baseline plus the frozen addition. Production Cinematographer,
Camotion, Director, and Shot Evaluator were not changed. Historical
Forest clips under `camotion/integration/forest-a-to-f/videos/` were
not overwritten (hashes still match `generation-manifest.json`).

Terran Boylan’s original TunnelVision technique and manual
continuous-locomotion / environment-negotiation prompting are the
source of the **frozen baseline** (`prompt.txt`). The treatment
additions are **not** Terran’s wording. They are agent-generated
Phase 1 segment choreography appended verbatim.

Harness: `media/experiments/forest-a-to-f/cinematographer-adaptive-choreography-generate.ts`

Run: `2026-09-08T17:25:25.063Z` → `2026-09-08T18:07:18.982Z`  
Git: `4c19f96379a3ee5566cb811ab0bb6fc969378bd4`

Provider / settings (Forest evidence reused):

- provider: Replicate
- model: `bytedance/seedance-2.5` (`modelVersion` reported `hidden`)
- duration: 6s (probed 6.041667s on all eight)
- resolution: 720p
- aspect ratio: adaptive
- audio: false
- watermark: false
- output: mp4
- first/last frames: existing Camotion shooting frames
  `camotion/integration/forest-a-to-f/shooting/{A–F}.png`
  (hashes match Forest shooting evidence)

Seed: Seedance 2.5 through this provider **does expose a reproducible
seed**. Same seed for control and treatment within a pair; different
fixed seed per pair. Submitted seed equaled reported seed on all eight.

| Pair | Seed submitted | Seed reported |
| --- | ---: | ---: |
| A→B | 40104 | 40104 |
| C→D | 40204 | 40204 |
| D→E | 40304 | 40304 |
| E→F | 40404 | 40404 |

Generation order (alternating, as specified):

1. A→B control
2. A→B treatment
3. C→D treatment
4. C→D control
5. D→E control
6. D→E treatment
7. E→F treatment
8. E→F control

One run per condition. Zero technical retries. Zero aesthetic rerolls.

Control prompt = `prompt.txt` verbatim.  
Treatment prompt = that baseline + newline + frozen `segmentPromptAddition`.
No model merge/rephrase.

| # | Pair | Condition | Prediction | Elapsed | Video sha256 |
| --- | --- | --- | --- | ---: | --- |
| 1 | A-B | control | `cvz7m3d3c9rmr0d0g86vaxa3mm` | 442901 ms | `ac4926d31669f0b69304321d2f5594346a50037306fd5ef934ca29f17626f199` |
| 2 | A-B | treatment | `f9wcncv88hrmr0d0g8abmeswfg` | 383276 ms | `b9c902f09e4c2b0757949337d75240f754eb25b7e8294b06e3b77be9bd58736b` |
| 3 | C-D | treatment | `t3b8hg271drmt0d0g8dafkhbgg` | 354213 ms | `8412beaa4f83ae4ebf0f0a32e8706c9b6941e1f99a15b3a138c8ed5ad5ba846d` |
| 4 | C-D | control | `681tjwnk6hrmy0d0g8ft4bhtbc` | 243154 ms | `bdab844315ae93fecec2d388207dc15d9c2583f3342e9b38b555be7ff8d8b017` |
| 5 | D-E | control | `mwmmmvvbtxrmr0d0g8ht7jsw20` | 335797 ms | `415f1b99442b232a400eaa79fc5cb5479a1c5e2c78ea226621cb11a4e3281804` |
| 6 | D-E | treatment | `0q6b6kwdwhrmr0d0g8mby02k8r` | 403027 ms | `c615097e662ae00e03257f3a834633940290175971d9dc9969f53775db0b358b` |
| 7 | E-F | treatment | `vp8mjzxrb9rmy0d0g8qbbk744m` | 191857 ms | `c658f606e409d5a2450548de5380b0fa2b3fd9efa6cf7d070335377027c7c0bb` |
| 8 | E-F | control | `vwn44a58rnrmt0d0g8rvstbmd4` | 152268 ms | `c11ae8d59b294499639d9664b0f0f765f940bc1d70f9e72d47a22eb0fb4e0776` |

Outputs: `generation/{pair}/{control,treatment}/video.mp4` plus
`generation.json` and `prompt.txt`. Manifest:
`generation/manifest.json`.

Phase 2 bookkeeping only. No subjective success labels were written
into Shot Evaluator input.

## Phase 3 — Blind Shot Evaluation

Experiment 03 Shot Evaluator prompt and sampled-frame process reused
unchanged. Experiment 03 files were not modified. Native video upload
was not re-attempted as a fix.

Sampling: `ffmpeg -y -i VIDEO -ss TIMESTAMP -frames:v 1 -q:v 2 SAMPLE.jpg`
(output-seek). First frame, every 1.0s, last frame ~duration−0.05s
(`0, 1, 2, 3, 4, 5, ~5.99`). Image order: canonical start, canonical
end, then shot samples. Canonical stills via trusted Forest media IDs,
same story/intents as Experiment 03.

Evaluator was not told control vs treatment, CM choreography,
hypotheses, Experiments 01–03 outcomes, or human judgments. Condition
exists only in on-disk paths/metadata, not in the model prompt.

Harness: `media/experiments/forest-a-to-f/cinematographer-adaptive-choreography-evaluate.ts`  
Prompt: `media/experiments/forest-a-to-f/cinematographer-shot-evaluation-prompt.ts`

Run: `2026-09-08T18:07:33.980Z` → `2026-09-08T18:11:18.739Z`  
Model: `google/gemini-3.1-pro`, `thinking_level=high`  
One evaluation per clip. Zero technical retries.

Evaluation order (interleaved so the model did not see control then
treatment as a pair): A-B control, C-D treatment, D-E control, E-F
treatment, A-B treatment, C-D control, D-E treatment, E-F control.

| Pair | Condition | overallResult | locomotion | endpointArrival | spatialSolidity | transitionMode | Prediction |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A→B | control | partial_traversal | strong | strong | compromised | traversal_with_transformation | `72jykjaekxrmt0d0g8ta90rqcr` |
| A→B | treatment | partial_traversal | strong | strong | compromised | traversal_with_transformation | `rtbyke7d2nrmy0d0g8ts3e04bc` |
| C→D | control | failed_traversal | ambiguous | strong | broken | dissolve | `v6ahyr321xrmt0d0g8v9vkr6hc` |
| C→D | treatment | partial_traversal | ambiguous | strong | broken | discontinuity | `35dkdqndp1rmr0d0g8t8beqx74` |
| D→E | control | partial_traversal | strong | strong | compromised | discontinuity | `zagmmj0rknrmt0d0g8ttgxb2w8` |
| D→E | treatment | successful_traversal | strong | strong | preserved | traversal | `qbvm76y7w9rmw0d0g8vbpy5x6r` |
| E→F | control | successful_traversal | strong | strong | preserved | traversal | `t4nd5ajnaxrmt0d0g8vv7pmt4m` |
| E→F | treatment | successful_traversal | strong | strong | preserved | traversal_with_transformation | `cydv54cg9hrmt0d0g8ttxr17wr` |

Raw evaluator JSON is in `evaluations/{pair}/{condition}/evaluation.json`.
These results are frozen before Phase 4.

## Phase 4 — Choreography Adherence

Compared after evaluator freeze. Adherence ≠ traversal quality ≠
endpoint fidelity. Endpoint arrival was strong on all eight clips.

### A→B treatment — partial

Requested: track along the glowing stone path, pass between left root
wall and right trunk, through the misty root archway toward the dark
tunnel.

Observed: forward travel between the left root wall and right trunk is
visible; stones/mushrooms pass the camera; the path continues into a
darker enclosed opening. The named archway pass is not a distinct
steer separate from ordinary center-line travel through that
geography. Evaluator: right-side trunk identity changes; destination
tunnel materializes from mist/geometry (morph), not a uniquely
choreographed alignment.

Control spontaneously performed a similar between-objects forward
move. The maneuver is not treatment-unique.

### C→D treatment — partial

Requested: push straight down the tunnel center, pass floor mushrooms,
approach the crystal ahead. Quasi-control for gratuitous turns.

Observed: early frames show centered forward travel and mushrooms
passing. No requested turn was added. At ~t=2s the tunnel core goes
dark; later frames show the crystal through a circular iris/vignette
rather than continued linear 3D travel (evaluator: 2D iris wipe /
discontinuity).

Control also stayed notionally axial and did not invent a lateral
veer. Control failed by crystal materialization and dissolve, including
an apparent backward jump. CM did not add turns; Seedance still broke
the world.

### D→E treatment — partial

Requested: approach crystal → veer slightly right → close alongside
pass → extreme-foreground facet sweep → continue into the reflective
corridor.

Observed (strongest pair difference):

- t=0–2: approach, crystal growing in frame (both conditions).
- t=3 treatment: crystal facets fill the lens in extreme foreground
  (full-screen pale occlusion). Evaluator: camera enters crystal
  geometry, then emerges into the corridor.
- t=4–5 treatment: stable dark reflective corridor toward the vertical
  light. Evaluator: spatial solidity preserved; mode `traversal`.

What did **not** clearly happen: a readable **rightward** lateral
offset with the crystal passing on one side and then recentering.
The treatment is closer to punching **through / into** the crystal
as transition cover than veering right to skirt it.

Control close encounter: at t=3 the crystal is large in the
lower-right foreground (a close pass of a kind), then t=4 jumps to
the corridor. Evaluator: collision then discontinuous jump. Control
did **not** spontaneously produce the continuous extreme-foreground
facet cover that the treatment used.

### E→F treatment — clear

Requested: straight down the reflective corridor, through the tall
bright portal, into the void, forward through debris toward the
central light.

Observed: corridor parallax, portal crossing, debris field, distant
central light. Control did the same maneuver spontaneously. The
visible difference is timing/cover, not path type: control is already
a full-frame portal whiteout at t=3; treatment is still in the
corridor approaching the portal at t=3, then in the void by t=4.

## Phase 5 — Control vs Treatment

Keep separate: choreography adherence ≠ traversal quality ≠ endpoint
fidelity.

| Pair | Control result | Treatment result | Choreography adherence | Camera-path difference | Traversal effect |
| --- | --- | --- | --- | --- | --- |
| A→B | partial_traversal (strong loco, compromised solidity, morph-in-travel) | partial_traversal (same classes) | partial | Modest. Both pass between left wall and right trunk into a darker opening. Treatment does not show a unique archway steer. | Unchanged |
| C→D | failed_traversal (dissolve, broken, crystal materializes) | partial_traversal (early travel, then iris/wipe discontinuity, still broken) | partial (linear as requested; no extra turn) | Both axial. Control dissolves/materializes. Treatment blacks/irises. Neither veers. | Slightly improved on evaluator labels; spatial solidity still broken |
| D→E | partial_traversal (discontinuity at crystal) | successful_traversal (preserved solidity, traversal) | partial (facet occlusion yes; right-veer/alongside no) | **Largest.** Treatment: extreme-foreground crystal fill then emerge. Control: close crystal then jump-cut to corridor. | Improved |
| E→F | successful_traversal (preserved, traversal) | successful_traversal (preserved, traversal_with_transformation) | clear | Small. Both go corridor → portal → debris/light. Control whiteout earlier; treatment holds corridor longer. | Unchanged / mixed (treatment’s whiteout noted as concealing an environment swap) |

### A. Film quality / traversal

- A→B: unchanged. Both travel, both morph destination structure.
- C→D: treatment less purely a dissolve, still not a solid traversal.
- D→E: treatment improved locomotion continuity and spatial solidity.
- E→F: both succeeded. Treatment’s evaluator note about whiteout
  concealing a swap is a quality caution, not a win.

### B. Camera choreography

- A→B: requested geography-aware steering was not clearly stronger
  than control’s spontaneous between-objects path.
- C→D: CM stayed linear; Seedance did not start inventing turns.
  Useful quasi-control.
- D→E: treatment created geography-aware behavior that control lacked:
  the crystal became transition cover via extreme-foreground occlusion
  instead of a collision/jump. That is not the same as the requested
  right-side skirt, but it is non-radial relative to a pure center-line
  miss or morph.
- E→F: portal instruction did not create a different spatial strategy.
  Both clips already do the portal traversal.

## Synthesis

Eight new clips, matched endpoints, matched Seedance settings, matched
within-pair seeds, one run, no cherry-picking.

1. **Can CM natural-language choreography alter camera movement?**
   Yes, on the pair that asked for a non-linear object negotiation
   (D→E). Same seed 40304, different prompt, different crystal
   encounter: jump-cut vs facet occlusion. A→B and E→F differences
   are small. C→D did not add a turn.

2. **Does CM respond selectively to geography rather than adding turns
   everywhere?** Phase 1 already proposed linear C→D and E→F. Phase 2
   videos did not introduce gratuitous veers on those pairs. The only
   large path change is on D→E, where CM asked for object negotiation.

3. **Can foreground objects become path features rather than automatic
   blockers?** D→E treatment: yes — the crystal occludes, then the
   corridor is there. D→E control: the crystal behaves more like a
   blocker that the model jumps past. One pair, one run.

4. **Did D→E produce the requested lateral/close-pass?** Close-pass /
   extreme-foreground facet sweep: yes. Distinct veer-slightly-right
   alongside then recenter: not clearly. Classification: partial.

5. **If so, did that improve traversal or merely add motion variation?**
   Improve, on this run. Blind evaluator: control `partial_traversal` /
   `discontinuity` / compromised solidity; treatment
   `successful_traversal` / `traversal` / preserved solidity.

6. **Did C→D remain appropriately simple?** The CM addition stayed
   linear. Generated videos both broke spatially without adding a
   choreographed turn. Evaluator preferred treatment slightly
   (`partial` vs `failed`) but both have broken solidity.

7. **Does E→F show that good choreography cannot rescue a spatially
   broken endpoint?** Not in this batch. Both clips were
   `successful_traversal` with preserved solidity. Historical Forest
   E→F failure is not evidence here and was not input to generation
   or evaluation. Portal prompt adherence is not a success metric
   separate from spatial solidity; here solidity held on both.

8. **Architectural responsibility: inspect sets and construct
   segment choreography, rather than predict whether the video model
   will succeed?** Directionally supported. Phase 1 CM did not predict
   Seedance. Phase 2–5 show one geography-specific instruction changing
   the generated path and the blind quality label. That is not yet
   enough to make adaptive CM choreography a production
   responsibility: four pairs, one strong result, no replication.

9. **Justify future research into non-radial Camotion (lateral / yaw /
   curve)?** Weak-to-moderate interest only. D→E’s intended right veer
   was not faithfully a lateral Camotion path; natural-language
   close-pass already changed Seedance. Do not implement non-radial
   Camotion from this experiment.

10. **Support the loop Director → CM choreography → baseline+segment →
    generation → Shot Evaluator → accept/retry/replan?** Plausible as
    future research. On this evidence the evaluator would accept D→E
    treatment and retry D→E control; accept both E→F; retry both C→D;
    leave both A→B as partial. Do not implement that loop now.

## Final recommendation

MORE CHOREOGRAPHY EVIDENCE NEEDED

