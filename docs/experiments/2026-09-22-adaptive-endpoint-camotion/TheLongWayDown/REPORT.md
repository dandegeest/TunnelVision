# Adaptive endpoint + canonical-derived Camotion — TheLongWayDown

**Date:** 2026-09-22  
**Model:** `kwaivgi/kling-v2.5-turbo-pro`  
**Controls:**

1. Hybrid endpoint inheritance — `docs/experiments/2026-09-22-hybrid-endpoint-inheritance/TheLongWayDown/`
2. Hybrid + canonical-derived Camotion — `docs/experiments/2026-09-22-hybrid-canonical-camotion/TheLongWayDown/`

**Production:** unchanged

## Hypothesis

Camotion already solves the outgoing half of each boundary. Incoming motion still dies because Kling pose-locks onto the canonical end still. If TunnelVision cuts at a frame where the destination is already established **and** the camera is still moving, then applies the same canonical-derived outgoing plan to that earlier state, the movie should feel like:

```
MOVE → ARRIVE WHILE STILL MOVING → CUT → CONTINUE MOVING
```

instead of:

```
MOVE → DECELERATE → POSE → CUT → CAMOTION JUMP → ALREADY MOVING
```

## Architecture under test

```
FULL KLING A′→B  →  select Be* (B reached, motion alive)  →  startPlan(B→C) ⋆ Be* → Bs′*
FULL KLING Bs′*→C →  select Ce*                          →  startPlan(C→D) ⋆ Ce* → Cs′*
FULL KLING Cs′*→D →  select De*                          →  startPlan(D→E) ⋆ De* → Ds′*
FULL KLING Ds′*→E →  select Ee* (documentary; no next hop)
```

A′→B is the exact hybrid / Camotion-control clip. New work begins at Be*. Plans are the stored canonical `startPlan` JSONs from the previous Camotion experiment. Application uses the same experiment-local `apply_camotion.py`. No new plans were derived from editorial endpoints.

## Generations

| Leg | Start | End | Wall | Output | Notes |
| --- | --- | --- | ---: | --- | --- |
| A→B | A′ (reused) | B | 205 s | 1928×1072 / 10.08 s | same clip as both controls |
| B→C | Bs′* | C | 421 s | 1932×1072 / 10.08 s | new — start changed |
| C→D | Cs′* | D | 189 s | 1932×1072 / 10.08 s | new — start changed |
| D→E | Ds′* | E | 165 s | 1932×1072 / 10.08 s | new — start changed |

Requested duration 8 s; Kling returned ~10.08 s / 242 frames each. Prompts are the stored `motionPlan.effectivePrompt` files. Full clips were generated; editorial cuts were chosen afterward.

## Editorial selections

Selection rule: latest frame where the destination is already convincingly established **and** pair-MAE is still useful travel, before dest-SSIM magnetism / motion collapse.

Dest-SSIM vs the pristine canonical is a **pose-lock** signal, not an arrival signal. It stays ~0.1–0.3 through semantically complete destinations and only spikes when Kling is already refining onto the still. Arrival was judged from the frames plus dest-MAE decline.

| Traversal | Dest established | Pose-lock began | Editorial cut | Pair MAE at cut | Dest SSIM at cut | Tail removed |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| A→B | ~8.0 s (stairwell + rusted door + construction floor) | ~9.5 s | **Be\* frame 216 / 9.00 s** | 7.50 | 0.241 | 1.08 s / 10.7% |
| B→C | ~7.5 s (plastic + shaft + string lights) | ~9.0 s | **Ce\* frame 210 / 8.75 s** | 8.21 | 0.321 | 1.33 s / 13.2% |
| C→D | ~6.0 s (cables + steam + brick) | ~9.5 s | **De\* frame 216 / 9.00 s** | 8.24 | 0.296 | 1.08 s / 10.7% |
| D→E | ~3.0 s (platform + tracks + columns) | ~9.0 s | **Ee\* frame 204 / 8.50 s** | 7.24 | 0.305 | 1.58 s / 15.7% |

Literal last-frame dest-SSIM was 0.93–0.99 with pair-MAE 1.5–3.4. Those frames are unused in the edited movie.

Total generated: 40.33 s. Used in the edited movie: 35.25 s. **Discarded: 5.08 s (12.6%).**

Destination often arrives several seconds before pose-lock (D→E: station at 3 s, lock at 9 s). That extra time is mostly **useful continued travel**, not dead tail. The discarded region is the last ~1.1–1.6 s of canonical refinement.

## Four axes

### 1. Visual continuity

Camotion itself (editorial still → primed still):

| Pair | SSIM | MAE | PSNR | HCorr |
| --- | ---: | ---: | ---: | ---: |
| Be\* ↔ Bs′\* | 0.815 | 5.79 | 26.6 | 0.936 |
| Ce\* ↔ Cs′\* | 0.693 | 10.00 | 23.7 | 0.853 |
| De\* ↔ Ds′\* | 0.770 | 7.51 | 26.0 | 0.850 |

Actual movie seams (editorial last frame ↔ outgoing first decoded frame):

| Seam | Adaptive | Camotion control | Hybrid (no Camotion) |
| --- | --- | --- | --- |
| B | SSIM **0.711** MAE 8.22 PSNR 24.2 HCorr 0.873 | 0.668 / 8.84 / 24.5 / 0.871 | 0.777 / 6.28 / 27.2 / 0.791 |
| C | SSIM **0.674** MAE 10.49 PSNR 23.6 HCorr 0.983 | 0.638 / 10.64 / 23.9 / 0.987 | 0.936 / 3.57 / 34.7 / 0.978 |
| D | SSIM **0.748** MAE 8.18 PSNR 25.8 HCorr 0.992 | 0.670 / 9.47 / 24.9 / 0.982 | 0.933 / 3.75 / 34.4 / 0.984 |

Adaptive seams are slightly **better** than literal-endpoint Camotion (less posed incoming still) and still **worse** than the no-Camotion hybrid at C and D. Kling kept primed starts closely on C and D (`Cs′\*↔Cs_rendered\*` SSIM 0.958, `Ds′\*↔Ds_rendered\*` 0.961). B remapped more (0.854), same family as previous B seams.

The Camotion tax is unchanged in kind: radial warp, motion blur, closer FOV at the cut.

### 2. Kinetic continuity

Last 1 s **before the editorial cut** vs first 1 s of the next traversal. Pair-MAE:

| Boundary | Adaptive in / out | Camotion-control in / out | Hybrid in / out |
| --- | ---: | ---: | ---: |
| B | **8.30 / 14.09** (min in 7.50) | 6.65 / 13.42 (min in 2.93) | 6.65 / 9.68 |
| C | **9.97 / 17.09** (min in 8.21) | 5.07 / 18.27 | 7.15 / 10.91 |
| D | **9.32 / 16.65** (min in 8.15) | 8.09 / 18.19 | 7.61 / 14.11 |

Incoming motion **survives**. The adaptive incoming windows never drop into the 2–3 MAE pose-lock well that defined both controls. Outgoing launch magnitude is about the same as Camotion-control (~14–17). Ratio out/in is still ~1.7×.

Perceptual seam clips (1 s before / 1 s after, yellow CUT marker):

- **B** — incoming is still walking down the stairwell. After the cut the camera continues down the stairs. There is a mild FOV widen, not a stop. Best of the three seams.
- **C** — incoming is still approaching the shaft. After the cut Camotion lunges: radial blur, closer FOV, already diving. Direction is coherent (into the shaft) but the speed jump is obvious. Most discontinuous seam.
- **D** — incoming is still traveling the utility tunnel. After the cut the brick arch jumps closer with motion blur. Forward direction holds; the cut still reads as a push.

The remaining discontinuity is no longer **stop → restart**. It is **travel → faster travel**. The stored canonical startPlans were authored to launch from a nearly static canonical pose. Applied to an already-moving editorial endpoint they over-accelerate.

### 3. Story continuity

Intact.

| Beat | Evidence |
| --- | --- |
| B stairwell / construction | Be\* shows concrete stairs, rusted door, plastic-wrapped floor |
| C construction floor / shaft | Ce\* shows plastic sheets, open shaft, string lights, rebar |
| D utility / cables / steam / brick | De\* shows cable runs, steam, brick arch, paper cup |
| E abandoned station | Present by ~3.0 s of D→E: platform, tracks, columns, clock, can |

No editorial cut was pulled so early that the destination failed. Station arrival is unmistakable.

### 4. Temporal efficiency

Kling routinely spends the last ~1.1–1.6 s posing onto the canonical. That is the only region this experiment discarded. Earlier “extra” time after semantic arrival is still camera travel and was kept.

The edited movie is 35.25 s vs ~40.3 s for both full-length controls. Pose-lock is gone from the **edited** movie because those tails were never included. Full-length diagnostics still contain them.

## Direct answers

1. **Could a useful motion-alive editorial endpoint be found for B, C, and D after the destination was already established?**  
   Yes. Each traversal has a candidate window of destination-reached + motion-alive lasting ~0.75–3.5 s before pose-lock.

2. **What frame/timestamp was selected for Be\*, Ce\*, and De\*?**  
   Be\* = frame 216 / 9.00 s. Ce\* = frame 210 / 8.75 s. De\* = frame 216 / 9.00 s. (Ee\* = frame 204 / 8.50 s, documentary.)

3. **How many seconds of pose-lock/deceleration were removed from each traversal?**  
   A→B 1.08 s, B→C 1.33 s, C→D 1.08 s, D→E 1.58 s.

4. **Did the canonical-derived Camotion plans still transfer sensibly onto these earlier rendered endpoints?**  
   Yes. Bs′\* / Cs′\* / Ds′\* are the same family of forward radial warps as the literal-endpoint experiment. Geometry and destinations stay recognizable. Transform SSIMs were 0.815 / 0.693 / 0.770 — slightly cleaner than transfer onto pose-locked stills.

5. **Did incoming motion remain alive through the selected cut?**  
   Yes. Incoming last-1 s mean pair-MAE 8.3 / 10.0 / 9.3 with minima 7.5 / 8.2 / 8.1. No collapse to the 2–3 MAE well.

6. **Did outgoing motion from Bs′\* / Cs′\* / Ds′\* feel compatible with that incoming motion?**  
   Partially. Direction is compatible (down stairs, into shaft, down tunnel). Magnitude is not: outgoing is ~1.7× incoming. B is closest. C and D still lunge.

7. **Did the camera feel less like it stopped and restarted?**  
   Yes versus both controls. Incoming no longer poses. The cut is a speed change, not a halt.

8. **Which seam improved most kinetically?**  
   **B.** Incoming death was obvious in both controls (last-second MAE → 2.9). Adaptive incoming stays at 7.5–9.0 and the outgoing Camotion on B is the mildest warp.

9. **Which seam still feels discontinuous?**  
   **C**, then D. Camotion’s shaft / brick-arch launch is larger than the incoming walk.

10. **What static seam penalty was paid?**  
    Versus hybrid: C 0.936→0.674, D 0.933→0.748, B 0.777→0.711. Versus Camotion-control the adaptive seams are slightly better. Worth it if the goal is motion; not if the goal is still-frame match.

11. **Did destination/story adherence remain intact?**  
    Yes. All four beats are in the edited movie.

12. **Did the journey still reach the abandoned station?**  
    Yes. Station is established by ~3 s of D→E and remains through Ee\*.

13. **Did adaptive endpoint selection eliminate or substantially reduce the canonical pose-lock problem in the ACTUAL EDITED MOVIE?**  
    **Eliminated from the edited movie.** Those tails are not in `experimental_A_B_C_D_E_adaptive_endpoint_camotion.mp4`. Kling still generates them; TunnelVision no longer has to show them.

14. **How much generated footage was discarded overall?**  
    5.08 s of 40.33 s (**12.6%**). Not the multi-second waste the D→E early-arrival might have suggested — most post-arrival time is still travel.

15. **Does the evidence suggest endpoint selection can eventually be automated using motion + destination-arrival signals?**  
    Pose-lock onset looks automatable: dest-SSIM climb + pair-MAE drop. Destination *establishment* is not dest-SSIM — that metric only fires at lock. Automation will need a semantic or dest-MAE / structure signal, then take the latest frame before the lock pair. Manual intersection of those two signals was straightforward on all four legs.

16. **Does the resulting architecture appear viable?**  
    Yes, with one amendment:

    ```
    PRISTINE CANONICAL          → destination
    FULL KLING GENERATION       → guarantees arrival
    ADAPTIVE EDITORIAL ENDPOINT → cut while motion is alive
    RENDERED ENDPOINT           → spatial truth
    CANONICAL-DERIVED CAMOTION  → intended outgoing direction
    NEXT CANONICAL              → next target
    ```

    Viable for story + incoming kinetic survival. The stored startPlans are sized for a **static** launch. On a motion-alive cut they over-push. Next experiment should scale outgoing Camotion to incoming kinetic energy, or use a smaller fraction of the same plan.

17. **Does the final adaptive-endpoint movie feel more like ONE CONTINUOUS CAMERA JOURNEY than both previous controls?**  
    **Yes.** At normal playback it is the most continuous of the three: hybrid still stops, Camotion-control still poses then jumps, adaptive keeps walking through B / C / D and only overspeeds at C and D. It is not yet a single unbroken camera — the remaining lurch is outgoing Camotion magnitude, not incoming death.

## What counts as a positive result

The missing incoming half is real and selectable. Adaptive cuts remove pose-lock from the movie without sacrificing B / C / D / E. Canonical plans still transfer. The leftover problem is **matching outgoing Camotion strength to surviving incoming velocity**, not finding a better last frame.

## Artifacts

| Path | What |
| --- | --- |
| `generated/A-B/A-B.mp4` | reused A′→B |
| `generated/{A-B,B-C,C-D,D-E}/*_star.png` | editorial endpoints |
| `generated/{A-B,B-C,C-D,D-E}/*_literal.png` | unused last frames |
| `generated/{B-C,C-D,D-E}/*-prime-star.png` | Camotion-conditioned starts |
| `curves/*/motion.csv` + `motion.png` | pair-MAE and dest-SSIM |
| `generated/clips/threeway-{B,C,D}.mp4` | hybrid / Camotion / adaptive seams |
| `generated/experimental_A_B_C_D_E_adaptive_endpoint_camotion.mp4` | edited movie (editorial cuts only) |
| `generated/experimental_A_B_C_D_E_adaptive_full_length_diagnostic.mp4` | full Kling tails |
| `generated/threeway_full_hybrid_camotion_adaptive.mp4` | three-way full playback |
| `generated/metrics.json` | numbers |

Play the three-way seam clips at normal speed before trusting the contact sheets.
