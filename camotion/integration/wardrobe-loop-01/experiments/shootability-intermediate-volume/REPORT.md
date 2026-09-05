# Cinematographer shootability / intermediate spatial volume

Not a Camotion tuning experiment. Camotion Phase 1 remains frozen.
This is **not** an experiment failure. The protocol stop after Stage 3
is the result.

Harness: `media/experiments/wardrobe-loop/shootability-intermediate.ts`
Machine record: `generation-manifest.json`
Protocol freeze: `PROTOCOL.md`
Stages: `stage1-shootability.json`, `stage2-x-spec.json`,
`stage3-actual-x-review.json`

## Research question

Can the Cinematographer inspect two actual canonical sets and
recognize that a requested direct transition lacks enough traversable
intermediate spatial volume to shoot convincingly as one continuous
camera move? And, when that happens, can it recommend an intermediate
canonical state X that provides the missing physical route?

In shorthand: **E→A versus E→X→A**.

The important result is not merely “two clips are easier than one.”
The test is whether the Cinematographer can inspect actual sets, judge
shootability, explain the spatial problem, specify a missing
intermediate camera position, and then inspect the **actual generated
X** before filmmaking continues.

## Protocol

Inspect actual Integration Test 01 canonical E and A. Do not tell the
Cinematographer it must reject E→A.

If Stage 1 is SHOOTABLE, stop before paid image/video generation.

If NEEDS_INTERMEDIATE, freeze one spatial specification for X, generate
exactly one canonical X, then inspect the actual X. Both E→X and X→A
must be SHOOTABLE before any Camotion plans or Seedance videos.

If either leg is NOT_SHOOTABLE: stop. Do not regenerate X. Do not
force video.

Intended later comparison, **not reached**: one 6-second direct E→A
(fresh seed 90, current frozen Phase 1 pipeline) versus two 6-second
spatially planned shots E→X (seed 90) and X→A (seed 91).

## Stage 1 decision

**NEEDS_INTERMEDIATE**

Gemini 3.1 Pro inspected the actual E and A vision stills plus existing
E→A CameraMotionPlan geometry. The prompt did **not** tell it to reject
E→A. Frozen `2026-09-05T22:26:07.317Z`, prediction
`gqanpekw6drmy0d0eeptpzcmew`, before any image or video call.

Exact reasoning:

> The door in the start image is closed, providing no traversable volume
> or threshold depth for the camera to enter. Additionally, pushing
> through that portal would logically place the camera at the threshold
> looking into the room, not halfway across the room looking back at the
> wardrobe as composed in the end image.

This exposed two spatial problems:

1. E’s closed door provides insufficient visible traversable volume.
2. A has an incompatible camera position/orientation for the implied
   continuous route.

Shootability depends not only on semantic scene compatibility or camera
position, but also camera orientation/pose and the physical route
connecting positions. Do not prematurely formalize a large camera-pose
schema from this one result.

Canonical hashes matched Integration Test 01:

- E `49154292cb2534ab333c2fb1ec6329ca8fa82855b8baca2b7078a4356e9357ff`
- A `d71319696162eab7e9c2dbe3c2f7037fd21bcb2aea877a98d8a223ce1e7b6820`

## X spatial specification

The Cinematographer proposed an intermediate **physical camera
position**, not an aesthetic 50/50 blend:

inside the dark wooden wardrobe, looking outward through partially
open doors into the attic.

Intended physical route:

cavern → glowing door → wardrobe interior → attic

Frozen `2026-09-05T22:26:28.799Z`, prediction
`7qxcwv6t1hrmt0d0eepsx5x6qw`. Complete prompt in
`stage2-x-spec.json`.

## X generation provenance

Exactly one canonical X. No aesthetic retry.

| | |
| --- | --- |
| File | `canonical/X.png` |
| Model | `black-forest-labs/flux-1.1-pro-ultra` |
| Seed | 10106 |
| Prediction | `xybr3y5zhsrmw0d0eeqb9011qc` |
| SHA-256 | `56e5038b0bf1b96853e0558dab202fb17599cb07cdcbb4d89535fd93d8829cf7` |
| Bytes | 1898644 |
| Settings | aspect 16:9, raw false, png, safety_tolerance 2 |
| Retries | 0 |

## Actual generated X

The generated still did **not** fully realize the requested geometry.

Observed:

- near-closed double door
- two knobs
- narrow starburst crack
- hanging coats barely represented

The Cinematographer inspected this actual image rather than assuming
the requested X had been produced.

## Actual-X review

| Leg | Decision | Reasoning |
| --- | --- | --- |
| E→X | **NOT_SHOOTABLE** | E presents a single door while X presents double doors / two knobs, creating structural mismatch for a continuous physical push through the threshold. |
| X→A | **NOT_SHOOTABLE** | X looks outward from a dark interior toward the room, while A is positioned in the room looking back toward the wardrobe. Connecting them requires a cut or approximately 180° camera reorientation not represented by the route. |

Gemini 3.1 Pro, frozen `2026-09-05T22:27:41.863Z`, prediction
`9qc4wxzranrmt0d0eeq9b3mx4g`.

## Protocol stop

Zero video generations. No Camotion plans. No shooting frames. No
research assembly. X was not regenerated.

The fresh seed-90 direct E→A control was **not** generated because the
protocol stop occurred before video generation. Historical Integration
Test 01 `videos/E-A.mp4` (prediction `87hkxhvq99rmt0d0dtw8mxvyc0`,
unseeded) remains historical evidence only. This experiment does **not**
contain a video comparison.

## Interpretation

A destination object is not enough. The shot needs traversable depth
through the transition.

Semantic compatibility between endpoints is also not sufficient.
Shootability requires reasoning about traversable volume, threshold
depth, foreground geometry, perspective, occlusion/parallax
opportunity, camera position, camera orientation, physical route, and
how much missing geography the video model would need to invent.

A useful Cinematographer question:

> Is there somewhere physically plausible for the camera to be between
> these observations?

Intermediate X should represent an actual camera observation along that
route, not a visual blend between scenes.

The strongest result here is behavioral. The Cinematographer:

1. rejected an apparently semantically sensible E→A transition based
   on physical shootability;
2. proposed a spatial repair rather than an aesthetic midpoint;
3. inspected the actual generated repair;
4. rejected its own proposed strategy when the generated set did not
   satisfy the required geometry.

A proposed intermediate canonical is **not** automatically accepted as
canonical merely because an agent requested it. Generated media is
evidence that agents inspect, not an assumed successful execution of
their intent.

Do not claim this proves general autonomous shootability. This is one
deliberately bounded Wardrobe Loop case.

This experiment did not reach Camotion or video stages. Infer nothing
new about Camotion performance from it.

## Limitations

- one pair (E and A)
- one X generation
- one reasoning model (Gemini 3.1 Pro)
- Wardrobe Loop only
- no video comparison
- no proof that a different X would have been shootable
- no camera-pose schema
- no production planner implementation

## Product implication

Supported Phase 1 architecture direction, **not implemented as a
generalized production loop in this checkpoint**:

1. Director/Cinematographer reasons about intended spatial route.
2. Cinematographer evaluates whether actual generated sets are
   shootable.
3. If insufficient spatial evidence exists, the Cinematographer may
   request/recommend an intermediate canonical camera position.
4. Image generation builds that proposed set.
5. Cinematographer inspects the **actual** generated result.
6. The generated set must pass shootability review before filmmaking
   continues.
7. If the actual set does not support the route, reject it and return
   upstream rather than forcing video generation.

Shorthand: the Director/CM proposes where to put the camera;
generation builds the set; the CM walks onto the actual generated set;
the CM decides whether it can physically shoot the route.

## Phase 1 stop line

TunnelVision Research Phase 1 is **complete**.

The purpose of Phase 1 was not to discover an optimal filmmaking
pipeline. It was to establish a sufficiently supported pipeline capable
of moving into autonomous product development.

No more dedicated Phase 1 research experiments. The next milestone is
product development, then Movie #2 through the product. Concrete
failures observed while making Movie #2 may reopen specific backlog
questions based on evidence.

> We are no longer trying to discover the optimal TunnelVision
> pipeline. We are building a sufficiently supported pipeline that can
> autonomously make movies.
