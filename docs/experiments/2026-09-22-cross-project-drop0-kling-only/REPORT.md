# Cross-project drop-0 validation — Kling only

Read-only. Zero generations. Zero project or app changes.
Previous mixed-model pass is untouched:
`docs/experiments/2026-09-22-cross-project-drop0-validation/`.

This pass uses **selected takes whose model is Kling**. Pruna `p-video` is treated as draft mode and excluded, even when a project's settings still list `videoModel: pruna-p-video`.

Rule under test: keep the first traversal intact; drop decoded frame 0 of every subsequent traversal; flat-concat.

**Verdict:** On Kling 2.5 Turbo Pro, drop-0 looks like a **structural property of the current Camotion lock**, not a TheLongWayDown accident. Median new L↔O0 is SSIM **0.916** / MAE **3.53**, median motion_ratio **1.02**. Screening support is **22 / 32 (69%)** of new seams, **22 / 30 (73%)** if Kling v3 is set aside.

It is still not a perfect universal rule. Three new counters remain: one 2.5 lock miss (PaperChase `D-E|E-F`), one 2.5 subject-teleport plus outgoing freeze (NoMan'sLand `D-E|E-F`, ratio 7.03), and both Kling v3 seams (weaker lock).

A later **Kling 2.5 / strong-lock** production experiment is justified. Do not implement a blanket concat change. Do not mix Pruna draft takes into that experiment.

---

## Direct answers

1. **Discovered:** 50 project directories.
2. **Eligible Kling-only authored journeys:** 16 projects / 101 seams (25 directories were Kling-only; 8 of those are templates/tests). 20 projects were Pruna-only. 3 were mixed Kling+Pruna and excluded.
3. **Selected 10 / 35 seams** (3 control + **32 new**). See sample below.
4. **NEW seams analyzed:** 32. All selected incoming and outgoing takes are Kling (`analyze.py` refuses anything else).
5. **TheLongWayDown reproduced:** 0.957/2.02, 0.917/3.33, 0.952/2.47. Ratios 0.990 / 1.028 / 0.994.
6. **NEW L↔O0:** median SSIM **0.916**, MAE **3.53** (p10 0.812 / 1.67, p90 0.960 / 7.17). This is the LongWayDown-class lock. The mixed-model pass was 0.789 / 10.6 because Pruna dominated it.
7. **O0 redundant?** Screening signature on **22 / 32 = 69%**. Kling 2.5 alone: **22 / 30 = 73%**. Kling v3: 0 / 2.
8. **L→O1 vs O0→O1:** new median L→O1 MAE 15.9 vs native O0→O1 MAE 16.1.
9. **motion_ratio (new):** median **1.02**, p10 **0.96**, p90 **1.17**, min **0.65**, max **7.03**. The max is a near-zero-denominator freeze, not a typical jump.
10. **Strong support:** 22 new seams.
11. **Ambiguous:** 7 (several are tight locks with small native motion that fail the O0→O1 MAE≥8 moving band).
12. **Clear counters:** 3 (PaperChase `D-E`, NoMan'sLand `D-E`, FadedGenes `B-C`).
13. **Grammar:** FOLLOW 8/9 support (the 9th is MatchMakerFOLLOW `C-D`, SSIM 0.972, native step only 6.2 — lock is real, motion is tiny). POV 12/18 support, 3 counter. No authored Kling LEAD/MOUNTED journeys exist outside the template suite; those templates were not used.
14. **Fast vs slow:** Kling FOLLOW train (fast) and MatchMaker match-on-water (slow) both lock. The dangerous slow case is a **near-frozen outgoing start** (NoMan'sLand `D-E`, O0↔O1 MAE 0.73): ratio explodes even when the spatial jump already exists in control.
15. **Persistent subjects:** Kling FOLLOW is the *strongest* cell, opposite of the Pruna FOLLOW/LEAD result. When the lock slips on a visible person (NoMan'sLand soldier/tank), drop-0 does not repair the teleport.
16. **Strongest success:** MatchMakerFOLLOW `C-D|D-E` — L↔O0 0.972 / 1.30 / ratio 1.01. Whiteout `B-C|C-D` (0.960 / 2.47 / 1.003) is the strongest moving success.
17. **Strongest failure:** NoMan'sLand `D-E|E-F` — soldier/tank already remapped at O0; O0≈O1 (MAE 0.73); ratio **7.03**. Model-specific runner-up: FadedGenes `B-C|C-D` (Kling v3, 0.744 / 9.3 / 2.55).
18. **Clips:** 4 BETTER, 1 INDISTINGUISHABLE/worse lock-miss, 2 WORSE. See Phase 4.
19. **Classification:** for **Kling 2.5 Turbo Pro**, drop-0 is a structural property of the current traversal lock. It is not LongWayDown-specific. It is **not** a property of Kling v3 in this sample, and not of Pruna draft mode.
20. **Production experiment?** Justified if scoped to Kling 2.5 / measured-tight locks. Not justified as a universal rule across every provider. **Do not implement now.**

---

## Most important question

Does

> first traversal: keep every frame  
> every subsequent traversal: drop decoded frame 0  
> flat concat

improve perceived continuous motion across **Kling** journeys without a worse visual jump?

**Usually yes, on Kling 2.5.** Incoming-last and outgoing-0 are typically the same conditioned boundary. Dropping O0 removes a one-frame hold and the first real step is the outgoing clip's own O0→O1.

**No, not always.** It fails when that lock misses (PaperChase papers), when a persistent subject is already in a new place at O0 (NoMan'sLand), and on the only Kling v3 project in the sample (FadedGenes).

Do not rescue those with trim, crossfade, or per-project frame counts.

---

## Phase 1 — Kling inventory

Selected-take model, not `project.json` `videoModel`. Many Kling journeys still have draft `videoModel: pruna-p-video` in settings.

| | count |
|---|---|
| Projects on disk | 50 |
| Kling-only (all selected takes Kling) | 25 |
| Pruna-only | 20 |
| Mixed Kling+Pruna | 3 |
| Authored Kling-only with ≥1 seam (no templates/tests) | 16 / 101 seams |
| This pass | **10 projects / 35 seams** |

Excluded: all Pruna; mixed takes; templates; FPSTEST; balloon parades (22–24 seams); MidnightDescent (11 seams, would overweight one POV); pull-forward MidnightMiniature variant.

No authored Kling LEAD or MOUNTED journeys were on disk.

### Selected projects

| Project | Role | Grammar | Kling | Why |
|---|---|---|---|---|
| TheLongWayDown | control | POV | 2.5 | Known positive. Indoor descent. 3 seams. |
| Whiteout | new | FOLLOW | 2.5 | Snowboarder, outdoor forest. 3 |
| PaperChase | new | POV | 2.5 | Stylized indoor/city. 6 |
| NightTrainFOLLOW_2 | new | FOLLOW | 2.5 | Kling counterpart to the earlier Pruna train. 3 |
| MatchMakerFOLLOW | new | FOLLOW | 2.5 | Persistent match, night water. 3 |
| MatchMaker | new | POV | 2.5 | Indoor dark hallway counterpart. 3 |
| FadedGenes | new | POV | **v3** | Only authored v3 journey. 2 |
| NoMan'sLand | new | POV | 2.5 | Trench/battlefield, people. 4 |
| MidnightMiniature | new | POV | 2.5 | Night mini-golf, slower. 3 |
| WhiteWhale | new | unspecified | 2.5 | Underwater open water. 5 |

---

## Phase 2 — control

Same TheLongWayDown numbers as before. Screening: 3/3 support. Not independent evidence.

---

## Phase 3 — new Kling seams (n=32)

| metric | median | p10 | p90 | min | max |
|---|---|---|---|---|---|
| L↔O0 SSIM | **0.916** | 0.812 | 0.960 | 0.631 | 0.972 |
| L↔O0 MAE | **3.53** | 1.67 | 7.17 | 1.30 | 12.2 |
| L↔O1 MAE | 15.9 | 7.47 | 28.4 | 5.11 | 36.3 |
| O0↔O1 MAE | 16.1 | 7.10 | 29.1 | 0.73 | 36.2 |
| motion_ratio | **1.02** | 0.96 | 1.17 | 0.65 | 7.03 |

Compared with the mixed pass (34 new, mostly Pruna): SSIM 0.789 → 0.916, MAE 10.6 → 3.53, ratio 1.11 → 1.02.

### Screening (same bands as the mixed pass; not production thresholds)

| | new n | % |
|---|---|---|
| support | 22 | 69% |
| ambiguous | 7 | 22% |
| counter | 3 | 9% |

Kling **2.5** only (n=30): 22 / 6 / 2.  
Kling **v3** (n=2): 0 / 1 / 1. Do not mix.

FOLLOW (n=9): median L↔O0 0.951 / 2.47, median ratio 1.01. 8 support + 1 ambiguous (tiny native step, SSIM 0.972).

### Failures

| Seam | Why drop-0 is bad |
|---|---|
| NoMan'sLand D-E\|E-F | Soldier and tank already remapped at O0 (L soldier left, O0/O1 center). O0↔O1 MAE **0.73** — outgoing freeze. Ratio 7.03 is a near-zero denominator. Control already has the teleport; drop-0 does not create a larger spatial jump, but O0 is not a copy of L. The rule's premise fails. |
| FadedGenes B-C\|C-D | Kling v3. L↔O0 0.744 / 9.3. Native first step small (4.2). Ratio 2.55. Lock is not 2.5-tight. |
| PaperChase D-E\|E-F | Kling 2.5 lock miss. 0.631 / 12.2. Paper layout on O0 is not the incoming last frame. |

Ambiguous notes worth keeping: WhiteWhale `D-E|E-F` ratio **0.65** (drop-0 *smaller* than native); NoMan'sLand `C-D|D-E` ratio 0.76; MatchMakerFOLLOW `C-D` is a successful lock that the moving-band calls ambiguous.

---

## Phase 4 — representative clips

Seven side-by-side 24 fps clips in `clips/`. Left CONTROL `L|O0…`, right DROP-0 `L|O1…`.

| # | Clip | Screening | Playback |
|---|---|---|---|
| 1 | MatchMakerFOLLOW C-D\|D-E | ambiguous* | **DROP-0 BETTER** — match/water/tree already locked; control holds. *Ambiguous only because native O0→O1 MAE is 6.2. |
| 2 | NightTrainFOLLOW_2 A-B\|B-C | support | **DROP-0 BETTER** — train size matches at L and O0, then grows. Kling FOLLOW of the same subject that was borderline on Pruna. |
| 3 | MidnightMiniature A-B\|B-C | support | **DROP-0 BETTER** — cave/ship locked; typical 0.94 / 2.5 / 1.02. |
| 4 | PaperChase D-E\|E-F | counter | **DROP-0 WORSE** — papers are in a different arrangement on O0. O0 is not a hold. |
| 5 | NoMan'sLand D-E\|E-F | counter | **DROP-0 WORSE** as a rule application — soldier/tank already jump at the cut. O0≈O1 so drop-0 does not enlarge the teleport; it also does not remove it. Premise “O0 duplicates L” is false. |
| 6 | TheLongWayDown B-C\|C-D | support | **DROP-0 BETTER** — known control hold removal. |
| 7 | FadedGenes B-C\|C-D (v3) | counter | **DROP-0 WORSE** — weaker v3 lock; crowd/stage already differ at O0; ratio 2.55. |

No skier in the Kling authored set (FirstTracks is Pruna).

---

## Interpretation

The previous mixed-model “frequently useful but conditional” result was mostly **provider-conditional**. Pruna draft takes do not snap incoming-last to outgoing-0. Kling 2.5 Camotion takes usually do.

That is why TheLongWayDown looked magical: it was a typical Kling 2.5 lock, not a one-off.

Remaining conditions even inside Kling:

1. The lock can miss (PaperChase `D-E`).
2. A visible subject can already be in a new place at O0 (NoMan'sLand `D-E`).
3. Kling v3, on this one project, does not lock like 2.5.
4. If outgoing itself is frozen at the start, motion_ratio is not meaningful.

A production experiment should generate **new Kling 2.5** journeys (or gate on measured L↔O0) and A/B the concat rule. It should not flip Pruna draft takes, and it should not assume v3 behaves the same.

**No production change in this pass.**

---

## Artifacts

| path | what |
|---|---|
| `selected-projects.json` | Kling census + sample |
| `analyze.py` | measure + compare renderer; refuses non-Kling |
| `seams.csv` | 35-seam metrics |
| `aggregate.json` | control / new / grammar / model |
| `screening.json` | support / ambiguous / counter |
| `clips/*.mp4` | 7 A/B clips |
| `diagnostics/*.png` | L \| O0 \| O1 sheets |

Experiment folder **77 MB**. Takes referenced in place under `projects/`.
