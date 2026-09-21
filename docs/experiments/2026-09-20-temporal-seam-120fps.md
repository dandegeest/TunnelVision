# Temporal Seam Experiment: Runway 120fps Enhancement

**Date:** September 20, 2026  
**Kind:** Isolated R&D record. Not a feature proposal, implementation plan, or architecture decision record.  
**Status:** Concluded / Abandoned for velocity smoothing

```
EXPERIMENT CONCLUDED
120FPS TEMPORAL SEAM FOR VELOCITY SMOOTHING: ABANDONED
RUNWAY PROVIDER: RETAIN
120FPS ENHANCEMENT CAPABILITY: RETAIN FOR FUTURE EXPERIMENTS
```

This note documents a completed, failed-for-purpose experiment thoroughly enough that a later session can reconstruct why we tried it, what we measured, what we saw, and why we stopped. Negative results are part of the record.

**Do not productize Temporal Seam. Do not continue tuning this technique.**

All videos, graphs, measurements, and scripts remain in place under [`media/experiments/temporal-seam/FPSTEST/`](../../media/experiments/temporal-seam/FPSTEST/). This report references those files by repo-relative path. It does not copy, move, duplicate, embed, or re-encode any of them.

---

## Executive summary

Runway added Enhance Frame Rate support up to 120fps. TunnelVision hypothesized that 120fps enhancement could provide dense temporal material for smoothing velocity discontinuities between independently generated traversals.

The experiment progressed through:

1. 120fps enhancement of existing FPSTEST takes
2. generic velocity easing
3. motion-aware easing derived from optical-flow measurements
4. boundary micro-repair of only the anomalous region around C
5. temporal resampling and hybrid approaches
6. extremely subtle temporal cushioning
7. a randomized blind perceptual comparison

Technical processing worked. Runway enhancement was inexpensive and reliable (3 successful calls, 11 credits, ~140 seconds wall). Increasingly sophisticated manipulation did **not** produce a sufficiently compelling perceptual improvement over the untreated Control.

Final blind test mapping:

| Letter | Treatment |
| --- | --- |
| A | Control |
| B | Light |
| C | Strong |
| D | Medium |

Blind visual ranking from review:

```
B > A > C > D
```

B/Light and A/Control were extremely close. Light narrowly ranked above Control, but the difference was not compelling.

The predefined kill criterion was therefore met:

> If a treated version is not **clearly and repeatably** preferable to Control, abandon 120fps Temporal Seam for velocity smoothing.

**Final decision:** Do not productize Temporal Seam / 120fps velocity smoothing. Keep the reusable Runway provider, the Enhance Frame Rate capability, and this experimental knowledge. Do not continue tuning this technique.

---

## Background

### The original problem

TunnelVision creates continuous journeys from independently generated traversals. Each traversal is a generated shot between two canonical stills. Current export is flat concatenation.

Even when spatial continuity is good — the camera arrives in a world that still looks like the same place — adjacent traversals can have different apparent camera velocities. A typical product case is:

```
A→B FAST
B→C SLOW
```

Potential perceptual result at the generated-shot boundary:

```
FAST → B | SLOW
```

The filmmaker experiences a seam: not a cut in space, but a sudden change in how fast the world is rushing past.

This is distinct from two other continuity problems already in the research record:

- **Spatial continuity:** does the camera physically traverse connected intermediate space, or reconcile worlds through a cut / dissolve / replacement?
- **Temporal continuity at endpoints:** does generated motion carry through the ending frame, or ease / decelerate / stop at B?

See [RESEARCH_BACKLOG.md — Spatial vs temporal continuity](../RESEARCH_BACKLOG.md#spatial-vs-temporal-continuity). This experiment was about a third issue: **velocity mismatch between two already-generated shots that are then concatenated**.

### Original hypothesis

Enhancing generated traversal footage from native delivery FPS (24) to 120fps might provide enough intermediate temporal samples to construct a cushioned join:

```
FAST → ease → B → ease → SLOW
```

and ultimately render that remapped timeline back to normal 24fps output.

120fps was **never** intended as the delivery format. It was intended as high-density temporal *working material*: five source frames for every delivery frame, so a local time remap could slow or ease through a boundary without repeating the same 24fps frame.

### Why this was worth a controlled test

The idea was plausible for three reasons:

1. Runway’s Enhance Frame Rate API made 120fps interpolation a cheap, isolated call rather than a new generation.
2. TunnelVision already concatenates independently generated takes; any join-time treatment would be export-side, not a change to Director, Cinematographer, Camotion, or generation.
3. If it worked, it would address a real finishing problem without asking the video model to generate longer, velocity-matched shots.

The experiment was isolated under `media/experiments/temporal-seam/FPSTEST/`. It was never integrated into the production journey/export path, Director, Cinematographer, UI, or take-selection.

---

## Runway provider work

Before the Temporal Seam experiment, TunnelVision added a reusable Runway Dev provider layer. That work remains useful even though this particular experiment was abandoned.

### What exists

| Piece | Location |
| --- | --- |
| Client / auth | [`media/src/runway/client.ts`](../../media/src/runway/client.ts) |
| Async task polling | [`media/src/runway/tasks.ts`](../../media/src/runway/tasks.ts) |
| Download | [`media/src/runway/download.ts`](../../media/src/runway/download.ts) |
| Enhance Frame Rate body | [`media/src/runway/enhance-frame-rate.ts`](../../media/src/runway/enhance-frame-rate.ts) |
| Provider | [`media/src/runway/provider.ts`](../../media/src/runway/provider.ts) |
| CLI | `npm --prefix media run runway:enhance-frame-rate -- <input.mp4> <output.mp4>` |

Environment:

```
RUNWAY_DEV_TOKEN
```

The provider implements reusable Runway async task infrastructure plus Enhance Frame Rate. It does **not** wrap other Runway generation models. Official `@runwayml/sdk` VideoUpscale types did not yet include `enhance_frame_rate` at the time of implementation, so the provider uses HTTP directly.

API observations that remain true:

- Endpoint: `POST https://api.dev.runwayml.com/v1/video_upscale`
- Model: `enhance_frame_rate`
- Field name is **`targetFramerate`** (not `targetFrameRate`)
- Allowed values: `24`, `25`, `30`, `48`, `50`, `60`, `120`, `23_98`, `29_97`, `59_94`
- Max input duration: 300s
- Cost during this experiment: 1 credit / 2s of input
- Poll `GET /v1/tasks/{id}` no faster than 5s
- Task states: PENDING / THROTTLED / RUNNING / SUCCEEDED / FAILED / CANCELLED
- Output URLs expire in 24–48h
- Header: `X-Runway-Version: 2024-11-06`
- Local files upload via `POST /v1/uploads` `{filename, type:"ephemeral"}` then form POST
- Data-URI upload is capped at 5MB and is not usable for typical TunnelVision clips

### Live smoke test (before FPSTEST)

A live end-to-end smoke test demonstrated:

```
TunnelVision MP4
  → Runway provider
  → Enhance Frame Rate @ 120fps
  → async task
  → downloaded verified MP4
```

Source: `projects/MidnightMiniaturePF_FOLLOW_HoleInOne/traversals/A-B/take-02.mp4`  
Enhanced beside the source as `take-02-120fps.mp4`.  
Task `931e7ed1-a9e0-45be-a563-1b9340f9c53f`, 3 credits.

That test was infrastructure validation only. It did not include Temporal Seam, UI, or journey integration.

This infrastructure remains in product as a reusable capability. The abandoned idea is using 120fps as working material for *velocity-smoothing joins*, not the provider itself.

---

## FPSTEST

A purpose-built TunnelVision journey called **FPSTEST** was generated specifically to create strong velocity changes. It was not a typical product story. It was a stress test.

Project facts (from [`source.json`](../../media/experiments/temporal-seam/FPSTEST/source.json)):

| Field | Value |
| --- | --- |
| Project | `FPSTEST` |
| Project id | `tv-26a72cff3a9e6b3a` |
| Camera grammar | POV |
| Sequence | A→B, B→C, C→D |
| Model (all selected takes) | Kling v2.5 turbo pro (`kwaivgi/kling-v2.5-turbo-pro`) |
| Selected takes | all `take-02.mp4` |
| Audio | `generateAudio: false` |

Story intent:

> First-person POV traveling along a remote alpine mountain road at dawn toward a dark stone tunnel carved through the mountain. Begin with a slow, calm forward glide. Inside the tunnel, steadily accelerate as repeating overhead lights and wall markings rush past. Burst from the tunnel into a vast alpine valley at high speed, continuing to accelerate until traveling at hyper speed just above the road toward a distant valley town.

Intended pace progression:

```
SLOW → FAST → HYPER
```

| Traversal | Stored pace | Story intent | Take duration |
| --- | --- | --- | --- |
| A→B | variable | slow calm glide approaching and entering the tunnel | 10s (actual ~10.083s) |
| B→C | hyperspeed | accelerate through the tunnel as lights and markings rush past | 5s (actual ~5.083s) |
| C→D | hyperspeed | burst into the valley and continue accelerating to hyper speed | 5s (actual ~5.083s) |

Native takes: 24fps, 1928×1072.

Strong visual velocity cues that made FPSTEST useful:

- road markings
- tunnel walls
- repeating tunnel lights
- bridge / road geometry
- nearby terrain
- distant mountains

These cues made apparent camera speed readable to both optical flow and a human viewer. Later work focused on **boundary #2** (B→C | C→D): the tunnel-exit / valley-arrival join at canonical C. That was the most informative seam.

FPSTEST was **not** regenerated during later phases. After Phase 1, every treatment reused the same 120fps enhanced files.

---

## Phase 1 — Runway enhancement and generic velocity easing

**Credits authorized. Isolated experiment. No production integration.**

Runner: [`run_experiment.py`](../../media/experiments/temporal-seam/FPSTEST/run_experiment.py)  
Machine record: [`report.json`](../../media/experiments/temporal-seam/FPSTEST/report.json)

### Enhancement

Three selected takes were copied into `media/experiments/temporal-seam/FPSTEST/source/` and enhanced independently:

| Clip | Task id | Credits | Wall | Output | Duration | Frames | Size |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A→B | `e962580a-629d-4f1e-b649-afa5a73a7b32` | 5 | ~58s | [`enhanced/A-B-120fps.mp4`](../../media/experiments/temporal-seam/FPSTEST/enhanced/A-B-120fps.mp4) | 10.050s | 1206 | 1928×1072 / 120fps |
| B→C | `88d7d1c8-67af-4c34-a7e5-4ff45b950340` | 3 | ~41s | [`enhanced/B-C-120fps.mp4`](../../media/experiments/temporal-seam/FPSTEST/enhanced/B-C-120fps.mp4) | 5.050s | 606 | 1928×1072 / 120fps |
| C→D | `b824e68c-82c9-44ec-bb38-46b627836b7e` | 3 | ~41s | [`enhanced/C-D-120fps.mp4`](../../media/experiments/temporal-seam/FPSTEST/enhanced/C-D-120fps.mp4) | 5.050s | 606 | 1928×1072 / 120fps |

Totals: **3 successful calls, 11 credits, ~140 seconds wall, no meaningful API failures.**

Runway trimmed a short tail (~33ms / 4 frames at 120fps) relative to the native takes, consistent with the earlier smoke test.

### What we compared

| # | Treatment | File | Duration |
| --- | --- | --- | --- |
| 1 | Control — hard join of original 24fps takes | [`01-control.mp4`](../../media/experiments/temporal-seam/FPSTEST/01-control.mp4) | 20.250s |
| 2 | 120fps Straight — enhance each traversal, join, conform to 24fps | [`02-120fps-straight.mp4`](../../media/experiments/temporal-seam/FPSTEST/02-120fps-straight.mp4) | 20.167s (−0.083s) |
| 3 | 120fps + generic velocity ease | [`03-120fps-velocity-ease.mp4`](../../media/experiments/temporal-seam/FPSTEST/03-120fps-velocity-ease.mp4) | 20.167s (−0.083s) |
| 4 | Optional soft-boundary crossfade (not a primary candidate) | [`04-120fps-soft-boundary.mp4`](../../media/experiments/temporal-seam/FPSTEST/04-120fps-soft-boundary.mp4) | 19.875s (−0.375s) |

Labeled sequential comparison: [`FPSTEST-temporal-seam-comparison.mp4`](../../media/experiments/temporal-seam/FPSTEST/FPSTEST-temporal-seam-comparison.mp4) (66.6s).

Encode convention for this experiment tree: libx264 CRF 18, preset medium, yuv420p, 1928×1072, 24fps delivery, no audio.

### Generic ease recipe

Window: last 500ms outgoing + first 500ms incoming at each join.  
Implementation: 10 × 50ms slices, smoothstep on slice midpoints, `setpts=PTS/speed,fps=120` per slice, bodies remain 1.0×, then conform to 24fps. SLOW→FAST→HYPER was preserved; the ease was not intended to flatten the journey.

Predetermined ranges:

| Boundary | Outgoing | Incoming |
| --- | --- | --- |
| A→B \| B→C | 1.00 → 1.14 | 0.88 → 1.00 |
| B→C \| C→D | 1.00 → 1.10 | 0.91 → 1.00 |

### Findings

1. **Straight 120fps enhancement preserved the original motion signature reasonably closely.** It did **not** itself fix traversal velocity discontinuities. That was expected and useful to verify. Interpolation adds temporal samples; it does not invent a different camera-speed plan.
2. **Generic easing produced almost no meaningful perceptual improvement.** A predetermined speed ramp around B / C is the wrong model. The actual source motion is not a clean FAST→SLOW step sitting exactly on the canonical frame.
3. Duration deltas from Runway’s tail trim (−83ms) and from the optional xfade (−375ms) were incidental, not the result.

This phase established the working material and killed the simplest treatment. The next requirement was to *measure* the join instead of assuming it.

---

## Phase 2 — Motion analysis

No further Runway calls. Existing 120fps files only.

Script: [`boundary2_motion_aware.py`](../../media/experiments/temporal-seam/FPSTEST/boundary2_motion_aware.py)  
Measurements: [`boundary2-motion.json`](../../media/experiments/temporal-seam/FPSTEST/boundary2-motion.json), [`boundary2-motion.csv`](../../media/experiments/temporal-seam/FPSTEST/boundary2-motion.csv)  
Graph: [`boundary2-motion-analysis.png`](../../media/experiments/temporal-seam/FPSTEST/boundary2-motion-analysis.png)

Boundary #2 was selected for detailed study:

```
outgoing:  media/experiments/temporal-seam/FPSTEST/enhanced/B-C-120fps.mp4
incoming:  media/experiments/temporal-seam/FPSTEST/enhanced/C-D-120fps.mp4
join:      B-C | C-D   (canonical C)
```

### Method

- Farneback optical flow
- Analysis width: 480px
- Local venv: `media/experiments/temporal-seam/FPSTEST/.venv` (opencv-python-headless, numpy, matplotlib)
- Diagnostic clips: last ~2s of outgoing + first ~2s of incoming, extracted as PNGs under [`intermediates/boundary2/`](../../media/experiments/temporal-seam/FPSTEST/intermediates/boundary2/)

### Methodological discovery: do not use median vector on forward POV

A median *vector* is inappropriate for this shot. Forward POV expansion is radial. Leftward and rightward components cancel, so the median vector can report near-zero motion while the camera is clearly rushing forward.

**Median flow magnitude** was used instead. Magnitude tracks apparent camera speed. Scaling by FPS makes 24fps and 120fps series comparable (`px/s = median_mag × fps`; `mag24 = median_mag × (24 / analysis_equivalent)`).

This is a durable analysis lesson, independent of Temporal Seam: optical-flow diagnostics on TunnelVision POV footage should start from magnitude, not from a cancelled median vector.

### What the measurements actually showed

120fps plateaus (approximately −0.55…−0.20s and +0.20…+0.55s from C):

| Side | Stable px/s | ≈ mag24 |
| --- | --- | --- |
| Outgoing (still in / just leaving the tunnel) | 178 | 7.4 |
| Incoming (valley after C) | 65 | 2.7 |

Ratio: **2.75×**.

The first reading of that pair looks like a simple step:

```
7.4 → 2.7
```

That is **not** what happens at C. Immediate samples at the join are a generated **spike**:

| Side | Immediate px/s | ≈ mag24 |
| --- | --- | --- |
| Outgoing, last samples before C | ~396 | ~16.5 |
| Incoming, first samples after C | ~451 | ~18.8 |

The plateau ratio (7.4 vs 2.7) is real, but it lives a few hundred milliseconds away from the join. The thing the viewer actually crosses is a 16–19 mag24 spike, then a decay into the slower valley plateau.

Two physical facts explain why the plateaus differ even though both stored paces are `hyperspeed`:

1. Tunnel close-walls and repeating lights produce large pixel motion.
2. Valley distance and open terrain produce smaller pixel motion at a similar camera speed.

So “match outgoing velocity to incoming velocity” is not even a well-posed perceptual goal. Some of the 2.75× gap is geometry, not camera-speed error.

This reframed the rest of the experiment. The problem is not a clean FAST→SLOW cliff at C. It is a short, generated acceleration / discontinuity immediately around C, sitting on top of two different stable motion regimes.

---

## Phase 3 — Motion-aware remapping

Still no Runway. Same 120fps sources. Treatment derived from the Phase 2 measurements.

Model:

```
apparent output velocity  =  source apparent velocity × playback rate

playback rate             =  desired velocity / source velocity
```

Treatment:

- ±500ms around C
- smoothstep target from the outgoing plateau (178 px/s) toward the incoming plateau (65 px/s)
- rate clamp 0.5–2.0
- implementation: integrate `dt_src / rate` at 120fps, nearest source frame, then `fps=24`

Outputs:

- Control window: [`boundary2-control.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-control.mp4)
- Motion-aware: [`boundary2-motion-aware.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-motion-aware.mp4)
- Sequential comparison: [`boundary2-motion-aware-comparison.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-motion-aware-comparison.mp4)
- Sample dumps: [`boundary2-control-samples.json`](../../media/experiments/temporal-seam/FPSTEST/boundary2-control-samples.json), [`boundary2-motion-aware-samples.json`](../../media/experiments/temporal-seam/FPSTEST/boundary2-motion-aware-samples.json)

### Quantitative result (re-measured on the 24fps diagnostic clips)

| | Control | Motion-aware |
| --- | --- | --- |
| Outgoing near B (stable) | 226 px/s | 150 px/s |
| Boundary | 366 → 325 | 180 → 150 |
| Boundary step | 41 | 30 |
| Incoming | 151 px/s | 122 px/s |
| Max step ±200ms | 100 | 104 |
| Duration | 4.042s | 4.542s (**+0.50s**) |

Boundary step improved numerically by ~27%. That is the only number that moved in the hoped-for direction.

### Interpretation

- The 0.5× clamp saturated on the 16–19 spike. True flattening wanted rates around 0.3×, which the clamp refused — correctly, from a “do not turn this into slow motion” standpoint.
- Maximum *local* discontinuity (±200ms) did not improve (100 → 104).
- Surrounding motion changed too much. A ±500ms window is a large fraction of a 2s+2s diagnostic and would be a large fraction of a 5s take.
- The journey gained half a second at a single join. That is unacceptable as a general export treatment.
- Perceptual benefit was insufficient. The treated clip did not feel like a clearly better camera move; it felt like the same join with more of the shot rewritten.

**Conclusion:** Broad velocity normalization is the wrong approach. Do not try to make the outgoing tunnel and the incoming valley share one apparent speed. Do not rewrite half a second on each side of every join.

---

## Phase 4 — Micro-repair

New hypothesis: preserve native generated motion and repair only the anomalous region around C.

Anomaly from the existing 120fps series ([`boundary2-micro-motion.json`](../../media/experiments/temporal-seam/FPSTEST/boundary2-micro-motion.json)):

| Event | Time from C | mag24 |
| --- | --- | --- |
| Last plateau-consistent sample | −350ms | 7.44 |
| Rise above 10 | −300ms | 11.61 |
| Core 16–19 begins | −133ms | 17.22 |
| Outgoing peak | −50ms | 18.18 |
| Incoming peak | 0ms | 18.81 |
| Second incoming peak | +42ms | 18.70 |
| Falls through 10 | +100ms | 10.38 |
| Incoming settled | +267ms | 3.08 |

Micro-repair window:

```
−133ms → +100ms
= 233ms
= 28 frames at 120fps
```

The window sits mostly on the outgoing side. The spike begins before C and decays just after. Everything outside the window remained 1.0×.

Script: [`boundary2_micro_repair.py`](../../media/experiments/temporal-seam/FPSTEST/boundary2_micro_repair.py)  
Graph: [`boundary2-micro-motion-analysis.png`](../../media/experiments/temporal-seam/FPSTEST/boundary2-micro-motion-analysis.png)  
Comparison: [`boundary2-micro-comparison.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-micro-comparison.mp4)

Three strategies, all using the same 120fps sources, all 1928×1072 / 24fps, ~1.5s before C and ~1.5s after:

### Remap

Local playback-rate adjustment inside the 233ms window only. Extra time capped at 100ms. Rates after the cap: 0.67–0.80. The uncapped mathematical correction wanted **+373ms**, which is perceptually excessive slowing of a 233ms region.

| | Control | Remap |
| --- | --- | --- |
| Spike | 21.8 | 17.9 |
| Max step ±250ms | 7.51 | 10.83 |
| Duration | 3.042s | 3.125s (**+83ms**) |

Temporal cadence stayed relatively natural. The spike was only partly reduced. Max local step got worse. True velocity normalization would require a duration change large enough to feel like slow motion.

File: [`boundary2-micro-remap.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-micro-remap.mp4)

### Resample

Used 120fps temporal density to *choose different 24fps source samples*. The 28 spike frames were omitted. Repair slots sampled the 80ms plateau edge, then the 80ms incoming settle. Duration unchanged.

| | Control | Resample |
| --- | --- | --- |
| Spike | 21.8 | 11.6 |
| Max step ±250ms | 7.51 | 3.71 |
| Duration | 3.042s | 3.042s |

Numerically excellent. Plateaus preserved. **Perceptually poor.** The video looked jerky because sequential temporal progression had been discarded. The 120fps source was being used as a pile of stills to cherry-pick, not as a continuous motion.

File: [`boundary2-micro-resample.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-micro-resample.mp4)

This is the critical negative result of the entire experiment:

> A better optical-flow graph does **not** necessarily mean better perceived motion.

### Hybrid

Dropped the 16–19 core (−50ms to +50ms, 12 frames) and applied mild remap only on the 13–15 shoulders.

| | Control | Hybrid |
| --- | --- | --- |
| Spike | 21.8 | 11.0 |
| Max step ±250ms | 7.51 | 2.62 |
| Duration | 3.042s | 3.042s |

Best numerical result. Perceptually inherited the temporal manipulation / jerkiness of resampling. File: [`boundary2-micro-hybrid.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-micro-hybrid.mp4)

### Perceptual ranking after Phase 4

Control and Micro Remap were the visually strongest versions. Resample and Hybrid looked worse despite winning the graph.

**Conclusion:** Do not optimize Temporal Seam against optical-flow magnitude. Human perceptual evaluation is authoritative. Native generated motion can contain spikes that look more natural than a surgically “corrected” timeline.

---

## Phase 5 — Final kill test (subtle temporal cushion)

Final hypothesis: the only remaining useful treatment might be an extremely subtle temporal cushion immediately around C. Not velocity matching. Not spike elimination. Not discarding source frames.

```
native generated motion
         ↓
   tiny temporal cushion
         ↓
         C
         ↓
   tiny temporal cushion
         ↓
native generated motion
```

The treatment was supposed to be difficult to consciously detect. Sequential fractional timing through the 120fps source was required. The previous Resample strategy was forbidden.

Script: [`boundary2_final_cushion.py`](../../media/experiments/temporal-seam/FPSTEST/boundary2_final_cushion.py)  
Public (non-secret) summary: [`boundary2-final-public.json`](../../media/experiments/temporal-seam/FPSTEST/boundary2-final-public.json)

Four versions, all 1928×1072, 24fps, 3.042s, no labels in the test footage:

| Variant | Repair window | Minimum rate | Curve | File |
| --- | --- | --- | --- | --- |
| Control | none | 1.0× | identity | [`boundary2-final-control.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-final-control.mp4) |
| Light | ~100ms | ~0.90× | 1.0 → 0.90 → 1.0 | [`boundary2-final-light.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-final-light.mp4) |
| Medium | ~133ms | ~0.825× | 1.0 → ~0.825 → 1.0 | [`boundary2-final-medium.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-final-medium.mp4) |
| Strong | ~167ms | ~0.725× | 1.0 → ~0.725 → 1.0 | [`boundary2-final-strong.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-final-strong.mp4) |

Rates used a smooth parabolic bump centered on C (`r(u) = 1 − depth · 4u(1−u)`), not a curve derived from optical flow. Indices were required to be non-decreasing. No region skip.

Inherent duration extras *before* matching Control length: Light +8ms, Medium +25ms, Strong +42ms. Extra frames were trimmed from the pad ends only, never from the middle. Final durations were identical (3.042s / 73 frames). There was no perceptible compensatory speed-up elsewhere.

### Blind comparison

File: [`boundary2-final-blind-comparison.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-final-blind-comparison.mp4) (29.2s, 24fps, 1928×1072)

The four versions were presented in randomized order, labeled only **A / B / C / D**. Each version played twice consecutively. The mapping was stored only in [`boundary2-final-blind-key.json`](../../media/experiments/temporal-seam/FPSTEST/boundary2-final-blind-key.json) and was not revealed until after visual ranking.

Mapping (revealed after ranking):

```
A = Control
B = Light
C = Strong
D = Medium
```

Blind visual ranking:

```
B > A > C > D
```

Observations from review:

- **B / Light** looked best, but only marginally.
- **A / Control** was extremely close. Native generated motion already looked surprisingly natural despite the measured spike.
- **C / Strong** produced an interesting perceptual side-effect: after the bridge, the distant mountains appeared to emerge / reveal differently. That was not a velocity-smoothing win; it was a change in how destination geometry arrived.
- **D / Medium** made the temporal treatment more perceptible without making the join better.

No optical-flow ranking was performed on these four files. That was deliberate. Phase 4 had already shown that the graph can elect a loser.

---

## Kill criterion and decision

Before the blind key was revealed, the survival rule was fixed:

> For this technique to survive, one treated version must be **clearly and repeatably** preferable to Control.
>
> If Control is as good or nearly as good: **abandon.**

Result: Light narrowly ranked above Control. The difference was not clear, not large, and not a reason to keep spending development time.

**Kill criterion met.**

### Final conclusion

Do **not** add Runway 120fps Temporal Seam velocity smoothing to the TunnelVision production pipeline.

Do **not** continue tuning this technique.

Reasons:

1. Native generated traversal motion is already surprisingly convincing at a hard join.
2. Velocity discontinuities that measure as large optical-flow spikes are not necessarily objectionable to a viewer.
3. Aggressive corrections damage natural temporal cadence.
4. Resampling can dramatically improve metrics while making motion visibly worse.
5. Subtle corrections offer only marginal improvement — close enough that a blind ranking can put them just above Control without anyone wanting to ship the difference.
6. Additional pipeline / API complexity (enhance every take, remap every join, absorb duration drift) is not justified by the perceptual gain.
7. True mathematical flattening of this spike wanted hundreds of milliseconds of slowdown. That is a different shot, not a finishing pass.

Runway 120fps can remain available for other future TunnelVision uses. This particular idea — using it as working material to smooth traversal-to-traversal velocity — is closed.

---

## What we keep

### 1. Runway provider

The reusable Runway Dev integration succeeded as infrastructure. Keep `media/src/runway/`, `RUNWAY_DEV_TOKEN`, and the Enhance Frame Rate CLI. Do not rip it out because Temporal Seam failed.

### 2. Enhance Frame Rate capability

120fps enhancement is inexpensive, reliable, and technically useful. Three production-length clips enhanced cleanly for 11 credits. The motion signature of the source was preserved. That is a good primitive for *other* future experiments (inspection, slow-motion study, possible later finishing ideas that are not velocity matching).

### 3. Optical-flow analysis tooling

[`boundary2_motion_aware.py`](../../media/experiments/temporal-seam/FPSTEST/boundary2_motion_aware.py) and the Farneback measurement path may be useful later for Cinematographer evaluation or research. Treat optical flow as a **diagnostic signal**, not as a perceptual-quality objective function.

Durable methodological rules from this work:

- On forward POV, use flow **magnitude**, not median vector.
- Report both plateau regimes and the immediate join; they are different phenomena.
- Do not elect a finishing treatment because a graph got smoother.
- A duration-neutral remap of a uniformly-too-fast window cannot reduce apparent velocity (same frames in the same time). Slowing a spike adds duration; skipping frames looks jerky. Those are the only two levers, and both failed perceptually here.

### 4. FPSTEST

FPSTEST remains a useful stress-test journey for motion experiments. Do not regenerate it unless a later experiment needs a different story. The 120fps enhanced takes are the canonical working sources for any future re-inspection of this material.

---

## Unexpected finding — spatial reveal

During blind review, the Strong treatment (C) changed how the world arrived after the bridge. Distant mountains appeared to emerge / reveal differently.

This is **not** evidence that Strong is a better velocity join. It is evidence that a local temporal treatment can alter perception of destination geometry and environmental reveal even when it does not improve velocity continuity.

Do **not** pursue this now.

Record it as a possible future research direction related to:

- arrival quality
- destination reveal
- environmental emergence
- perceptual spatial continuity

rather than velocity smoothing. If it is ever reopened, it should be designed as an arrival / reveal experiment, with its own kill criterion, not as another Temporal Seam retune.

---

## Key product lesson

The most important result is methodological:

> A mathematically smoother transition is not necessarily a perceptually smoother transition.

TunnelVision should optimize for **perceived continuous spatial experience**, not for minimized optical-flow discontinuities.

Native generated motion can contain spikes, acceleration, and other irregularities that contribute positively to the feeling of movement. Over-correcting those irregularities can make the journey feel synthetic: jerky when frames are skipped, sluggish when time is dilated, or merely different when a tiny cushion is applied.

Current export — flat concatenation of selected takes — remains an acceptable baseline for this class of seam. The remaining interesting finishing questions are about spatial arrival and destination reveal, not about 120fps velocity matching.

---

## Iteration map

| Phase | Question | What we did | What we learned | Verdict |
| --- | --- | --- | --- | --- |
| 0 | Can we talk to Runway Enhance Frame Rate? | Provider + live smoke test | Yes. Cheap, reliable, 120fps MP4 comes back | Keep the provider |
| 1 | Does 120fps, or a generic ease, fix joins? | Enhance FPSTEST; Control vs Straight vs generic 500ms ease | Enhancement preserves motion; generic ease does almost nothing | Kill generic ease |
| 2 | What is the actual motion at C? | Farneback on B-C / C-D | Median vector cancels; plateaus are 7.4 vs 2.7; the join is a 16–19 spike | Reframe the problem |
| 3 | Can measurement-driven ±500ms remap flatten it? | Rate = desired / source, clamp 0.5–2.0 | −27% step, +0.50s, too much footage rewritten, local max step unchanged | Kill broad remap |
| 4a | Can we remap only the 233ms anomaly? | Local 0.67–0.80×, +83ms | Cadence stays natural; spike barely moves; true flatten wants +373ms | Weak, not enough |
| 4b | Can we resample / skip the spike? | Omit 28 frames; pick 24fps samples from 120fps | Best numbers, jerky picture | Kill resampling |
| 4c | Hybrid skip + mild remap? | Drop 16–19 core, remap shoulders | Best numbers of all, still jerky | Kill hybrid |
| 5 | Can a tiny undetectable cushion help? | Light / Medium / Strong vs Control, blind A–D | Light ≳ Control ≫ Medium; not clearly better | **Kill Temporal Seam** |

---

## Asset index

All assets remain under [`media/experiments/temporal-seam/FPSTEST/`](../../media/experiments/temporal-seam/FPSTEST/). Paths are repo-relative. Nothing in this report embeds, copies, or re-packages them.

### Sources and enhancement

| Asset | Path |
| --- | --- |
| Project / take manifest | [`source.json`](../../media/experiments/temporal-seam/FPSTEST/source.json) |
| Phase 1 machine report | [`report.json`](../../media/experiments/temporal-seam/FPSTEST/report.json) |
| Native take copies | `source/A-B.mp4`, `source/B-C.mp4`, `source/C-D.mp4` |
| Enhanced 120fps A→B | [`enhanced/A-B-120fps.mp4`](../../media/experiments/temporal-seam/FPSTEST/enhanced/A-B-120fps.mp4) |
| Enhanced 120fps B→C | [`enhanced/B-C-120fps.mp4`](../../media/experiments/temporal-seam/FPSTEST/enhanced/B-C-120fps.mp4) |
| Enhanced 120fps C→D | [`enhanced/C-D-120fps.mp4`](../../media/experiments/temporal-seam/FPSTEST/enhanced/C-D-120fps.mp4) |
| Runway CLI logs | `enhanced/A-B-120fps.log`, `enhanced/B-C-120fps.log`, `enhanced/C-D-120fps.log` |

### Phase 1 whole-journey treatments

| Asset | Path |
| --- | --- |
| Control | [`01-control.mp4`](../../media/experiments/temporal-seam/FPSTEST/01-control.mp4) |
| 120fps Straight | [`02-120fps-straight.mp4`](../../media/experiments/temporal-seam/FPSTEST/02-120fps-straight.mp4) |
| 120fps + generic ease | [`03-120fps-velocity-ease.mp4`](../../media/experiments/temporal-seam/FPSTEST/03-120fps-velocity-ease.mp4) |
| Optional soft-boundary | [`04-120fps-soft-boundary.mp4`](../../media/experiments/temporal-seam/FPSTEST/04-120fps-soft-boundary.mp4) |
| Labeled comparison | [`FPSTEST-temporal-seam-comparison.mp4`](../../media/experiments/temporal-seam/FPSTEST/FPSTEST-temporal-seam-comparison.mp4) |

### Phase 2–3 motion-aware (boundary #2)

| Asset | Path |
| --- | --- |
| Measurements (JSON) | [`boundary2-motion.json`](../../media/experiments/temporal-seam/FPSTEST/boundary2-motion.json) |
| Measurements (CSV) | [`boundary2-motion.csv`](../../media/experiments/temporal-seam/FPSTEST/boundary2-motion.csv) |
| Analysis graph | [`boundary2-motion-analysis.png`](../../media/experiments/temporal-seam/FPSTEST/boundary2-motion-analysis.png) |
| Control diagnostic | [`boundary2-control.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-control.mp4) |
| Motion-aware diagnostic | [`boundary2-motion-aware.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-motion-aware.mp4) |
| Sequential comparison | [`boundary2-motion-aware-comparison.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-motion-aware-comparison.mp4) |
| Control samples | [`boundary2-control-samples.json`](../../media/experiments/temporal-seam/FPSTEST/boundary2-control-samples.json) |
| Motion-aware samples | [`boundary2-motion-aware-samples.json`](../../media/experiments/temporal-seam/FPSTEST/boundary2-motion-aware-samples.json) |
| PNG extracts / 120fps intermediates | `intermediates/boundary2/` |

### Phase 4 micro-repair

| Asset | Path |
| --- | --- |
| Measurements | [`boundary2-micro-motion.json`](../../media/experiments/temporal-seam/FPSTEST/boundary2-micro-motion.json) |
| Analysis graph | [`boundary2-micro-motion-analysis.png`](../../media/experiments/temporal-seam/FPSTEST/boundary2-micro-motion-analysis.png) |
| Control | [`boundary2-micro-control.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-micro-control.mp4) |
| Remap | [`boundary2-micro-remap.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-micro-remap.mp4) |
| Resample | [`boundary2-micro-resample.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-micro-resample.mp4) |
| Hybrid | [`boundary2-micro-hybrid.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-micro-hybrid.mp4) |
| Sequential comparison | [`boundary2-micro-comparison.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-micro-comparison.mp4) |

### Phase 5 kill test

| Asset | Path |
| --- | --- |
| Control | [`boundary2-final-control.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-final-control.mp4) |
| Light | [`boundary2-final-light.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-final-light.mp4) |
| Medium | [`boundary2-final-medium.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-final-medium.mp4) |
| Strong | [`boundary2-final-strong.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-final-strong.mp4) |
| Blind comparison | [`boundary2-final-blind-comparison.mp4`](../../media/experiments/temporal-seam/FPSTEST/boundary2-final-blind-comparison.mp4) |
| Blind key | [`boundary2-final-blind-key.json`](../../media/experiments/temporal-seam/FPSTEST/boundary2-final-blind-key.json) |
| Public summary (no ranking) | [`boundary2-final-public.json`](../../media/experiments/temporal-seam/FPSTEST/boundary2-final-public.json) |

### Scripts

| Script | Role |
| --- | --- |
| [`run_experiment.py`](../../media/experiments/temporal-seam/FPSTEST/run_experiment.py) | Phase 1: enhance, generic ease, whole-journey comparison |
| [`boundary2_motion_aware.py`](../../media/experiments/temporal-seam/FPSTEST/boundary2_motion_aware.py) | Shared probe / encode / Farneback / Phase 2–3 remap |
| [`boundary2_micro_repair.py`](../../media/experiments/temporal-seam/FPSTEST/boundary2_micro_repair.py) | Phase 4 remap / resample / hybrid |
| [`boundary2_final_cushion.py`](../../media/experiments/temporal-seam/FPSTEST/boundary2_final_cushion.py) | Phase 5 cushions + blind comparison |

Labeled cards and concat listings used to build comparisons live under `cards/` and `intermediates/`. They are build artifacts, not additional experimental conditions.

---

## What might still be worth revisiting later

These are **not** invitations to retune Temporal Seam.

1. **Arrival / destination reveal.** The Strong cushion changed how mountains emerged after the bridge. If finishing research reopens, start there — not at velocity matching.
2. **Optical flow as a Cinematographer diagnostic.** Magnitude-based POV flow can describe apparent speed. It must not become a score to minimize.
3. **Other uses of 120fps enhancement.** Inspection, slow-motion study, or a later finishing idea that is not “match adjacent traversal velocities.”
4. **Native generation as the real lever.** If a future journey has an actually objectionable velocity seam, the productive move is probably a NEW TAKE or a different Motion Plan, not a 120fps remap of the existing take.

Do not reopen:

- generic 500ms eases
- measurement-driven broad remaps
- spike-skipping resampling
- hybrid skip + remap
- further Light / Medium / Strong cushion grids
- optical-flow-elected winners

---

## Final status

```
EXPERIMENT CONCLUDED
120FPS TEMPORAL SEAM FOR VELOCITY SMOOTHING: ABANDONED
RUNWAY PROVIDER: RETAIN
120FPS ENHANCEMENT CAPABILITY: RETAIN FOR FUTURE EXPERIMENTS
```

Authoritative decision date: **20 September 2026**.  
Authoritative perceptual ranking: **B/Light > A/Control > C/Strong > D/Medium**, with Light and Control too close to justify productization.
