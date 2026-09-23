# C-seam geometric registration — TheLongWayDown

Offline diagnostic. Production unchanged. Kling 0. Camotion 0. Smart-prelock baseline not altered.

## Verdict

**The scale/missing-travel hypothesis is geometrically true for the rigid scene, and insufficient as an explanation of the visible C hitch.**

Cs_rendered is about **3.6% closer** than Ce*. That matches the discarded B′→C′ tail (Ce*+3 / lock = 3.8%). The outgoing C′→D′ start is sitting on the **incoming terminal lock**, not on Ce*.

Registering that away with uniform scale + translation:

- lines up beams / lights / atrium
- does **not** line up the plastic sheet
- lifts seam SSIM only **0.472 → 0.509** (literal lock seam was 0.917)
- paints black borders around a 4–5% digital zoom-out

The hitch is a **mixture**: missing ~125 ms of forward travel **plus** an independent plastic-sheet / foreground reset between two Kling takes. Simple geometric compensation does not hide it. Decay was not run. Keep the smart-prelock hard cut.

## 1. Exact frames that touch

Movie concat is `B-C-to-star.mp4` (239 frames, last = index 238) then `C-D-to-star.mp4` (first = index 0).

| side | name | source | index | t |
|---|---|---|---|---|
| incoming last kept | **Ce*** | `projects/.../B-C/take-01.mp4` | **238** | 9.917 s |
| outgoing first rendered | **Cs_rendered** | `projects/.../C-D/take-01.mp4` | **0** | 0.000 s |

SHA-256 of `Ce_star.png` / `C-D/first.png` matches frames extracted from the project takes. Those takes are hardlinked into the smart-prelock folder.

The Camotion still C′ is **not** the movie seam. Cs_rendered vs resized C′ is already SSIM 0.905 / MAE 4.4. Literal B-C frame 241 vs Cs_rendered is SSIM **0.917** / MAE 3.3. Ce* vs Cs_rendered is SSIM **0.472** / MAE 25.3.

## 2. Is Cs_rendered larger / closer than Ce*?

**Yes**, for the rigid scene. Architecture RANSAC (ORB + scale/translation, left plastic masked):

```
scale: 0.964
dx:    +33.7 px   (origin-based)
dy:    +27.8 px
inliers: 399 / 668  (60%)
inlier RMSE: 1.75 px
```

Warping Cs toward Ce* with scale 0.964 means Cs is **3.6% larger**. Center-based residual after removing pivot compensation:

```
dx_c: -0.9 px  (−0.05% of width)
dy_c: +8.5 px  (+0.79% of height)
```

So this is almost a **center zoom**, not a pan.

A pixel-MAE refine drifted to scale 0.954 / +42 / +34. That extra 1% is border/plastic leakage. The RANSAC model is the defensible one.

## 3. Scale-only

Forced zoom about frame center (no translation) **failed**:

```
scale: 1.009
inliers: 14%
SSIM: 0.472 → 0.475
```

Using the joint scale 0.964 as a pure center zoom made SSIM **worse** (0.449) because of the leftover +8.5 px vertical and the black borders.

Scale-only is not enough even though the residual translation is small.

## 4. Scale + X/Y

Best-fit (architecture RANSAC):

```
scale: 0.964
dx:    +33.7 px   →  +1.7% of width   (origin-based)
dy:    +27.8 px   →  +2.6% of height
center-based: dx_c −0.9 px, dy_c +8.5 px
```

Refined (masked MAE, less trusted):

```
scale: 0.954
dx:    +41.7 px
dy:    +33.8 px
```

## 5. Does registration improve correspondence?

| pair | SSIM | MAE | PSNR | hist-corr |
|---|---|---|---|---|
| Ce* vs Cs (control) | **0.472** | 25.3 | 16.9 | 0.978 |
| Ce* vs scale-only | 0.475 | 25.3 | 16.9 | 0.917 |
| Ce* vs scale+xy | **0.509** | 23.2 | 17.1 | 0.445 |
| literal 241 vs Cs | **0.917** | 3.3 | 33.9 | 0.999 |

Feature quality is good (60% inliers, ~1.8 px). Pixel improvement is **small**. Histogram correlation collapses because of the black zoom-out border.

Difference images: beams/lights/rail go quiet after warp. The left plastic sheet stays loud.

## 6–8. Missing forward travel?

Discarded B′→C′ frames, each registered **onto Ce*** (architecture mask):

| frame | dest-SSIM (existing curve) | scale onto Ce* | meaning |
|---|---|---|---|
| 238 Ce* | 0.284 | 1.000 | reference |
| 239 | 0.345 | 0.984 | 1.6% closer |
| 240 | 0.471 | 0.976 | 2.4% closer |
| 241 lock | **0.996** | 0.962 | 3.8% closer |
| Cs_rendered | — | **0.964** | 3.6% closer |

Cs_rendered lands on the **incoming lock**, not on Ce*. The ~3 missing frames do contain real forward scale. They also contain the dest-SSIM snap (0.28 → 1.00, mostly 240→241).

**Mixture:** progressive forward scale in 238–240, then abrupt target-lock at 241. The outgoing take starts at that lock.

## 9–13. Static correction and decay

Static scale+xy on the whole outgoing C′→D′ section **does not make the cut clean**.

- Architecture hitch shrinks.
- Plastic sheet still pops.
- ~4% black border / digital zoom-out on every outgoing frame.

That is a worse movie than the hard cut.

Decay over 3/5/8 frames was **not run**. Phase 5 did not show a material perceptual win (SSIM +0.036, visible zoom, plastic still wrong). A 3.6% linear zoom-in over 3–8 frames would be a digital push — the failure mode this test is supposed to avoid.

Smart-prelock’s continuous-motion advantage is preserved by **leaving the cut alone**.

## 14. Is the hitch primarily missing 125 ms of forward travel?

**No, not primarily.**

It is **partly** that: the rigid camera step Ce* → lock is real and matches Cs_rendered.

It is **not mainly** that: the thing you notice at C is the plastic sheet, and that sheet is not a uniform scale of Ce*. Two Kling takes simulated it differently. Scale + translation cannot fix it.

Do not add transient geometric compensation. Keep:

```
Camotion A′→B′ → Kling → detect lock → trim 3–4 frames → hard concat
```

## Artifacts

Scripts: `analyze.py` (experiment-local venv with OpenCV; gitignored).

Videos (normal speed):

- `generated/clips/control-C-seam.mp4`
- `generated/clips/static-scale-only.mp4`
- `generated/clips/static-scale-trans.mp4`
- `generated/clips/compare-control-vs-scale-trans.mp4`
- `generated/clips/compare-sequential-normal.mp4`

Stills: `generated/diagnostics/` (side-by-side, 50% overlay, diff, flicker, cut frames).

Metrics: `generated/metrics.json`.

## Disk

| | size |
|---|---|
| experiment artifacts | **83 MB** |
| local `.venv` (do not commit) | 181 MB |
| total folder | 263 MB |

No production files, no smart-prelock files, and no project takes were modified.
