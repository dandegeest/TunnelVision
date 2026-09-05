# TunnelVision Architecture

> **Intended later split:** React owns the storyboard, the LLM owns
> direction, code owns geometry, and generative APIs only render.

That split is **not implemented**. This repository is in a Camotion-first
research stage. Do not read the later diagram as a description of
current code.

## Current implementation --- Camotion first

This repository is in a Camotion-first research stage. Application
code today is the Python `camotion/` package and a TypeScript
`media/` package for image and video generation, vision reasoning, and
a thin cinematographer pair planner used by Integration Test 01. Do
**not** create `web/`, `server/`, Director, Screenwriter, a full
Cinematographer product package, or a journey workspace runtime yet.

``` text
camotion/     Python package, CLI (unchanged renderer)
media/        MediaProvider (image + video) + ReasoningProvider
              + thin cinematographer planner (Integration Test 01)
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
    remains the conservative directed-traversal baseline. **01.8
    Route-Preserved Exposure remains the current Camotion
    baseline.** 01.9 Adaptive Exposure Integration is completed
    still-only evidence; the sparse-sampling hypothesis was not
    supported, and 01.9 is not promoted. A prompt-control family
    (`tuning/video-runs/prompt-control/camera-speed/`) holds 01.8
    A′/B′ constant and varies linguistic camera instruction; it is
    not Camotion 01.9. Unvalidated product brainstorms live in
    `docs/RESEARCH_BACKLOG.md`. 01.10 Depth-Compositor Ablation is
    completed still-only diagnostic evidence; the multi-layer
    compositor hypothesis was not supported as the origin of first
    appearance, and 01.10 is not promoted. 01.11 Exposure Operator
    Characterization is completed still-only diagnostic evidence;
    sparse trajectory sampling is not the dominant remaining cause
    of structured Ghost Library copies, and 01.11 is not promoted.
    01.12 Baked-Exposure Operating Window is completed still-only
    diagnostic evidence; no useful pristine-source operating window
    was observed (classification C + D), and 01.12 is not promoted.
    This closes the current exposure-operator tuning branch.
    **Integration Test 01 — The Wardrobe Loop** is completed: the
    first unattended end-to-end movie experiment (independent FLUX
    canonicals, Gemini 3.1 Pro cinematographer vision plans, Camotion
    01.8 shooting frames, Seedance 2.5 videos, human-reviewed
    assembled movie). It is **not** Camotion 01.13. Do not characterize
    it as Camotion solving or failing traversal. 01.8 remains the
    current Camotion baseline; 01.5 / 0.08 remains the conservative
    directed video baseline where appropriate. A later controlled
    Wardrobe A→B Seedance 2×2 (fixed seed 70) found that Camotion
    endpoints and the authoritative Cinematographer locomotion prompt
    were complementary: 04-conditioned-motion was the human-judged
    winner. That is one seed, not cross-seed proof. Working
    hypothesis: Camotion is motion-state conditioning, not image
    enhancement. Retain Camotion + CM prompting in the Phase 1
    pipeline. A later three-pair Wardrobe scene-aware strength
    experiment preferred Cinematographer-selected bounded strengths
    `{0.02, 0.04, 0.08}` over fixed `0.08`. **Camotion Phase 1 is
    frozen:** 01.8 operator, geometry, destination protection, depth
    behavior, sample count, route preservation, that strength
    vocabulary, and CM ownership of per-canonical strength. A later
    Wardrobe E→A shootability experiment is **completed** and is
    **not** Camotion work: the Cinematographer independently judged
    direct E→A NEEDS_INTERMEDIATE, specified one intermediate camera
    position X, inspected the actual generated X, and rejected both
    E→X and X→A. Protocol stopped before video. Infer nothing new
    about Camotion from it. **TunnelVision Research Phase 1 is
    complete.** No more dedicated Phase 1 research experiments. Next
    milestone is product development, then Movie #2 through the
    product; do not start that from this checkpoint. The movie-level
    metric
    is increasingly whether the model shoots the route, not whether
    A′ is aesthetically clean as a still. Camotion itself still knows
    nothing about Replicate. Local files are passed to Replicate as
    bytes (`Buffer`); Node ReadStreams are not auto-uploaded by the
    official SDK.
-   **Does not exist and must not be created yet:** `web/`, `server/`,
    Director, Screenwriter, a full Cinematographer product package,
    journey workspace runtime, Runway/Krea adapters, or a
    last-frame-discovery architecture.

The current **product direction** is a simple autonomous storyboard
(story → progressive canonicals → Keep/Redo → SHOOT MOVIE). That UI
is not built. A Runway hackathon “last-frame discovery” idea is a
research branch, not a replacement for this pipeline, and must not
restructure current application architecture.

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
Optional 01.8 route-preservation and 01.9 adaptive exposure are
opt-in flags on that path; both default off. 01.9 did not replace
`apply_multisample_exposure()`.

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
directed A→B baseline. 01.8 Route-Preserved Exposure remains the
current Camotion baseline.** 01.9 Adaptive Exposure Integration
(`tuning/01.9-adaptive-exposure-result.png`) densified taps along
the same 01.8 trajectory; the sparse-sampling hypothesis was **not
supported** on Ghost Library stills, and 01.9 is not promoted. 01.10
Depth-Compositor Ablation extracted real 01.8 intermediates without
changing the renderer; first appearance of the repeated-object
look is in strong exposure, not later compositing / route /
destination protection, on this fixture. 01.10 is not promoted and
is not a new renderer version. 01.11 Exposure Operator
Characterization compared 01.8/01.9 gather with research-only
operator families on a synthetic fixture and Ghost Library artifact
crops; sparse sampling is not the dominant remaining cause, and no
01.11 candidate is promoted. 01.12 Baked-Exposure Operating Window
found no useful pristine-source operating window on Ghost Library
(classification C + D); the current exposure-operator tuning branch
is closed, and no 01.12 condition is promoted. Do not treat pixel
similarity to Terran's reference as architecture or as an
optimization objective.

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

Director, Cinematographer, and a possible later Screenwriter are
**filmmaking roles**. A thin cinematographer pair planner exists in
`media/src/cinematographer/` for Integration Test 01. Final
Cinematographer module boundaries remain an open question. Do not
create ScreenwriterAgent.

Agent roles must not hardcode provider or model IDs. A later reasoning
provider should support configurable model routing by role or profile
so Director, Cinematographer, and Evaluator may use different models.

## Later media-provider boundary

TunnelVision owns normalized request/response types. Director
implementation must depend on that contract, not on a vendor SDK.

The first implemented slice lives in `media/` and currently exposes
**video and image generation**:

``` ts
interface MediaProvider {
  generateVideo(request: VideoGenerationRequest): Promise<GeneratedVideo>;
  generateImage(request: ImageGenerationRequest): Promise<GeneratedImage>;
}
```

`VideoGenerationRequest` currently carries a start shooting frame, an
optional end shooting frame, a prompt, and optional duration.
`ImageGenerationRequest` currently carries a prompt and optional seed.
Model- and provider-specific capabilities stay behind
`ReplicateMediaProvider` (Seedance 2.5 and FLUX 1.1 Pro Ultra). Extra
pristine/canonical reference images are not part of the current
contract. A `ReasoningProvider` with vision inputs also lives in
`media/` (Gemini 3.1 Pro adapter).

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
image/video MediaProvider lives in `media/`.

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
-   remaining 01.8 repeated-object / ghost-copy appearance: 01.9
    did not clearly remove it; 01.10 localized first appearance to
    strong exposure on Ghost Library stills, not compositor / route
    / destination protection. 01.11 found discrete 01.8 sampling
    artifacts and a filled dense point streak, while structured
    Ghost Library features still read as transformed copies; sparse
    sampling is not the dominant remaining cause. 01.12 found no
    useful pristine baked-exposure operating window (classification
    C + D). Exposure-operator tuning is closed. Do not reopen
    brute-force strength/sigma/kernel search. Do not reopen 01.12.
    Keep the 01.8 operator. Scene-aware bounded strength selection
    from `{0.02, 0.04, 0.08}` is **completed** Phase 1 evidence
    (Wardrobe A→B / B→C / D→E; adaptive 3–0 over fixed `0.08` on
    two independent human reviews). It is **not** Camotion 01.13.
    **Camotion Phase 1 is frozen.** Do not start `.06`, new kernels,
    sample-count sweeps, compositor experiments, or cross-seed
    Camotion sweeps unless a concrete later movie failure provides
    reason.
-   final Cinematographer module boundaries
-   production implementation of shootability review and optional
    intermediate canonicals (Phase 1 evidence exists on Wardrobe
    E→A / X; do not formalize a camera-pose schema from that one
    result; do not expand the thin IT01 planner in this checkpoint)
-   shot-boundary velocity continuity and variable shot duration
-   a possible Screenwriter agent upstream of the Director
-   how the future host process invokes Camotion
-   how a future Cinematographer derives changing camera geometry while
    turning toward a user-selected destination
