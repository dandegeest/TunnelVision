# CAMOTION INTEGRATION TEST 01 — THE WARDROBE LOOP

Unattended end-to-end run of the current TunnelVision filmmaking path:

story → independent text-to-image canonicals → Cinematographer CameraMotionPlans → Camotion 01.8 shooting frames → Seedance 2.5 videos.

This is **not** Camotion experiment 01.13. The renderer, CameraMotionPlan v1, and exposure operator were not changed. Poor aesthetic results were not regenerated.

A manually concatenated, unedited final movie now exists as the
canonical human-reviewed assembled artifact:

`camotion/integration/wardrobe-loop-01/videos/ThoughTheWardrobe.mov`

Preserve the MOV. A browser MP4 derivative was remuxed from it for the
research site (`ThoughTheWardrobe.mp4`: H.264 bitstream copied, PCM
audio omitted because the source shots were generated silent).
Deterministic pipeline concat is an implementation follow-up, not part
of this run.

## 1. Implementation changes

Reusable product infrastructure (not throwaway scaffolding):

- `MediaProvider.generateImage` plus a FLUX 1.1 Pro Ultra adapter inside `ReplicateMediaProvider`. No `image_prompt` / reference chain.
- A small `ReasoningProvider` with vision image inputs. First adapter: Gemini 3.1 Pro on Replicate (`thinking_level=high`), matching the existing Ghost Library cinematographer fixture ranking.
- Cinematographer pair planner: inspects actual start/end stills, emits shot-specific CameraMotionPlan v1 JSON. Geometry comes from the model. `camera.forward=1.0` and 01.8 exposure `strength=0.08` / `samples=16` are pinned to the current directed-traversal baseline.
- Integration runner: `npm --prefix media run wardrobe-loop -- --execute`
- Existing 01.8 route-preserved renderer invoked as-is (`render_banded.py --route-preservation`). Local Depth Anything V2 Small near-weights, same as the Ghost Library 01.8 path.
- Focused tests for image mapping, cinematographer JSON extraction, F==A copy, and generated artifacts.

Not changed: CameraMotionPlan v1, default `render()`, 01.8 compositor, exposure operator, Seedance known-good settings.

## 2. Image provider / model

- Provider: Replicate
- Model: `black-forest-labs/flux-1.1-pro-ultra`
- Settings: `aspect_ratio=16:9`, `raw=false`, `output_format=png`, `safety_tolerance=2`
- No input image. No `image_prompt`.
- Actual outputs: 2752×1536 PNG (16:9)

## 3. Canonical A–E

All generated independently from text. First technical success kept.

| ID | Path | Seed | Size | SHA-256 | Prediction |
| --- | --- | --- | --- | --- | --- |
| A | `camotion/integration/wardrobe-loop-01/canonical/A.png` | 10101 | 2752×1536 | `d71319696162eab7e9c2dbe3c2f7037fd21bcb2aea877a98d8a223ce1e7b6820` | `pryb30n3hnrmw0d0dtfbfrs650` |
| B | `camotion/integration/wardrobe-loop-01/canonical/B.png` | 10102 | 2752×1536 | `26cfa5ba61c7ff154666f1a2387c7007e32083cb8c8d732dc9538410589e93c9` | `gfeaffphmdrmw0d0dtfbsa3bv4` |
| C | `camotion/integration/wardrobe-loop-01/canonical/C.png` | 10103 | 2752×1536 | `9767bfa9c82f61c3d2e3f1e74b0dd6ecafa27416435003be62046c0dd3f79b08` | `6fsag5ztgdrmt0d0dtfa601414` |
| D | `camotion/integration/wardrobe-loop-01/canonical/D.png` | 10104 | 2752×1536 | `cf60b53ea5a1965ff266abad157ccd154cd41f0f0313188b99f770be5333492a` | `1m9vk098phrmy0d0dtfrbtz2a4` |
| E | `camotion/integration/wardrobe-loop-01/canonical/E.png` | 10105 | 2752×1536 | `49154292cb2534ab333c2fb1ec6329ca8fa82855b8baca2b7078a4356e9357ff` | `7tevecjfq1rmy0d0dtfr00en1c` |

Observations on the kept first successes (not regenerated):

- A: attic bedroom, open wardrobe, walkable route, shared warm/cool lighting. Usable.
- B: wardrobe-passage into snowy forest. A **visible person** walks the path despite “no people.”
- C: moonlit forest with a stone arch and distant warm glow. Distinct from A/B.
- D: ruined hall with a **stairway ascending toward a glowing portal**, not the requested descending underground stair.
- E: cavern with a freestanding wooden door and amber edge light. Distinct from D.

## 4. F == A

Confirmed.

- `canonical/F.png` is a byte-for-byte copy of `canonical/A.png`
- SHA-256 of both: `d71319696162eab7e9c2dbe3c2f7037fd21bcb2aea877a98d8a223ce1e7b6820`
- Manifest records `f_equals_a: true` and `F.equals = A`

## 5. Cinematographer CameraMotionPlans

Reasoning model: `google/gemini-3.1-pro` (vision). Plans are shot-specific and grounded in the **actual** stills, including D’s upward stair.

Official start plans (CameraMotionPlan v1, 01.8 exposure pinned):

**A→B** `plans/A-B.json`

```json
{
  "version": 1,
  "camera": { "vanishing_point": [0.515, 0.48], "forward": 1.0 },
  "destination": { "point": [0.515, 0.48], "protect": true, "bbox": [0.48, 0.16, 0.55, 0.8] },
  "exposure": { "strength": 0.08, "samples": 16 }
}
```

Route: forward across the bedroom through the open wardrobe.

**B→C** `plans/B-C.json`

```json
{
  "version": 1,
  "camera": { "vanishing_point": [0.51, 0.45], "forward": 1.0 },
  "destination": { "point": [0.51, 0.75], "protect": true, "bbox": [0.35, 0.15, 0.65, 0.85] },
  "exposure": { "strength": 0.08, "samples": 16 }
}
```

Route: forward through the root passage into the snowy forest.

**C→D** `plans/C-D.json`

```json
{
  "version": 1,
  "camera": { "vanishing_point": [0.5, 0.58], "forward": 1.0 },
  "destination": { "point": [0.5, 0.6], "protect": true, "bbox": [0.42, 0.35, 0.57, 0.7] },
  "exposure": { "strength": 0.08, "samples": 16 }
}
```

Route: along the snowy path through the stone arch.

**D→E** `plans/D-E.json`

```json
{
  "version": 1,
  "camera": { "vanishing_point": [0.51, 0.28], "forward": 1.0 },
  "destination": { "point": [0.51, 0.28], "protect": true, "bbox": [0.44, 0.15, 0.58, 0.42] },
  "exposure": { "strength": 0.08, "samples": 16 }
}
```

Route: **up** the actual generated stair toward the glowing arch (not the unused “descend” story assumption).

**E→A** `plans/E-A.json`

```json
{
  "version": 1,
  "camera": { "vanishing_point": [0.5, 0.5], "forward": 1.0 },
  "destination": { "point": [0.5, 0.5], "protect": true, "bbox": [0.45, 0.33, 0.55, 0.69] },
  "exposure": { "strength": 0.08, "samples": 16 }
}
```

Route: along the cavern path into the wooden door.

End-frame plans used only to condition B′ live beside each shot under `shooting/<shot>/end-plan.json`. Full Gemini JSON is in `shooting/<shot>/reasoning.json`. All five official plans pass `camotion.plan.load_plan`.

## 6. Camotion 01.8 shooting frames

Baseline: 01.8 route-preserved, outgoing orientation, adaptive exposure off. Depth: Depth Anything V2 Small near-weight.

| Shot | A′ start | B′ end |
| --- | --- | --- |
| A→B | `shooting/A-B/start.png` | `shooting/A-B/end.png` |
| B→C | `shooting/B-C/start.png` | `shooting/B-C/end.png` |
| C→D | `shooting/C-D/start.png` | `shooting/C-D/end.png` |
| D→E | `shooting/D-E/start.png` | `shooting/D-E/end.png` |
| E→A | `shooting/E-A/start.png` | `shooting/E-A/end.png` |

Pristine canonicals were not overwritten. Hashes are in `generation-manifest.json`.

## 7. Video prompts and settings

Model: `bytedance/seedance-2.5`

Identical settings on every shot (known-good 01.5/01.8 control):

- duration: 6
- resolution: 720p
- aspect_ratio: adaptive
- generate_audio: false
- watermark: false
- output_format: mp4
- seed: omitted
- start = Camotion A′, end = Camotion B′

Actual files resolved to ~1284×716 H.264, ~6.04s.

Prompts were used exactly as specified (A→B wardrobe walkthrough, B→C emerge into forest, C→D through the arch, D→E through ruins/stairs into cavern, E→A through the bedroom door). Full text is in `story.json` and the manifest.

## 8. Video paths

| Shot | Path | Prediction |
| --- | --- | --- |
| A→B | `camotion/integration/wardrobe-loop-01/videos/A-B.mp4` | `8yhmjab25srmy0d0dtgb6th32w` |
| B→C | `camotion/integration/wardrobe-loop-01/videos/B-C.mp4` | `tskqf07rqxrmw0d0dthra7dgm4` |
| C→D | `camotion/integration/wardrobe-loop-01/videos/C-D.mp4` | `fs4sprh3xdrmw0d0dtp9n8abkr` |
| D→E | `camotion/integration/wardrobe-loop-01/videos/D-E.mp4` | `fpgy4xqys1rmw0d0dtsvjy2yqr` |
| E→A | `camotion/integration/wardrobe-loop-01/videos/E-A.mp4` | `87hkxhvq99rmt0d0dtw8mxvyc0` |

Sampled preview stills: `evaluation/<shot>/frame-00.png` … `frame-04.png`.

## 9. Per-shot first-pass observations

Sampled from those preview stills. No regeneration.

**A→B**

1. Forward: yes — bedroom, into the wardrobe, through hanging clothes, out toward the snowy opening.
2. Endpoint: resembles B (forest opening framed by roots/clothes).
3. Traversal vs morph: mostly traversal; the mid-shot is a real dark clothes-tunnel, not a dissolve.
4. Parallax: some furniture/door-frame motion near the start; mid is too dark to read clearly.
5. Camotion artifacts: radial smear/copies visible on start and end frames.
6. Emergent detail: hanging garments and a dark passage the canonicals do not fully show.
7. Catastrophic failure: no. Note: the B figure appears at the end because it is in canonical B.

**B→C**

1. Forward: yes, down the snowy corridor.
2. Endpoint: resembles C (stone arch, distant warm window).
3. Traversal vs morph: continuous forest travel; the arch arrives as geography ahead rather than a hard cut.
4. Parallax: trees streak past; some of that is Camotion radial smear rather than natural parallax.
5. Camotion artifacts: strong; discrete copies remain visible in mid frames.
6. Emergent detail: the walking figure persists and the forest densifies.
7. Catastrophic failure: no.

**C→D**

1. Forward: yes, toward and through the arch.
2. Endpoint: resembles D (ruin stair hall, cyan portal, torches).
3. Traversal vs morph: early/mid still forest; D’s ruin hall is established late. Possible late environment replacement after the arch.
4. Parallax: trees/arch edges move; again mixed with radial exposure.
5. Camotion artifacts: strong on start and after the environment change.
6. Emergent detail: passing the archway.
7. Catastrophic failure: no, but D’s upward stair (not a descent) becomes the destination.

**D→E**

1. Forward: yes, up the generated stair toward the glow, then the cavern door.
2. Endpoint: resembles E (wooden door, orange rim light, bioluminescence).
3. Traversal vs morph: the glow-to-cavern change is a threshold invention; not a literal descent because D never depicted one.
4. Parallax: stair/rail motion; peripheral copies.
5. Camotion artifacts: clear bead/copy streaks on rails and periphery.
6. Emergent detail: approaching the cyan portal.
7. Catastrophic failure: no.

**E→A**

1. Forward: yes, along the path into a close door-threshold.
2. Endpoint: resembles A (attic bedroom / wardrobe).
3. Traversal vs morph: the camera crowds the glowing door, then the bedroom is present. Threshold crossing is compressed; not a clearly continuous walk-through of an opened door into room volume.
4. Parallax: cavern plants/water near the start; bedroom furniture smear at the end.
5. Camotion artifacts: visible on start and on the returned bedroom end frame.
6. Emergent detail: extreme door close-up with light leaking at the jambs.
7. Catastrophic failure: no. Loop closure to A is recognizable.

## 10. Overall integration-test observations

These are run observations, not new project conclusions.

The current stack **did** produce an unattended five-shot loop: five independent 16:9 canonicals, F identical to A, five validated shot-specific CameraMotionPlans, ten 01.8 shooting frames, and five Seedance clips with the frozen video settings.

The Cinematographer used vision on the real stills. It did not copy one plan onto every shot, and it followed D’s actual upward portal instead of the unused “descending stair” story text.

Independently generated canonicals are spatially related by story, not by pixel inheritance. Continuity therefore depends on the video model inventing the in-between. That sometimes reads as traversal (A→B clothes tunnel, B→C forest corridor) and sometimes as a late environment swap (C→D, E→A door-to-bedroom).

Known 01.8 repeated-object / radial-copy artifacts survive into the videos, often so strongly that mid-shot frames still look like baked exposure rather than natural locomotion. That is accepted for this test.

Canonical prompt misses that were kept: person in B; D’s stair direction. They affected later shots and should be treated as pipeline evidence, not as a reason to retune Camotion.

## 11. Tests

After implementation, before generation:

- `npm --prefix media test` — 44 passed
- `camotion/.venv/bin/python -m pytest camotion/tests -q` — 163 passed, 5 skipped (artifacts not yet present)

After generation:

- `npm --prefix media test` — 44 passed
- `camotion/.venv/bin/python -m pytest camotion/tests -q` — 168 passed (artifact checks included; none skipped)

## 12. Git status

Branch `main`, up to date with `origin/main`. Nothing committed or pushed.

This run's text changes are unstaged/untracked under `media/` and `camotion/integration/`. Generated PNG/JPEG/MP4 artifacts are untracked and excluded from the checkpoint patch.

Unrelated leftover 01.12 still-only diagnostic text (docs, `operating_window.py`, 01.12 JSON) remains uncommitted from the previous checkpoint and was not part of this integration test.

## 13. Warnings / blockers

- No hard blocker. FLUX 1.1 Pro Ultra, Gemini 3.1 Pro, and Seedance 2.5 all ran.
- Hugging Face Hub warned about unauthenticated Depth Anything downloads (local depth only).
- Gemini vision used JPEG sidecars under `canonical/vision/` because Ultra PNGs can exceed the 7MB image cap. Canonical PNGs were not replaced.
- Seedance `adaptive` 720p resolved to 1284×716, not a round 1280×720.
- End-frame Camotion used outgoing 01.8 with end-image geometry. `B_in` / `B_out` remains unformalized.
- Preview extraction via ffmpeg is observational only and is not part of the product pipeline.

## 14. Replicate calls

| Kind | Count | Retries |
| --- | --- | --- |
| Image (FLUX 1.1 Pro Ultra) | 5 | 0 |
| Reasoning (Gemini 3.1 Pro) | 5 | 0 |
| Video (Seedance 2.5) | 5 | 0 |
| **Total** | **15** | **0** |

No aesthetic regenerations.

## 15. Human review of completed videos

This section supersedes the first-pass preview notes in §9 for
movie-level judgment. §9 remains the automated still-sample log.

The five clips were concatenated with hard butts and no editorial
transitions. Notation: A/B = pristine canonicals; A′/B′ =
Camotion-conditioned shooting frames; A→B = generated traversal shot.

**A→B — excellent / “killer” traversal.** The camera does not simply
dissolve from bedroom to forest. It approaches the wardrobe, enters a
real dark intermediate wardrobe/clothing space, and emerges into
winter.

**B→C — good traversal.** Sustained forward movement, trees pass the
camera, useful parallax, arch develops ahead.

**C→D — mixed.** Real approach through the arch, followed by a late
environment rewrite / replacement into ruins.

**D→E — good traversal.** Sustained stair climb for much of the shot;
rails and masonry pass the camera; portal/cavern transition works
surprisingly well.

**E→A — weakest.** Good approach to the orange bedroom door, but the
door behaves as a flat destination surface rather than traversable
volume. The world then changes into the bedroom.

## 16. Emerging research conclusion

**A destination object is not enough. The shot needs traversable
depth through the transition.**

Related formulation: the best TunnelVision transitions may need a
traversable intermediate spatial story, not merely compatible
endpoints.

Successful examples provide somewhere for the camera to exist
BETWEEN canonicals:

- bedroom → wardrobe interior → forest
- forest corridor → arch
- stairway → portal → cavern

Weak examples contain insufficient intermediate spatial evidence,
especially cavern → flat bedroom door → bedroom.

This suggests future Cinematographer shootability reasoning should
ask: *Can I describe a continuous spatial route from this camera
position into the next world?* A future CM may sometimes decide it
cannot cover a move convincingly in one shot, and may recommend an
intermediate canonical (`E → X → A`). That is not implemented here.

## 17. Movie-level velocity and pacing

Assembling the five clips reveals accidental perceived camera-speed
changes at some shot boundaries. The most obvious current example is
the A→B / B→C boundary.

A speed change can be expressive, but today it is accidental.
TunnelVision should eventually reason about shot rhythm and camera
velocity across shot boundaries (exit velocity from one shot, entry
velocity into the next). Deliberate acceleration/deceleration may be
narratively useful. Accidental speed jumps should not simply be
repaired in post.

Shot duration should not necessarily be globally fixed. The ~5-second
generative cadence in *Digging in the Dirt* became perceptible as a
repeated rhythm. Future direction (not implemented, no new schema):
Screenwriter owns narrative pacing / beat importance;
Cinematographer decides practical shot duration and physical camera
pace (e.g. 3, 5, 8, or 10 seconds) within provider-supported
duration constraints. If a move cannot be covered naturally in one
supported duration, the system may need to subdivide it rather than
forcing the move.

## 18. Assembled movie artifacts

| File | Role |
| --- | --- |
| `videos/ThoughTheWardrobe.mov` | Canonical human-reviewed assembled movie. Preserve. Encoder: DaVinci Resolve. 1284×716 H.264 + PCM audio, ~30.21s, SHA-256 `89177b9083d47e934fffe0b4bc7bccb093dfb60c217e523477dbc2289f24c9af` |
| `videos/ThoughTheWardrobe.mp4` | Website playback derivative only. Video bitstream copied; audio omitted. SHA-256 `9b11ebeadf3e3ef699c2201c16a0d25618655ec02be554a413ce13cae908b991` |

ffmpeg used for the browser derivative (video not recompressed):

``` text
ffmpeg -y -i camotion/integration/wardrobe-loop-01/videos/ThoughTheWardrobe.mov -c:v copy -an -movflags +faststart camotion/integration/wardrobe-loop-01/videos/ThoughTheWardrobe.mp4
```

Joins: hard cuts, no transitions, no optical flow, no stabilization,
no grading. Shot order: A→B, B→C, C→D, D→E, E→A.

## 19. Checkpoint interpretation of Camotion

This is Integration Test 01, **not** Camotion 01.13. Do not characterize
the run as either “Camotion solved traversal” or “Camotion failed.”

- 01.12 established the practical limit of strong baked-exposure
  motion encoding on the Ghost Library fixture.
- 01.8 remains the current Camotion baseline.
- 01.5 / strength 0.08 remains the conservative directed video
  baseline where appropriate.
- The Integration Test demonstrated that the complete system can
  nevertheless produce genuinely compelling traversal shots.
- Camotion artifacts remain visible in conditioned stills, but they
  can become less perceptually important during successful moving
  shots.
- The movie-level metric is increasingly: *Does the model shoot the
  route?* rather than *Is A′ aesthetically clean as a still?*

Do not reopen brute-force strength/sigma/kernel tuning closed by
01.12. Scene-aware selection of a small known-safe Camotion
exposure-strength range is an unvalidated next research direction,
not this experiment, and must not be called Camotion 01.13 from this
checkpoint.
