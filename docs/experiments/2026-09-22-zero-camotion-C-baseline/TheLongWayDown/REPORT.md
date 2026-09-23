# Zero-Camotion C→D baseline

Project: `projects/TheLongWayDown`
Controls:
- 100%: `docs/experiments/2026-09-22-adaptive-endpoint-camotion/TheLongWayDown/`
- 50%: `docs/experiments/2026-09-22-camotion-50pct-C-test/TheLongWayDown/`

Production: unchanged. Exactly one new Kling generation.

## Question

Incoming motion at `Ce*` is pair-MAE **10.0** (min 8.2). Full Camotion launches at **17.1**. 50% Camotion launches at **14.7** and is perceptually better, but still a restart.

How much of that outgoing acceleration is Camotion, and how much is Kling starting a new clip from a still?

This run is the missing zero: `Ce*` → D with no start-image transform.

## Start-image identity

`Ce*` was copied from the adaptive B→C editorial endpoint (frame 210 / 8.75 s).

- SHA-256: `cc1e2d86c251843829d5e68bd62c545a3f4f78df63bddc6abfa76573c3eb5154`
- bytes identical to the adaptive artifact
- pixels identical (1932×1072)
- Camotion not applied
- no zero-strength warp

That file was the Kling `startImage`. No reusable seed existed on the 50% or 100% C→D calls; none was added.

## Generation

One call only:

- START: exact `Ce*`
- END: pristine canonical D
- PROMPT: existing C→D traversal intent
- MODEL: `kwaivgi/kling-v2.5-turbo-pro`
- duration requested: 8 s
- returned: 1932×1072, 24 fps, 10.08 s, 242 frames
- Replicate prediction: `7cz3kf2ewhrmt0d0sdmtdhxsc0`
- wall: 236 s

Incoming footage for all three seam clips is the same adaptive B→C cut at 8.75 s.

## Kinetic C seam

Same pair-MAE windows as the 50% and 100% reports.

| Camotion | outgoing first 1 s | min | max | outgoing / incoming |
|---|---|---|---|---|
| **0%** | **13.17** | 10.87 | 14.55 | **1.32** |
| 50% | 14.72 | 12.99 | 15.68 | 1.48 |
| 100% | 17.09 | 14.89 | 18.57 | 1.71 |

Incoming last 1 s at `Ce*`: **10.0** (min 8.2).

This is **Outcome B**. Zero Camotion is still substantially faster than the surviving incoming walk.

Frame-by-frame first 2 s of the 0% clip:

- first step already 11.14
- rises to 14.55 by 0.62 s
- eases back to 10.87 at 1.00 s
- second second sits near 10–13

Kling does not begin at inherited velocity. It remaps the still, then eases into a launch pulse, then settles. There is no hesitation freeze; there is an intrinsic start-up.

## Response curve

Three measured outgoing means:

```
strength 0.00 → 13.17
strength 0.50 → 14.72
strength 1.00 → 17.09
```

Linear fit: `outgoing ≈ 13.03 + 3.92 × strength` (R² **0.986**). Residuals are small. The three points are close to linear **on top of a Kling baseline**, not a line through the origin.

Decomposition:

- Kling baseline (0%): **+3.2** above incoming 10.0
- Camotion 50% adds **+1.56** on top of that baseline
- Camotion 100% adds **+3.92** on top of that baseline

Implied strength to hit outgoing 10.0: **−0.77**. No Camotion strength in [0, 1] can match incoming energy. Residual / matched-strength Camotion cannot close this gap.

## Static C seam (`Ce*` ↔ first decoded outgoing frame)

| | 0% `Cs_rendered_0` | 50% | 100% |
|---|---|---|---|
| SSIM | **0.939** | 0.769 | 0.674 |
| MAE | **3.52** | 7.63 | 10.49 |
| PSNR | **34.9** | 26.0 | 23.6 |
| HCorr | 0.968 | 0.978 | 0.983 |

Zero Camotion **does** improve visual seam SSIM past 0.769. The first decoded frame is a slight Kling remapping of `Ce*`, not a FOV punch. 50% and 100% stills visibly enlarge the shaft; 0% does not.

High SSIM is not enough. The 0% cut still starts a new movement.

## Playback

Primary judgment: `generated/clips/compare-C-100-vs-50-vs-0.mp4` at normal speed. Same incoming, three outgoing C→D clips, cut marked.

- **0% is the most continuous of the three.** No radial smear, no shaft-scale jump, heading stays on the floor opening.
- It still feels like a **new clip begins**. The camera does not simply continue the incoming walk. It restarts, then accelerates into the descent.
- Direction into the shaft remains intentional. No wander, no reverse.
- 50% is the middle: milder than 100%, still a Camotion lunge.
- 100% remains the hardest launch.

## Destination

D is reached. ~7 s is already the circular utility tunnel. Literal last frame dest-SSIM vs canonical D: **0.946** (same as the 50% test). Brick arch + cables + steam present.

## Answers

1. **Was exactly one new Kling generation performed?** Yes.

2. **Was the exact existing `Ce*` passed directly to Kling with no Camotion transformation?** Yes. Bytes and pixels identical to the adaptive artifact. No warp.

3. **What is 0% outgoing first-second motion?** Pair-MAE **13.17** (min 10.87, max 14.55).

4. **What is the outgoing/incoming ratio?** **1.32**.

5. **Compare 0% / 50% / 100%:** outgoing 13.17 / 14.72 / 17.09. Ratios 1.32 / 1.48 / 1.71. Rendered SSIM 0.939 / 0.769 / 0.674.

6. **How much outgoing acceleration exists even with no Camotion?** About **+3.2** pair-MAE above incoming, a first-step of 11.1, and a 0.6 s rise to 14.6.

7. **Does the three-point response suggest Camotion strength can realistically be chosen to match incoming energy?** No. The fit is nearly linear around a 13.0 intercept. Matching 10.0 would require negative strength.

8. **Is Kling itself imposing a meaningful launch/ease-in behavior?** Yes. That is the zero-point of this curve.

9. **Which version looks most continuous at normal playback speed?** **0%.** Then 50%, then 100%. None is a true pass-through.

10. **Does zero Camotion improve visual seam SSIM beyond 0.769?** Yes. **0.939**.

11. **Does zero Camotion preserve the intended direction into D?** Yes. Toward and into the shaft, then the utility tunnel.

12. **Does it still reach D correctly?** Yes. Last-frame dest-SSIM **0.946**.

13. **Does the remaining discontinuity appear primarily to be A, B, or C?** **C, with B now dominant.** Camotion still adds a roughly linear extra launch. After removing it, Kling’s own start behavior keeps outgoing at 13.2.

14. **Should the next experiment pursue residual/matched Camotion strength?** **No.** Strength in [0, 1] cannot reach incoming 10.0.

15. **If even 0% still behaves like a new launch, should the next experiment instead test motion-conditioned terminal targets such as `C′`?** **Yes.** The incoming clip still eases toward a still of C, then a new generation starts from that still. Conditioning the incoming traversal toward a motion-alive `C′` is the remaining architectural question. Not run here.

## Artifacts

- `generated/Ce_star.png` — exact reused `Ce*`
- `generated/ce_star_identity.json`
- `stills/D.png`
- `generated/C-D/C-D.mp4` — the one new Kling traversal
- `generated/C-D/Cs_rendered_0.png`
- `generated/clips/seam-0.mp4`
- `generated/clips/compare-C-100-vs-50-vs-0.mp4`
- `curves/C-D/`
- `sheets/strength-vs-outgoing-mae.png`
- `generated/metrics.json`
