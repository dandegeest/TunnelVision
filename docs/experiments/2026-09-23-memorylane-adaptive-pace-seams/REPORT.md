# MemoryLane — Adaptive Pace vs +1 seam continuity

**Date:** 2026-09-23  
**Project:** MemoryLane (`tv-50bd64f2d153a637`)  
**Status:** PRE-HACKATHON SOTA / REGRESSION BASELINE  
**Related:** [HACKATHON.md code freeze](../../HACKATHON.md#pre-hackathon-filmmaking-code-freeze--23-september-2026), canvas `memorylane-pace-seams`

## Question

Does per-segment Adaptive Pace contribute to **velocity discontinuity** between independently generated traversals, and does locking one journey-level pace improve endpoint compatibility enough for the existing +1 seam gate to finish the handoff?

The strongest visible failure was at **A-B → B-C**.

## Frozen preferred configuration

| Setting | Value |
| --- | --- |
| Camera grammar | POV |
| durationMode | adaptive (Adaptive Durations ON) |
| Adaptive Pace | **OFF** |
| journeyPace | **slow** (CM journey-pace call) |
| Video model | `kling-v2.5-turbo-pro` |
| Intent | balanced |
| Pull Forward | ON |
| +1 seam trimming | ON (SSIM ≥ 0.89 and MAE ≤ 5) |
| Selected family | **Take 4** — Kling / balanced / slow |
| Construction | Agent-directed and Agent-created |

Final playback was visually extremely close to seamless. This configuration is the **pre-hackathon regression baseline**. Do not change the frozen systems listed in HACKATHON.md unless a reproducible P0 regression appears.

## Method

Four take families on the same MemoryLane canonicals (A–E), same story, POV:

| Family | Adaptive Pace | Model | Intent | Motion pace |
| --- | --- | --- | --- | --- |
| T1 | ON | Pruna `prunaai/p-video` | fast | Per-segment CM |
| T2 | ON | Kling 2.5 | balanced | CM: moderate / **fast** / moderate / moderate |
| T3 | OFF · journeyPace=slow | Pruna | fast | All legs restaged slow |
| T4 | OFF · journeyPace=slow | Kling 2.5 | balanced | All legs restaged slow |

Seam metrics compare **Be** (incoming last frame) to **Bs** (outgoing first frame). Gate from `DROP_OUTGOING_START_GATE`:

- DROP outgoing frame 0 if SSIM ≥ 0.89 **and** MAE ≤ 5  
- otherwise HOLD

Measurements: take-N → take-N pairs, 2026-09-23.

## Full seam matrix

### T1 — Adaptive Pruna (0 / 3 DROP)

| Seam | SSIM | MAE | +1 |
| --- | --- | --- | --- |
| A-B→B-C | 0.771 | 14.39 | HOLD |
| B-C→C-D | 0.770 | 8.19 | HOLD |
| C-D→D-E | 0.795 | 7.41 | HOLD |

### T2 — Adaptive Kling (2 / 3 DROP)

| Seam | SSIM | MAE | +1 |
| --- | --- | --- | --- |
| A-B→B-C | 0.869 | 6.33 | **HOLD** |
| B-C→C-D | 0.930 | 2.68 | DROP |
| C-D→D-E | 0.957 | 1.76 | DROP |

Hard seam failed both sides of the gate under moderate→fast.

### T3 — Fixed Pruna (0 / 3 DROP)

| Seam | SSIM | MAE | +1 |
| --- | --- | --- | --- |
| A-B→B-C | 0.778 | 13.17 | HOLD |
| B-C→C-D | 0.817 | 7.32 | HOLD |
| C-D→D-E | 0.780 | 7.98 | HOLD |

### T4 — Fixed Kling ★ selected (3 / 3 DROP)

| Seam | SSIM | MAE | +1 |
| --- | --- | --- | --- |
| A-B→B-C | 0.952 | 2.47 | DROP |
| B-C→C-D | 0.961 | 1.65 | DROP |
| C-D→D-E | 0.960 | 1.67 | DROP |

## Hard-seam controlled comparison (T2 vs T4)

Matched model (Kling / balanced). Only Adaptive Pace ON vs OFF differs.

| | Adaptive Kling (T2) | Fixed slow Kling (T4) |
| --- | --- | --- |
| Incoming A-B pace | moderate | slow |
| Outgoing B-C pace | fast | slow |
| SSIM | 0.869 | 0.952 |
| MAE | 6.33 | 2.47 |
| +1 | HOLD | DROP |

Change: SSIM **+0.082**, MAE **−3.86**, gate HOLD → DROP. Not a marginal threshold crossing.

## Interpretation (evidence, not proven causality)

Working hypothesis:

1. Camotion **pace** is not only aesthetic blur strength. With Kling especially, it appears to influence the temporal / velocity state at traversal endpoints.
2. Independently assigning different paces at a shared canonical can produce incompatible endpoint motion: A→B arrives at B at one apparent velocity while B→C departs at another.
3. Fixed journey pace produces substantially more compatible Be/Bs pairs.
4. Compatible endpoints let the existing +1 detector recognize a duplicated temporal moment and DROP outgoing frame 0.

**Therefore:** the +1 system does **not** create continuity. CM / Camotion / generator establish compatible endpoint state; +1 finishes the temporal handoff.

## Model-specific finding

Do **not** generalize fixed-pace across providers.

| Provider | Adaptive drops | Fixed slow drops | Hard-seam fixed (SSIM / MAE) |
| --- | --- | --- | --- |
| Pruna | 0 / 3 | 0 / 3 | 0.778 / 13.17 |
| Kling | 2 / 3 | 3 / 3 | 0.952 / 2.47 |

Kling appears substantially more responsive to the Camotion / endpoint conditioning in this experiment. Observed model-specific result only.

## Longer-term Camotion research (POST-HACK — do not implement)

Adaptive Pace ON/OFF may be the wrong long-term abstraction. A stronger physical model is a **continuous pace / velocity trajectory**: entry velocity → traversal accel/decel → exit velocity, with

``` text
exitVelocity(A→B) ≈ entryVelocity(B→C)
```

Conceptual Camotion reading: A′ communicates entry velocity; B′ communicates exit velocity; shared canonical B participates in continuous temporal state across independently generated clips.

Tracked in [BACKLOG.md — Continuous Camotion velocity trajectory](../../BACKLOG.md#continuous-camotion-velocity-trajectory-post-hack).

## Artifacts

- Project folder: `projects/MemoryLane`
- Selected export (at freeze): `exports/MemoryLane_v2.mp4` (verify on disk; selected takes are take 4)
- Interactive matrix: Cursor canvas `memorylane-pace-seams`
