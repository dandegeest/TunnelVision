# TunnelVision Product Plan

## Product thesis

TunnelVision turns the manually directed **TunnelTV** filmmaking
technique into an agentic system for exploring and filming continuous
journeys through imagined worlds.

TunnelTV demonstrated that successive AI-generated viewpoints can be
manually selected and carried forward to create the feeling of traveling
through a coherent imagined environment. TunnelVision asks what happens
when that loop becomes self-directing.

> **Preserve the world's rules while changing the viewer's question.**

TunnelVision is not primarily a video generator. It is a system for
**directing an ongoing journey through an imagined space**. A finished
film is one traversal through that world.

## Origin and naming

**TunnelTV** is the original manually directed technique demonstrated in
the AI music video for Peter Gabriel's *Digging in the Dirt*. The
workflow was developed by Terran Boylan and depends on deliberate human
generation, selection, visual continuity, and motion conditioning.

**TunnelVision** is the agentic evolution being built from that
foundation.

-   **TunnelTV:** manual filmmaking through an imagined world.
-   **TunnelVision:** agentic exploration and filmmaking through
    potentially endless imagined worlds.

Preserve clear attribution to Terran Boylan and distinguish his original
craft from later TunnelVision experiments and extensions.

## User promise

Starting with an image and a story idea, TunnelVision builds a
physically plausible first-person journey through an imagined world. The
user can let the system direct autonomously or intervene by choosing an
alternative frame or pointing at a destination and effectively saying
**go there**.

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
radial-exposure experiment inspired by TunnelTV motion-conditioning
findings. It is **not** a port of Terran Boylan's depth-aware Photoshop
workflow (Z/depth, multiple blur operations, destination protection).
Optional depth weighting is a renderer sidecar, not part of
CameraMotionPlan v1. See [IMPLEMENTATION.md](IMPLEMENTATION.md) and
[DATA_MODEL.md](DATA_MODEL.md).

There is no separate Edit agent initially. The storyboard keeps
**canonical / pristine frames** as world-state authority. Video
currently receives Camotion **shooting frames**, not those canonical
images. How to derive distinct arrival/departure derivatives
(`B_in` / `B_out`) is an **open question** --- do not treat it as
solved.

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
-   **Structured intent, deterministic geometry.** AI reasons about
    filmmaking; code owns pixel math.
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

The MediaProvider contract must exist before Director code depends on
generation. Do not implement providers as part of the Camotion
milestone.

The current intended video path is:

``` text
canonical A  →  optional CV / depth map  →  Camotion  →  shooting frame A'
canonical B  →  optional CV / depth map  →  Camotion  →  shooting frame B'
A' + B' + locomotion prompt  →  video model  →  continuous shot
```

A later video-generation request should represent a start shooting
frame, an end shooting frame, and a prompt. Extra pristine/canonical
reference images are **not** part of the current architecture. Model-
and provider-specific capabilities stay behind the adapter. That
schema is not designed yet. Genesis locomotion prompts are
experimental artifacts, not a vendor-neutral API.

## Initial experience

Ask for a starting frame, freeform journey/story idea, and approximate
duration. A later Director may propose a canonical storyboard. The user
can accept it, inspect alternatives, replace a selection, point to a
different destination, and step through frames to audit spatial
continuity.

How duration maps to shot count is an **open question**. Do not treat
"Director infers viewpoint count from duration" as a specified
algorithm. This initial experience is the intended product, not the
current Camotion research.

## Success criteria

A successful prototype makes the viewer believe the camera occupies
successive positions in one coherent world, can physically travel
between them, continuously moves rather than morphing, discovers
meaningful new information, and can be redirected with a simple spatial
gesture.

> **I pointed there, and it actually went there.**
