# Smart pre-lock trim — TheLongWayDown

Project: `projects/TheLongWayDown`
Production: unchanged.
Kling generations this run: **0**

The takes are the app-generated originals. They live under gitignored `projects/TheLongWayDown/traversals/{A-B,B-C,C-D,D-E}/take-01.mp4`. Each take used `videoInputs.startShootingFrame` + `endShootingFrame` on `kwaivgi/kling-v2.5-turbo-pro`. That is the original Camotion architecture, not hybrid inheritance.

## What this is

```
A′ → Be*  |  B′ → Ce*  |  C′ → De*  |  D′ → Ee*
```

`Be*` is an edit point only. It is not used to generate the next clip. The next clip is the existing B′→C′ take, unchanged.

No Camotion scaling. No endpoint inheritance. No blending.

## Terminal behavior (not a freeze)

These original clips do **not** pose-lock the way the hybrid/adaptive pristine-B clips did.

Pair-MAE stays high through the last second. What happens instead is a **3–5 frame snap onto B′/C′/D′/E′**:

| clip | dest-SSIM @ 9.75 s | @ selected | @ last frame |
|---|---|---|---|
| A′→B′ | 0.28 | 0.33 | **0.99** |
| B′→C′ | 0.20 | 0.28 | **1.00** |
| C′→D′ | 0.25 | 0.32 | **1.00** |
| D′→E′ | 0.16 | 0.25 | **0.99** |

The last decoded frame is essentially the Camotion still. The three frames before that morph into it. That morph is the "ease/pose" in this architecture.

## Selections

Rule: latest frame that is already at the destination, immediately **before** dest-SSIM jumps ≥ 0.05 toward lock in the final second.

| | frame | t | frames before last | seconds before last | pair-MAE at cut | dest-SSIM at cut |
|---|---|---|---|---|---|---|
| **Be*** | 238 | 9.92 s | **3** | **0.125 s** | 13.6 | 0.332 |
| **Ce*** | 238 | 9.92 s | **3** | **0.125 s** | 14.1 | 0.284 |
| **De*** | 237 | 9.88 s | **4** | **0.167 s** | 12.1 | 0.324 |
| **Ee*** | 238 | 9.92 s | **3** | **0.125 s** | 16.9 | 0.249 |

Full generated duration is 10.08 s / 242 frames on every take.

Compared with the previous pristine-canonical adaptive cuts (Be* 25 frames / 1.08 s early, Ce* 31 frames / 1.33 s early): these smart cuts are an order of magnitude closer to the literal endpoint.

Motion is still alive at every selected frame. Incoming last-1s pair-MAE: B 9.9, C 12.8, D 9.5.

## Hard-cut stills

The movie cut is the selected frame versus the **first decoded frame of the next original take** (not the Camotion PNG; Kling remaps that).

| cut | Be*/Ce*/De* ↔ next first frame | literal last ↔ next first frame |
|---|---|---|
| B | SSIM **0.491** MAE 21.8 | SSIM **0.957** MAE 2.0 |
| C | SSIM **0.472** MAE 25.3 | SSIM **0.917** MAE 3.3 |
| D | SSIM **0.507** MAE 26.8 | SSIM **0.952** MAE 2.5 |

Untrimmed original already has excellent **static** seams, because both sides have snapped to B′. Smart trim pays a spatial step: the camera is 3–4 frames earlier (more stair, larger plastic sheet) when B′ begins.

SSIM vs the Camotion PNG itself is not a fair movie metric. Those stills are 1376×768 with radial blur; the video is 1928×1072 and sharp until the snap.

## Playback

Normal speed on:

- `generated/experimental_Aprime_Bprime_smart_trim.mp4`
- `generated/original_untrimmed_Aprime_to_Eprime.mp4`
- `generated/clips/compare-smart-trim-{B,C,D}.mp4`
- `generated/clips/compare-C-original-smart-hybrid-adaptive.mp4`

The original Camotion movie already travels. The last three frames of each clip are a visible settle/morph onto the still, then the next clip starts already in motion.

Smart trim removes that morph. The camera is still moving at the cut. The next B′→C′ / C′→D′ take still feels like the same journey — because it *is* the same independently generated Camotion take.

The cost is a small **spatial hitch**: a few frames of forward jump plus the Camotion smear on the outgoing start. At 24 fps it is shorter than the hybrid/adaptive stop-restart. It is not invisible, especially at C (plastic sheet changes scale).

Versus hybrid inheritance and adaptive+Camotion: this simple edit is **more continuous**. Those later experiments were solving a problem created by replacing B′ with pristine B and then inheriting a rendered still. The original architecture did not need that.

## Answers

1. **Were existing A′→B′ / B′→C′ / C′→D′ / D′→E′ generations available?** Yes. App takes in `projects/TheLongWayDown/traversals/*/take-01.mp4`.

2. **How many new Kling generations were required?** **Zero.**

3. **Where were Be*, Ce*, De*, Ee* selected?** Frames 238 / 238 / 237 / 238 (9.92 / 9.92 / 9.88 / 9.92 s).

4. **How many frames / seconds before the literal endpoint?** 3 / 3 / 4 / 3 frames. **0.125 / 0.125 / 0.167 / 0.125 s.**

5. **Were these substantially closer to the literal endpoint than the previous pristine-canonical adaptive cuts?** Yes. Adaptive removed 1.1–1.3 s. This removes ~0.13 s.

6. **At each selected frame, was meaningful motion still alive?** Yes. Last-1s pair-MAE 9.5–12.8. No freeze.

7. **How closely did Be* match B′, Ce* match C′, De* match D′?** Spatially the destination is established (same room, same heading). Pixel match to the Camotion PNG is modest because of blur/resolution. Dest-SSIM on the motion curve: 0.33 / 0.28 / 0.32.

8. **How large is the hard-cut visual discontinuity?** Rendered-seam SSIM 0.49 / 0.47 / 0.51. Visible as a small forward step. Untrimmed literal seams are 0.92–0.96.

9. **Does the terminal ease/pose visibly disappear from the edited movie?** The 3-frame snap is gone. There was no long pose-lock to remove.

10. **Does the next traversal feel like continuation rather than a new launch?** Yes, more than hybrid/adaptive. It is the original B′→C′ take. There is still a Camotion smear on the outgoing start.

11. **Which seam is best?** B and D. Geometry is close; heading holds.

12. **Which seam remains most noticeable?** **C.** Plastic sheet scale jumps between Ce* and C′.

13. **At normal playback speed, is this SIMPLE SMART-TRIM version more continuous than the recent adaptive/inherited-state experiments?** **Yes.** Those movies stop/restart or lunge. This one is the original traveling camera with a short hitch.

14. **Does the evidence support the simple production architecture?** **Yes, as a first editor.** Pristine canonicals → Camotion A′/B′/C′ → Kling A′→B′ → detect pre-lock Be* → trim → hard cut to existing B′→C′. It does not need inheritance to look like one camera. It does need the 3–4 frame snap removed, and C still shows a spatial step.

15. **Was the original "Be − 1" intuition basically correct?** **Yes.** Not literally one frame. On these four takes it is **3–4 frames / ~0.13 s** before the dest-SSIM snap. A fixed −1 would leave part of the morph. A fixed −1 s would cut too early. A variable pre-lock offset from known B′ + local dest-SSIM is enough.

## Automation

On this project the signal is deterministic:

1. Known target = B′ (the end shooting frame).
2. dest-SSIM stays ~0.1–0.3 until the last ~0.25 s, then jumps to ~1.0 in 3–5 frames.
3. Discard the snap. Take the latest prior frame.

That is a pre-lock editor, not an inheritance system. Do not build it in production from this one journey. The four legs here all behaved the same way.

## Artifacts

- `refs/*-take-01.mp4` — hardlinks to the app takes
- `stills/{A,B,C,D,E}-prime.png` and `*-prime-next.png`
- `generated/experimental_Aprime_Bprime_smart_trim.mp4`
- `generated/original_untrimmed_Aprime_to_Eprime.mp4`
- `generated/clips/compare-smart-trim-{B,C,D}.mp4`
- `generated/clips/compare-C-original-smart-hybrid-adaptive.mp4`
- `curves/`
- `generated/metrics.json`
