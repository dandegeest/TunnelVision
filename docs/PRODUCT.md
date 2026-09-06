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

## Primary workspace: Plan | Shoot

**Decided product direction.** TunnelVision's primary filmmaking
workspace is **PLAN | SHOOT**.

> **Plan the journey. Shoot the journey.**

There is deliberately no Edit workspace. TunnelVision is not trying
to become an AI nonlinear editor.

Plan and Shoot are two views of the same evolving movie, not
disconnected workflows:

-   **Plan** expresses filmmaking intent: this is what we intend to
    make.
-   **Shoot** confronts that intent with generated reality: this is
    what the generated world actually gave us.
-   Production evidence can send the filmmaker back to Plan.

**Current implementation:** Product Slice 3 adds a thin Director that
turns the filmmaker story plus authoritative starting frame into
planned storyboard beats via `ReasoningProvider` (Gemini 3.1 Pro on
Replicate). Plan UI is unchanged: Conversation + storyboard grid.
Send asks the Director to plan; the composer is not a chat. Shoot
remains the Slice 1 Destinations / Journey timeline. Generation of
images and video is not wired. Live development currently uses the
Wardrobe Loop fixture to initialize Project state, including starting
frame A with a trusted media identity. Plan starts unplanned beyond A;
the Director's output becomes the planned continuation. The Director runtime resolves
that identity from Project state; it does not independently substitute
Wardrobe `A.jpg`. Arbitrary user story/image input is not implemented
yet. Visual checkpoint for the frozen Plan shell:
[genesis/research/11-product-slice-2.html](../genesis/research/11-product-slice-2.html).
First live Director observation:
[genesis/research/12-product-slice-3.html](../genesis/research/12-product-slice-3.html).

## Plan is a conversational storyboard

**Decided product direction.** Slice 2 implements the persistent
storyboard visualization and a static Conversation fixture. Chat
is not implemented yet.

Plan should be a **storyboard workspace driven by conversation**.
The user develops the movie with TunnelVision. As the conversation
develops, TunnelVision materializes a familiar visual storyboard
rather than exposing agent internals or filmmaking forms.

The conversation is an interaction mechanism, **not** the
authoritative project data model. The durable result is structured
Director / movie intent:

conversation → structured Director intent → storyboard visualization
→ approved / revised movie plan

The storyboard is persistent and revisable. It is not a disposable
prompt screen. Users should be able to make semantic revisions in
conversation ("pull farther back", "make the return physically
traversable"); the system updates the structured plan. Do not design
the complete conversation / revision architecture yet.

> **Preserve the path to sophistication; don't implement the
> sophistication early.**

### Storyboard images are provisional

Plan storyboard images are inexpensive visualizations of Director
intent. They are **not** canonical Destinations, production sets,
Camotion inputs, final frames, or evidence that the generated world
has that geometry.

Conceptual pipeline, **not current wiring**:

Plan conversation → Director shot / destination intent → provisional
storyboard visualization → production canonical generation →
Cinematographer inspects the actual generated set → physical shooting
plan → Camotion → Journey generation

### Storyboard visual language

**Product / UX direction, not architecture.** Traditional
black-and-white film storyboard; the UI owns chrome. See
[UX.md](UX.md).

> **The model generates the drawing. TunnelVision generates the
> storyboard.**

`prunaai/p-image` is a current development renderer candidate, not an
architectural dependency. See [IMPLEMENTATION.md](IMPLEMENTATION.md).

## User promise

The user develops a movie conversationally in Plan. A persistent
storyboard shows intended Destinations, composition, route,
choreography, pacing, and landmarks. When the plan is ready enough to
confront reality, Shoot generates actual Destinations, the
Cinematographer inspects those sets, and Journeys are produced only
when the route is physically shootable. Optional cheap intervention
remains (Keep / Redo / Redo With Note). Destination pointing (**go
there**) is a later collaborative capability.

> **TunnelVision presents decisions, not generations.**

The UI should reveal filmmaking intent without requiring filmmaking
vocabulary. A redo of destination D still invalidates adjacent
journeys C→D and D→E. Do not implement the full conversational Plan
in this checkpoint.

## Filmmaking roles

### Director

Decides **where to go next**: understand the current frame and journey,
preserve world rules, propose meaningful next camera positions,
distinguish camera displacement from scene evolution, evaluate
candidates, learn from selections, and maintain discovery.

Plan is Director-level. The Director specifies semantic / spatial
intent ("approach the house and enter through the bedroom window")
without pretending to know exact screen coordinates or physical
geometry before the production image exists. Planning independent
attractive endpoints is insufficient; plan the whole spatial journey
— camera position, destination, what lies between, thresholds,
orientation, loop closure, and choreography. Evidence: a destination
object is not enough; the shot needs traversable depth through the
transition. A strong transition lets the destination world become
visible before the current world disappears. Open doors, arches,
tunnels, windows, cave mouths, gaps, and paths around corners are
potentially spatial handoff mechanisms, not rigid generation rules.

### Cinematographer

Decides **how to physically get there on camera** after the actual
canonical exists: inspect that generated set; determine destination
position, vanishing point / forward geometry, traversal corridor,
occluders, route feasibility, required reorientation if later
supported, Camotion strength, and the locomotion prompt. Choose
Camotion conditioning strength from the bounded Phase 1 vocabulary
`{0.02, 0.04, 0.08}`; produce structured shot/camera data; invoke
Camotion to derive **shooting frames** from canonical frames; and
prepare video-generation inputs from those shooting frames.

Do not generate the final Cinematographer plan from Plan storyboard
drawings. Storyboard images are not evidence of actual geometry.

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

A later three-pair Wardrobe experiment preferred **scene-aware
bounded Camotion strength** over fixed `0.08`. The Cinematographer
inspects each actual canonical keyframe and chooses strength from
`{0.02, 0.04, 0.08}` (LIGHT / MEDIUM / STRONG). Strength is per
canonical, not necessarily one value per shot. Use the minimum
bounded conditioning needed to establish useful motion state.
Stronger Camotion does not automatically mean stronger perceived
camera travel. **Camotion Phase 1 is frozen.** Do not claim `0.02`
is globally best or that `0.08` is obsolete.

The Cinematographer also inspects **actual generated sets** before
expensive video. A destination object is not enough; the shot needs
traversable depth through the transition. Semantic compatibility
between endpoints is not sufficient: shootability includes traversable
volume, threshold depth, camera position **and orientation**, and a
physically plausible route between observations. A proposed
intermediate canonical is not automatically accepted merely because
an agent requested it. Generation builds the set; the Cinematographer
walks onto the actual result; if the geometry is not shootable, reject
it and return upstream rather than forcing video.

Not every Shoot problem should be solved in Shoot. Some failures
mean the generated set failed a good Director plan; some mean the
Director planned an inherently difficult spatial relationship.

> **The Cinematographer should not be forced to save a bad Director
> decision.**

> **A good Director decision can still produce a bad set.**

When Shoot discovers an unshootable relationship, one valid response
is return to Plan → revise the storyboard / route / Destination
intent → generate a new actual Destination → inspect the new set →
continue only if physically shootable. Returning to Plan does not
guarantee success. It starts another planning / production /
inspection loop. That is a major reason Plan must stay persistent
and revisable after production begins. Do not erase expensive
generated evidence merely because Plan changes. Exact revision /
history / undo semantics remain future work.

A later manual revised-E still
(`camotion/integration/wardrobe-loop-01/experiments/upstream-e-replanning/`)
showed that upstream replanning can specify a more traversable
spatial design, and that the generator can still fail the
world-to-world threshold. One still. Not proof that replanning does
not work. This is supported Phase 1 product / architecture
direction. It is **not** implemented as a generalized production
planner.

**TunnelVision Research Phase 1 is complete.** The purpose of Phase 1
was not to discover an optimal filmmaking pipeline. It was to
establish a sufficiently supported pipeline capable of moving into
autonomous product development. The next milestone is **product
development**, then Movie #2 through the product. The product itself
becomes the experimental apparatus.

The next product slice should still ask: what is the smallest thing
we can make real that causes fixture-driven UI to stop being a
fixture? When real media generation is introduced during product
development, prefer cheap draft providers through the existing
MediaProvider abstraction. Do not implement the full conversational
Plan, revision graph, or production-quality pipeline in the next
slice.

There is no Edit workspace and no Edit agent. Plan storyboard images
are provisional Director-intent drawings. **Canonical Destinations**
are actual generated sets — Shoot's world-state authority. Video
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
-   **Shootability is physical, not merely semantic.** Compatible
    endpoints are not enough. Ask whether there is somewhere
    physically plausible for the camera to be between observations,
    including orientation along the route.
-   **Generated sets are evidence.** Inspect the actual generated
    still. Do not assume a requested intermediate camera position was
    realized.
-   **Plan intends; Shoot inspects actual sets.** Storyboard drawings
    are provisional. Canonical Destinations are generated reality.
-   **Intent first, actual set second, physical shooting solution
    third.** Do not ask the Cinematographer to author a final
    CameraMotionPlan from a storyboard.
-   **No Edit workspace.** Assembly is deterministic concat of
    successful shots, not an AI NLE.
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
    generation providers only render. Draft vs production quality is
    a provider / model **choice**, not a product mode.

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

**Development media (decided strategy, not a user-facing mode):**
use draft models to develop the filmmaking workflow; use production
models to evaluate filmmaking quality. Do not create a special
"Pruna mode." Draft models remain MediaProvider configuration.
Draft media should exercise real asynchronous generation, latency,
status, failures, and asset creation. It is **not** valid evidence
for traversal quality, endpoint fidelity, or Camotion effectiveness.
A user-facing Draft vs Final toggle remains backlog only. Current
draft candidates and renderer notes live in
[IMPLEMENTATION.md](IMPLEMENTATION.md).

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

**Product direction:** the user develops the movie conversationally
in Plan. A persistent storyboard visualizes structured Director
intent. Optional Keep / Redo remains at cheap destination stages.
When the plan is ready enough to confront reality, Shoot generates
actual Destinations, the Cinematographer inspects those sets, and
the user presses **Shoot This Shot** or **Shoot Movie**. Approximate
duration and destination pointing are later collaborative controls.

**Current implementation:** Product Slice 3 is the current Plan | Shoot
shell. Plan is conversation → storyboard; Send asks the Director to
plan subsequent beats. Shoot remains the Slice 1 Destinations /
Journey timeline. Generation is not connected. Live development uses
the Wardrobe Loop fixture to initialize Project state, including
starting frame A with a trusted media identity. Plan starts unplanned
beyond A; the Director's output becomes the planned continuation. The Director runtime
resolves that identity from Project state; it does not independently
substitute Wardrobe `A.jpg`. Arbitrary user story/image input is not
implemented yet. Visual
checkpoint:
[genesis/research/11-product-slice-2.html](../genesis/research/11-product-slice-2.html).
Director observation:
[genesis/research/12-product-slice-3.html](../genesis/research/12-product-slice-3.html).

How duration maps to shot count, and whether shot duration should vary
per move, are **open questions**. Do not treat "Director infers
viewpoint count from duration" as a specified algorithm. Do not
formalize a duration schema in this checkpoint.

An **unvalidated** later crew hypothesis places a Screenwriter agent
upstream of the Director (narrative beats and journey structure,
without Camotion or provider geometry). Do not create
`ScreenwriterAgent` or Screenwriter schemas until evidence justifies
them. See [RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md).

Integration Test 01 exercised the unattended pipeline behind Shoot
Movie after canonicals existed, not the conversational Plan UI.

## Success criteria

A successful prototype makes the viewer believe the camera occupies
successive positions in one coherent world, can physically travel
between them, continuously moves rather than morphing, discovers
meaningful new information, and can be redirected with a simple spatial
gesture.

> **I pointed there, and it actually went there.**
