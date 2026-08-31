# TunnelVision Architecture

> **Intended later split:** React owns the storyboard, the LLM owns
> direction, code owns geometry, and generative APIs only render.

That split is **not implemented**. This repository is in a Camotion-first
research stage. Do not read the later diagram as a description of
current code.

## Current implementation --- Camotion first

After the next scaffold, the only application code should be:

``` text
camotion/     Python package, CLI
                |
         CameraMotionPlan JSON  (see DATA_MODEL.md)
                |
         motion-conditioned PNG
```

``` bash
python -m camotion --image input.png --plan camera-motion.json --output output.png
```

-   **Exists now:** planning docs; genesis experiment record.
-   **Next to exist:** `camotion/` only.
-   **Does not exist and must not be created yet:** `web/`, `server/`,
    media providers, Director, Cinematographer modules, journey
    workspace runtime.

Camotion is a standalone deterministic Python graphics package.

Public contract:

`source image + CameraMotionPlan JSON -> motion-conditioned image`

It knows nothing about LLMs, prompting, Replicate, Runway, Krea, Node,
or TunnelVision orchestration. It has **no TypeScript or Node
dependency**. Pydantic implements CameraMotionPlan v1. JSON Schema for
other languages, if any, can be generated from those models later.

Python is used because later *optional* work may intersect depth,
masks, OpenCV, arrays, and warping. **v1 does not include depth.**

Camotion v1 is a radial-exposure experiment inspired by TunnelTV
motion-conditioning findings. It is not Terran Boylan's Photoshop
workflow. See [IMPLEMENTATION.md](IMPLEMENTATION.md). v1 models
**forward translation only** (radial expansion around a supplied focus
of expansion). It does not implement strafing or turning / yaw.

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
Camotion Engine (Python; already specified)
   |
Motion-conditioned frame
   |
   +--> video request: start, end, optional refs, prompt
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

When `VideoGenerationRequest` is designed, it must be able to
represent:

-   start frame
-   end frame
-   optional additional reference images
-   prompt
-   model / provider-specific capabilities hidden behind the adapter

Genesis used first/last-frame conditioning and, in some tests, an extra
pristine reference. Those are capabilities the future request must
*allow*, not fields to specify now.

Implement **ReplicateProvider** first, **after** the contract exists and
**before** Director code calls generation. Add RunwayProvider if/when
needed for the hackathon. Evaluate Krea only if useful. Do not
scaffold unused adapters. Do not implement any provider as part of
Camotion v1.

Provider-specific types must not leak into CameraMotionPlan, Camotion,
or later journey/storyboard state.

## Reasoning vs geometry (intended)

Reasoning (later): environment, meaningful destination, route,
occluders, candidate evaluation, preference.

Deterministic code (Camotion now; more later): coordinates, flow
fields, exposure accumulation, destination protection. Depth, masks,
and linear-light compositing are later **if** experiments justify them.

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
-   depth estimation implementation
-   final Cinematographer module boundaries
-   how the future host process invokes Camotion
-   how a future Cinematographer derives changing camera geometry while
    turning toward a user-selected destination
