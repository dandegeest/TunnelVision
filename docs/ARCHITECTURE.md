# TunnelVision Architecture

> **React owns the storyboard, the LLM owns direction, code owns
> geometry, and generative APIs only render.**

## High-level system

``` text
React / TypeScript UI
        |
Node / TypeScript API
        |
   +----+----------------+
   |                     |
Reasoning Provider    MediaProvider
   |                  Replicate initially
Structured JSON       Runway at hackathon
   |                  Krea optional
Cinematographer
   |
CameraMotionPlan JSON
   |
Camotion Engine (Python)
   |
Motion-conditioned frame
```

## Initial stack

Frontend: React + TypeScript + Vite + Zod. Add lightweight state
management only when needed.

Backend: thin Node/TypeScript API for reasoning calls, media calls,
orchestration, validation, journey persistence and prompt templating.

Persistence: JSON plus files. Do not introduce a database initially.

## Camotion boundary

Camotion is a standalone deterministic Python graphics package.

Public contract:

`source image + CameraMotionPlan JSON -> motion-conditioned image`

It knows nothing about LLMs, prompting, Replicate, Runway, Krea or
TunnelVision orchestration.

Python is preferred because later work naturally intersects depth
estimation, masks, OpenCV, arrays, warping and CV/ML tooling.

## Media-provider boundary

TunnelVision owns normalized request/response types.

``` ts
interface MediaProvider {
  generateImage(request: ImageGenerationRequest): Promise<GeneratedImage>;
  generateVideo(request: VideoGenerationRequest): Promise<GeneratedVideo>;
}
```

Implement **ReplicateProvider** first. Add RunwayProvider if/when needed
for the hackathon. Evaluate Krea only if useful. Do not scaffold unused
adapters.

## Reasoning vs geometry

Reasoning handles semantics: environment, meaningful destination, route,
foreground occluders, protected regions, candidate evaluation and
preference.

Deterministic code handles coordinates, depth data, masks, flow fields,
exposure accumulation, color conversion and compositing.

## Data ownership

TunnelVision owns Journey, CanonicalFrame, CandidateFrame,
DirectorDecision, ShotPlan, CameraMotionPlan, GenerationRequest,
GeneratedAsset and PreferenceState schemas. External API objects are
normalized at provider boundaries.

## Prototype workspace

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

## Non-goals

No database, Redis, queues, Kubernetes, vector database, generic agent
framework, microservices or workflow engine until a demonstrated need
exists.
