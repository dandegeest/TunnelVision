# Scene-aware Camotion strength

Not Camotion 01.13. The 01.8 operator was not changed. 01.12 is not
reopened. No kernels, sample counts, depth behavior, route
preservation, or compositor changes.

This is the final bounded Camotion experiment for Phase 1.

Harness: `media/experiments/wardrobe-loop/scene-aware-strength.ts`
Planning freeze: `planning.json`
Machine record: `generation-manifest.json`
Protocol (pre-video): `PROTOCOL.md`

## Research question

Can scene-aware selection of a small, already-understood Camotion
conditioning strength improve video behavior across heterogeneous,
already-shootable scenes compared with the current fixed `.08`
conditioning?

This is not a test of whether Camotion works. The controlled A→B
seed-70 2×2 already supported retaining Camotion-conditioned endpoints
plus authoritative Cinematographer locomotion prompting.

## Protocol

Three previously shootable Wardrobe Loop transitions:

- A→B seed 80
- B→C seed 81
- D→E seed 82

Not C→D (prior mixed/dissolve-like result). Not E→A (insufficient
traversable intermediate volume / flat destination; a separate
shootability question).

Each shot produced two Seedance 2.5 videos. Within a pair, prompt,
settings, and seed were identical. The only intended difference was
the Camotion-conditioned endpoint images.

Control: Integration Test 01 01.8 route-preserved shooting frames at
fixed `.08` / `.08`.

Adaptive: same 01.8 renderer. Strength chosen from `{.02, .04, .08}`
only. No interpolation. No `.06`. Start and end of a shot may differ.
Canonical B is reused across A→B end and B→C start.

Adaptive selections were frozen in `planning.json` **before** any
Seedance call.

Prompts are the authoritative Integration Test 01 Seedance prompts for
those exact shots. `COMMON_VIDEO_INTENT` was not prepended.

Shared Seedance settings: model `bytedance/seedance-2.5`, duration 6,
resolution 720p, aspect_ratio `adaptive`, generate_audio false,
watermark false, output_format mp4.

Seed controls a major source of randomness. It does **not** guarantee
deterministic reproduction.

## Frozen adaptive selections

Gemini 3.1 Pro inspected the actual Integration Test 01 canonical
stills (vision JPEGs as model input; canonical PNG hashes recorded)
plus existing CameraMotionPlans. Prediction `70a5rznf01rmt0d0edhtywsr58`.
Frozen at `2026-09-05T21:05:32.111Z`. First Seedance call started at
`2026-09-05T21:08:28.062Z`.

| Canonical | Strength | Label | Concise reasoning |
| --- | --- | --- | --- |
| A | .02 | LIGHT | Furniture, ceiling planks, hanging clothes; high structured-content duplication risk. |
| B | .02 | LIGHT | Hanging clothes, dense trunks, intricate roots; smear-prone. Reused as A→B end and B→C start. |
| C | .04 | MEDIUM | Natural parallax through trees and arch; clearer cue without aggressive conditioning. |
| D | .02 | LIGHT | Dense repeating stair geometry; step-duplication / smear risk. |
| E | .02 | LIGHT | Illuminated door frame plus fine roots; structured-content duplication risk. |

Nobody independently selected `.08`. That choice was preserved. It was
not forced toward or away from the control.

Shot endpoints:

- A→B adaptive = `.02` / `.02`
- B→C adaptive = `.02` / `.04`
- D→E adaptive = `.02` / `.02`

## Six conditions

| File | Shot | Condition | Strengths | Seed | Prediction | Status | Retry |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `01-A-B-fixed-08.mp4` | A→B | fixed | .08 / .08 | 80 | `skcrer6721rmy0d0edkb60ay5c` | succeeded | 0 |
| `02-A-B-adaptive.mp4` | A→B | adaptive | .02 / .02 | 80 | `h9v7vh433xrmr0d0ednbc3y58g` | succeeded | 0 |
| `03-B-C-fixed-08.mp4` | B→C | fixed | .08 / .08 | 81 | `gwfxjk5nv5rmt0d0edq8x6kct0` | succeeded | 0 |
| `04-B-C-adaptive.mp4` | B→C | adaptive | .02 / .04 | 81 | `9rtx0pa8j5rmy0d0eds8k4awyr` | succeeded | 0 |
| `05-D-E-fixed-08.mp4` | D→E | fixed | .08 / .08 | 82 | `mmbkwk7qwsrmt0d0edvb230b60` | succeeded | 0 |
| `06-D-E-adaptive.mp4` | D→E | adaptive | .02 / .02 | 82 | `g7mfjxhtbnrmw0d0edx8kb2yew` | succeeded | 0 |

All six succeeded. Zero retries. Submitted seed equals
provider-reported seed on every prediction.

## Human evaluation

Primary human reviewer: adaptive wins on A→B, B→C, and D→E (3–0).

Independent second review: adaptive wins on A→B, B→C, and D→E (3–0).

Shared qualitative interpretation, not a numerical score:

- adaptive preserved same-or-better perceived traversal
- geometry remained strong
- conditioned endpoint blur / smear was less noticeable
- stronger `.08` conditioning did not show a compensating locomotion
  advantage in these three pairs

Do not convert this into a universal claim.

## Relationship to prior research

01.12 still stands. On the Ghost Library fixture, substantial baked
exposure creates objectionable structured-content duplication, and
there was no useful pristine-source operating window where a strong
baked travel cue avoided that cost.

The later interpretation still stands: **Camotion is motion-state
conditioning, not image enhancement.**

The controlled A→B seed-70 2×2 still stands: conditioned endpoints
plus the authoritative Cinematographer locomotion prompt was the
human-judged winner at one controlled seed.

This experiment adds: useful motion-state conditioning does not need
to be fixed at `.08` for every scene. Scene-aware lighter conditioning
preserved or improved perceived traversal in all three tested Wardrobe
Loop shot pairs while reducing visible conditioning artifacts.

These results are complementary, not contradictions.

## Limitations

- only three shot pairs
- one seed per pair
- Seedance seed does not guarantee deterministic reproduction
- Wardrobe Loop scenes only
- adaptive selector used Gemini 3.1 Pro qualitative reasoning
- selector was guided conceptually rather than trained on empirical
  strength/video mappings
- no adaptive selection used `.08` in this experiment
- therefore this does **not** establish that `.08` is unnecessary in
  general
- result supports bounded scene-aware selection, not a universal
  optimal strength
- do not claim `.02` is globally best
- do not claim the selector is fully validated across arbitrary scenes
- do not claim cross-seed reliability

## Phase 1 conclusion

Scene-aware bounded Camotion strength is preferred over fixed `.08`
for TunnelVision Phase 1.

The Cinematographer inspects each **actual** canonical keyframe and
creates Camotion shooting preparation, including CameraMotionPlan
geometry, vanishing point / focus-of-expansion, destination /
protected region, traversal / route geometry, Camotion conditioning
strength, and semantic locomotion intent for the shot.

Camotion itself remains deterministic.

Architecture remains:

Agent reasons. CV observes/measures where useful. Camotion renders.
Video model films.

Camotion strength is a per-canonical/keyframe decision, not necessarily
one value per shot. This experiment’s B→C pair used B′ = `.02` and
C′ = `.04`.

Bounded Phase 1 vocabulary, no arbitrary values:

- LIGHT = `.02`
- MEDIUM = `.04`
- STRONG = `.08`

Guiding principle: use the minimum bounded conditioning needed to
establish useful motion state. Stronger Camotion does not automatically
mean stronger perceived camera travel.

## Camotion Phase 1 stop line

Camotion Phase 1 is **frozen**.

Frozen:

- Camotion 01.8 Route-Preserved Exposure operator
- current geometry model
- destination protection
- depth behavior
- sample count
- route preservation
- bounded strength vocabulary `{.02, .04, .08}`
- Cinematographer ownership of per-canonical strength selection

Do not start `.06`, `.03` / `.05`, new kernels, sample-count sweeps,
compositor experiments, alternate blur operators, new exposure
weighting, more Ghost Library tuning, or cross-seed Camotion sweeps.

Future product evidence can reopen Camotion only if a concrete movie
failure provides reason.

## Later research (completed after this freeze)

Shootability / traversable intermediate volume was executed as the
final Phase 1 research experiment, not as Camotion work. See
`../shootability-intermediate-volume/REPORT.md`.

**TunnelVision Research Phase 1 is complete.**
