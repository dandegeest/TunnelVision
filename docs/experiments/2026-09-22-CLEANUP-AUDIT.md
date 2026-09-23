# Cleanup audit (dry run — nothing deleted)

Date: 2026-09-22  
Scope: `docs/experiments/2026-09-22-*` plus `projects/TheLongWayDown/`  
Winning direction: original Camotion A′→B′ / B′→C′ / C′→D′ / D′→E′ + ~3–4 frame pre-lock trim.

**Tier A deleted 2026-09-22 (user approved). Tier B not deleted.**

Exact candidate paths: [`2026-09-22-CLEANUP-AUDIT-delete-candidates.txt`](2026-09-22-CLEANUP-AUDIT-delete-candidates.txt) (471 files).  
Deletion log: [`2026-09-22-CLEANUP-TIER-A-DELETED.json`](2026-09-22-CLEANUP-TIER-A-DELETED.json) (373 files, 1.900 GB listed).

## Disk summary

`du` over-counts hardlinked names if you add folders separately, and under-counts `projects/TheLongWayDown/` because the four original takes are hardlinked into the winning experiment (`nlink=3`). Unlinking those experiment names **reclaims 0 bytes**.

| | size |
|---|---|
| `docs/experiments/` apparent | **2.8 GB** |
| `projects/TheLongWayDown/` `du` | **0.14 GB** (takes share blocks with experiment hardlinks) |
| Project take + export + stills (ls sizes) | **0.26 GB** |
| Unique inodes in audit scope | **~3.09 GB** |
| **Guaranteed KEEP** | **0.97 GB** |
| **Proposed DELETE (A+B)** | **2.12 GB** (471 files / unique inodes) |
| **Tier A executed** | **373 files / 1.900 GB** unique-inode reclaim |
| **Tier B remaining** | **0.22 GB** (smart-prelock intermediates) |
| Scope unique inodes after A | **1.19 GB** (was 3.09 GB) |

Recommended tiers:

| tier | what | reclaim |
|---|---|---|
| **A — superseded only** (recommended first) | all DELETE CANDIDATE except winning-experiment intermediates | **1.90 GB** |
| **B — optional winning intermediates** | smart-prelock `*-scaled.mp4`, unmarked `*-raw.mp4`, `curves/*/samples/` | **0.22 GB** |

## Policy

KEEP: original TheLongWayDown takes, canonicals, shooting frames, app export, project metadata; the complete smart-prelock-trim result (movie, B/C/D compares, selected Be*/Ce*/De*/Ee*, measurements); all reports/scripts/JSON/CSV/plots; one representative seam/compare clip per superseded experiment.

DELETE CANDIDATE: superseded Kling masters, full assembled movies, ffmpeg intermediates, `_tmp`, large frame dumps. Reports already summarize those movies.

Kling masters are **not bit-reproducible** (no stored seed). Deleting a master means you cannot re-watch that exact take.

## Authoritative source — KEEP

| path | size | type | KEEP / DELETE | reason | other copy | regen |
|---|---|---|---|---|---|---|
| `projects/TheLongWayDown/traversals/A-B/take-01.mp4` | 27.6 MB | original take | KEEP | Winning A′→B′ source | hardlink ×3 into smart-prelock `generated/` + `refs/` | irreplaceable (Kling, no seed) |
| `projects/TheLongWayDown/traversals/B-C/take-01.mp4` | 28.6 MB | original take | KEEP | Winning B′→C′ source | same | irreplaceable |
| `projects/TheLongWayDown/traversals/C-D/take-01.mp4` | 29.5 MB | original take | KEEP | Winning C′→D′ source | same | irreplaceable |
| `projects/TheLongWayDown/traversals/D-E/take-01.mp4` | 35.3 MB | original take | KEEP | Winning D′→E′ source | same | irreplaceable |
| `projects/TheLongWayDown/exports/TheLongWayDown_v1.mp4` | 121.0 MB | app export | KEEP | Original untrimmed Camotion movie | unique (experiment untrimmed is a different encode) | irreplaceable |
| `projects/TheLongWayDown/canonicals/{A–E}/take-01.png` | ~9.7 MB | canonical stills | KEEP | Needed to reproduce | small experiment copies exist | expensive (manual / Flux) |
| `projects/TheLongWayDown/shooting-frames/**` | ~10.2 MB | A′–E′ Camotion frames | KEEP | Conditioned endpoints | unique | local Camotion apply if plans kept |
| `project.json` + `traversals/*/traversal.json` | tiny | metadata | KEEP | Do not modify | — | — |

`projects/` is gitignored. That does **not** make these files disposable.

## `2026-09-22-smart-prelock-trim` — winning experiment

Apparent folder: 608 MB. Proposed delete (optional tier B): 222.7 MB.

| path | size | type | KEEP / DELETE | reason | other copy | regen |
|---|---|---|---|---|---|---|
| `generated/experimental_Aprime_Bprime_smart_trim.mp4` | 52.0 MB | winning movie | KEEP | Current result | unique | local concat from takes |
| `generated/original_untrimmed_Aprime_to_Eprime.mp4` | 60.3 MB | untrimmed control | KEEP | Convenient re-encode of original architecture | unique encode; app export is the other movie | local concat |
| `generated/clips/compare-smart-trim-{B,C,D}.mp4` | 0.9+1.1+1.2 MB | seam compare | KEEP | B/C/D seam evidence | unique | local ffmpeg |
| `generated/clips/compare-C-original-smart-hybrid-adaptive.mp4` | 1.6 MB | cross-arch compare | KEEP | Unique C-seam four-way | unique | local ffmpeg if other clips kept |
| `generated/clips/{smart,original}-{B,C,D}.mp4` | ~16 MB | marked seam clips | KEEP | Winning seam stills | unique | local ffmpeg |
| `generated/{A-B,B-C,C-D,D-E}/*.mp4` (unscaled masters) | 0 extra | take copies | KEEP | Hardlinks of project takes | **authoritative copy in `projects/`** | 0 bytes if unlinked |
| `refs/*-take-01.mp4` | 0 extra | take copies | KEEP | Same hardlinks | same | 0 bytes if unlinked |
| `generated/*-to-star.mp4` | 12.0+12.5+12.5+15.0 MB | trimmed winning legs | KEEP | Direct construction of winning movie | unique | local ffmpeg trim |
| `REPORT.md`, scripts, `metrics.json`, `motion.csv`, `motion.png`, `curve.json`, Be*/Ce*/De*/Ee* | small | docs / selected frames | KEEP | Complete experiment record | — | cheap / selected frames cheap from takes |
| `generated/*-scaled.mp4` | 13.8+14.5+14.5+17.5 MB | ffmpeg intermediate | DELETE CANDIDATE | Resolution-normalize leftovers | unique | local ffmpeg seconds |
| `generated/clips/*-raw.mp4` | ~19 MB | unmarked raw seams | DELETE CANDIDATE | Marked + compare kept | unique | local ffmpeg |
| `curves/*/samples/*.png` | ~144 MB | every-12-frame dump | DELETE CANDIDATE | Plots/CSV/selected frames kept | unique | local extract if take kept |

## `2026-09-22-adaptive-endpoint-camotion` — superseded

Apparent: 700 MB. Proposed delete: **600.7 MB**. Keep report + `threeway-{B,C,D}` + `adaptive-{B,C,D}`.

| path | size | type | KEEP / DELETE | reason | other copy | regen |
|---|---|---|---|---|---|---|
| `experimental_A_B_C_D_E_adaptive_full_length_diagnostic.mp4` | 50.8 MB | full movie | DELETE CANDIDATE | Summarized in REPORT.md | unique | 3 Kling + concat |
| `experimental_A_B_C_D_E_adaptive_endpoint_camotion.mp4` | 43.6 MB | full movie | DELETE CANDIDATE | Summarized in REPORT.md | unique | 3 Kling + concat |
| `threeway_full_hybrid_camotion_adaptive.mp4` | 28.0 MB | full three-way | DELETE CANDIDATE | Seam three-ways kept | unique | local ffmpeg |
| `generated/D-E/D-E.mp4` | 33.7 MB | Kling master | DELETE CANDIDATE | Superseded architecture | unique | 1 Kling, not identical |
| `generated/C-D/C-D.mp4` | 29.6 MB | Kling master | DELETE CANDIDATE | Superseded | unique | 1 Kling |
| `generated/B-C/B-C.mp4` | 29.0 MB | Kling master | DELETE CANDIDATE | Superseded | unique | 1 Kling |
| `generated/A-B/A-B.mp4` | 28.8 MB | reused hybrid A-B | DELETE CANDIDATE | Same SHA as hybrid + hybrid-camotion copies | **same hash in two other experiments** | 0 if any copy kept; else 1 Kling |
| `*-to-*-star.mp4` + `*-scaled.mp4` | ~118 MB | trimmed / scaled | DELETE CANDIDATE | Intermediates | unique | local ffmpeg |
| unmarked `*-raw.mp4` + extra hybrid/camotion seam clips | ~30 MB | raw / extra seams | DELETE CANDIDATE | `adaptive-*` + `threeway-*` kept | unique | local ffmpeg |
| `curves/*/samples/` (89 PNGs) | 159.5 MB | frame dump | DELETE CANDIDATE | `motion.csv` / `motion.png` kept | unique | local extract |
| `clips/threeway-{B,C,D}.mp4` | 1.2+1.4+1.6 MB | compare | KEEP | Representative evidence | unique | local |
| `clips/adaptive-{B,C,D}.mp4` | 2.4+2.6+3.0 MB | adaptive seams | KEEP | Representative; C == 50% `seam-100.mp4` | C same SHA as 50% experiment | local |
| REPORT / plans / metrics / scripts | small | docs | KEEP | Historical evidence | — | — |

## `2026-09-22-hybrid-canonical-camotion` — superseded

Apparent: 594 MB. Proposed delete: **520.8 MB**. Keep report + `compare-seam-{B,C,D}`.

| path | size | type | KEEP / DELETE | reason | other copy | regen |
|---|---|---|---|---|---|---|
| `experimental_A_B_C_D_E_hybrid_canonical_camotion.mp4` | 59.7 MB | full movie | DELETE CANDIDATE | Summarized in REPORT.md | unique | 3 Kling + concat |
| `clips/control-full-scaled.mp4` | 54.3 MB | scaled control | DELETE CANDIDATE | Intermediate | unique | local ffmpeg |
| `control_vs_experiment_side_by_side.mp4` | 35.0 MB | full compare | DELETE CANDIDATE | Summarized; seam compares kept | unique | local ffmpeg |
| `generated/{A-B,B-C,C-D,D-E}/*.mp4` masters | 28.8+29.5+31.3+35.5 MB | Kling masters | DELETE CANDIDATE | Superseded; A-B same SHA as hybrid/adaptive | A-B duplicated | 3 unique Kling + 1 shared A-B |
| all `*-scaled.mp4` / `ctrl-*-scaled.mp4` | ~122 MB | intermediates | DELETE CANDIDATE | Several are exact copies of hybrid scaled legs | same SHA across hybrid | local ffmpeg |
| `clips/seam-{B,C,D}.mp4` + control/raw | ~37 MB | extra seams | DELETE CANDIDATE | `compare-seam-*` kept | unique | local ffmpeg |
| approach/tail PNG dumps | ~81 MB | frame dump | DELETE CANDIDATE | Metrics/report kept | unique | local extract |
| `clips/compare-seam-{B,C,D}.mp4` | 2.1+2.4+2.9 MB | compare | KEEP | Representative | unique | local |
| REPORT / plans / metrics | small | docs | KEEP | Historical evidence | — | — |

## `2026-09-22-hybrid-endpoint-inheritance` — superseded

Apparent: 438 MB. Proposed delete: **376.5 MB**. Keep report + `seam-clips/seam-{B,C,D}`.

| path | size | type | KEEP / DELETE | reason | other copy | regen |
|---|---|---|---|---|---|---|
| `experimental_A_B_C_D_E_hybrid_endpoint_inheritance.mp4` | 61.8 MB | full movie | DELETE CANDIDATE | Summarized in REPORT.md | unique | 4 Kling + concat |
| `generated/D-E/D-E.mp4` | 37.9 MB | Kling master | DELETE CANDIDATE | Superseded | unique | 1 Kling |
| `generated/C-D/C-D.mp4` | 31.5 MB | Kling master | DELETE CANDIDATE | Superseded | unique | 1 Kling |
| `generated/B-C/B-C.mp4` | 30.2 MB | Kling master | DELETE CANDIDATE | Superseded | unique | 1 Kling |
| `generated/A-B/A-B.mp4` | 28.8 MB | Kling master | DELETE CANDIDATE | Same SHA as adaptive + hybrid-camotion | 2 other copies (also DELETE) | 1 Kling if all three removed |
| `*-scaled.mp4` | ~62 MB | intermediates | DELETE CANDIDATE | Copied into hybrid-camotion `ctrl-*` | same SHA | local ffmpeg |
| approach/tail PNG dumps | ~125 MB | frame dump | DELETE CANDIDATE | Metrics/report kept | unique | local extract |
| `seam-clips/seam-{B,C,D}.mp4` | 3.4+4.0+4.7 MB | seams | KEEP | Representative | unique | local |
| REPORT / metrics / scripts | small | docs | KEEP | Historical evidence | — | — |

## `2026-09-22-recursive-endpoint-inheritance` — superseded

Apparent: 211 MB. Proposed delete: **179.5 MB**. Keep report + `seam-{B,C,D}-clip.mp4`.

| path | size | type | KEEP / DELETE | reason | other copy | regen |
|---|---|---|---|---|---|---|
| `experimental_A_B_C_D_E_endpoint_inheritance.mp4` | 31.6 MB | full movie | DELETE CANDIDATE | Story failed; summarized in REPORT.md | unique | 4 Kling; not worth it |
| `generated/{A-B,B-C,C-D,D-E}/*.mp4` | 16.3+14.7+12.7+14.7 MB | Kling masters | DELETE CANDIDATE | Superseded | unique | 4 Kling |
| `generated/_tmp/**` | ~47 MB | temp encodes | DELETE CANDIDATE | Leftovers | unique | local ffmpeg |
| frame dumps | ~40 MB | frames | DELETE CANDIDATE | Report kept | unique | local extract |
| `seam-{B,C,D}-clip.mp4` | 6.7+5.1+6.0 MB | seams | KEEP | Representative | unique | local |
| REPORT / metrics | small | docs | KEEP | Historical evidence | — | — |

## `2026-09-22-camotion-50pct-C-test` — superseded strength test

Apparent: 117 MB. Proposed delete: **95.4 MB**. Keep report + `compare-C-100-vs-50.mp4` + `compare-C-100-vs-50-vs-B.mp4` + `seam-50.mp4`.

| path | size | type | KEEP / DELETE | reason | other copy | regen |
|---|---|---|---|---|---|---|
| `generated/C-D/C-D.mp4` | 28.5 MB | 50% Kling master | DELETE CANDIDATE | Unique 50% take; numbers + compare clip kept | unique | **1 Kling**, not identical |
| `clips/seam-100.mp4` | 2.6 MB | 100% C seam | DELETE CANDIDATE | Same SHA as adaptive `adaptive-C.mp4` (KEEP) | **authoritative copy in adaptive clips/** | 0 if adaptive clip kept |
| `*-raw.mp4` | ~6 MB | raw seams | DELETE CANDIDATE | Intermediate | one matches adaptive raw | local ffmpeg |
| `curves/samples/` + `sheets/inspect/` | 58.3 MB | frame dump | DELETE CANDIDATE | CSV/plot/report kept | unique | local extract |
| `clips/seam-50.mp4` | 2.6 MB | 50% seam | KEEP | Representative of unique take | unique | local from master |
| compare clips | 1.8+1.5 MB | compare | KEEP | Strength-test evidence | unique | local |
| REPORT / plans / `Ce_star` / metrics | small | docs | KEEP | Historical evidence | — | — |

## `2026-09-22-zero-camotion-C-baseline` — superseded baseline

Apparent: 104 MB. Proposed delete: **82.7 MB**. Keep report + `compare-C-100-vs-50-vs-0.mp4` + `seam-0.mp4`.

| path | size | type | KEEP / DELETE | reason | other copy | regen |
|---|---|---|---|---|---|---|
| `generated/C-D/C-D.mp4` | 31.1 MB | 0% Kling master | DELETE CANDIDATE | Unique 0% take; numbers + compare kept | unique | **1 Kling**, not identical |
| `clips/seam-0-raw.mp4` | 3.0 MB | raw | DELETE CANDIDATE | Intermediate | unique | local ffmpeg |
| `curves/samples/` + inspect sheets | 48.5 MB | frame dump | DELETE CANDIDATE | CSV/plot/report kept | unique | local extract |
| `clips/seam-0.mp4` | 2.6 MB | 0% seam | KEEP | Representative | unique | local |
| `clips/compare-C-100-vs-50-vs-0.mp4` | 1.5 MB | compare | KEEP | Strength-curve evidence | unique | local |
| REPORT / `ce_star_identity.json` / metrics | small | docs | KEEP | Historical evidence | — | — |

## `2026-09-22-endpoint-inheritance` (FirstTracks) — superseded

Apparent: 109 MB. Proposed delete: **44.0 MB**. Different project; do not touch FirstTracks source takes.

| path | size | type | KEEP / DELETE | reason | other copy | regen |
|---|---|---|---|---|---|---|
| `kling25-720p/C-D.mp4` | 15.7 MB | Kling master | DELETE CANDIDATE | Superseded FirstTracks inherit | unique | 1 Kling |
| `kling25-720p/B-C.mp4` | 12.9 MB | Kling master | DELETE CANDIDATE | Superseded | unique | 1 Kling |
| `experimental_B_C_D_flat_concat.mp4` | 15.4 MB | full movie | DELETE CANDIDATE | Summarized in REPORT.md | unique | local concat |
| `original_seam_clip.mp4` + `experimental_seam_clip.mp4` | 8.8+4.7 MB | seams | KEEP | Representative | unique | local |
| REPORT | small | docs | KEEP | Historical evidence | — | — |

`2026-09-22-endpoint-arrival` is 28 KB of docs only — KEEP.

## Dedup (hashes / hardlinks)

Hardlinks (same inode — deleting extra names frees **0 bytes**):

| inode group | names |
|---|---|
| A-B take | `projects/.../A-B/take-01.mp4` + smart-prelock `generated/A-B/A-B.mp4` + `refs/A-B-take-01.mp4` |
| B-C take | same pattern |
| C-D take | same pattern |
| D-E take | same pattern |

Same-hash separate inodes (deleting extras **does** free space):

| SHA prefix | copies | size each |
|---|---|---|
| hybrid A-B master | hybrid-inherit + hybrid-camotion + adaptive `A-B.mp4` | 28.8 MB × 3 |
| hybrid A-B scaled | 4 scaled copies across hybrid / hybrid-camotion / adaptive | 13.3 MB × 4 |
| hybrid B-C/C-D/D-E scaled | hybrid scaled == hybrid-camotion `ctrl-*-scaled` | 15–18 MB × 2 |
| adaptive C seam | adaptive `adaptive-C.mp4` == 50% `seam-100.mp4` | 2.6 MB × 2 |

Do **not** replace project takes with experiment copies. Authoritative takes stay in `projects/`.

## Proposed deletion by class

471 files, **2.12 GB**:

1. Superseded full movies + side-by-sides — ~0.40 GB  
2. Superseded Kling masters — ~0.45 GB  
3. Scaled / raw / `_tmp` intermediates — ~0.45 GB  
4. Curve samples + tail/approach/inspect PNG dumps — ~0.62 GB  
5. Optional smart-prelock intermediates (tier B) — ~0.22 GB  

## Not on the list

- Production code  
- Project metadata  
- Canonical stills  
- Camotion shooting frames  
- Original TheLongWayDown traversal takes  
- Winning smart-trim movie, B/C/D compares, four-way C compare, selected Be*/Ce*/De*/Ee*, reports  

Wait for explicit approval before deleting. Suggested command after approval: delete only paths listed in `2026-09-22-CLEANUP-AUDIT-delete-candidates.txt`.
