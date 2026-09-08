# TunnelVision Product Plan

## Product thesis

TunnelVision is agentic filmmaking research extending filmmaker
**Terran Boylan's original TunnelVision** technique: a system for
exploring and filming continuous journeys through imagined worlds.

Terran's original manual workflow showed that successive AI-generated
viewpoints can be selected and carried forward to create the feeling of
traveling through a coherent imagined environment. That workflow used
an existing frame plus camera/location movement instructions to derive
a subsequent viewpoint. The current image-conditioned destination-
construction path is agentic research motivated by that technique, not
Terran's implementation. This research asks what happens when that
loop becomes self-directing.

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
Replicate). The Plan composer is a temporary draft. Accepted Send / Plan Movie
submissions append the exact draft to conversation history, update
`Project.story`, and clear the composer. It is not a live display of
current project story.
After planning, Construct builds a planned beat from the immediately
preceding actual destination through image-conditioned edit
(`ImageEditProvider` / FLUX Kontext Pro). Later planned beats stay
planned until the filmmaker constructs them. Video remains unwired in
the product. Shoot remains the Slice 1
Destinations / Journey timeline. Live development currently initializes
Project from the Forest A→F fixture
(`camotion/integration/forest-a-to-f/`), using filmmaker-provided A,
sequentially Derived B–F stills, and the completed Journey clips.
Wardrobe Loop remains historical research evidence and a test factory;
it is not the current product-development fixture. Plan can still
replan from A. The Director runtime resolves
that identity from Project state; it does not independently substitute
a catalog still. Accepted Plan submissions update `Project.story`. The filmmaker can
replace authoritative A with an uploaded still. Uploaded A is
session/dev-runtime trusted media, not durable project persistence.
Constructed B is registered the same way so it can later be resolved
as provider input. After replacement, runtime Project A is authoritative. Visual checkpoint for the frozen Plan shell:
[genesis/research/11-product-slice-2.html](../genesis/research/11-product-slice-2.html).
First live Director observation:
[genesis/research/12-product-slice-3.html](../genesis/research/12-product-slice-3.html).
First Director-derived destination construction:
[genesis/research/13-destination-construction.html](../genesis/research/13-destination-construction.html).
Forest A→F Camotion continuity evidence:
[genesis/research/14-forest-a-to-f.html](../genesis/research/14-forest-a-to-f.html).

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

Conceptual pipeline, **not current video wiring**:

Plan conversation → Director shot / destination intent → provisional
storyboard visualization → destination construction (Provided /
Generated / Derived / later Discovered) → actual generated set →
Cinematographer inspects that set → physical shooting plan →
Camotion → Journey generation

Do not treat "production canonical generation" as a requirement that
every destination be independently generated.

### Storyboard visual language

**Product / UX direction, not architecture.** Traditional
black-and-white film storyboard; the UI owns chrome. See
[UX.md](UX.md).

> **The model generates the drawing. TunnelVision generates the
> storyboard.**

`prunaai/p-image` is a current development renderer candidate, not an
architectural dependency. See [IMPLEMENTATION.md](IMPLEMENTATION.md).

### Media preflight and boundary continuity

These are small production-consistency surfaces. They are **not**
Cinematographer evaluation, Camotion scoring, or a general evaluation
architecture.

-   **Media preflight (Plan)** reports consistency of actual
    storyboard stills: aspect ratio (warning), resolution
    (informational), and format (informational). Unconstructed or
    metadata-less frames do not invent findings. Preflight does not
    crop, resize, convert, or replace filmmaker-provided media. Aspect
    mismatch is marked on the affected thumbnail. Media Info is an
    explicit opt-in strip, not a global diagnostic banner.
-   **Boundary continuity (Shoot)** is the visual match of adjacent
    **completed** Journey clips at their shared destination: previous
    clip final decoded frame ↔ next clip first decoded frame. It
    answers how closely two clips meet at that instant. It does **not**
    answer whether either traversal was spatially successful, shootable,
    or a good shot. Output raster mismatch is a separate fact from
    visual boundary match. Classification labels (Strong / Good /
    Review / Mismatch) are explicit MAE heuristics for display, not
    validated quality thresholds. Forest forensic numbers are
    evidence for that fixture, not universal bars.

Do not call boundary continuity spatial continuity, seamlessness, or
shootability.

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

Recent Director runs show useful spatial verbs and
threshold-oriented planning. A semantic/spatial plan is **not** proof
that generated sets will be physically shootable.

### Destination construction

A destination can enter the journey through multiple construction
strategies:

-   **Provided** — filmmaker-supplied still. Current starting-frame
    upload is the implemented case; it is session/dev-runtime trusted
    media, not durable project persistence.
-   **Generated** — independent image generation from a description.
    Integration Test 01 Wardrobe Loop canonicals were generated this
    way.
-   **Derived** — image-conditioned construction from an actual
    previous destination. Current Plan Construct is this path
    (FLUX Kontext Pro). First hop:
    [genesis/research/13-destination-construction.html](../genesis/research/13-destination-construction.html).
    Sequential chain frozen as forest A–F canonicals in
    `camotion/integration/forest-a-to-f/`.
-   **Discovered** — eventual observation from traversal / exploration.
    Not implemented.

These are construction strategies, **not** four global movie modes.
Destination provenance belongs to the frame. Destination construction
strategy belongs to the segment. Directed vs Autonomous remains an
orthogonal question of agency. Do **not** encode all four in the
product schema yet.

Current Construct is sequential Derived: destination N is built from
the immediately preceding actual destination, not independently from
A. Previous-frame conditioning is one strategy, not a mandatory rule
for every destination. Wardrobe Loop remains evidence that independent
generation can also produce a journey.

Sequential Derived construction has shown that the actual previous
canonical can successfully condition the next destination, local
world/material continuity can remain strong, and large visual
transformation can still accumulate across several destinations.
Generated reality can diverge from the Director's original open-loop
plan; later Derived destinations may follow the actual generated world
more strongly than the original planned description. Staged visual /
spatial bridge states remain a **research hypothesis**, not a
guaranteed rule.

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
expensive video — not merely the Director's intended descriptions.
A destination object is not enough; the shot needs traversable
depth through the transition. Semantic compatibility
between endpoints is not sufficient: shootability includes traversable
volume, threshold depth, camera position **and orientation**, and a
physically plausible route between observations. A visually coherent
pair of destination stills can still be difficult or impossible to
traverse physically.

The next research question is how the Cinematographer should reason
about actual adjacent sets before attempting to shoot them. Do not
implement that solution, schema, or UI yet. See
[AGENTS.md](AGENTS.md) and [RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md).

A proposed intermediate canonical is not automatically accepted merely
because an agent requested it. Generation builds the set; the Cinematographer
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
-   **Visual / world continuity is not spatial traversability**, and
    neither alone proves **continuous camera travel**. Camera
    displacement and spatial reachability must be evaluated
    explicitly. A recursively constructed storyboard can be
    directionally coherent and still fail as physical traversal.
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
plan subsequent beats. After planning, Construct builds the next
planned beat from the preceding actual destination. Later beats and
video remain unwired in the product until later slices. A forest A→F
research spike assembled a review movie outside the product UI; do
not treat that as a Render Movie feature. That spike showed a
directionally coherent 30-second journey
(forest → mouth → tube → crystal → portal → void) whose destination /
world continuity did **not** automatically produce physical traversal
continuity. See [ARCHITECTURE.md](ARCHITECTURE.md). Shoot remains the Slice 1 Destinations /
Journey timeline. Live development initializes Project from the
Forest A→F fixture, including starting frame A with a trusted media
identity and actual B–F Derived stills plus completed Journey clips.
The Director runtime
resolves that identity from Project state; it does not independently
substitute a catalog still. Accepted Plan submissions update `Project.story` in
Plan and can replace authoritative A with an uploaded still.
Uploaded A is session/dev-runtime trusted media, not durable project
persistence. Constructed B is registered the same way so it can later
be resolved as provider input. After replacement, runtime Project A is authoritative. Visual
checkpoint:
[genesis/research/11-product-slice-2.html](../genesis/research/11-product-slice-2.html).
Director observation:
[genesis/research/12-product-slice-3.html](../genesis/research/12-product-slice-3.html).
First Director-derived destination construction:
[genesis/research/13-destination-construction.html](../genesis/research/13-destination-construction.html).
Forest A→F Camotion continuity evidence:
[genesis/research/14-forest-a-to-f.html](../genesis/research/14-forest-a-to-f.html).

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
