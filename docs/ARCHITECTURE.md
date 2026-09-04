# TunnelVision Architecture

> **Intended later split:** React owns the storyboard, the LLM owns
> direction, code owns geometry, and generative APIs only render.

That split is **not implemented**. This repository is in a Camotion-first
research stage. Do not read the later diagram as a description of
current code.

## Current implementation --- Camotion first

This repository is in a Camotion-first research stage. Application
code today is the Python `camotion/` package and a small TypeScript
`media/` package for video generation. Do **not** create `web/`,
`server/`, Director, Cinematographer modules, or a journey workspace
runtime yet.

``` text
camotion/     Python package, CLI (unchanged renderer)
media/        MediaProvider + Replicate adapter (video only)
```

``` bash
python -m camotion --image input.png --plan camera-motion.json --output output.png
python -m camotion --image input.png --plan camera-motion.json --depth near-weight.png --output output.png
```

-   **Exists now:** planning docs; genesis experiment record; Camotion
    v1 (radial field, multisample exposure, destination protection);
    optional near-weight CLI/renderer input; Terran Boylan original
    TunnelVision Action reverse-engineering as reference research; an **experimental**
    depth-banded, motion-aware compositor path (not the default
    renderer); a TypeScript `MediaProvider` contract and Replicate
    Seedance 2.5 adapter (`media/`), plus a sequential historical
    batch runner. A controlled Replicate series exists for 01.3–01.8
    (`tuning/video-runs/replicate-bytedance-seedance-2.5/`). 01.5
    remains the conservative directed-traversal baseline; 01.8 is
    the leading experimental branch. A prompt-control family
    (`tuning/video-runs/prompt-control/camera-speed/`) holds 01.8
    A′/B′ constant and varies linguistic camera instruction; it is
    not Camotion 01.9. Unvalidated product brainstorms live in
    `docs/RESEARCH_BACKLOG.md`. Camotion itself still knows
    nothing about Replicate. Local files are passed to Replicate as
    bytes (`Buffer`); Node ReadStreams are not auto-uploaded by the
    official SDK.
-   **Does not exist and must not be created yet:** `web/`, `server/`,
    Director, Cinematographer modules, journey workspace runtime,
    image generation, Runway/Krea adapters.

Camotion is a standalone deterministic Python graphics package.

Frozen plan contract:

`image + CameraMotionPlan JSON -> shooting-frame image`

An optional near-weight image may be supplied **beside** the JSON
(`--depth`). It is not a CameraMotionPlan field. If omitted, behavior
matches the radial-only path.

Camotion knows nothing about LLMs, prompting, Replicate, Runway, Krea,
Node, or TunnelVision orchestration. It has **no TypeScript or Node
dependency**. It does **not** estimate depth, run CV models, or call
generators. Pydantic implements CameraMotionPlan v1.

Research split:

``` text
Agent reasons  →  CV observes / measures  →  Camotion renders  →  video model films
```

Depth estimation and CV scene analysis belong outside Camotion.
Camotion may consume a supplied near-weight map and deterministically
weight its motion field with it.

Camotion v1 models **forward translation only** (radial expansion
around a supplied focus of expansion). It is not Terran Boylan's
Photoshop workflow. It does not implement strafing or turning / yaw.
See [IMPLEMENTATION.md](IMPLEMENTATION.md).

### Implemented Camotion vs Terran Action research

**Current default renderer** (continuous near-weight path; `render()`):

``` text
image + CameraMotionPlan JSON
  → forward radial motion field
  → optional near_weight multiplies that field
  → multisample outgoing exposure
  → destination-protection blend
  → shooting-frame image
```

If no near-weight sidecar is supplied, the radial-only path is
unchanged. Depth estimation remains outside Camotion. Optional
near-weight is renderer/CLI input, not a CameraMotionPlan v1 field.
Do not redefine the generic Camotion engine contract around
TunnelVision-specific canonical-frame language.

**Experimental implemented path** (not default; not a replacement):
depth-banded, motion-aware compositing over pristine source, then the
same destination-protection blend. Strong and medium radial exposures
use the existing multisample machinery. The strong visibility mask is
itself motion-treated. Invoked separately from normal `render()`.

Terran Boylan's original **TunnelVision** Photoshop Action remains
**reference research**. Camotion is **not** a port or reimplementation
of it.

**Our interpretation** of the observed Action, not a claim Terran
made: the result is better described as **depth-banded, motion-aware
exposure compositing** than as one continuously depth-scaled radial
blur.

On the Ghost Library fixture, that experimental path with **outgoing**
start-frame exposure produced a more photographic still
(`tuning/01.5-banded-result.png`) and materially reduced, but did not
eliminate, recursive-space reconstruction in the corresponding video
(`tuning/01.5-banded-video.mp4`). This is one fixture, not a renderer
replacement. **01.5 outgoing orientation at strength 0.08 is the
current working experimental baseline for directed A→B on this
fixture.** Tuning values are not architecture.

A later one-variable start-frame orientation test
(`tuning/01.6-terminal-start-result.png`,
`tuning/01.6-terminal-start-video.mp4`) reversed the exposure sample
set so history terminated at canonical A. On Ghost Library / Krea
that **worsened** the initial reconstruction. A later Replicate
rerun of the same 01.6 A′ did **not** reproduce that severe
collapse/retreat. Do not adopt terminal-at-canonical start exposure
as the working hypothesis. Do not treat the helper as
`A_in` / `A_out` or `B_in` / `B_out` architecture.

Halving start-frame strength to 0.04 on the same 01.5 path
(`tuning/01.7-banded-strength-004-result.png`,
`tuning/01.7-banded-strength-004-video.mp4`) removed the obvious
initial recursion on Ghost Library / Seedance 2.5 but reduced
authority over authored starting geometry. **0.04 is not promoted.**
This is a fixture-level tradeoff, not a new renderer contract.

An experimental **route-preservation** modifier (01.8; off by
default) attenuates strong/medium visibility inside a geometric
traversal corridor while leaving destination protection unchanged.
It is not CameraMotionPlan, not default `render()`, and not a
promoted baseline. On Ghost Library the still retained peripheral
motion treatment and preserved more central route geometry
(`tuning/01.8-route-preserved-result.png`). The later Seedance 2.5
via Krea video (`tuning/01.8-route-preserved-video.mp4`) showed an
apparent backward/retreat opening before forward traversal. A
controlled Replicate rerun of the same 01.8 A′
(`tuning/video-runs/replicate-bytedance-seedance-2.5/01.8/01.8-result.mp4`)
did **not** reproduce that pronounced backward-then-forward
behavior. The Krea opening should not currently be treated as an
intrinsic property of 01.8. **01.5 / 0.08 remains the conservative
directed A→B baseline. 01.8 is the leading experimental branch.**
Do not treat pixel similarity to Terran's reference as architecture
or as an optimization objective.

### Canonical frames vs shooting frames

**Canonical / pristine frames** are storyboard and world-state
authority. They are **not** currently supplied to the video model.
TunnelVision currently supplies a canonical frame as Camotion's image
input. Camotion itself does not know what a canonical frame,
storyboard, or world-state asset is.

**Shooting frames** are Camotion-conditioned derivatives. They are
what video generation currently receives as start and end images.

``` text
canonical A  →  optional CV / depth  →  Camotion  →  A'
canonical B  →  optional CV / depth  →  Camotion  →  B'
A' + B' + locomotion prompt  →  video model
```

For **directed A→B** traversal, A and B are the authored shot
endpoints. Video currently receives shooting frames A' and B' derived
from them. Those supplied start and end frames are authoritative: the
generated video's boundary frames should match them as closely as the
video model permits, ideally pixel-perfect. Evaluation priority: (1)
endpoint fidelity, (2) coherent spatial traversal between endpoints,
(3) locomotion/parallax quality, (4) creative scene evolution only
insofar as it does not violate endpoint authority.

This requirement is specific to directed A→B. Future Discovery /
open-exploration generation may intentionally invent future geometry
after an authoritative starting frame. That mode is not current
architecture and is not designed here.

An extra pristine/canonical reference image is **not** part of the
current generation contract. That idea was tested and is recorded in
the exploration log; it is not current architecture.

## Intended later architecture

When the product exists, the intended shape is:

``` text
React / TypeScript UI          (later)
        |
Node / TypeScript API          (later; invocation of Camotion TBD)
        |
   +----+----------------+
   |                     |
Reasoning Provider      MediaProvider          (later)
   |                    Replicate initially
Director /              Runway at hackathon
Cinematographer roles   Krea optional
   |                     |
ShotPlan / prompts      image + video render
   |
CameraMotionPlan JSON
   |
Camotion Engine (Python)
   |
Shooting frame
   |
   +--> video request: shooting-frame start, shooting-frame end, prompt
```

How Node (or another host) will invoke Camotion is **not decided**
(CLI subprocess vs other). Do not invent a service boundary for it
now.

Director and Cinematographer are **filmmaking roles**, not current
packages. Cinematographer module boundaries are an open question.

Agent roles must not hardcode provider or model IDs. A later reasoning
provider should support configurable model routing by role or profile
so Director, Cinematographer, and Evaluator may use different models.

## Later media-provider boundary

TunnelVision owns normalized request/response types. Director
implementation must depend on that contract, not on a vendor SDK.

The first implemented slice lives in `media/` and currently exposes
**video generation only**:

``` ts
interface MediaProvider {
  generateVideo(request: VideoGenerationRequest): Promise<GeneratedVideo>;
}
```

`VideoGenerationRequest` currently carries a start shooting frame, an
optional end shooting frame, a prompt, and optional duration. Model-
and provider-specific capabilities stay behind `ReplicateMediaProvider`
and the Seedance 2.5 adapter. Extra pristine/canonical reference images
are not part of the current contract.

Implement additional adapters (Runway, Krea) only if needed. Do not
scaffold unused adapters. Do not import Replicate from Camotion.

Provider-specific types must not leak into CameraMotionPlan, Camotion,
or later journey/storyboard state.

## Reasoning vs geometry (intended)

Reasoning (later): environment, meaningful destination, route,
occluders, candidate evaluation, preference.

Deterministic code (Camotion now): coordinates, flow fields, exposure
accumulation, destination-protection masks and blending, optional
near-weight scaling of the existing radial field. Depth **estimation**,
semantic segmentation, CV-derived scene masks, and linear-light
compositing stay outside Camotion unless a later experiment explicitly
moves them.

## Data ownership

**Frozen now:** CameraMotionPlan v1 --- [DATA_MODEL.md](DATA_MODEL.md).

**Not specified yet:** Journey, CanonicalFrame, CandidateFrame,
DirectorDecision, ShotPlan (illustrative only), PreferenceState.

External API objects are normalized at provider boundaries. The first
video MediaProvider lives in `media/`.

## Later prototype workspace (not created yet)

``` text
workspace/
  journeys/
    <journey-id>/
      journey.json
      frames/
      candidates/
      motion/
      video/
```

Do not create this tree for Camotion v1. Camotion examples/tests may
use local fixture files inside `camotion/`.

## Non-goals

No database, Redis, queues, Kubernetes, vector database, generic agent
framework, microservices, or workflow engine until a demonstrated need
exists.

No application frontend or API until a later milestone explicitly
starts them.

## Open questions

-   `B_in` / `B_out` handoff strategy
-   automated traversal scoring
-   PreferenceState schema
-   duration → shot count
-   how vanishing point is derived from a destination
-   depth estimation as CV **outside** Camotion (not a Camotion module)
-   start-frame temporal orientation: **rejected on Ghost Library**
    (Krea 01.6 worsened initial reconstruction; Replicate 01.6 did
    not reproduce that severe collapse/retreat; 01.5 outgoing
    remains the conservative experimental baseline; not
    `A_in` / `A_out` or `B_in` / `B_out` architecture)
-   start-frame exposure strength: **0.04 not promoted** on Ghost
    Library / Seedance 2.5 (obvious recursion gone; starting-geometry
    fidelity worse; 01.5 / 0.08 remains directed A→B working
    baseline; not architecture)
-   recursive-space / reconstituted-environment artifacts in video
    (materially reduced on Ghost Library 01.5 outgoing, not
    eliminated; Krea 01.6 made the start-of-shot behavior worse;
    Replicate 01.6 did not reproduce that severe collapse; 01.7
    removed the obvious initial event at the cost of endpoint
    geometry authority; one fixture)
-   whether environmental/foreground motion can serve as a perceptual
    witness to camera locomotion (observation from the Replicate
    series; not a proven mechanism)
-   apparent camera pace vs camera embodiment as possibly distinct
    controls (one Seedance pair; linguistic pace looked useful,
    linguistic walking embodiment did not clearly appear; not a
    schema)
-   final Cinematographer module boundaries
-   how the future host process invokes Camotion
-   how a future Cinematographer derives changing camera geometry while
    turning toward a user-selected destination
