# Recursive endpoint inheritance — The Long Way Down

**Date:** 22 September 2026  
**Kind:** Offline generation. Production pipeline not modified.  
**Model:** `kwaivgi/kling-v2.5-turbo-pro` on every leg  
**End image:** none  
**Camotion on inherited starts:** none

---

## Project

| | |
| --- | --- |
| Folder | `projects/TheLongWayDown` (`tv-568dcd004b541ab8`) |
| Grammar | POV |
| Story | Director-planned A–E descent: rooftop → stairwell/construction floor → utility/foundations → brick passages → lost station |
| Canonical A | `canonicals/A/take-01.png` 1376×768 — used as the A→B start, no Camotion |
| B–E stills | none (intents + visualDescriptions only). Videos were required to discover them. |

Traversal prompts = stored Director **intent + visualDescription** plus the product POV locomotion baseline (`composeJourneyShootingPrompt`, pace `fast`, pull-forward on). There were no cinematographer `effectivePrompt`s because this project has never been shot.

---

## Generation (0 retries)

| Leg | Start | Wall | Predict | Output | Prediction |
| --- | --- | ---: | ---: | --- | --- |
| A→B | canonical A | 322 s | 321 s | 1928×1072, 5.04 s, 121 f | `93gcndc27xrmw0d0satb5p5c0c` |
| B→C | Be last frame | 202 s | 201 s | 1932×1072, 5.04 s, 121 f | `djdzdm1tnnrmr0d0sax9c4s5f4` |
| C→D | Ce last frame | 255 s | 254 s | 1932×1072, 5.04 s, 121 f | `1qpp9b9j3hrmr0d0saz9t0ejww` |
| D→E | De last frame | 277 s | 276 s | 1932×1072, 5.04 s, 121 f | `pg8tx7fcj1rmy0d0sb1bx2x3gg` |

Every literal last frame was kept. Near-end windows were the same space, not glitches.

---

## Discovered states (not canonicals)

| State | What Kling actually arrived at | Story beat |
| --- | --- | --- |
| A | Night rooftop, wet deck, door on the right | given |
| Be | Empty unfinished floor, fluorescent grid, city beyond the slab | **B-ish** — construction level, stairwell skipped |
| Ce | Near-black enclosed shaft, hanging wire | **C-ish** — elevator/foundation shaft; almost no detail |
| De | Brick arches + rails | **D** — buried brick passage (rails arrived early) |
| Ee | Deeper / tighter brick rail tunnel, light at infinity | **not E** — never opened into a monumental station |

---

## Boundary quality (frames that touch)

| Seam | SSIM | MAE | PSNR | HCorr |
| --- | ---: | ---: | ---: | ---: |
| A→B last ↔ B→C first | **0.932** | **3.14** | **33.44** | **0.945** |
| B→C last ↔ C→D first | **0.926** | **1.01** | **42.93** | **0.990** |
| C→D last ↔ D→E first | **0.927** | **2.62** | **37.93** | **0.973** |

Inherited start ≡ last rendered frame (pixel identity). First-frame fidelity is the same table: Kling did not reinvent the start.

The FirstTracks B→C/C→D single-seam result (SSIM 0.963) **persists recursively** at ~0.93 on all three cuts. Seams are near-seamless. That is **boundary quality**.

---

## State quality (degradation)

Sharpness on a still vs a video frame is not comparable (A is a generated still). Among **video endpoints**:

| Endpoint | Luma | Sharpness |
| --- | ---: | ---: |
| Be | 65.9 | 2.55 |
| Ce | **2.6** | **0.55** |
| De | 26.6 | 1.49 |
| Ee | 27.7 | 0.95 |

- Motion blur is present from Be onward (floor streaking).
- C collapses into a nearly black, low-detail shaft. The next clip *starts* from that void and still recovers a readable tunnel — but C itself is a quality hole.
- D recovers architecture; E softens again and stays in-tunnel.
- Semantic drift: stairwell omitted; rails appear at D instead of E; E never becomes a station.
- Skipping Camotion did **not** break launch. Every first frame matches the inherited start. No obvious launch stutter from raw video endpoints.

A chain can have invisible cuts and still get darker, softer, and story-wrong.

---

## Answers

1. **Plausible B, C, D, E without destination images?**  
   B (floor), C (shaft), D (brick) — yes enough to read. E — no. The last clip never leaves the tunnel.

2. **Faithful to The Long Way Down?**  
   The descent *direction* is right: roof → interior slab → dark undercroft → old brick. The specified stairwell, utility pipes/steam, and lost station are missing or weak.

3. **Seamless internal boundaries?**  
   Yes. All three cuts are in the FirstTracks class.

4. **Metrics:** table above.

5. **First-frame preservation?**  
   Yes. SSIM 0.93 / 0.93 / 0.93 vs the inherited start.

6. **Recursive visual degradation?**  
   Yes, especially at C (black) and E (soft, no new volume).

7. **Motion blur accumulate?**  
   Present after A→B; not a strict monotonic stack, but video endpoints never recover still-like acuity.

8. **Architectural / semantic drift?**  
   Yes: skipped stairwell; C is a void; rails early; no station.

9. **Problems from skipping Camotion?**  
   Not at launch. The risk showed up as **state** (dark C), not as a snapped start.

10. **Any leg fail to progress for lack of an end image?**  
    D→E. It continues the brick tunnel instead of emerging into E.

11. **Does the flat concat feel like one journey?**  
    As a *cut* film, yes — you do not feel canonical resets. As *The Long Way Down*, it is an incomplete descent that dies in the tunnel.

12. **Next experiment: inheritance ± Camotion on each inherited start?**  
    **Yes.** Boundary inheritance is already proven without Camotion. The open question is whether a light, non-rewriting start prep (or a brightness/detail restore that is still not Camotion) would keep C from collapsing and help E actually open — without destroying the 0.93 seams. Do not put either path in production from this.

---

## Paths

Experiment root:

`docs/experiments/2026-09-22-recursive-endpoint-inheritance/TheLongWayDown/`

Final movie:

`docs/experiments/2026-09-22-recursive-endpoint-inheritance/TheLongWayDown/generated/experimental_A_B_C_D_E_endpoint_inheritance.mp4`

This report:

`docs/experiments/2026-09-22-recursive-endpoint-inheritance/TheLongWayDown/REPORT.md`

Also: `generated/{A-B,B-C,C-D,D-E}/*.mp4`, `*e_literal.png`, `*s_inherited.png`, `seam-{B,C,D}-{sheet,diff,clip}.*`, `contact-sheet-discovered-states.png`, `generated/metrics.json`.
