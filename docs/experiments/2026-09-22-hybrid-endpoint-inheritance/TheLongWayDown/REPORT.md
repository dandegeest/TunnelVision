# Hybrid endpoint inheritance — The Long Way Down

**Date:** 22 September 2026  
**Kind:** Offline generation. Production pipeline not modified.  
**Model:** `kwaivgi/kling-v2.5-turbo-pro` on every leg  
**Architecture:** rendered start + pristine canonical end  
**Camotion on inherited starts:** none  
**Control (not rerun):** [start-only recursive experiment](../../2026-09-22-recursive-endpoint-inheritance/TheLongWayDown/REPORT.md)

---

## Hypothesis

Canonicals tell Kling **where the director wants to go**.  
Extracted rendered endpoints tell Kling **where the movie actually is**.

Chain:

```
A′ + B  →  Be
Be + C  →  Ce
Ce + D  →  De
De + E  →  Ee
```

`A′` is the project's Camotion-conditioned A shooting frame. `B/C/D/E` are pristine TunnelVision canonicals. `Be/Ce/De/Ee` are literal last decoded frames. No Camotion, restoration, or reframing on inherited starts.

---

## Project

| | |
| --- | --- |
| Folder | `projects/TheLongWayDown` (`tv-568dcd004b541ab8`) |
| Grammar | POV |
| Agency | directed, planned |
| Story | night skyscraper roof → stairwell/construction floor → utility infrastructure → older brick → lost underground station |
| Canonicals | A–E all present (`canonicals/*/take-01.png`, 1376×768) |
| `A′` | `shooting-frames/A-B/start-upload-ec100b1f3f72745de5cc1ad7ee21c313.png` |
| Production video | none — this project has not been shot in-product |
| Prompts | stored `motionPlan.effectivePrompt` for each leg (intent + POV locomotion baseline) |

Requested traversal durations were 9 / 8 / 8 / 8 s. Kling 2.5 only accepts 5 or 10; all four clips returned **10.08 s / 242 frames**.

Returned resolution was recorded, not assumed: A→B **1928×1072**, later legs **1932×1072**.

---

## Generation (0 retries)

| Leg | Start | End | Camotion | Wall | Predict | Output | Prediction |
| --- | --- | --- | --- | ---: | ---: | --- | --- |
| A→B | A′ | canonical B | A′ only | 205 s | 201 s | 1928×1072, 10.08 s, 242 f | `czc7a0awfsrmr0d0sb8tjcwdnm` |
| B→C | Be | canonical C | none | 161 s | 156 s | 1932×1072, 10.08 s, 242 f | `b9jceck2w1rmy0d0sbavaqphmc` |
| C→D | Ce | canonical D | none | 166 s | 161 s | 1932×1072, 10.08 s, 242 f | `4nvr2g5f0hrmr0d0sbc8ng7hyw` |
| D→E | De | canonical E | none | 172 s | 166 s | 1932×1072, 10.08 s, 242 f | `dgfw0ns1znrmw0d0sbeb07necg` |

Every literal last frame was kept. Near-end windows were the same space, not decode glitches.

---

## Destination arrivals (Primary Test #2)

| State | Intended | Actual rendered arrival | Story beat |
| --- | --- | --- | --- |
| Be | stairwell + rusted door + construction floor | same stairwell, door, rails, plastic-wrapped floor | **B** |
| Ce | unfinished floor, hanging plastic, work lights, open shaft | same floor, plastic, lights, shaft | **C** — not the start-only black collapse |
| De | concrete utility tunnel, cables, steam, brick beyond | same tunnel, cables, steam, brick arch, cup | **D** |
| Ee | abandoned station: clock, columns, tracks, dark tunnel | same station, clock, columns, tracks, cup | **E** — start-only failed here |

Pixel metrics after cover-fitting the 1376×768 canonical onto the rendered frame (secondary; semantic judgement is primary):

| Pair | SSIM | MAE | PSNR | HCorr |
| --- | ---: | ---: | ---: | ---: |
| B ↔ Be | 0.847 | 4.79 | 30.4 | 0.842 |
| C ↔ Ce | 0.862 | 5.48 | 29.9 | 0.844 |
| D ↔ De | 0.820 | 6.44 | 28.1 | 0.822 |
| E ↔ Ee | 0.753 | 9.18 | 25.6 | 0.856 |

These are **not** identity. They are close compositions of the intended rooms. That is destination control, not a claim of pixel arrival.

---

## Boundary continuity (Primary Test #1)

Frames that actually touch in the finished movie:

| Seam | SSIM | MAE | PSNR | HCorr | Start-only control |
| --- | ---: | ---: | ---: | ---: | --- |
| Be ↔ Bs_rendered | **0.777** | **6.28** | **27.2** | **0.791** | 0.932 / 3.14 / 33.4 / 0.945 |
| Ce ↔ Cs_rendered | **0.936** | **3.57** | **34.7** | **0.978** | 0.926 / 1.01 / 42.9 / 0.990 |
| De ↔ Ds_rendered | **0.933** | **3.75** | **34.4** | **0.984** | 0.927 / 2.62 / 37.9 / 0.973 |

C and D preserve the start-only class of inherited-start continuity (~0.93 SSIM). B does **not**. Kling remapped the first frame of B→C: same stairwell, slightly different FOV / door scale / right-side floor. The difference image is a geometric offset, not a scene change. The cut is still the same room; it is not as pixel-invisible as the start-only B seam.

The 1928→1932 width hop also existed in the start-only control, so it is not a sufficient explanation by itself. The more likely cause is that end-conditioned Be is a settled, still-like frame; Kling treats that launch more loosely than it treated the motion-blurred start-only Be.

---

## End-condition pressure (Primary Test #3)

Canonical ends pull the last seconds toward the still.

| Leg | Last-8-frame MAE | What happens |
| --- | --- | --- |
| A→B | 2.9–5.9 | still moving; composition settles onto B |
| B→C | 3.1–6.4 | still moving; floor/plastic/shaft lock onto C |
| C→D | 2.4–6.0 | still moving; cables/steam/cup lock onto D |
| D→E | **0.9–2.0**, last step 4.0 | **freeze / magnetism** onto E |

Approach samples at ~7.5 s (frame 180):

- A→B is already looking down the stairwell, but not yet in the exact B pose.
- B→C is on the construction floor with a shaft, but the plastic/debris layout is not yet C.
- C→D is already in a utility tunnel, but pipes/cables are a different arrangement than D.
- D→E is already in the station by ~5 s (frame 120), then spends the rest of the clip refining clock / cup / tiles / columns toward canonical E.

That is visible endpoint magnetism: travel first, then last-second posing. D→E also shows the frozen-final-frames pattern. No grotesque deformation or lighting snap was observed, but the last seconds are not freely kinetic.

This is the cost of destination control. The start-only experiment had healthier late-clip motion and no station.

---

## Recursive quality (Primary Test #4)

Video-endpoint luma / sharpness (same Laplacian used in the start-only report):

| Endpoint | Hybrid luma | Hybrid sharpness | Start-only luma | Start-only sharpness |
| --- | ---: | ---: | ---: | ---: |
| Be | 61.0 | 4.68 | 65.9 | 2.55 |
| Ce | 68.9 | 5.71 | **2.6** | **0.55** |
| De | 73.1 | 6.46 | 26.6 | 1.49 |
| Ee | 61.6 | 8.25 | 27.7 | 0.95 |

Canonical C **prevented the near-black collapse**. Ce is a lit construction floor with usable geometry. Sharpness among video endpoints **rises** down the chain because each arrival locks onto a detailed still. That is the opposite of the start-only failure mode.

Endpoints are still softer than the 1376×768 canonical stills (canonical sharpness 12–29). Video-to-still acuity is not recovered. Softness does not accumulate into unreadability.

No inherited endpoint was a poor launch state. Skipping Camotion on Be/Ce/De did not produce a snapped or stuttered start. The B remapping is a start-image reinterpretation, not a Camotion-shaped kinetic break.

---

## Final movie

Flat concat, no crossfade / flow / blend:

`generated/experimental_A_B_C_D_E_hybrid_endpoint_inheritance.mp4`

1932×1072, 40.33 s, 968 frames. A→B was scaled 1928→1932 for container consistency only. Seam clips (~1.6 s before and after each cut) are in `generated/seam-clips/`.

The raw cuts read as one descent. B is the only cut a careful viewer might notice as a slight spatial settle. C and D are near-invisible. The journey **does** open into the station.

---

## Three-way comparison

Do not treat this as a single numerical winner.

| | Normal TunnelVision | Start-only inheritance | Hybrid |
| --- | --- | --- | --- |
| Starts | conditioned / canonical | rendered endpoint | rendered endpoint (A′ only on first hop) |
| Ends | canonical | none | pristine canonical |
| Destination control | designed strength | failed at E; C collapsed | **restored B, C, D, and E** |
| Seam continuity | reset at boundaries (unmeasured here; no production takes) | **0.93 / 0.93 / 0.93** | **0.78 / 0.94 / 0.93** |
| Endpoint quality | authored stills | dark/soft; Ce unusable | healthy; Ce usable |
| Kinetic late-clip | n/a in this project | continuous motion | late posing; D→E freeze |
| Recursive drift | reset each hop | story drift | story held |
| Reliability | n/a | 0 retries, 5 s clips | 0 retries, 10 s clips |
| Latency | n/a | 1056 s wall | 703 s wall |

Normal TunnelVision is the conceptual destination-control pole. This project has no production takes, so its boundary-reset cost is not measured here.

Start-only remains the continuity pole.

Hybrid is the first of the three that **both arrives at E and keeps C/D seams in the 0.93 class**. It gives back some of the B-seam invisibility and spends the last seconds of each clip posing toward the still.

---

## Answers

1. **Did pristine end-frame conditioning restore story adherence vs start-only?**  
   **Yes.** Roof → stairwell → construction shaft → utility/brick → station. Start-only died in a brick rail tunnel.

2. **Did A→B arrive at B?**  
   **Yes.** Concrete stairwell, rusted door, plastic-wrapped floor.

3. **Did B→C arrive at C?**  
   **Yes.** Unfinished floor, hanging plastic, work lights, open shaft.

4. **Did canonical C prevent the near-black collapse?**  
   **Yes.** Ce luma 68.9 / sharpness 5.71 vs start-only 2.6 / 0.55.

5. **Did C→D arrive at D?**  
   **Yes.** Cables, steam, circular concrete, brick arch, cup.

6. **Did D→E arrive at station E?**  
   **Yes.** Clock, columns, tiled platform, rusted tracks, dark tunnel. This is the result start-only could not produce.

7. **Did Kling preserve each inherited rendered start?**  
   **Mostly.** C and D yes (~0.93 SSIM). B only as the same room (0.777 SSIM, slight FOV remapping).

8. **Actual seam metrics:**  
   Be↔Bs 0.777 / 6.28 / 27.2 / 0.791  
   Ce↔Cs 0.936 / 3.57 / 34.7 / 0.978  
   De↔Ds 0.933 / 3.75 / 34.4 / 0.984

9. **Vs start-only control?**  
   C and D match or slightly beat the 0.93 class. B is clearly worse (0.777 vs 0.932). Continuity is no longer uniformly excellent.

10. **Visible convergence artifacts?**  
    **Yes, especially D→E.** Early arrival (~5 s), then freeze/refine onto the still. A→B / B→C / C→D still move in the last 8 frames but their last seconds are pose-locks onto B/C/D. No grotesque warp; the artifact is magnetism and deceleration, not a glitch.

11. **Did blur/detail degradation accumulate?**  
    **Not as a collapse.** Video endpoints stay softer than stills. Sharpness among video arrivals rises (4.7 → 8.3) because they lock onto detailed canonicals. The start-only failure mode did not repeat.

12. **Did any inherited endpoint become a poor launch state?**  
    **No.** Be/Ce/De were all readable, well-lit, geometrically intact.

13. **Problems from skipping Camotion on Be/Ce/De?**  
    **No obvious kinetic launch failure.** First frames are the inherited rooms. The B remapping is start-image reinterpretation, not a Camotion-shaped stutter.

14. **Does the flat concat feel like one continuous journey?**  
    **Yes, as a descent that actually finishes.** C and D cuts are near-seamless. B is a soft spatial settle in the same stairwell. The station arrival is the story ending the start-only movie never earned.

15. **Does the hybrid keep both advantages?**  
    **Mostly, with a visible trade.**  
    Authored destination control is restored — including the station.  
    Rendered-state continuity is preserved at C and D at start-only quality, and only partially at B.  
    The new cost is end-condition magnetism: clips travel, then pose into the canonical, and D→E freezes.

Canonicals can define where the film should go, and rendered endpoints can define where the film actually is, **well enough to complete this story without a boundary reset to a conditioned start**. They do not yet coexist without a seam tax at the first hop or late-clip posing.

Do not put this path in production from this notebook.

---

## Paths

Experiment root:

`docs/experiments/2026-09-22-hybrid-endpoint-inheritance/TheLongWayDown/`

Final movie:

`docs/experiments/2026-09-22-hybrid-endpoint-inheritance/TheLongWayDown/generated/experimental_A_B_C_D_E_hybrid_endpoint_inheritance.mp4`

This report:

`docs/experiments/2026-09-22-hybrid-endpoint-inheritance/TheLongWayDown/REPORT.md`

Also: `generated/{A-B,B-C,C-D,D-E}/*.mp4`, `*e_{literal,selected}.png`, `Bs/Cs/Ds_rendered.png`, `sheets/`, `generated/seam-clips/`, `generated/metrics.json`.
