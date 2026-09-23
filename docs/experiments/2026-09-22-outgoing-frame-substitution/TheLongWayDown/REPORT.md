# Outgoing-frame substitution — one frame at C

Offline. Kling 0. Camotion 0. Production unchanged. Prior experiments untouched.

## Verdict

The one-frame idea **does what it claims**: it removes a real 1-frame micro-reset (incoming lock sitting next to an almost-identical Cs) and does **not** reopen the smart-prelock plastic/scale hitch.

At normal speed it is a **small cadence fix**, not a new movie. Plastic is effectively unchanged.

Do not implement this in production. If anything follows, repeat the **same one-frame rule on B and D**. Do not expand to 2+ frames.

## What was built

**Control** (original C boundary):

```
… F239 → F240 → F241(lock) | Cs_rendered → D1 → D2 …
```

**Experiment** (Cs used once):

```
… F239 → F240 → Cs_rendered | D1 → D2 …
```

Sources: `projects/TheLongWayDown/traversals/B-C/take-01.mp4` and `…/C-D/take-01.mp4` (1928×1072, 24 fps, 242 frames). Cs_rendered is the **decoded** C-D frame 0, not the Camotion still. Extracted lock and Cs match the preserved smart-prelock stills exactly (SSIM 1.0).

Clips are 1 s incoming + 2 s outgoing, same length. Experiment last incoming slot is Cs; outgoing starts at D1.

## Answers

1. **Replaced frame:** B-C decoded **frame 241** (`F241_lock` / `Ce_literal`).

2. **Replacement:** C-D decoded **frame 0** (`Cs_rendered`). SHA `09e18fbc…`.

3. **Cs once?** **Yes.** Count in the experiment clip is 1. Outgoing begins at frame 1.

4. **Metrics**

| pair | SSIM | MAE | PSNR | hist-corr |
|---|---|---|---|---|
| F239 → F240 | 0.567 | 15.6 | 20.4 | 0.993 |
| F240 → lock | 0.538 | 17.3 | 19.8 | 0.989 |
| lock → Cs | **0.917** | **3.33** | 33.9 | 0.999 |
| F240 → Cs | **0.540** | 17.4 | 19.8 | 0.986 |
| Cs → D1 | 0.515 | 17.2 | 20.0 | 0.996 |

F240 → Cs is the same size step as F240 → lock. Incoming convergence is preserved.

5. **Micro-reset removed?** **Yes, measurably.** Control pair-MAE at the cut is **3.33** (near-hold). Experiment cut is **17.2**, in line with the surrounding 16–18 traveling frames.

```
control:    16.4  15.6  17.3  |  3.33  17.2  17.8  17.8
experiment: 16.4  15.6  17.4  | 17.2   17.8  17.8  17.8
```

The original boundary is a 1-frame settle: lock, then a nearly duplicate start, then C-D moves. Substitution deletes that settle.

6. **Incoming convergence kept?** **Yes.** The last three incoming frames still snap toward C′. Only the lock still is swapped for Cs, which is already SSIM 0.917 to that lock.

7. **Cadence?** The 42 ms hold disappears. Motion stays live through the cut. No blend, no zoom, no retiming.

8. **Better than original at normal speed?** **Slightly, as cadence.** Not a different seam. You no longer see lock-then-same-picture-then-go. You see lock-approach land on the real C-D start and continue. Easy to miss if you are not looking for the settle. Easy to prefer once you have seen the pair-MAE dip.

9. **Plastic sheet?** **Unchanged.** Lock ≈ Cs, so the landing silhouette is the same. Cs → D1 is the original take’s first step (sheet starts traveling). This is not the Ce* | Cs scale pop.

10. **Next?** **Do not do a 2-frame follow-up.** That would start eating the useful snap. Optional smallest next test: the same one-frame substitution at B and D. Production stays the original hard cut.

## Clips

- `generated/clips/control-C-original.mp4`
- `generated/clips/experiment-C-replace-last-with-Cs.mp4`
- `generated/clips/compare-control-vs-replace.mp4`

Watch the compare at normal speed. The useful difference is the missing 1-frame pause, not geometry.

## Disk

**42 MB** added. No prior experiment or project file was modified.
