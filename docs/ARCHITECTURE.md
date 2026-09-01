# TunnelVision Architecture

> **Intended later split:** React owns the storyboard, the LLM owns
> direction, code owns geometry, and generative APIs only render.

That split is **not implemented**. This repository is in a Camotion-first
research stage. Do not read the later diagram as a description of
current code.

## Current implementation --- Camotion first

This repository is in a Camotion-first research stage. Application
code today is the Python `camotion/` package and CLI. Do **not**
create `web/`, `server/`, media providers, Director, Cinematographer
modules, or a journey workspace runtime yet.

``` text
camotion/     Python package, CLI
                |
         canonical image
         + CameraMotionPlan JSON
         + optional near-weight sidecar
                |
         shooting-frame PNG
```

``` bash
python -m camotion --image input.png --plan camera-motion.json --output output.png
python -m camotion --image input.png --plan camera-motion.json --depth near-weight.png --output output.png
```

-   **Exists now:** planning docs; genesis experiment record; Camotion
    v1 (radial field, multisample exposure, destination protection);
    optional near-weight CLI/renderer input.
-   **Does not exist and must not be created yet:** `web/`, `server/`,
    media providers, Director, Cinematographer modules, journey
    workspace runtime.

Camotion is a standalone deterministic Python graphics package.

Frozen plan contract:

`canonical image + CameraMotionPlan JSON -> shooting-frame image`

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

Depth/CV observation belongs outside Camotion. Camotion only applies a
supplied near-weight map, if any, to the existing radial field.

Camotion v1 models **forward translation only** (radial expansion
around a supplied focus of expansion). It is not Terran Boylan's
Photoshop workflow. It does not implement strafing or turning / yaw.
See [IMPLEMENTATION.md](IMPLEMENTATION.md).

### Canonical frames vs shooting frames

**Canonical / pristine frames** are storyboard and world-state
authority. They are Camotion inputs. They are **not** currently
supplied to the video model.

**Shooting frames** are Camotion-conditioned derivatives. They are
what video generation currently receives as start and end images.

``` text
canonical A  →  optional CV / depth  →  Camotion  →  A'
canonical B  →  optional CV / depth  →  Camotion  →  B'
A' + B' + locomotion prompt  →  video model
```

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

## Later media-provider boundary

TunnelVision will own normalized request/response types. Director
implementation must depend on that contract, not on a vendor SDK.

Sketch only --- **not a frozen schema, do not implement in the
Camotion milestone:**

``` ts
interface MediaProvider {
  generateImage(request: ImageGenerationRequest): Promise<GeneratedImage>;
  generateVideo(request: VideoGenerationRequest): Promise<GeneratedVideo>;
}
```

When `VideoGenerationRequest` is designed, the **current** intended
inputs are:

-   start shooting frame
-   end shooting frame
-   prompt
-   model / provider-specific capabilities hidden behind the adapter

Canonical / pristine frames are not video inputs in the current
architecture. Extra reference images were an experimental
provider-side capability (recorded in the genesis log) and are **not**
part of the current contract.

Implement **ReplicateProvider** first, **after** the contract exists and
**before** Director code calls generation. Add RunwayProvider if/when
needed for the hackathon. Evaluate Krea only if useful. Do not
scaffold unused adapters. Do not implement any provider as part of
Camotion work.

Provider-specific types must not leak into CameraMotionPlan, Camotion,
or later journey/storyboard state.

## Reasoning vs geometry (intended)

Reasoning (later): environment, meaningful destination, route,
occluders, candidate evaluation, preference.

Deterministic code (Camotion now): coordinates, flow fields, exposure
accumulation, destination protection, optional near-weight scaling of
the existing radial field. Depth **estimation**, masks as CV products,
and linear-light compositing stay outside Camotion unless a later
experiment explicitly moves them.

## Data ownership

**Frozen now:** CameraMotionPlan v1 --- [DATA_MODEL.md](DATA_MODEL.md).

**Not specified yet:** Journey, CanonicalFrame, CandidateFrame,
DirectorDecision, ShotPlan (illustrative only), GenerationRequest,
GeneratedAsset, PreferenceState.

External API objects are normalized at provider boundaries when those
exist.

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
-   whether a more photographic depth-dependent renderer should replace
    or supplement current radial exposure (open; do not implement now)
-   recursive-space / reconstituted-environment artifacts in video
-   final Cinematographer module boundaries
-   how the future host process invokes Camotion
-   how a future Cinematographer derives changing camera geometry while
    turning toward a user-selected destination
