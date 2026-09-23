# Cross-project drop-0 validation

Read-only. Zero generations. Zero project or app changes.
One universal rule under test: keep the first traversal intact; drop decoded frame 0 of every subsequent traversal; flat-concat.

**Verdict:** drop-0 is frequently useful but conditional. It is not TheLongWayDown-specific, and it is not a universal structural property of the current traversal pipeline. The evidence does **not** justify implementing a blanket production rule. It does justify a later *gated* production experiment, scoped to strong Camotion locks (today: Kling 2.5 Turbo Pro), not a flat concat change.

---

## Direct answers

1. **Discovered:** 50 projects on disk.
2. **Eligible:** 48 (223 eligible seams). Two had no takes (`GrammarTest-PreflightSave`, `GrammarTest-POVCanyonRun`).
3. **Selected 10 / 37 seams** (3 control + 34 new). See sample below. Not alphabetical; diversity-first. Long journeys (`MarbleMountain`, balloon parades) were excluded so they would not consume the 40-seam cap.
4. **NEW seams analyzed:** 34 (under the 40-seam cap).
5. **TheLongWayDown reproduced.** B/C/D last↔out0 = SSIM 0.957 / 0.917 / 0.952 and MAE 2.02 / 3.33 / 2.47. Motion ratios 0.990 / 1.028 / 0.994. Same numbers as the prior drop-0 experiment. Control only; not independent evidence.
6. **NEW L↔O0:** median SSIM **0.789**, MAE **10.6** (p10 0.631 / 3.79, p90 0.922 / 16.7, min 0.566 / 18.7). Much weaker than the control median 0.952 / 2.47.
7. **O0 redundant?** Screening signature (close + moving + comparable ratio) on **11 / 34 = 32%** of new seams. Almost all of those are Kling tight-lock. Pruna: 3 / 25.
8. **L→O1 vs O0→O1:** new median L→O1 MAE 26.9 vs native O0→O1 MAE 23.5.
9. **motion_ratio distribution (new):** median **1.11**, p10 **1.00**, p90 **1.27**, min **0.96**, max **1.87**. Control median 0.994.
10. **Strong support:** 11 new seams (screening).
11. **Ambiguous:** 14 new seams.
12. **Clear counterexamples:** 9 new seams.
13. **Grammar:** FOLLOW 4/6 support (but 3 of those are Kling Whiteout). LEAD 0/3 support, 2/3 counter. MOUNTED 1/3 support. POV 6/22 support, 7/22 counter. Tiny LEAD/MOUNTED n; do not overclaim.
14. **Fast vs slow:** fast POV (Redline) is typical Pruna — ratio ~1.13–1.18, no catastrophic jump, but O0 is not a hold. Slow/low-native-step seams are more dangerous: a small O0→O1 makes any L≠O0 into a large ratio (Gardens D-E|E-F = 1.87, FirstTracks A-B|B-C = 1.60).
15. **Persistent subjects:** more sensitive when the lock is loose. Kling FOLLOW (Whiteout) is the strongest success — rider pose is locked. Pruna FOLLOW/LEAD trains show position/scale mismatch at O0; LEAD is the worst grammar in this sample. FirstTracks skier pole/arm changes across L→O1.
16. **Strongest success:** Whiteout `B-C|C-D` — L↔O0 SSIM 0.960 / MAE 2.47 / ratio 1.003. Kling FOLLOW snowboarder.
17. **Strongest failure:** Gardens `D-E|E-F` — ratio 1.87; O0 introduces a coral cluster absent from L. Runner-up: NightTrainLEAD `C-D|D-E` L↔O0 0.566 / 18.7.
18. **Normal-speed representative clips:** 2 new BETTER, 2 INDISTINGUISHABLE, 2 WORSE, plus control BETTER. See Phase 4.
19. **Classification:** frequently useful but **conditional** on a tight incoming-last ≈ outgoing-0 lock. Not LongWayDown-only. Not a structural property of every current take.
20. **Production experiment?** A *universal* drop-0 concat rule is not justified. A later gated experiment (apply drop-0 only when L≈O0 / Kling-class lock) is justified. Do not implement now.

---

## Most important question

Does

> first traversal: keep every frame  
> every subsequent traversal: drop decoded frame 0  
> flat concat

continue to improve perceived continuous motion across diverse existing projects **without** a worse visual jump?

**No, not as a universal rule.**

It improves the cut when incoming-last and outgoing-0 are already the same conditioned boundary state (TheLongWayDown, Whiteout, most PaperChase Kling seams). It creates a worse jump when O0 is not redundant — new scene content (Gardens coral), weak endpoint lock (LEAD, Backstage, two FirstTracks seams), or a small native first step that amplifies any L≠O0 (Gardens D-E, FirstTracks A-B).

Do not rescue this with trim, crossfade, inheritance, or per-project frame counts. Those are different hypotheses.

---

## Phase 1 — inventory and sample

`projects/` was inspected via `project.json` (name, `settings.cameraGrammar`, destinations, traversal order, `selectedTakeId` / take asset, model, `videoInputs.startShootingFrame` / `endShootingFrame`). Directory names were not used as the source of truth.

| | count |
|---|---|
| Projects on disk | 50 |
| Eligible (takes present, ordered Camotion-conditioned legs) | 48 |
| Eligible seams in corpus | 223 |
| This pass | **10 projects / 37 seams** |

Excluded from eligibility: missing takes. Not used as validation even if present: endpoint-inheritance experiment outputs, FPS test, grammar-template suite. Long 22–24 seam journeys were eligible but not selected so they would not dominate the cap.

### Selected projects

| Project | Role | Grammar | Model | Env | Why |
|---|---|---|---|---|---|
| TheLongWayDown | **known control** | POV | Kling 2.5 | indoor urban | Prior positive result. 3 seams. |
| FirstTracksTheDescent2 | new | POV | Pruna | outdoor alpine | Skier; original Camotion continuity already felt strong. 4 seams. |
| Whiteout | new | FOLLOW | Kling 2.5 | outdoor forest | Persistent snowboarder. 3 seams. |
| NightTrainFOLLOW | new | FOLLOW | Pruna | outdoor night | High-speed persistent locomotive. 3 seams. |
| NightTrainLEAD | new | LEAD | Pruna | outdoor night | LEAD counterpart. 3 seams. |
| NightTrainMOUNTED | new | MOUNTED | Pruna | outdoor night | MOUNTED counterpart. 3 seams. |
| PaperChase | new | POV | Kling 2.5 | indoor stylized | Non-photoreal; selected take 2 (not filename take-01). 6 seams. |
| Backstage | new | POV | Pruna | indoor theater | Foreground-heavy sprint. 3 seams. |
| GardensoftheCurrent | new | POV | Pruna | underwater | Slower fluid motion. 5 seams. |
| Redline | new | POV | Pruna | outdoor track | Fast F1 cockpit. 4 seams. |

All selected legs record Camotion start+end shooting frames. Traversal order is `from`/`to` destination chaining.

---

## Phase 2 — control sanity

TheLongWayDown only. Same takes as the prior experiment.

| Seam | L↔O0 SSIM / MAE | L↔O1 MAE | O0↔O1 MAE | ratio |
|---|---|---|---|---|
| A-B\|B-C | 0.957 / 2.02 | 11.3 | 11.5 | 0.990 |
| B-C\|C-D | 0.917 / 3.33 | 17.7 | 17.2 | 1.028 |
| C-D\|D-E | 0.952 / 2.47 | 17.3 | 17.4 | 0.994 |

Reproduced. Screening would label all three **support**. Not counted below.

---

## Phase 3 — new-seam distribution

n = 34. Motion = MAE. `motion_ratio = MAE(L→O1) / MAE(O0→O1)`.

| metric | median | p10 | p90 | min | max |
|---|---|---|---|---|---|
| L↔O0 SSIM | **0.789** | 0.631 | 0.922 | 0.566 | 0.960 |
| L↔O0 MAE | **10.6** | 3.79 | 16.7 | 2.47 | 18.7 |
| L↔O1 SSIM | 0.514 | 0.386 | 0.613 | 0.329 | 0.762 |
| L↔O1 MAE | 26.9 | 17.3 | 34.8 | 10.8 | 43.4 |
| O0↔O1 MAE | 23.5 | 14.0 | 32.7 | 6.62 | 39.8 |
| motion_ratio | **1.11** | 1.00 | 1.27 | 0.961 | 1.87 |

Incoming-last and outgoing-0 are *often similar*, not *usually nearly identical*. The LongWayDown-class lock (SSIM ≥ 0.90, MAE ≤ 4) appears on 4 / 34 new seams, all Kling (Whiteout B-C and C-D; PaperChase A-B and E-F).

### Screening labels (not production thresholds)

Written in `screening.json`. Bands chosen to describe the LongWayDown signature, not to maximize pass rate.

- **A close:** L↔O0 SSIM ≥ 0.85 and MAE ≤ 8, **or** SSIM ≥ 0.80 and MAE < 0.45 × O0↔O1
- **B moving:** O0↔O1 MAE ≥ 8
- **C comparable:** ratio in [0.85, 1.20]
- **support** = A ∧ B ∧ C
- **counter** = ratio ≥ 1.40, **or** (SSIM < 0.70 and MAE > 12)
- else **ambiguous**

| | n | % of 34 |
|---|---|---|
| support | 11 | 32% |
| ambiguous | 14 | 41% |
| counter | 9 | 26% |

### By model (new seams only)

| | n | L↔O0 SSIM / MAE median | ratio median | support / ambig / counter |
|---|---|---|---|---|
| Kling 2.5 Turbo Pro | 9 | **0.892 / 4.58** | **1.01** | 8 / 0 / 1 |
| Pruna p-video | 25 | 0.779 / 12.0 | 1.13 | 3 / 14 / 8 |

Do not mix these. Kling locks the conditioned boundary tightly; Pruna usually does not. The one Kling counter is PaperChase `D-E|E-F` (SSIM 0.631 / MAE 12.2) — even Kling is not guaranteed.

Projects are also age-split: NightTrain / Backstage are 2026-09-18 Pruna; PaperChase 2026-09-19 Kling; Gardens / Redline 2026-09-21 Pruna; Whiteout / FirstTracks / TheLongWayDown 2026-09-22. The split that matters is **model/lock tightness**, not calendar day.

### By camera grammar (new seams)

| grammar | n | L↔O0 SSIM / MAE med | ratio med | support / ambig / counter |
|---|---|---|---|---|
| FOLLOW | 6 | 0.858 / 6.57 | 1.03 | 4 / 2 / 0 |
| POV | 22 | 0.787 / 11.1 | 1.10 | 6 / 9 / 7 |
| MOUNTED | 3 | 0.803 / 9.98 | 1.15 | 1 / 2 / 0 |
| LEAD | 3 | 0.586 / 17.5 | 1.25 | 0 / 1 / 2 |

FOLLOW looks best because Whiteout (Kling) is in the cell. NightTrainFOLLOW (Pruna) is 1 support + 2 ambiguous — the train is already a different size/place at O0. LEAD is the grammar most likely to make drop-0 bad: looking at a persistent subject whose endpoint lock is loose.

---

## Failures (do not sand these away)

| Seam | Why drop-0 is bad |
|---|---|
| Gardens D-E\|E-F | **Strongest failure.** L is an empty coral window; O0 already contains the purple cluster. O0 is new content, not a hold. Native O0→O1 is tiny (MAE 6.6); L→O1 is 12.4; ratio **1.87**. |
| NightTrainLEAD C-D\|D-E | L↔O0 0.566 / 18.7. Train/track geometry disagrees. O0 is required launch. |
| NightTrainLEAD B-C\|C-D | Same pattern. SSIM 0.586 / MAE 17.5, ratio 1.27. |
| Backstage B-C\|C-D | Foreground theater geometry. L↔O0 0.606 / 18.3. |
| Backstage A-B\|B-C | Ratio **1.52**. O0 is a useful intermediate, not a duplicate of L. |
| FirstTracks A-B\|B-C | Skier pole/arm pose changes. Native first step is small (6.7); ratio **1.60**. |
| FirstTracks C-D\|D-E and D-E\|E-F | Weak lock (0.690 / 16.7 and 0.660 / 13.8). Landscape/skier disagree. |
| PaperChase D-E\|E-F | Only Kling counter. Hallway/paper lock fails (0.631 / 12.2). |

Pattern: drop-0 is bad when **O0 is not a copy of L**. That happens when the generator does not snap the outgoing start to the incoming terminal, or when the first outgoing frame carries object birth / pose launch.

---

## Phase 4 — representative clips

Seven side-by-side 24 fps clips in `clips/`. Last 1 s of incoming + first 1.5 s outgoing. Left = CONTROL (`L | O0…`). Right = DROP-0 (`L | O1…`). No full-project movies.

Classification is from the side-by-side cut (still sheets + frame-accurate strip around the splice). Metrics do not override visible motion.

| # | Clip | Screening | Playback |
|---|---|---|---|
| 1 | Whiteout B-C\|C-D (FOLLOW, Kling) | support | **DROP-0 BETTER** — rider/board/trees already match at L and O0; control holds one frame; drop-0 starts the native downhill step. Strongest new success. |
| 2 | PaperChase A-B\|B-C (stylized POV, Kling) | support | **DROP-0 BETTER** — hallway locked; papers are the motion. Control pauses; drop-0 continues the flutter at native step (ratio 1.002). |
| 3 | Redline A-B\|B-C (fast POV, Pruna) | ambiguous | **INDISTINGUISHABLE** — cars already jump L→O0 (SSIM 0.79). Drop-0 is a slightly larger first step (ratio 1.13) buried in F1 motion. No hold to remove. |
| 4 | NightTrainFOLLOW B-C\|C-D (Pruna) | ambiguous | **INDISTINGUISHABLE** — train continues either way; O0 is not a duplicate (0.756 / 12.4). Persistent subject makes a one-frame skip noticeable in stills, not clearly worse at speed. |
| 5 | Gardens D-E\|E-F (slow POV, Pruna) | counter | **DROP-0 WORSE** — coral cluster is born on O0. Drop-0 jumps L (empty hole) → O1 (filled hole + extra drift). Strongest failure. |
| 6 | TheLongWayDown B-C\|C-D (control) | support | **DROP-0 BETTER** — reproduces the known one-frame hold removal. Plastic mismatch remains on both sides. |
| 7 | FirstTracks A-B\|B-C (skier POV, Pruna) | counter | **DROP-0 WORSE** — pole/arm pose on O1 is not the incoming terminal. Native first step is small, so skipping O0 is a pose hitch, not a redundant hold. |

Skier included as #7 because FirstTracks was not represented in 1–6.

---

## Interpretation

The LongWayDown signature is:

1. incoming last ≈ outgoing 0 (conditioned boundary duplicated)
2. first real motion is O0→O1
3. L→O1 ≈ O0→O1

That is a **lock-quality** property, not a **concat** property. Kling 2.5 Turbo Pro with Camotion start+end currently produces it often (8/9 new Kling seams). Pruna p-video usually does not (3/25).

A blanket “always drop outgoing frame 0” rule would help the Kling-like third of this sample, do little on the ambiguous middle, and visibly hurt about a quarter of seams — including slow scenes and LEAD/subject-launch cases.

That is enough to **falsify the universal rule** and enough to **motivate a later gated experiment** (measure L↔O0, drop 0 only when the lock is already tight). Measuring-then-dropping is a different rule than the one tested here.

**No production change. No per-project tuning. No extra processing.**

---

## Artifacts

| path | what |
|---|---|
| `selected-projects.json` | inventory + sample rationale |
| `analyze.py` | measure + compare-clip renderer |
| `seams.csv` | 37-seam metrics |
| `aggregate.json` | control / new / grammar / model summaries |
| `screening.json` | labeled support / ambiguous / counter |
| `clips/*.mp4` | 7 representative A/B clips (~41 MB) |
| `diagnostics/*.png` | L \| O0 \| O1 contact sheets only |

Experiment folder **48 MB**. Sources are referenced in place under `projects/`; takes were not copied.
