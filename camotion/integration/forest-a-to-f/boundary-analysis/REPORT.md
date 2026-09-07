# Forest A→F Seedance boundary analysis

Read-only forensic test of the five committed Seedance 2.5 clips. No new
generation. No trims. No replacement movie. Source shooting frames and
videos were not rewritten (SHA-256 checked against the files as analyzed).

TunnelVision is agentic filmmaking research extending filmmaker Terran
Boylan's original TunnelVision technique. This analysis, Camotion, and
the agentic pipeline are not Terran's code.

Reproduce:

```bash
camotion/.venv/bin/python camotion/integration/forest-a-to-f/boundary-analysis/analyze_boundaries.py
```

Sequential full-stream RGB decode via ffmpeg (no timestamp seek).
Numbers: `metrics.json`. Contact sheets: `contact-sheets/`.

## Method

Pixel identity is only claimed when dimensions match. They never do:
shooting frames are `A′` 1000×558 and `B′`–`F′` 1392×752; videos are
A–B 1284×716 and later legs 1306×706, all `yuv420p`.

Content comparison fits each shooting still onto that clip's decoded
canvas three documented ways (LANCZOS). Primary tables use **contain**
(aspect-preserving scale-to-fit, center pad black). **Cover** and
**stretch** are reported so a closer accidental crop/stretch is not
hidden.

- A–B start (`A′` 1000×558 → 1284×716): contain scale 1.283154, resized
  1283×716, **1 px right pad**. Cover/stretch are nearly identical to
  each other (independent-axis scales 1.284 × 1.283154).
- A–B end (`B′` 1392×752 → 1284×716): contain scale 0.922414, resized
  1284×694, **22 px vertical letterbox**. Stretch uses scale_x 0.922414
  × scale_y 0.952128 (fills the A-aspect canvas).
- B–C through E–F (`1392×752` → `1306×706`): contain scale 0.938218,
  resized 1306×706, **pad 0×0**. Contain ≈ stretch.

A yuv420p round-trip of the fitted still (no H.264) is the
chroma-subsample floor: MAE ≈ **1.37–1.53**.

MAE/RMSE/max-abs are 8-bit RGB. PSNR uses 255/RMSE. SSIM is mean 8×8
block SSIM over RGB channels (numpy only).

---

## VIDEO STRUCTURE

All five clips are the same temporal object.

| | |
| --- | --- |
| codec | H.264 `yuv420p` |
| size | A–B 1284×716; B–C…E–F 1306×706 |
| `r_frame_rate` / `avg_frame_rate` | 24/1 |
| time base | 1/12288 |
| decoded frames | **145** (indexes 0…144) |
| first PTS | 0.000 s |
| last PTS | 6.000 s |
| container duration | 6.041667 s |
| 145 / 24 | **6.041667 s** |

Container duration = frame_count / fps. Last PTS + one frame
(1/24 s) = container duration. Residual vs implied duration is
3.3×10⁻⁷ s (float).

Requested duration was 6 s. 145 timestamps from 0.000 through 6.000
inclusive at 24 fps is an ordinary inclusive-endpoint / off-by-one
pattern (144 frames would last-PTS 5.958 s and display-duration 6.000 s).
Inserting both `A′` and `B′` as *extra* frames would be +2 (146), not
+1. **Duration is not evidence of endpoint insertion.**

---

## START ENDPOINT RESULTS

Frame 0 vs supplied start, contain (cover/stretch in parentheses when
they differ).

| Leg | native identity | contain MAE | SSIM | vs yuv420-fitted MAE | uniquely closest | opening hold |
| --- | --- | --- | --- | --- | --- | --- |
| A→B vs `A′` | impossible (1000×558 vs 1284×716) | 3.180 | 0.942 | 2.119 | frame 0 | **no** |
| B→C vs `B′` | impossible | 2.080 | 0.965 | 1.465 | frame 0 | **no** |
| C→D vs `C′` | impossible | 3.779 | 0.894 | 2.794 | frame 0 | **no** |
| D→E vs `D′` | impossible | 2.427 | 0.962 | 1.863 | frame 0 | **no** |
| E→F vs `E′` | impossible | 2.128 | 0.980 | 1.358 | frame 0 | **no** |

Exact RGB equality: never. After contain, B–C / E–F start vs
yuv420-fitted MAE (1.36–1.47) sits on the chroma floor (~1.42).
Remaining gap is H.264 plus possible resample-kernel mismatch, not a
different picture.

No opening hold: frame 0 is the unique MAE minimum (15% band contains
only index 0). Consecutive MAE frame 0→1 is **6.7–11.9**. Frame 9 is
already MAE 19–43 from the start still. Motion starts immediately.

C→D is the weakest start match (SSIM 0.894) but frame 0 is still
uniquely closest to `C′`. The earlier qualitative “C′ is not held”
is the *subsequent pull*, not a missing `C′` at index 0.

---

## END ENDPOINT RESULTS

Final decoded frame (144) vs supplied end.

| Leg | contain MAE | stretch MAE | SSIM contain | uniquely closest | terminal hold |
| --- | --- | --- | --- | --- | --- |
| A→B vs `B′` | 6.246 | **2.564** | 0.787 / 0.946 stretch | frame 144 | **no** |
| B→C vs `C′` | 3.205 | 3.205 | 0.908 | frame 144 | **no** |
| C→D vs `D′` | 2.537 | 2.537 | 0.950 | frame 144 | **no** |
| D→E vs `E′` | 2.091 | 2.091 | 0.976 | frame 144 | **no** |
| E→F vs `F′` | 2.208 | 2.208 | 0.970 | frame 144 | **no** (quiet last step only) |

A→B end is the aspect-mismatch case: letterboxing `B′` into the
A-aspect canvas (22 px pad) is the wrong model. Stretch-to-fill MAE
2.564 / SSIM 0.946 matches the other legs. Seedance filled the A–B
canvas; it did not letterbox `B′`.

Approach, not freeze: MAE to the end still falls across the last 10
frames, with the **largest single improvement on the last step**
(e.g. B→C 9.93 → 3.21; C→D 9.48 → 2.54; A→B contain 11.67 → 6.25).
That is last-frame attraction, not a run of duplicate endpoint frames.

E→F last consecutive MAE is ~1.9–2.7 (quieter warp), including one
step &lt; 2.0. That is not a multi-frame freeze on `F′`. Frame 144
remains uniquely closest.

---

## SHARED BOUNDARIES

Contain vs exact shooting still unless noted. Same-shape MAE is
previous-final vs next-first at native pixels.

| Seam | prev final → still | still → next first | prev final → next first |
| --- | --- | --- | --- |
| **B** A–B 1284×716 vs B–C 1306×706 vs `B′` 1392×752 | contain 6.246 / **stretch 2.564** | contain 2.080 | different raster; stretch-fit prev→next **1.843** SSIM 0.957 |
| **C** | 3.205 | 3.779 | **2.585** SSIM 0.945 (same 1306×706) |
| **D** | 2.537 | 2.427 | **2.095** SSIM 0.958 |
| **E** | 2.091 | 2.128 | **1.221** SSIM 0.977 |

Seams look good because **both clips independently reconstruct the
same conditioned still** after rescale + `yuv420p` encode, not because
Seedance pasted one identical RGB frame into both files.

On C/D/E, previous-final vs next-first is *slightly closer* than
either is to the PNG. Adjacent compressed reconstructions share look
more than either shares with the lossless shooting still.

Seam B cannot be pixel-identical even with perfect endpoints: the two
clips have different sizes because A–B followed `A′`'s aspect and
later clips followed 1392×752.

---

## DURATION FINDING

**~6.04 s is ordinary 145-frame / 24 fps container math.** It matches
frame_count/fps and last-PTS + 1/24. It does not support endpoint
insertion as the duration cause.

---

## ENDPOINT INSERTION FINDING

Seedance does **not** literally insert the supplied PNG as RGB pixels.

It **rescales** the conditioned still into the adaptive 720p raster
(aspect follows the start image on A–B; later legs follow `B′`–`F′`
1.851), **4:2:0 encodes** it, and the decoded first/last frames are
**high-fidelity reconstructions** of that still (start MAE ~2–4 after
contain; often near the chroma floor after a yuv420 round-trip).

Then the clip **immediately leaves** the start still and **approaches**
the end still, with extra last-frame attraction. That is
**approximate / re-encoded endpoint conditioning**, not a loose
“generate toward a mood” at the actual boundary indexes, and not a
paste of the original PNG.

---

## FINISHING HYPOTHESIS

`A′ | generated interior | B′` as pixel-identical bookends:

Would it improve boundary fidelity? **Yes, on a common output raster.**
Decoded boundaries are already close but never exact, and adjacent
clips are not the same size on seam B. Bookending the *same* resized
`B′` on both sides of a shared canvas is the only way to get
byte-identical seams.

Would it risk a pause/stutter? **A long freeze is not required by
this evidence.** There is no multi-frame endpoint hold to strip.

- Opening: replace **one** frame (index 0). Do not also delete frames
  1–9; those already move (consecutive MAE ~7–12). Replacing 0 with
  exact `A′` then playing generated 1 is a similar-sized step to
  current 0→1.
- Ending: replace **one** frame (index 144). The last generated step
  already snaps toward the still (consecutive MAE ~5–12 except quieter
  E→F). Exact `B′` vs frame 143 may be a similar or slightly larger
  snap, plus a sharpness pop (lossless still vs H.264 neighbor).
- Removing several near-static frames first is **not** supported here.

Pixel-identical movie seams also require resampling every clip to one
canvas. Inserting `B′` at two different output sizes would not make
A–B/B–C identical.

No trim algorithm is prescribed. No replacement movie was made.

---

## FILES CREATED

```
camotion/integration/forest-a-to-f/boundary-analysis/
  analyze_boundaries.py
  metrics.json
  REPORT.md
  contact-sheets/{A-B,B-C,C-D,D-E,E-F}-{start,end}.png
  contact-sheets/seam-{B,C,D,E}.png
  frames/<leg>/{start,end}/*.png     # decoded windows only
  fitted-references/*.png            # documented contain/cover/stretch refs
```

Existing `REPORT.md`, videos, shooting frames, and the review movie
were not modified.
