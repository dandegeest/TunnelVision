# Endpoint inheritance — First Tracks: The Descent B→C→D

**Date:** 22 September 2026  
**Kind:** Offline generation experiment. Production pipeline not modified.  
**Phase 2 (Kling 3 / 1080p):** not run. Kling 2.5 already met the stop condition.

---

## Selected project / section

| | |
| --- | --- |
| Project | `projects/FirstTracksTheDescent2` (`tv-6101816850a06efd`) |
| Section | **B→C→D** |
| Why | Newest completed multi-leg journey. B is an aerial ski; C is a rock-chute choke; D is a pine forest. Existing B→C and C→D takes, prompts, B, D, and D′ are all on disk. |
| Grammar | POV, fast |
| Original video model | `prunaai/p-video` (not overwritten) |
| Experimental model | `kwaivgi/kling-v2.5-turbo-pro` for **both** legs |

Prompts reused verbatim from `traversals/B-C` and `traversals/C-D` `effectivePrompt` (segment addition + the product locomotion wrapper). No new traversal language.

Start of experimental B→C: lanczos 1280×720 of **canonical B** (`canonicals/B/take-01.png`). Production had used Camotion B′; this experiment follows the brief (supply B, do not supply C).

End of experimental C→D: lanczos 1920×1080 of the **existing C→D end shooting frame D′** — the same last-frame conditioning the product used.

---

## Resolution note

The brief asked for Kling 2.5 **720p**. The TunnelVision Kling 2.5 adapter has no resolution field (`prompt`, `start_image`, optional `end_image`, `duration` 5|10 only). Replicate returned **1920×1080** for both clips. Both experimental legs are therefore the same model and the same native 1080p. We did not mix resolutions and we did not downscale the movies to fake 720p.

---

## Generation

| Leg | End image | Requested | Output | Wall | Predict | Prediction | Retries |
| --- | --- | --- | --- | ---: | ---: | --- | --- |
| B→C | **none** | 5 s | 1920×1080, 121 frames, 5.04 s | 134 s | 130 s | `f9s0z5myd1rmy0d0saeta4f520` | 0 |
| C→D | D′ 1080p | 5 s | 1920×1080, 122 frames, 5.08 s | 136 s | 132 s | `t1w21n5121rmt0d0sag9p47ek8` | 0 |

Audio off. No failures.

---

## Ce extraction

Sequential ffmpeg `rgb24` decode. No `-ss` seek.

- `Ce_literal` = last decoded frame, index **120**, t = 5.00 s @ 24 fps, 1920×1080.
- Last-8-frame window inspected. Luma falls as the camera enters the shadowed chute. Frame-to-frame MAE at the end (17.75) is *lower* than the previous steps.
- **`Ce_selected` = `Ce_literal`.** The darkening is the arrived-at C, not a glitch. Did not walk backward for a prettier frame.

`Cs` = ffmpeg lanczos onto 1920×1080 (already native). **Ce ≡ Cs** (exact pixel identity). No generative restore.

---

## The frames that physically touch

| Comparison | SSIM | PSNR | MAE | RMSE | NCC32 | HCorr |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| **Ce ↔ Cs_rendered** (experimental cut) | **0.963** | **38.86** | **2.06** | **2.91** | **0.9996** | **0.997** |
| Cs ↔ Cs_rendered | 0.963 | 38.86 | 2.06 | 2.91 | 0.9996 | 0.997 |
| Ce ↔ Cs | 1.000 | ∞ | 0 | 0 | 1.000 | 1.000 |
| **Original B→C last ↔ C→D first** | 0.787 | 22.15 | 13.17 | 19.91 | 0.990 | 0.522 |

Kling 2.5 honored the inherited start still. The two concat-join frames (`concat-join/join-003.png` and `join-004.png`) are the same chute, same skier station, same keyhole of light. Difference map is near-black.

The original product cut snaps: brighter open chute vs darker tighter chute, backpack/kit shift, color reset. Histogram correlation 0.52 vs 0.997 on the experiment.

---

## Did C→D still reach D?

Yes. Last frame of experimental C→D is a high-speed forest corridor with the same orange/blue skier between two snow-loaded trunks — the D beat. More motion-blurred than the pristine D still, but the destination is the forest, not a stuck chute.

---

## Success gate (Kling 2.5)

| Criterion | Result |
| --- | --- |
| Ce and Cs_rendered visually very close | Yes |
| No major geometry / composition snap | Yes |
| Persistent subject aligned | Yes |
| Hard cut hard to notice on the touching frames | Yes |
| C→D launches from inherited endpoint | Yes |
| C→D progresses toward D | Yes |
| Restore/upscale does not reinterpret | Yes (identity) |
| Quality acceptable | Yes (native 1080p) |
| Clearly at least as good as the original boundary | Yes, clearly better |

**Stop. Do not run Kling 3.**

---

## Answers

1. **Can B→C generate a useful C without canonical C as an end image?**  
   Yes. From B + the existing B→C prompt only, Kling 2.5 entered a rock corridor with a bright exit — a usable discovered C, not a morph back to the open alpine.

2. **Is that endpoint stable enough to start C→D?**  
   Yes. The last frames are the same space, continuously advancing. The literal last frame was kept.

3. **Can Ce become Cs without changing geometry/content?**  
   Yes. Lanczos onto the native 1920×1080 canvas was a no-op.

4. **How closely does C→D’s first rendered frame keep Cs?**  
   SSIM 0.963, MAE 2.1, NCC 0.9996. The model did not reinvent the start.

5. **How close are the two frames that touch?**  
   Same as (4). That *is* Ce ↔ Cs_rendered.

6. **Does inheritance make the hard cut less visible than TunnelVision’s current C?**  
   Yes. Original last/first SSIM 0.79 / MAE 13 / histogram 0.52 vs experimental 0.96 / 2.1 / 0.997. The original cut feels like a canonical reset; the experimental cut does not.

7. **Does C→D still reach D from the inherited C?**  
   Yes.

8. **Could blur / drift accumulate if this were recursive?**  
   The C seam itself is clean. The *end* of C→D is already a smeared forest plate. Handing that D forward as the next start would likely stack motion blur. That is the risk for A→B→C→D→E, not a failure of this C cut.

9. **Is Kling 2.5 already sufficient?**  
   **Yes. Stop.**

10. **Kling 3?**  
    Not tested. Not needed for this continuity question.

11. **Promising enough for a later short recursive test?**  
    Yes, as a *later* offline test only. This C inheritance worked. Recursion should watch blur at each extracted end, not just the first seam. Do not implement that in production from this result.

---

## Artifact index

```
docs/experiments/2026-09-22-endpoint-inheritance/
  generate.ts
  FirstTracksTheDescent2/
    REPORT.md
    prompts/B-C-effective.txt
    prompts/C-D-effective.txt
    stills/B-720p.png
    stills/B-pristine.png
    stills/C-pristine.png          # reference only; not sent as an end image
    stills/D-prime.png
    stills/D-prime-1080p.png
    generated/kling25-720p/
      B-C.mp4
      C-D.mp4
      B-C-generation.json
      C-D-generation.json
      Ce_literal.png
      Ce_selected.png
      Ce-selection.json
      Cs.png
      Cs_rendered.png
      C-D-last.png
      Ce-vs-Cs_rendered-diff.png
      contact-sheet.png
      boundary-sheet.png
      original-boundary-sheet.png
      original-B-C-last.png
      original-C-D-first.png
      original-seam-diff.png
      experimental_B_C_D_flat_concat.mp4
      experimental_seam_clip.mp4
      original_seam_clip.mp4
      metrics.json
      concat-join/                 # frames around the actual movie cut
```

Production project files were not rewritten.
