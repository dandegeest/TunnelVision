# Drop outgoing frame 0 — TheLongWayDown

Offline editorial test. Kling 0. Camotion 0. Production unchanged. Prior experiments and project takes not modified.

## Verdict

**Outgoing frame 0 is a redundant conditioned-start hold at B, C, and D.** Incoming last ↔ outgoing-0 is SSIM 0.92–0.96 / MAE 2.0–3.3. Movement begins on outgoing-1 (MAE 11–17), the same size as that take’s own first step.

Dropping only that frame keeps Kling’s terminal snap and removes the 1-frame pause. It does **not** create the smart-prelock `Ce* | Cs` scale pop. Plastic at C is unchanged geometrically; the sheet just starts traveling one frame sooner.

At normal speed the drop-0 movie is **slightly more continuous** than the original concat. The rule generalizes across B/C/D.

Do not implement in the app from this one journey. The editorial rule is supported:

```
first traversal: keep all frames
every later traversal: drop decoded frame 0
flat-concat
```

## Construction

Sources (original Camotion takes, 1928×1072, 24 fps, 242 decoded frames):

- `projects/TheLongWayDown/traversals/A-B/take-01.mp4`
- `…/B-C/take-01.mp4`
- `…/C-D/take-01.mp4`
- `…/D-E/take-01.mp4`

| movie | recipe | decoded frames |
|---|---|---|
| control | A-B + B-C + C-D + D-E, all frames | **968** (242×4) |
| drop-0 | A-B full + B-C/C-D/D-E from frame 1 | **965** (242+241×3) |

Incoming legs are complete. Exactly one decoded frame removed from each subsequent take. Verified by OpenCV decode counts.

Experimental seams:

- B: A-B last (241) | B-C frame 1
- C: B-C last (241) | C-D frame 1
- D: C-D last (241) | D-E frame 1

## Metrics

| seam | last ↔ out0 | last ↔ out1 | out0 ↔ out1 | out1 ↔ out2 |
|---|---|---|---|---|
| **B** | SSIM **0.957** MAE **2.02** | 0.669 / 11.3 | 0.667 / 11.5 | 0.669 / 12.3 |
| **C** | SSIM **0.917** MAE **3.33** | 0.499 / 17.7 | 0.515 / 17.2 | 0.512 / 17.8 |
| **D** | SSIM **0.952** MAE **2.47** | 0.592 / 17.3 | 0.588 / 17.4 | 0.578 / 19.2 |

Touching-frame SSIM gets worse if you drop frame 0. That is the hold disappearing, not a new spatial fault. last↔out1 ≈ out0↔out1: the experiment cut is the outgoing take’s own first step, one frame earlier.

## Answers

1. **Takes:** the four `take-01.mp4` files above.

2. **New generations?** **Zero.**

3. **Incoming untouched?** **Yes.** A-B is complete. B-C and C-D keep their literal last frames as incoming sides of C and D.

4. **One frame dropped?** **Yes.** 242→241 on B-C, C-D, D-E. Totals 968 vs 965.

5. **Control seam (last ↔ out0):** B 0.957 / 2.02; C 0.917 / 3.33; D 0.952 / 2.47.

6. **Experiment seam (last ↔ out1):** B 0.669 / 11.3; C 0.499 / 17.7; D 0.592 / 17.3.

7. **Motion out0 ↔ out1:** B 11.5; C 17.2; D 17.4. That is real travel, not noise.

8. **Is frame 0 a hold?** **Yes.** Near-duplicate of the incoming lock, then motion starts on frame 1. Same pattern at all three seams.

9. **B:** **Better** (cadence). No extra spatial jump.

10. **C:** **Better** (cadence). Same as B/D. Not a new architecture.

11. **D:** **Better** (cadence). No extra spatial jump.

12. **Plastic at C?** **Unchanged as geometry.** last ≈ out0, so you do not get the smart-prelock scale pop. The sheet then moves as C-D always did, just without the 1-frame freeze.

13. **Full movie vs original?** **Yes, slightly more continuous.** Three holds removed. Incoming snaps kept. Watch `control-vs-drop0.mp4` then the per-seam compares.

14. **Vs smart-prelock?** **Yes, better.** Smart-prelock cut 3 frames early and hit Ce*|Cs (SSIM 0.47). This keeps the lock and only deletes the redundant start.

15. **Simple rule supported?** **Yes, as an editor for this Camotion+Kling pattern.** First clip complete. Later clips drop decoded frame 0. Flat concat. Do not write it into production from this project alone.

## Clips

- `generated/original-control.mp4`
- `generated/drop-frame-zero.mp4`
- `generated/control-vs-drop0.mp4` (sequential, normal speed)
- `generated/clips/compare-{B,C,D}-original-vs-drop0.mp4`

## Disk

**363 MB** (full movies + legs + compares). No source or prior experiment files were modified.
