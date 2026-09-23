# C→D Camotion 50% strength test

Project: `projects/TheLongWayDown`
Control: `docs/experiments/2026-09-22-adaptive-endpoint-camotion/TheLongWayDown/`
Production: unchanged. Exactly one new Kling generation.

## Question

The adaptive experiment kept incoming motion alive at `Ce*` (last-1s pair-MAE 10.0, min 8.2) but full-strength canonical-derived Camotion launched the C→D traversal too hard. Is that remaining C-seam problem simply excessive application strength?

Nothing else changed: same `Ce*`, same C→D plan geometry, same prompt, same Kling settings, same pristine D.

## How 50% was produced

Not image alpha blending.

Camotion's v1 exposure samples each destination pixel from

```
p - (motion_field[p] * strength * t_i)
```

after converting the normalized radial field to pixels (`camotion/src/camotion/exposure.py`). `CameraMotionPlan.exposure.strength` is therefore the actual warp-path length.

The stored canonical C→D plan already used `strength: 0.04` (moderate pace). The 50% plan is that same JSON with:

- `exposure.strength`: **0.04 → 0.02**
- unchanged: `vanishing_point [0.5, 0.68]`, `forward 1`, destination protect bbox, `samples 16`

That plan was applied to the exact adaptive `Ce*` (frame 210 / 8.75 s) with the existing experiment-local applicator (`apply_camotion.py`: depth from `Ce*`, `--adaptive`, no replan). Result: `Cs′_50`.

Camotion transform vs `Ce*`:

| | 50% | 100% (adaptive control) |
|---|---|---|
| SSIM | **0.798** | 0.693 |
| MAE | **6.79** | 10.00 |
| PSNR | **26.3** | 23.7 |
| HCorr | 0.873 | 0.853 |

The 50% still is a milder radial push toward the shaft. The 100% still is a visibly stronger FOV squeeze / smear.

## Generation

One call only:

- START: `Cs′_50`
- END: pristine canonical D
- PROMPT: existing C→D traversal intent
- MODEL: `kwaivgi/kling-v2.5-turbo-pro`
- duration requested: 8 s (same as adaptive C→D)
- returned: 1932×1072, 24 fps, 10.08 s, 242 frames
- Replicate prediction: `hxcx3j2v4drmw0d0sddvhq1tdr`
- wall: 211 s

Incoming footage is the reused adaptive B→C clip, cut at the same `Ce*`.

## Kinetic C seam

Same pair-MAE windows as the adaptive experiment.

| | incoming last 1 s at `Ce*` | outgoing first 1 s |
|---|---|---|
| **50%** | 10.0 (min 8.2) | **14.7** (min 13.0, max 15.7) |
| **100%** | 10.0 (min 8.2) | **17.1** (min 14.9, max 18.6) |

Outgoing / incoming ratio: **1.48** at 50% vs **1.71** at 100%.

Reference: the adaptive B seam that subjectively felt smoother launched at outgoing pair-MAE **14.1**. 50% C is now in that same outgoing-magnitude band. 100% C was hotter (17.1).

50% does **not** match incoming 10.0. It is closer, not equal. The first outgoing frames still step up (12.99 immediately after the cut, then 14–15).

## Static C seam (`Ce*` ↔ first decoded outgoing frame)

| | 50% `Cs_rendered_50` | 100% `Cs_rendered*` |
|---|---|---|
| SSIM | **0.769** | 0.674 |
| MAE | **7.63** | 10.49 |
| PSNR | **26.0** | 23.6 |
| HCorr | 0.978 | 0.983 |

`Cs′_50` ↔ `Cs_rendered_50` SSIM 0.955 — Kling honored the milder start still.

Visual seam similarity **improved**. Less crop / FOV jump. Shaft opening stays closer to the incoming size. Geometry and heading remain the same: still looking at the floor opening, still about to drop.

## Playback

Primary judgment at normal speed on `generated/clips/compare-C-100-vs-50.mp4` (left 100%, right 50%, cut marked). Also `compare-C-100-vs-50-vs-B.mp4` with the adaptive B seam as the smoother-feeling reference.

- **Launch/lunge is reduced.** 100% still punches into the hole with a radial smear. 50% keeps more of the construction-floor scale and starts the drop instead of lunging into it.
- **Direction is still correct.** Both versions continue toward / into the shaft. 50% does not reverse or wander.
- **The cut is still felt.** Incoming motion at `Ce*` is a moderate walk toward the opening. 50% outgoing is still a faster start than that walk. It is a smaller step-up than 100%, not a continuous pass-through.
- Versus the B reference: 50% C now looks closer to B's launch energy. It does not yet feel as continuous as B, because C→D also changes the travel axis (approach floor opening → descend).

## Destination

D is reached. Mid-clip (~7 s) is already the circular utility tunnel with cables / steam. Literal last frame dest-SSIM vs canonical D: **0.946**. Pose-lock begins ~9.5 s. This test did not re-select an editorial `De*`.

## Answers

1. **Was exactly one new Kling generation performed?** Yes. One `C-D` call. No 25%, no 75%, no other legs.

2. **How was the Camotion transformation scaled to 50%?** `exposure.strength` 0.04 → 0.02 on the stored canonical C→D `startPlan`. That halves pixel displacement along the same radial field. Vanishing point, forward, destination protect, and sample count were not changed. Not alpha blending.

3. **What was incoming motion at `Ce*`?** Last-1s pair-MAE **10.0** (min **8.2**, max 10.9). Same adaptive B→C window as the control.

4. **What is outgoing first-second motion at 50%?** Mean pair-MAE **14.7** (min 13.0, max 15.7).

5. **How does that compare with the previous 100% result?** 100% outgoing was **17.1**. 50% cut the launch excess from +7.1 to +4.7 above incoming, and landed near the adaptive B outgoing magnitude (14.1).

6. **Is the visible launch/lunge reduced?** Yes. Less radial smear, smaller shaft-scale jump, milder first-second acceleration.

7. **Does direction still feel correct?** Yes. Still into the floor opening / descent. No heading flip.

8. **Is visual seam similarity improved or degraded?** Improved. Rendered-seam SSIM 0.674 → **0.769**; MAE 10.49 → **7.63**.

9. **Does the traversal still reach D?** Yes. Utility tunnel + brick arch. Last-frame dest-SSIM 0.946.

10. **At normal playback speed, is 50% C perceptually better than the current adaptive C seam?** Yes. The 100% C cut still reads as a lunge. 50% reads as a milder restart. It is the better C seam of the two. It is not yet a continuous camera through C.

11. **Does this result support adaptive/residual Camotion strength, or should the next experiment instead investigate motion-conditioned end targets such as `C′`?** **Residual strength is supported as the next lever.** Halving strength moved the C launch in the right direction on both kinetics and stills, without losing D. 50% did not finish the job: outgoing is still ~1.5× incoming, and C→D also pitches from floor-approach into a descent. Do not run another arbitrary 25/75 grid. If another generation is warranted, scale strength so the *applied* warp is closer to the surviving incoming pair-MAE (a residual / matched-energy start), then re-judge the same C seam. Investigate motion-conditioned `C′` only if a magnitude-matched launch still feels like a new move because the next beat is a drop.

## Artifacts

- `generated/Ce_star.png` — reused adaptive `Ce*`
- `plans/C-D-startPlan-100pct.json` — stored canonical plan
- `plans/C-D-startPlan-50pct.json` — same plan, strength 0.02
- `plans/scale.json` — how 50% was produced
- `generated/C-D/Cs-prime-50.png` — `Cs′_50`
- `generated/C-D/C-D.mp4` — the one new Kling traversal
- `generated/C-D/Cs_rendered_50.png` — first decoded frame
- `generated/clips/seam-50.mp4` / `seam-100.mp4`
- `generated/clips/compare-C-100-vs-50.mp4`
- `generated/clips/compare-C-100-vs-50-vs-B.mp4`
- `curves/C-D/` — motion.csv / motion.png
- `generated/metrics.json`
- `sheets/` — stills, diffs, cut-frame inspect
