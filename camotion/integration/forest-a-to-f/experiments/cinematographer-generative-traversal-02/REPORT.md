# Forest Cinematographer Experiment 02: Generative Traversal Potential

Research / evidence. Not a product milestone. Production Cinematographer
code was not changed. Experiment 01 evidence was not modified.

Single variable: an experiment-only prompt that asks whether a
generative video model could synthesize continuous forward camera
travel between two visual states, instead of requiring literal
geometric proof of adjacency.

Same four Forest canonical files, trusted media identities, destination
intents, journey story, model (`google/gemini-3.1-pro`,
`thinking_level=high`), output schema, and pairs as Experiment 01.
One run per pair. Zero technical retries.

Harness: `media/experiments/forest-a-to-f/cinematographer-generative-traversal.ts`  
Prompt: `media/experiments/forest-a-to-f/cinematographer-generative-traversal-prompt.ts`  
Evidence: this directory. Raw JSON is in each pair’s `raw.txt`.

Run: `2026-09-08T16:34:57.014Z` → `2026-09-08T16:36:13.810Z`  
Git: `9b10bc70e1546a7ac26ac655230e403dd15f46f5`

## Experiment 02 results (no interpretation)

| Pair | Shootability | Summary | Generative route evidence | Replacement / morph risk | Visual-state discontinuity | Camotion suitability | Main concerns |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A→B | `needs_review` | Strong forward path, but open cliff-edge ridge → enclosed flat ground risks a morph rather than continuous travel. | Forward and down the stone path, curving left into the misty gap between midground trees. Threshold: misty space between left trunk and right structure. | Chasm on the right disappears; cliff edge may dissolve into the root wall. | Narrow elevated ridge → flat enclosed floor. | `appropriate` | Right-side chasm gone. Ground geometry change. Dissolve of cliff into root wall. |
| C→D | `not_shootable` | Nearly identical framing/camera station. Change reads as mushroom→crystal substitution, not forward travel. | Forward along the central tunnel. Threshold: central dark opening. | Direct object substitution; identical station relative to outer tunnel. | Ground plane and wall textures change completely (stylistic swap). | `appropriate` | Morph mushrooms into crystal. Identical camera station. Texture swap without spatial progression. |
| D→E | `not_shootable` | Central crystal blocks forward path; a forward camera collides and morphs rather than traversing. | No continuous path; crystal blocks. Threshold: none visible. | Crystal likely morphs into the glowing portal. | Organic mossy cave → smooth reflective architectural corridor. | `poor_fit` | Crystal→portal replacement. Structural discontinuity. Blocked locomotion. |
| E→F | `shootable` | Push down the corridor through the glowing vertical portal; intense light conceals the transition into the debris field. | Straight along the reflective floor, through the bright central opening, into the void. Threshold: tall glowing vertical opening. | Concern that the model uses a white-out dissolve instead of physical passage. | Narrow bounded floor → vast open horizon; risk of a sudden spatial pop. | `appropriate` | White-out dissolve instead of passage. Ground-plane pop. |

Provider records:

| Pair | Prediction | Elapsed |
| --- | --- | --- |
| A-B | `yrbgh63ekhrmw0d0g7fv3datng` | 18968 ms |
| C-D | `tyj7q25rp9rmy0d0g7fvqqdx9g` | 25919 ms |
| D-E | `sye5x4rxc9rmr0d0g7gb2cy7hc` | 16360 ms |
| E-F | `mbxssety1drmy0d0g7ga92y5zg` | 15510 ms |

`modelVersion` reported as `hidden`. Prior Seedance outcomes and
expected classifications were not supplied.

## Three-way comparison

Consulted only after Experiment 02 captures. Experiment 01:
[`../cinematographer-actual-set-assessment/REPORT.md`](../cinematographer-actual-set-assessment/REPORT.md).
Observed video:
[`../../REPORT.md`](../../REPORT.md).

| Pair | Experiment 01 (physical-set) | Experiment 02 (generative traversal) | Observed Seedance | Exp 02 vs video |
| --- | --- | --- | --- | --- |
| A→B | `not_shootable` / `poor_fit`. B not on A’s forward vector; no threshold. | `needs_review` / `appropriate`. Path through misty tree gap; chasm/ground morph risk. | Strongest locomotion. Gateway entered; trunks pass; travel not dissolve. | **Partially aligned.** Now admits a generative route matching the observed walk, but still withholds `shootable` and predicts morph the clip did not do. |
| C→D | `not_shootable` / `appropriate`. Same camera station; interior swapped. | `not_shootable` / `appropriate`. Object substitution; identical station. | C replaced early; crystal as destination pull; not a traversal of C. | **Aligned.** Replacement/morph diagnosis matches the clip. |
| D→E | `not_shootable` / `poor_fit`. Crystal dead-end; no threshold in the stills. | `not_shootable` / `poor_fit`. Crystal blocks; crystal→portal morph; material discontinuity. | Best threshold grammar. Next space visible through an opening. Crystal never physically passed. Material language changes. | **Partially aligned.** Crystal-as-obstacle and material jump match; overall veto misses the clip’s successful opening grammar. |
| E→F | `shootable` / `appropriate`. Portal as clean threshold into void. | `shootable` / `appropriate`. Portal + light as cover into debris field; notes white-out and ground-plane pop. | Spatial break. Corridor becomes void/warp. Portal not crossed as a doorway. | **Contradicted.** Verdict still `shootable`. Concerns move closer to the observed dissolve/warp but do not change the classification. Radial-forward remains `appropriate` on the pair where prior evidence most needed `poor_fit`. |

## Questions

1. **Did changing only the evaluation objective materially change CM
   judgments?**
   On one pair. A→B moved `not_shootable`/`poor_fit` →
   `needs_review`/`appropriate` and named a misty-gap route. C→D, D→E,
   and E→F kept the same shootability (and Camotion) labels.

2. **Does Experiment 02 better distinguish perceptual camera
   displacement from scene transformation?**
   Somewhat. A→B now treats path, scale drop, and passing trunks as
   displacement while separately flagging chasm morph. C→D is explicit
   that identical station + object swap is not travel. E→F still reads
   a portal motif as displacement.

3. **Does it identify replacement/morph risk where endpoints otherwise
   look compatible?**
   Yes for C→D (compatible tunnel language, rejected as substitution).
   D→E names crystal→portal morph. A→B names chasm/cliff morph. E→F
   names white-out but still approves.

4. **Does it avoid treating a semantically obvious portal/threshold as
   sufficient evidence of generative traversability?**
   No. The prompt said a portal is not sufficient. E→F remains
   `shootable` because of the vertical opening and its light.

5. **Does it better recognize transition-cover opportunities?**
   Yes on A→B: mist, tree-gap, framing roots — Experiment 01 said no
   connecting threshold. E→F uses portal light as cover, which is
   recognition without the required skepticism.

6. **Is Experiment 02 more predictive of actual Seedance behavior than
   Experiment 01?**
   Slightly, and only on A→B (moved toward the observed strong walk
   without matching it). C→D is equally predictive. D→E still rejects a
   clip that worked. E→F still approves a clip that warped. Not enough
   to replace Experiment 01 as a planner input.

7. **What useful Experiment 01 signal would be lost if CM focused only
   on generative traversal?**
   Experiment 01’s hard veto that B cannot exist on A’s forward vector.
   That veto was the source of the A→B inversion; dropping it is the
   useful change. The still-to-still facts both runs share (missing
   chasm, identical C/D station, crystal as occluder, D/E material
   jump) are not unique to physical-set mode. Experiment 01 did not
   uniquely catch E→F.

8. **Should physical-set plausibility and generative-traversal
   potential remain separate concepts?**
   Yes. These four pairs show two axes, not one score:

   - **Physical / spatial plausibility:** can the stills be understood
     as connected sets? Experiment 01 said no for A→B; video still
     traveled. Experiment 01/02 both said no for D→E (crystal blocks);
     video invented a mid-shot opening that is in neither still.
   - **Generative traversal potential:** can the video model make
     travel read? A→B: high in video, medium in Experiment 02, none in
     Experiment 01. C→D: low in all three. E→F: high in both CM runs,
     low in video — semantic portal ≠ locomotion.

   Collapsing them into one `shootability` value hid that A→B can be
   physically unproven and generatively strong, while E→F can be
   narratively connected and generatively weak.

Do not change the product schema from this report.

## Recommendation

**RETAIN BOTH SIGNALS — DESIGN NEXT EXPERIMENT**

Do not adopt the generative-traversal prompt as the production
objective: E→F is still inverted, and D→E still misses a working
threshold clip. Do not keep Experiment 01’s physical-proof objective
alone: it vetoed the strongest Forest walk. Next work should keep
physical-set plausibility and generative-traversal potential as
separate recorded judgments, and test whether an explicit portal/void
discontinuity check can move E→F without retuning on that pair.
