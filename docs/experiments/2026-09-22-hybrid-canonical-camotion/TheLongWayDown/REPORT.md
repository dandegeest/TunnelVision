# Hybrid + canonical-derived Camotion — TheLongWayDown

**Date:** 2026-09-22  
**Model:** `kwaivgi/kling-v2.5-turbo-pro`  
**Control:** `docs/experiments/2026-09-22-hybrid-endpoint-inheritance/TheLongWayDown/` (same A′→B; no Camotion on inherited starts)  
**Production:** unchanged

## Step 0 — Camotion planning vs application

TunnelVision already separates the two.

1. **Planning.** Cinematographer assessment of the **canonical pair + traversal intent** reports travel geometry (vanishing point, destination point/bbox, heading). A deterministic bridge (`cameraMotionPlansFromAssessment`) writes CameraMotionPlan v1: `forward=1`, 16 exposure samples, pace-mapped strength (moderate → 0.04), and the CM travel points. CM does not emit the plan JSON itself.

2. **Plan inputs.** Canonical start/end stills, stored traversal intent, CM `travel.start` / `travel.end`, and pace. Not the rendered movie state.

3. **Application.** `camotion --image X --plan Y --output Z --adaptive [--depth]`. The renderer warps whatever image it is given. Depth is an application-time near-weight for that image, not part of the plan.

4. **Reusable plans exist.** `projects/TheLongWayDown/shooting-frames/{B-C,C-D,D-E}/metadata.json` already store `startPlan` / `endPlan` derived from the pristine canonicals.

5. **Transfer.** A plan derived for canonical B can be applied to Be without recomputing VP/destination from Be. Same for C→Ce and D→De. Coordinates are normalized.

**Experiment-only mechanism:** `apply_camotion.py` copies the stored canonical `startPlan` and runs the product CLI against the rendered endpoint. Depth is estimated from the image being warped (Be / Ce / De) so adaptive weights match those pixels. That is not a new motion plan. No production code was changed.

## Architecture under test

```
CANONICAL:  B+C → B→C startPlan     C+D → C→D startPlan     D+E → D→E startPlan
RENDERED:   reused A′→B → Be
            startPlan(B→C) ⋆ Be → Bs′  +  C  → Ce
            startPlan(C→D) ⋆ Ce → Cs′  +  D  → De
            startPlan(D→E) ⋆ De → Ds′  +  E  → Ee
```

A′→B is the exact hybrid control clip (`Be` reused). New work begins at Be.

## Generations

| Leg | Start | End | Wall | Predict | Output | Prediction |
| --- | --- | --- | ---: | ---: | --- | --- |
| A→B | A′ (reused) | B | 205 s | 201 s | 1928×1072 / 10.08 s | `czc7a0awfsrmr0d0sb8tjcwdnm` |
| B→C | Bs′ | C | 143 s | — | 1932×1072 / 10.08 s | `3tyh6s3edsrmr0d0sbzbq0a08w` |
| C→D | Cs′ | D | 190 s | — | 1932×1072 / 10.08 s | see `generated/C-D/generation.json` |
| D→E | Ds′ | E | 296 s | — | 1932×1072 / 10.08 s | see `generated/D-E/generation.json` |

Requested durations 8 s (9 s on reused A→B); Kling returned ~10.08 s each. Prompts are the stored `motionPlan.effectivePrompt` files. Literal last frames used for Ce / De / Ee.

## Four axes

### 1. Visual continuity

Camotion itself (inherited still → primed still):

| Pair | SSIM | MAE | PSNR | HCorr |
| --- | ---: | ---: | ---: | ---: |
| Be ↔ Bs′ | 0.758 | 6.74 | 26.6 | 0.898 |
| Ce ↔ Cs′ | 0.657 | 10.26 | 24.0 | 0.845 |
| De ↔ Ds′ | 0.693 | 8.90 | 25.1 | 0.804 |

Actual movie seams (incoming last decoded frame ↔ outgoing first decoded frame):

| Seam | Experiment | Control (no Camotion) |
| --- | --- | --- |
| Be ↔ Bs_rendered | SSIM **0.668** MAE 8.84 PSNR 24.5 HCorr 0.871 | 0.777 / 6.28 / 27.2 / 0.791 |
| Ce ↔ Cs_rendered | SSIM **0.638** MAE 10.64 PSNR 23.9 HCorr 0.987 | 0.936 / 3.57 / 34.7 / 0.978 |
| De ↔ Ds_rendered | SSIM **0.670** MAE 9.47 PSNR 24.9 HCorr 0.982 | 0.933 / 3.75 / 34.4 / 0.984 |

Kling kept the primed start closely on C and D (`Cs′↔Cs_rendered` SSIM 0.956, `Ds′↔Ds_rendered` 0.956). B remapped more (`Bs′↔Bs_rendered` 0.866), same family as the hybrid B seam.

**C and D visually regress.** That is the Camotion tax: radial warp + motion blur + a closer FOV at the cut.

### 2. Kinetic continuity

Last 1 s incoming vs first 1 s outgoing. Pair-MAE and cheap block-match flow magnitude:

| Boundary | Incoming MAE / flow | Outgoing MAE / flow | Control in | Control out |
| --- | ---: | ---: | ---: | ---: |
| B | 6.65 / 4.93 | **13.42 / 7.85** | 6.65 / 4.93 | 9.68 / 6.18 |
| C | 5.07 / 2.21 | **18.27 / 8.68** | 7.15 / 3.27 | 10.91 / 5.41 |
| D | 8.09 / 4.22 | **18.19 / 8.80** | 7.61 / 3.74 | 14.11 / 7.11 |

Control B→C launch ramps from pair-MAE ~4 → ~14 over the first second (classic accelerate-from-still). Experiment B→C **starts at ~10 and stays high**. Same pattern at C and D: outgoing is immediately traveling.

Incoming still dies. Reused A→B last second falls 8 → 3. New B→C last second mean flow is only 2.21. The cut is therefore:

**slow posed arrival → spatial Camotion jump → already-moving launch**

Side-by-side seam clips (`generated/clips/compare-seam-{B,C,D}.mp4`) show the experiment camera closer to the shaft / arch within ~0.7 s of the cut, while the control is still hanging on the posed still. The outgoing side is more alive. The cut itself is a visible lurch, not invisible travel.

### 3. Story continuity

| Beat | Result |
| --- | --- |
| B | Stairwell / construction transition. Reused Be. |
| C | Unfinished floor, plastic, open shaft. Ce SSIM 0.824 vs canonical C. |
| D | Utility tunnel, cables, steam, brick arch. De SSIM 0.714 vs D. |
| E | **Abandoned station reached.** Clock, columns, tracks, vault. Ee SSIM 0.587 vs E (composition differs; semantics match). Station already present by ~3 s of D→E. |

Story did not regress. The station still opens.

### 4. Temporal efficiency

Camotion does not shorten the incoming pose-lock.

| Clip | Destination established | Motion falloff | Low-motion tail |
| --- | --- | --- | --- |
| Bs′→C (~10 s) | Shaft floor by late clip | Last 8 frames MAE 2.7–5.6 | ~1 s easing, not frozen |
| Cs′→D (~10 s) | Tunnel mid-late | Last 8 MAE 1.8–4.9 | ~1–2 s refinement |
| Ds′→E (~10 s) | Station by **~3 s** (frame 72) | Then pose-lock toward E | **~5–7 s** of station refinement |

D→E still spends most of the clip posing the station. Outgoing Camotion cannot spend that time.

## Camotion cost and transfer robustness

| Transfer | Spatial price | Robust? |
| --- | --- | --- |
| Be → Bs′ | Radial forward blur; rails/stairs streak; landing slightly closer. Same room. | **Yes.** Be ≈ canonical B (stairwell + right-hand floor). Plan VP (0.49, 0.57) and dest (0.60, 0.65) still sit on the landing / right exit. Matches production B′ language. |
| Ce → Cs′ | Stronger pull into the shaft; plastic and floor streak; FOV feels closer. | **Yes.** Ce is the same construction floor as C. Plan dest is the rectangular opening (0.50, 0.68). Warp aims at the hole, not a wrong wall. |
| De → Ds′ | Tunnel pull toward the brick arch; cables streak; cup leaves frame. | **Yes.** De is the same utility tunnel as D. Plan dest is the arch (0.49, 0.49). |

No case invented a new heading from the rendered still. Moderate canonical/rendered divergence did not break the plans. Sharpness drops on primed frames (Be 4.68 → Bs′ 1.93) because Camotion is motion blur by design.

## Answers

1. **How does TunnelVision separate planning from application?**  
   CM + deterministic bridge write CameraMotionPlan v1 from **canonical** travel geometry. The Python renderer applies that JSON to any image. Depth is optional application-time weighting.

2. **Were the B→C / C→D / D→E plans transferred onto Be / Ce / De?**  
   **Yes.** Stored `startPlan` files were applied unchanged. No replan from rendered endpoints.

3. **Sensible Bs′?**  
   **Yes.** Forward-down stairwell motion; same architecture as Be and as production B′.

4. **Sensible Cs′?**  
   **Yes.** Forward pull into the floor opening. Stronger warp than B, still the same set.

5. **Sensible Ds′?**  
   **Yes.** Forward pull through the tunnel toward the arch.

6. **Did the camera feel like it kept moving through B, C, and D?**  
   **Partly.** Outgoing motion starts immediately and is stronger than the control. Incoming motion still dies, so the cut is a lurch rather than uninterrupted travel.

7. **Which boundaries improved kinetically?**  
   **All three outgoing launches** (higher first-second MAE/flow; no slow ramp). C and D are the most obvious in the side-by-sides: the experiment is already crossing the shaft / approaching the arch while the control is still posed.

8. **Which boundaries regressed visually?**  
   **C and D** (SSIM 0.94 → 0.64 / 0.67). B also dropped (0.777 → 0.668) but was already the weak static seam.

9. **Rendered seam metrics**  
   B 0.668 / 8.84 / 24.5 / 0.871  
   C 0.638 / 10.64 / 23.9 / 0.987  
   D 0.670 / 9.47 / 24.9 / 0.982

10. **Vs no-Camotion hybrid**  
    Static continuity is worse on every seam, especially C and D. That is expected and not treated as automatic failure.

11. **Camotion-only change**  
    Be↔Bs′ 0.758 / 6.74  
    Ce↔Cs′ 0.657 / 10.26  
    De↔Ds′ 0.693 / 8.90

12. **FOV / geometry / crop problems?**  
    Intentional radial crop and blur, not broken geometry. C’s closer shaft FOV is the largest composition change. No invented rooms.

13. **Story adherence intact?**  
    **Yes.** B, C, D, E all hold.

14. **Did D→E still reach the station?**  
    **Yes.** Present by ~3 s; Ee is the abandoned station.

15. **How much pose-lock remains?**  
    **Most of D→E after ~3 s.** B→C and C→D still ease in the last 1–2 s. Incoming magnetism is unsolved.

16. **Does Camotion alone solve stop/restart?**  
    **No.** It fixes the **outgoing** half (launch already moving) and leaves the **incoming** half (decelerate / pose). Across a posed still, the primed start reads as a jump.

17. **Does the evidence support Camotion + adaptive termination?**  
    **Yes, strongly.** Destinations arrive before clip end. Cutting while motion is still alive, then transferring the next canonical plan onto that live endpoint, is the remaining path to `MOVE → ARRIVE WHILE MOVING → CUT → CONTINUE`. Do not implement that here.

18. **Is the architecture viable?**  
    **Yes as a director/movie split; not yet as a complete kinetic solution.**

    - Canonical destination still defines where to go.  
    - Canonical Camotion plan still defines how to leave.  
    - Rendered endpoint still defines where the movie is.  
    - Transferring the plan onto that endpoint is **robust** and **story-safe**.  
    - The camera does **not** yet feel like it never stops, because incoming ease-out remains.

## Positive-result check

Useful: outgoing motion begins naturally; direction matches the authored route; story and station hold; plan transfer is sensible; no broken geometry.  
Not yet: substantially less *stopped* at the cut; the cut is not uninterrupted travel.  
SSIM loss is acceptable **if** kinetic gain were a continuous camera. It is not, yet. The gain is a faster, already-conditioned launch after a posed arrival.

## Follow-up (do not implement)

Test: **canonical-derived Camotion on inherited starts + adaptive / shorter termination** while motion is still alive.

## Artifacts

- Reused A′→B + Be: `generated/A-B/`
- Plans: `plans/{B-C,C-D,D-E}-startPlan.json`
- Bs′ / Cs′ / Ds′ + debug depth: `generated/{B-C,C-D,D-E}/`
- Movie: `generated/experimental_A_B_C_D_E_hybrid_canonical_camotion.mp4`
- Full side-by-side: `generated/control_vs_experiment_side_by_side.mp4`
- Seam compares: `generated/clips/compare-seam-{B,C,D}.mp4`
- Sheets: `sheets/camotion-*.png`, `sheets/seam-*.png`, `sheets/story-*.png`
- Metrics: `generated/metrics.json`
- Experiment-only apply: `../apply_camotion.py`
