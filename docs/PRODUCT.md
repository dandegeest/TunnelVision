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
turns the filmmaker story plus the complete ordered storyboard into
planned storyboard beats via `ReasoningProvider` (Gemini 3.1 Pro on
Replicate). A TunnelVision project is a **partially specified movie**:
the filmmaker may supply as much or as little of the storyboard as they
want before asking the Director to plan. AUTO lets the Director choose
how many destinations; a number, typed or stepped, adds that many FPO
storyboard slots. After the first DIRECT response the count is read-only and follows
storyboard add/delete. Starting frame A must be an actual image before
Add Destination or Shoot, and before DIRECT unless auto-generate starting
destination is on. When that toggle is on, DIRECT generates unresolved A
from the story and then runs Director planning. If A is already actual
and the story is empty, DIRECT first asks the Director to write a
journey story from that image, then continues with the existing plan.
Auto-generate all
destinations is independent and off by default; after a successful DIRECT
it constructs B…N in travel order from each preceding actual frame.
Construction is sequential because each later beat is derived from the
previous one. If a later construct fails, generation stops and the
Director plan remains. Auto blocking and Auto shoot are also
independent and off by default. After destinations exist, Auto blocking
blocks every actual adjacent pair. Auto shoot then generates
those blocked legs, including CM hold and no-go warnings.
Add
Destination is structural only: it appends one unresolved slot and does
not invoke the Director or generate an image. Delete is the same class of
edit: it removes a later beat without planning or relabeling; opening A
cannot be deleted. Story text is project
intent; editing it does not plan. **CREATE JOURNEY** in the Project panel is the
only UI action that invokes Director planning. The Director treats
actual filmmaker-specified canonicals as authoritative: it resolves
unspecified directing decisions and does not overwrite specified
filmmaking decisions or generate images. When an uploaded or other actual still
has no intent or visual description, DIRECT describes that still from the attached
image and adopts the text. Later DIRECTs leave filled fields alone. Uploading or
replacing a still asks whether to clear existing plan text so the next DIRECT can
describe the new image. Agency (Directed vs Agent) is orthogonal and is not a
stand-in for Discovery. Conversation is turn history; the Project panel
holds the journey prompt, destination count, Directed Options
(generate start destination, generate all destinations, shoot), and CREATE JOURNEY.
Video and Debug mode live in Project settings. Opening A can be
uploaded before a story is entered. Uploading A when a story already exists fills
empty opening intent from that story and leaves visual description empty (there is
no TunnelVision prompt). Generating A stores opening intent from the story and the
generation prompt as visual description. That prompt asks for the
opening instant only and does not depict later destinations. The Plan storyboard reel shows the same Inspector - Destination
panel as Shoot on the right — intent, story/source, a collapsed Prompt,
Reshoot, aspect / resolution / model, and A / A′ when Camotion exists —
including on an actual opening whose
intent and story are still empty so the filmmaker can type them.
When auto-generate starting destination is on, DIRECT can generate A
before Director planning. When auto-generate all destinations is on,
DIRECT then generates each remaining destination in order. Director activity appears in conversation when DIRECT runs;
pending **Planning…**, **Blocking…**, **Shooting…**, and construction turns show a progress spinner.
Empty Plan FPO thumbnails overlay Director intent as readable text until
an image exists. After planning, Construct builds a planned beat from the immediately
preceding actual destination through image-conditioned edit
(`ImageEditProvider` / FLUX Kontext Pro). Generated A requests 16:9.
Uploaded A stores its pixel aspect as the project canonical aspect ratio.
Later constructed destinations pass that ratio as an explicit provider
aspect_ratio; they do not use match_input_image. The previous canonical
remains the reference image. If a following beat already
has a Director plan, that plan's visual description is demoted far-field
continuity after this destination and the camera move from the source
still; this viewpoint stays this destination. The last beat has
no look-ahead. Later planned beats stay
planned until the filmmaker constructs them. Shoot is a production view of
the current Project: consecutive actual adjacent canonicals appear as
JourneyShots automatically. There is no separate send-to-Shoot step.
DIRECT is not a prerequisite for shooting actual adjacent canonicals.
MOTION is an inspect/status surface for the automatically generated Motion Plan;
Generate lives on the FOOTAGE band and stays Generate after a clip exists. Each Shoot interval is two
stacked bands: MOTION (the stored A→B Motion Plan) and FOOTAGE (the generated
take). Canonicals remain clickable places above those bands. When only A is
actual, Shoot still shows A and an FPO B that opens Plan on B. Band labels are MOTION and FOOTAGE only. Selecting a destination
exposes stored Camotion A′/B′ for that occurrence as a read-only preview
toggle, a CameraMotionPlan overlay on the still, and inspector facts. When an actual adjacent pair exists, the existing Cinematographer
runs against those stills automatically, renders Camotion A′/B′ for that pair, and stores the
Motion Plan on that JourneyShot. Changing either canonical invalidates and
recomputes that segment's Motion Plan. Footage generation remains explicit.
Generate on FOOTAGE uses those staged frames, composes `segmentPromptAddition`
ahead of the frozen locomotion baseline, and generates a development
clip. The Project panel Video control chooses the generator for every
SHOOT in the current project. Pruna (`prunaai/p-video`) is the development
default; mid-tier Luma Ray Flash 2 720p, Wan 2.2 First/Last Frame, and
Seedance 2.0 Fast, plus Seedance 2.5 HQ, are opt-in. Each adapter maps
A′/B′ onto that model's start and last-frame fields. Clip duration
follows the generator: Pruna, Wan, and Seedance product shots are 6s;
Luma Ray Flash 2 720p is 5s. The Shoot timeline tiles follow the take.
Shootability remains advisory set analysis; it does not
gate JourneyShot progression. CM does not generate
CameraMotionPlan JSON; a narrow deterministic bridge turns the same
assessment's travel geometry into CameraMotionPlan v1 and maps CM `pace`
to Camotion `exposure.strength`. Export Movie
concatenates whatever rendered journey clips currently exist, in
storyboard order, without transitions, bridges, or repair. Incomplete
exports report missing legs. The application starts as a
genuinely new project: untitled, empty story, unresolved opening
frame A, and no destinations, journeys, assessments, or media. Forest
A→F and Wardrobe Loop remain research evidence and explicit test
fixtures; they do not initialize the running product. The filmmaker
provides starting frame A, may add unresolved destination slots,
describes the movie, asks the Director with DIRECT, and constructs unresolved beats through the existing Generate
flow. Plan can replan
around existing destinations; specified stills survive. DIRECT adopts intent and
visual description onto an actual still only when those fields are empty.
The Director runtime resolves
that identity from Project state; it does not independently substitute
a catalog still. Story edits update `Project.story` without planning. The filmmaker can
replace a destination's canonical still in place. Replacing either canonical still on a production leg returns that JourneyShot to not prepared and not shot. Uploaded media is
session/dev-runtime trusted media, not durable project persistence.
Constructed B is registered the same way so it can later be resolved
as provider input. After replacement, that destination keeps its identity. Visual checkpoint for the frozen Plan shell:
[genesis/research/11-product-slice-2.html](../genesis/research/11-product-slice-2.html).
First live Director observation:
[genesis/research/12-product-slice-3.html](../genesis/research/12-product-slice-3.html).
First Director-derived destination construction:
[genesis/research/13-destination-construction.html](../genesis/research/13-destination-construction.html).
Forest A→F Camotion continuity evidence:
[genesis/research/14-forest-a-to-f.html](../genesis/research/14-forest-a-to-f.html).
Product Slice 4 UI:
[genesis/research/15-product-slice-4.html](../genesis/research/15-product-slice-4.html).
Product Slice 5 Project video model:
[genesis/research/16-product-slice-5.html](../genesis/research/16-product-slice-5.html).
Product Slice 6 destination look-ahead:
[genesis/research/17-product-slice-6.html](../genesis/research/17-product-slice-6.html).
Product Slice 7 Plan | Shoot UI:
[genesis/research/18-product-slice-7.html](../genesis/research/18-product-slice-7.html).

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
    mismatch is marked on the affected thumbnail. 16:9 tiles stay
    fixed; source stills are contained (letterboxed or pillarboxed)
    rather than stretched or cropped to fill. The Shoot motion
    preview uses the still aspect (two frames side by side) instead
    of forcing 16:9. Media facts appear on the
    selected storyboard still, including generated images once their
    dimensions are known. Debug is a
    session toggle in Project settings and is on by default for now.
    Camotion work dirs are kept only while Debug is on. The Shoot inspector
    no longer shows Technical or Debug path panels. Product shoot does not pass a depth
    map. Destination
    actions live on the destination card (Reshoot on generated stills, Replace…); Add Destination
    extends the storyboard without encoding construction strategy and
    does not invoke the Director. Conversation remains session UI:
    DIRECT appends a Director entry that goes from
    planning to complete/failed, carrying structured evidence and a
    filmmaker-facing summary. Send is not an active filmmaking command. Entry timestamps are stored data. The
    filmmaking conversation rail is a project-level workspace the
    filmmaker can hide or show; its visibility is independent of
    Plan / Shoot and Directed / Agent.
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
Cinematographer inspects those sets and determines how to shoot
between them, and Journeys are produced from that choreography.
Shootability of the stills is advisory. Optional cheap intervention
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

Later, the Director should review generated takes and decide what to
do with them. That review loop is **not implemented**. The experimental
Shot Evaluator remains isolated research, not a separate top-level
filmmaking role and not production Director review.

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
A. The source image is still N−1; when N+1 already has a plan, that
plan is a prompt-only far-field hint so N can include a visible
handoff without becoming N+1. Opening A stays story T2I and does not
look ahead. Previous-frame conditioning is one strategy, not a
mandatory rule for every destination. Wardrobe Loop remains evidence
that independent generation can also produce a journey.

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
canonical exists. **Cinematographer inspects actual adjacent sets and
determines how the camera should move through their visible
geography.** Both stills are first-person POV along the same forward
travel; the end still is the next forward viewpoint, not a reverse
angle. The POV is unembodied: the viewer/camera operator must never be
visible, while people, animals, vehicles, objects, and other subjects
may appear naturally as part of the world.

Current product slice: CM inspects two actual canonical stills for
one JourneyShot and returns structured choreography (route, camera
path, visible geometry, transition strategy, a concise
`segmentPromptAddition`, and a per-shot `pace` (`slow-motion` / `slow` /
`moderate` / `fast` / `hyperspeed` / `variable`) plus independent 0–100
`setConsistency` and `traversalConfidence` scores, advisory shootability,
concerns, and per-still semantic travel geometry (travel
VP / target / heading). That output is stored on the segment Motion Plan
with CameraMotionPlan and A′/B′. Shootability is a property of the leg A→B,
not of destination A or B. It is **advisory set analysis**, not a
hard gate and not a prediction of whether the stochastic video model
will succeed. A JourneyShot may progress even when CM reports
`not_shootable`. Shoot tiles show Stage / Film / Export, with filled clear / hold / no go bands after Plan;
the gutter between destination stills also shows a chevron pace mark after BLOCK. While
BLOCK or SHOOT runs, that segment uses the generating shimmer.
Inspector Motion uses a CINEMATOGRAPHER MOTION PLAN heading with compact
SET CONSISTENCY and TRAVERSAL CONF. scores. Advisory shootability stays
on the motion band as clear / hold / no go. CM does **not** emit CameraMotionPlan JSON
or generate video; the same assessment turn's travel object is bridged
deterministically into CameraMotionPlan, then Plan runs Camotion.

The immediate product goal is an end-to-end working filmmaking
pipeline. Individual components will be tuned through the application
after the pipeline exists.

The later video prompt, when wired, should be composed
deterministically:

``` text
CM segmentPromptAddition
+
stable locomotion baseline ({pace} filled from BLOCK)
```

Do not have an LLM rewrite or merge those two pieces. Terran Boylan's
original TunnelVision continuous-locomotion / environment-negotiation
prompting is the foundation of the stable baseline. The production
baseline follows the available route in the supplied world and does
not instruct the model to invent openings, tunnels, or thresholds. Adaptive
per-segment choreography is current TunnelVision product work, not
Terran's agent design.

Preserve:

``` text
Destination = canonical world state
JourneyShot = physical traversal between world states
Boundary = eventual visual seam between generated adjacent shots
```

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
between endpoints is not sufficient: choreography includes traversable
volume, threshold depth, camera position **and orientation**, and a
physically plausible route between observations. A visually coherent
pair of destination stills can still be difficult to
traverse physically. Apparent foreground obstacles are not automatic
refusals; CM should say how the camera might negotiate visible
geometry while keeping continuous locomotion.

A proposed intermediate canonical is not automatically accepted merely
because an agent requested it. Generation builds the set; the Cinematographer
walks onto the actual result. If the stills show no credible physical
route, that is advisory set analysis, not an automatic production
gate. A later return-to-Plan / reject-the-set loop is **not
implemented**.

Not every Shoot problem should be solved in Shoot. Some failures
mean the generated set failed a good Director plan; some mean the
Director planned an inherently difficult spatial relationship.

> **The Cinematographer should not be forced to save a bad Director
> decision.**

> **A good Director decision can still produce a bad set.**

When Shoot discovers a difficult spatial relationship, one valid
later response is return to Plan → revise the storyboard / route /
Destination intent → generate a new actual Destination → inspect
the new set. That loop is **not implemented**. Returning to Plan
does not guarantee success. It would start another planning /
production / inspection cycle. That is a major reason Plan must stay
persistent and revisable after production begins. Do not erase
expensive generated evidence merely because Plan changes. Exact
revision / history / undo semantics remain future work.

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

TunnelVision no longer begins from a demonstration journey. A project
begins partially specified and becomes a movie as filmmaker constraints
and Director decisions resolve it. Every subsequent MVP milestone
should advance a real user journey through the application and, where
practical, extend browser-level E2E coverage. When real media
generation is introduced during product development, prefer cheap
draft providers through the existing MediaProvider abstraction. Do
not implement the full conversational Plan, revision graph, or
production-quality pipeline in the next slice.

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
During Shoot development, optimize video generation for iteration
cost and speed rather than final output quality; do not hardcode a
development model into Shoot. Provider/model selection remains
configurable (cheap/fast during development, Seedance 2.5 or another
quality model for intentional output validation). The Project panel Video
control is that selection for the current project; Pruna remains the
default. Automated E2E mocks
the paid media-provider boundary. A user-facing Draft vs Final toggle remains backlog only. Current
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
actual Destinations, the Cinematographer inspects those sets and
determines how to shoot between them, and the user later presses
**Shoot** on a blocked leg or **Export Movie**. Video generation is not
wired in this slice. Approximate duration and destination pointing
are later collaborative controls.

**Current implementation:** Product Slice 3 is the current Plan | Shoot
shell. Plan is an explicit CREATE JOURNEY action over the current storyboard;
the Director rail is history. Journey prompt and CREATE JOURNEY live in the
Project panel. After planning, Construct builds the next
planned beat from the preceding actual destination, with following-beat
look-ahead in the Construct prompt when a successor plan exists.
Later beats remain unresolved until the filmmaker constructs them. Export Movie concatenates
rendered journey clips that exist; it is a test convenience, not an
Edit workspace. A forest A→F
research spike assembled a review movie outside the product UI; do
not treat that research concat as an NLE. That spike showed a
directionally coherent 30-second journey
(forest → mouth → tube → crystal → portal → void) whose destination /
world continuity did **not** automatically produce physical traversal
continuity. See [ARCHITECTURE.md](ARCHITECTURE.md). Shoot is a production
view of the current Project's Destinations / Journey timeline. The running application initializes a new untitled
project rather than Forest A→F. Forest remains research evidence and
a controlled test fixture. The Director runtime
resolves starting-frame identity from Project state; it does not independently
substitute a catalog still. Story edits update `Project.story` without
planning. The filmmaker can replace a destination's canonical still in place.
Replacing either canonical still on a production leg returns that JourneyShot to not prepared and not shot.
Uploaded media is session/dev-runtime trusted media, not durable project
persistence. Constructed B is registered the same way so it can later
be resolved as provider input. After replacement, that destination keeps its identity. Visual
checkpoint:
[genesis/research/11-product-slice-2.html](../genesis/research/11-product-slice-2.html).
Director observation:
[genesis/research/12-product-slice-3.html](../genesis/research/12-product-slice-3.html).
First Director-derived destination construction:
[genesis/research/13-destination-construction.html](../genesis/research/13-destination-construction.html).
Forest A→F Camotion continuity evidence:
[genesis/research/14-forest-a-to-f.html](../genesis/research/14-forest-a-to-f.html).
Product Slice 4 UI:
[genesis/research/15-product-slice-4.html](../genesis/research/15-product-slice-4.html).
Product Slice 5 Project video model:
[genesis/research/16-product-slice-5.html](../genesis/research/16-product-slice-5.html).
Product Slice 6 destination look-ahead:
[genesis/research/17-product-slice-6.html](../genesis/research/17-product-slice-6.html).
Product Slice 7 Plan | Shoot UI:
[genesis/research/18-product-slice-7.html](../genesis/research/18-product-slice-7.html).

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
