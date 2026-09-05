# TunnelVision Product Plan

## Product thesis

TunnelVision is agentic filmmaking research extending filmmaker
**Terran Boylan's original TunnelVision** technique: a system for
exploring and filming continuous journeys through imagined worlds.

Terran's original manual workflow showed that successive AI-generated
viewpoints can be selected and carried forward to create the feeling of
traveling through a coherent imagined environment. This research asks
what happens when that loop becomes self-directing.

> **Preserve the world's rules while changing the viewer's question.**

TunnelVision is not primarily a video generator. It is a system for
**directing an ongoing journey through an imagined space**. A finished
film is one traversal through that world.

## Origin and naming

**TunnelVision** originated with filmmaker **Terran Boylan**. He
developed the concept and manual filmmaking technique through work for
his own YouTube channel and video content. That work predates the
Peter Gabriel *Digging in the Dirt* project. The technique was later
adapted for DITD, where we used the playful label **TunnelTV**.

This repository keeps the TunnelVision name as a continuation of that
lineage. The current research extends Terran's original concept and
manual workflow into an agentic filmmaking system. It does not rename
his technique, and TunnelTV is not the original name of the technique.

-   **Original TunnelVision:** Terran Boylan's concept and manual
    filmmaking technique, developed through his own video work.
-   **TunnelTV:** playful DITD-era label for that application's
    adaptation of TunnelVision.
-   **Current TunnelVision research:** agentic Director /
    Cinematographer architecture, Camotion, and later experiments
    built from Terran's foundation.

Preserve clear attribution to Terran Boylan for the original concept
and manual craft, and distinguish that foundation from later agentic
and Camotion work.

## User promise

The current product direction is a **simple autonomous storyboard**,
not a large interactive editor.

1.  The user gives TunnelVision a story / journey concept.
2.  TunnelVision plans the film.
3.  Storyboard frames appear progressively as generation completes so
    the user watches the story emerge.
4.  The user can optionally intervene at the cheap canonical stage:
    Keep, Redo, and possibly Redo With Note / Adjust.
5.  Once satisfied, the user presses **SHOOT MOVIE**.
6.  TunnelVision performs Cinematographer planning, Camotion
    conditioning, video generation, evaluation/retry as appropriate,
    and deterministic final assembly.

The storyboard is initially a readable representation of the
autonomous crew's decisions rather than a traditional manual editor.

> **TunnelVision presents decisions, not generations.**

The UI should reveal filmmaking intent without requiring the user to
know filmmaking vocabulary. A redo of canonical D would invalidate
and recompute adjacent shot reasoning for C→D and D→E. Destination
pointing (**go there**) remains a later collaborative capability, not
the initial product surface. Do not build this UI in the current
checkpoint.

## Filmmaking roles

### Director

Decides **where to go next**: understand the current frame and journey,
preserve world rules, propose meaningful next camera positions,
distinguish camera displacement from scene evolution, evaluate
candidates, learn from selections, and maintain discovery.

### Cinematographer

Decides **how to physically get there on camera**: determine route,
destination, perspective, foreground geometry and motion cues; produce
structured shot/camera data; invoke Camotion to derive **shooting
frames** from canonical frames; and prepare video-generation inputs
from those shooting frames.

Camotion is deterministic graphics, not an agent. **Camotion v1** is a
radial-exposure experiment that approximates and extends aspects of
Terran Boylan's original TunnelVision motion-conditioning workflow. It
is **not** a port of his depth-aware Photoshop workflow (Z/depth,
multiple blur operations, destination protection).
Optional depth weighting is a renderer sidecar, not part of
CameraMotionPlan v1. See [IMPLEMENTATION.md](IMPLEMENTATION.md) and
[DATA_MODEL.md](DATA_MODEL.md).

Working hypothesis from the Wardrobe Loop A→B Seedance 2×2 (one
controlled seed): **Camotion is motion-state conditioning, not image
enhancement.** Shooting frames need not be aesthetically superior
stills. 01.12's Ghost Library still-image structured-copy limit
remains real and is not contradicted. Current evidence is enough to
**retain Camotion plus Cinematographer locomotion prompting** as
complementary Phase 1 pipeline pieces. It is not proof that Camotion
is universally necessary or that the current operator is optimal.

There is no separate Edit agent initially. The storyboard keeps
**canonical / pristine frames** as world-state authority. Video
currently receives Camotion **shooting frames**, not those canonical
images. How to derive distinct arrival/departure derivatives
(`B_in` / `B_out`) is an **open question** --- do not treat it as
solved. Deterministic concatenation of ordered shot videos is
plumbing, not an Edit agent.

Default finishing should prefer native generated shots, deterministic
concat, then conventional deterministic upscale if required. Generative
or AI upscaling of adjacent clips is not Phase 1. See
[RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md).

## Product principles

-   **Decisions, not generations.** The main UI shows the canonical
    journey; candidates are transient editing material.
-   **Variable autonomy.** Collaborative, supervised and autonomous
    modes use the same Director loop.
-   **Selection is prompting.** Selected pixels become the next
    reference and propagate preferences.
-   **Visual continuity is not traversability.** Camera displacement and
    spatial reachability must be evaluated explicitly.
-   **Locomotion outranks destination matching.** Morphing/dissolving to
    the endpoint is failure.
-   **Canonical frames are position samples, not stop points.** Forward
    motion is not the same as velocity continuing through a shot
    boundary.
-   **Directed A→B preserves authored endpoints.** For a directed
    traversal, A and B are authoritative shot endpoints. The generated
    video's first and last frames should match the supplied start and
    end frames as closely as the video model permits, ideally
    pixel-perfect. Judge endpoint fidelity first, then coherent
    spatial traversal, then locomotion/parallax quality; creative
    scene evolution must not violate endpoint authority. This is a
    directed-shot requirement. Future Discovery / open-exploration
    generation may invent future geometry after an authoritative
    starting frame; that mode is not current product behavior.
-   **Structured intent, deterministic geometry.** AI reasons about
    filmmaking; code owns pixel math. Generative models make
    filmmaking decisions; deterministic code preserves them.
-   **Provider independence.** TunnelVision owns its contracts;
    generation providers only render.

## Provider strategy

Development initially uses **Replicate**. If accepted to the Runway
hackathon, add/swap a native **Runway** provider according to event
rules. **Krea** may be evaluated as another provider. Provider-specific
structures must not leak into Director, Cinematographer, storyboard, or
Camotion state. Agent roles must not hardcode provider or model IDs. A
reasoning provider should support configurable model routing by role
or profile so Director, Cinematographer, and Evaluator may use
different models.

The MediaProvider contract in `media/` now covers **video and image
generation** (Seedance 2.5 and FLUX 1.1 Pro Ultra adapters). Director
code must depend on that contract, not on a raw Replicate client. Do
not implement Runway or Krea adapters in this slice. A thin
Cinematographer pair planner also exists in `media/` for Integration
Test 01; it is not a finished product package.

The current intended video path is:

``` text
canonical A  →  optional CV / depth map  →  Camotion  →  shooting frame A'
canonical B  →  optional CV / depth map  →  Camotion  →  shooting frame B'
A' + B' + locomotion prompt  →  video model  →  continuous shot
```

A later video-generation request should represent a start shooting
frame, an end shooting frame, and a prompt. Extra pristine/canonical
reference images are **not** part of the current architecture. Model-
and provider-specific capabilities stay behind the adapter. The first
TypeScript implementation of that request lives in `media/src/types.ts`.
Genesis locomotion prompts are experimental artifacts, not a
vendor-neutral API.

## Initial experience

The intended first product surface is the autonomous storyboard above:
story concept in, progressive canonicals out, optional Keep / Redo,
then **SHOOT MOVIE**. Approximate duration and destination pointing
are later collaborative controls, not the opening contract.

How duration maps to shot count, and whether shot duration should vary
per move, are **open questions**. Do not treat "Director infers
viewpoint count from duration" as a specified algorithm. Do not
formalize a duration schema in this checkpoint.

An **unvalidated** later crew hypothesis places a Screenwriter agent
upstream of the Director (narrative beats and journey structure,
without Camotion or provider geometry). Do not create
`ScreenwriterAgent` or Screenwriter schemas until evidence justifies
them. See [RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md).

This initial experience is current product direction, not a claim that
the UI exists. Integration Test 01 exercised the unattended pipeline
behind SHOOT MOVIE, not the storyboard UI.

## Success criteria

A successful prototype makes the viewer believe the camera occupies
successive positions in one coherent world, can physically travel
between them, continuously moves rather than morphing, discovers
meaningful new information, and can be redirected with a simple spatial
gesture.

> **I pointed there, and it actually went there.**
