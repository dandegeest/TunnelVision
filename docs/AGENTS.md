# TunnelVision Filmmaking Roles

Use real filmmaking responsibilities rather than implementation-oriented
agent names. Do not hardcode provider or model IDs into a role.
Routing belongs on a configurable reasoning-provider profile so
Director, Cinematographer, and Evaluator may use different models.

## Screenwriter --- what is the journey? (unvalidated)

**Do not implement.** Integration Test 01 and movie-level review
suggest TunnelVision may benefit from a Screenwriter agent upstream
of the Director. This is an architectural/product hypothesis requiring
evidence, not a current role.

Potential separation:

-   **Screenwriter:** interpret the user's story concept; create
    narrative beats and spatial journey structure; determine important
    transitions / thresholds; describe pacing and dramatic emphasis;
    think in journey beats rather than camera geometry. Does **not**
    know about Camotion, vanishing points, or provider parameters.
-   **Director:** visual interpretation of those beats; world/style
    continuity; canonical visual intentions; which canonical positions
    should exist.
-   **Cinematographer:** sees the **actual** generated frames and asks
    whether they can be shot.

Do not create `ScreenwriterAgent` or Screenwriter schemas in this
checkpoint.

## Director --- where do we go next?

Inputs: current/prior canonical frames, journey brief, remaining
duration, preference state and optional user destination. Plan
conversation is an interaction mechanism, not the Director's durable
state. The durable result is structured movie intent.

Responsibilities: understand the world, propose meaningful next camera
positions, preserve continuity, create discovery, avoid same-composition
scene evolution, request/evaluate candidates, learn from human choices
and audit the canonical sequence.

The Director should increasingly plan **routes**, not merely
attractive Destinations: where the camera is, where it is going, what
lies between, how thresholds are crossed, whether destination worlds
become visible before source worlds disappear, camera orientation,
loop closure, choreography, and intermediate spatial positions when
genuinely needed.

A semantic/spatial plan is **not** proof that generated sets will be
physically shootable. Destination construction (Provided / Generated /
Derived / later Discovered) creates the actual set. Those are
construction strategies, not four global movie modes, and they are
orthogonal to Directed vs Autonomous agency. Do not encode all four
in a product schema yet. Current Plan Construct is sequential Derived
from the immediately preceding actual destination. Independent
generation remains a valid strategy; previous-frame conditioning is
not mandatory.

Plan operates at Director level. The Director may specify semantic
spatial intent ("Approach the house and enter through the illuminated
second-story bedroom window") without pretending to know exact screen
coordinates or physical geometry before the production image exists.
Do not ask the Director to author a final CameraMotionPlan from a
storyboard drawing.

Useful Phase 1 research principles, **not rigid generation rules**:

-   A destination object is not enough. The shot needs traversable
    depth through the transition.
-   A strong transition lets the destination world become visible
    before the current world disappears.
-   Open doors, arches, tunnels, windows, cave mouths, gaps, and
    paths around corners are potentially spatial handoff mechanisms,
    not merely visual motifs.

Candidate evaluation can include continuity, perceptible camera
displacement, novelty, navigability, preference fit and discovery.
Automated scoring of displacement or traversal is an **open question**.
PreferenceState schema is an **open question**. A thin Director
storyboard planner now lives in `media/src/director/` (Product Slice 3).
The project is a partially specified movie. The Director fills
unspecified connective beats and preserves existing destinations as
authoritative constraints. Live development initializes Project from the Forest A→F fixture,
including starting frame A with a trusted media identity and the
completed A→F storyboard and Journey clips. The Director runtime resolves that identity from Project state; it does
not independently substitute a catalog still. The filmmaker's Plan composer is a temporary draft; accepted planning
submissions update `Project.story` and append that exact text to
conversation history. The filmmaker can replace a destination's
canonical still in place from the destination menu. Add Destination
extends the storyboard after the last configured frame; it is not
itself a destination. Uploaded media is session/dev-runtime trusted media, not
durable project persistence. After planning, Construct builds the
next planned beat from the preceding actual destination through
image-conditioned edit and registers the
still the same way so it can later be resolved as provider input.
Video remains unwired in the product. After replacement, that destination
keeps its identity. First destination-construction observation:
[genesis/research/13-destination-construction.html](../genesis/research/13-destination-construction.html).
Forest A→F continuity evidence:
[genesis/research/14-forest-a-to-f.html](../genesis/research/14-forest-a-to-f.html).
Do not implement a complete
Screenwriter or conversation-persistence
system now.

## Cinematographer --- how do we physically get there?

Inputs: accepted start/end **canonical** frames (actual generated
sets), intended destination/route, scene analysis and user overrides.
Provisional Plan storyboard images are **not** CM inputs.

Responsibilities (intended role, not a current module): after the
actual canonical exists, infer perspective/route geometry, identify
destination and useful focus-of-expansion geometry, identify
parallax-producing foreground objects and protected regions, produce
ShotPlan and CameraMotionPlan JSON, request any CV/depth observation
**outside** Camotion, invoke Camotion to produce shooting frames, fill
a stable locomotion template, and evaluate actual traversal.

Do **not** generate the final Cinematographer plan during Plan /
Storyboard. Architecture:

intent first → destination construction → actual generated set →
physical shooting solution

The next research question is: **how should the Cinematographer
reason about actual adjacent sets before attempting to shoot them?**
Relevant evidence suggests CM may eventually need to inspect route /
traversable corridor, foreground geometry, destination visibility,
occlusions, threshold correspondence, vanishing point / forward
geometry, whether an obstacle must be passed beside rather than flown
through, whether current Camotion vocabulary is appropriate for that
set, whether an intermediate destination/set is required, and whether
the pair is simply not shootable as currently constructed.

Do not introduce a Cinematographer schema, UI, or implementation from
this question. Agent reasons. CV observes / measures. Camotion
renders. Video model films.

Do not move CM reasoning prematurely into Plan just because
storyboard images exist.

Video currently receives those shooting frames plus the locomotion
prompt. Canonical frames stay Shoot world-state authority; they are
not currently video inputs. Plan storyboard drawings are not
canonicals.

Integration Test 01 used a **thin** pair planner in
`media/src/cinematographer/`: inspect actual start/end stills, emit
shot-specific CameraMotionPlan v1 JSON, pin `forward=1.0` and 01.8
exposure. That is evidence that vision-on-actual-stills works (D was
planned upward from the generated stair, not from unused “descend”
story text). It is **not** a finished Cinematographer package.

**Phase 1 Camotion strength is now a Cinematographer decision**, not a
pinned constant. The CM inspects each **actual** canonical keyframe
and chooses Camotion conditioning strength from the frozen bounded
vocabulary:

-   LIGHT = `0.02`
-   MEDIUM = `0.04`
-   STRONG = `0.08`

No arbitrary intermediate values. Strength is per canonical / keyframe,
not necessarily one value per shot (Wardrobe B→C used B′ = `0.02` and
C′ = `0.04`). Use the minimum bounded conditioning needed to establish
useful motion state. Stronger Camotion does **not** automatically mean
stronger perceived camera travel. Qualitative scene evidence includes
foreground structure/density, perspective depth, natural parallax,
open traversal corridor, destination/threshold geometry,
structured-content smear or duplication risk, fine detail, rails /
trunks / furniture / door frames, and whether the scene already
provides strong evidence of camera travel.

The current thin Integration Test 01 planner still pins `0.08` in
code. That pin is historical IT01 behavior, not the frozen Phase 1
policy. Do not expand that planner into a product package in this
checkpoint. Do not scaffold a Cinematographer package alongside
Camotion.

**Final Cinematographer module boundaries remain an open question.**
Do not expand the thin Integration Test 01 planner into a product
package in this checkpoint.

Phase 1 shootability evidence, **not a generalized production loop**:

-   A destination object is not enough; the shot needs traversable
    depth through the transition.
-   Semantic compatibility is not sufficient. Shootability includes
    traversable volume, threshold depth, foreground geometry,
    perspective, occlusion/parallax opportunity, camera position,
    camera orientation, physical route, and how much hidden geography
    the video model would need to invent.
-   Ask: is there somewhere physically plausible for the camera to be
    between these observations?
-   If a pair cannot be covered as one continuous spatial move, the
    Cinematographer may request an intermediate canonical camera
    position (`E → X → A`). Do not mechanically insert X for every
    transition.
-   A proposed X is not automatically canonical. Generate it, inspect
    the **actual** still, and reject/return upstream if the geometry
    is not shootable. Do not force video.
-   Wardrobe E→A evidence:
    `camotion/integration/wardrobe-loop-01/experiments/shootability-intermediate-volume/`.
    Direct E→A independently judged NEEDS_INTERMEDIATE. Actual X was
    rejected on both E→X and X→A. Protocol stopped before video.
    One bounded case; not proof of general autonomous shootability.
-   A later follow-on gave the Cinematographer the generalized
    traversability principle without a human visual solution:
    `camotion/integration/wardrobe-loop-01/experiments/shootability-generalized-repair/`.
    Actual X was again rejected on both legs.
-   A later **manual** checkpoint revised E upstream instead of
    inserting X:
    `camotion/integration/wardrobe-loop-01/experiments/upstream-e-replanning/`.
    Approach geometry improved; the generated set still failed to
    expose the destination world through the threshold. Canonical E
    was not replaced. One still; not evidence that upstream
    replanning does not work. Return-to-Plan should generate and
    inspect a new actual set. CM should not be forced to save a bad
    Director decision; a good Director decision can still produce a
    bad set.

Remaining cinematographer questions, still not implemented as product
behavior:

-   How to reason about **actual adjacent sets** before shooting
    (next frontier; list above; no schema yet).
-   Whether / how to apply current Camotion vocabulary to a given
    actual set, including open-void / non-corridor geometry.
-   Start-frame authority vs endpoint attraction (forest C→D).
-   Canonical review before expensive video: PASS / REGEN / REPAIR.
    Guideline: regeneration preserves exploration; editing preserves
    composition. Review + shot planning may later share one reasoning
    call when PASS.
-   Practical shot duration and physical camera pace, including exit
    and entry velocity across shot boundaries. Accidental speed jumps
    should not simply be repaired in post.
-   Evaluate **spatial continuity** (connected intermediate space vs
    cut/dissolve/replacement) separately from **temporal continuity**
    (motion carrying through B vs easing/stopping at B).
    Visual / world continuity is not spatial traversability, and
    neither alone proves continuous camera travel.

## Camotion Engine

Camotion is **not an agent**. It is deterministic graphics code. The
Cinematographer role decides what motion should mean, including
bounded per-canonical exposure strength; Camotion performs the math.
Current working hypothesis: Camotion shooting frames are
**machine-facing motion-state conditioning** for the video model, not
image enhancement. The 01.12 Ghost Library still-image
structured-copy limit remains. A Wardrobe A→B Seedance 2×2 (seed 70)
supported retaining Camotion together with Cinematographer locomotion
language as complementary Phase 1 inputs. A later three-pair
scene-aware strength experiment preferred bounded per-canonical
selection from `{0.02, 0.04, 0.08}` over fixed `0.08`. Camotion
Phase 1 is frozen.

A later forest A→F evidence spike
(`camotion/integration/forest-a-to-f/`) applied pinned 01.8
radial-forward Camotion to recursively Derived stills. That is not
a retune and not a product Render Movie feature. Radial-forward
Camotion can help forward / corridor-like geometry (A→B locomotion;
D→E threshold grammar). The same operator is not necessarily
appropriate for every canonical: E→F open-void geometry plus
radial-forward conditioning read as warp rather than traversal.
Stronger apparent motion is not automatically better spatial travel.
Do **not** conclude that Camotion failed. 01.12 still stands:
Camotion has reached the useful limit of encoding substantial camera
travel by smearing the scene itself into A′ under the currently
tested baked-exposure family. Whether some repeated-object artifacts
are inherent to baked exposure or partly caused by approximating
Photoshop Radial Blur / Zoom remains a later operator-equivalence
question, not a current Camotion task. CM may eventually decide
whether / how Camotion should be applied to an actual set. Do not
implement that decision now.

The frozen v1 **plan** contract is `image + CameraMotionPlan JSON` and
emits one shooting-frame still. See [DATA_MODEL.md](DATA_MODEL.md).
An optional near-weight image may be supplied beside that contract.
Camotion does not estimate depth, run CV, or call generators.

Camotion v1 is a **radial-exposure experiment** (forward radial motion
field around a supplied focus of expansion, scaled by `camera.forward`,
multisample exposure, protected destination, optional near-weight
scaling of that same field). It approximates and extends aspects of
Terran Boylan's original TunnelVision motion-conditioning workflow.
It is **not** a recreation or port of
Terran Boylan's depth-aware Photoshop workflow, which used Z / depth,
two blur operations, and destination protection.

v1 does not implement lateral translation / strafing or turning / yaw.
Do not add yaw / turn fields now. Let Movie #2 create off-axis route
evidence first. See [RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md).

Camotion must not call LLMs or generation providers and must have no
TypeScript or Node dependency.

## No Edit agent

Do not initially model an Editor. There is no Edit workspace.
Canonical Destinations are Shoot world-state authority. Plan
storyboard images are provisional intent drawings, not that handoff.
Video currently uses Camotion shooting frames as start/end images.
Distinct `B_in` / `B_out` derivatives and whether they can hand off
invisibly remain an **open question**.

Deterministic final-movie assembly (ordered successful shot videos,
hard butt joins, no transitions, grading, or optical flow) is
plumbing, not an Edit agent. A forest A→F evidence spike demonstrated
that concat as research tooling; it is not a product Render Movie
feature. See `camotion/integration/forest-a-to-f/`.

## Stable locomotion principle

Generated motion prioritizes uninterrupted physical travel: camera
continuously advances; foreground objects pass beside/behind it; strong
parallax reveals new space ahead; thresholds, turns, occlusions and
atmosphere can help preserve continuous locomotion.

The genesis prompt that demonstrated this on Seedance 2.5 / Krea is
recorded as an experimental artifact in
[IMPLEMENTATION.md](IMPLEMENTATION.md). Preserve Terran Boylan /
original TunnelVision provenance. Do not treat that text as model-independent or as
a Camotion input.
