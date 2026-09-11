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
-   **Cinematographer:** sees the **actual** generated frames and
    determines how the camera should move through their visible
    geography.

Do not create `ScreenwriterAgent` or Screenwriter schemas in this
checkpoint.

## Director --- where do we go next?

Inputs: current/prior canonical frames, journey brief, remaining
duration, preference state and optional user destination. Plan
conversation is an interaction mechanism, not the Director's durable
state. The durable result is structured movie intent.

Later, the Director should review generated takes and decide what to
do with them. That review loop is **not implemented**. The
experimental Shot Evaluator remains isolated research, not production
Director review and not a separate top-level filmmaking role.

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
unspecified directing decisions and preserves existing destinations as
authoritative constraints. It does not overwrite specified filmmaking
decisions or generate images. Empty intent and visual description on an
actual still are directing gaps: DIRECT examines the attached image and
fills them; later DIRECTs skip fields that are already set. The application starts as a new untitled
project rather than a demonstration journey. Forest A→F remains
research evidence and an explicit test fixture. The Director runtime
resolves starting-frame identity from Project state; it does
not independently substitute a catalog still. Story text is project
intent; CREATE JOURNEY in the Project panel is the only Director invocation.
AUTO destination count lets the Director choose N; a number, typed or
stepped, adds that
many FPO slots. After the first DIRECT response the count is read-only
and follows storyboard add/delete. When auto-generate starting
destination is on, DIRECT generates unresolved A from the story before
Director planning. Uploading A before the first plan turns that toggle
off and disables it. When the opening still is already actual and the
story is empty, DIRECT first asks the Director to write a journey story
from that image, then continues with the existing plan. When auto-generate all destinations is on, DIRECT then
constructs B…N in travel order from each preceding actual frame. Later
beats cannot run in parallel. If a later construct fails, generation
stops and the Director plan remains.
Auto blocking and Auto shoot are independent and off by default.
Motion Planning is automatic whenever an actual adjacent canonical pair
exists, using the same Cinematographer and Camotion path. Auto blocking
during CREATE JOURNEY is that same operation. Auto shoot then generates
each staged leg, including those with CM hold or no-go warnings.
Add Destination appends an unresolved slot after actual A and does not
call the Director. It is disabled while DIRECT or sequential destination
generation is running. Delete removes a later storyboard beat without
relabeling remaining ids or calling the Director; opening A cannot be
deleted. The filmmaker can replace a destination's
canonical still in place from the destination menu, or Reshoot a generated
still from the current prompt. If that slot already has
intent or a visual description, upload asks whether to clear them so a later
DIRECT can describe the new still. Storyboard and
other 16:9 thumbnails keep a fixed 16:9 tile and contain source stills
(letterbox or pillarbox) rather than stretching or cropping them.
Clicking an unselected storyboard still (outside the label, kebab, and
media-info strips) selects it. Clicking the already-selected still
opens a storyboard-bounded reel: the still is contained at the largest scale that
fits the storyboard area, with previous and next among actual stills. The
reel does not cover the conversation or Project rails. Clicking the label
strip opens destination details: the prompt is editable and
updates that beat's plan. Uploaded A with a story stores opening intent from
that story; generated A also stores the TunnelVision opening prompt as visual
description. Actual A can open details before those fields exist. Reshoot on the kebab or in details regenerates a generated still from
the current prompt. If the plan changes after a still exists, that
thumbnail shows Plan changed until Reshoot. Shoot Reshoot on the same canonical does the same
thing. Replacing either
canonical still on a production leg returns that JourneyShot to not
prepared and not shot. Add Destination
extends the storyboard after the last configured frame; it is not
itself a destination. Uploaded media is session/dev-runtime trusted media, not
durable project persistence. After planning, Construct builds the
next planned beat from the preceding actual destination through
image-conditioned edit and registers the
still the same way so it can later be resolved as provider input.
Generated A requests 16:9. Uploaded A stores its pixel aspect as the project
canonical aspect. Construct passes that ratio as an explicit provider
aspect_ratio, not match_input_image, while still using the previous
canonical as the reference image.
When a following beat already has a plan, Construct injects that plan's
visual description as demoted far-field continuity after this destination
and the camera move from the source still. This viewpoint stays this
destination; the last beat has no look-ahead. Opening A is still generated from the journey story only;
the prompt asks for that opening instant and does not depict later destinations.
Debug is a session toggle in Project settings, not project persistence. It is on by
default for now so Camotion work dirs are kept. The Shoot inspector no longer lists
Technical or Debug path panels. Destination Camotion in Inspector is filmmaker
fields plus an optional working directory while Debug is on. With Debug on,
Camotion keeps plan.json and shooting.png; otherwise those work dirs
are deleted after the shooting frames are copied into the session
store. Product shoot does not pass --depth, and Camotion does not
estimate depth maps.
Shoot is a production view of
the current Project: actual adjacent canonicals become JourneyShots
automatically. Each interval is two stacked bands under the destination
rail: MOTION (the stored A→B Motion Plan) and FOOTAGE (the generated take).
Canonicals remain clickable places above those bands. When only A is actual,
Shoot still shows A and an FPO B that opens Plan on B. A destination
still generating in Plan shimmers on the matching Shoot slot. MOTION is an
inspect/status surface for that segment's automatically generated Motion Plan;
Generate lives on the FOOTAGE band and stays Generate after a clip exists.
Shoot Inspector headers read Inspector - Destination, Inspector - Motion, or
Inspector - Footage. Motion and footage both use the A→B heading; footage shows
conditioned START′/END′ frames without a Take label. Footage Reshoot calls the
same regeneration as that band. Model label is Debug-only.
When an actual adjacent canonical pair exists, the existing Cinematographer
path runs automatically: CM inspects the actual A/B
canonicals, reports semantic travel geometry in the same assessment turn, a
deterministic CameraMotionPlan v1 bridge derives Camotion
geometry from that travel object (centered `[0.5, 0.5]` only as a fallback
when CM cannot determine a better target) and maps the existing CM `pace`
to `exposure.strength`, and Camotion renders A′/B′ for that shot only. Neighboring
segments are unchanged. Changing either canonical invalidates that segment's
Motion Plan and recomputes it; unrelated UI and story edits do not. Footage
generation remains an explicit FOOTAGE action. MOTION shows the A|B canonical stills, a canonical vs
conditioned toggle, and the stored CameraMotionPlan overlay once the Motion
Plan exists; FOOTAGE shows the clip. When a destination is selected, the preview can toggle
that occurrence's canonical still against stored Camotion A′/B′ from the
inbound/outbound Motion Plans, draw the
stored CameraMotionPlan as a read-only overlay on the displayed still
(travel path, radial direction, points; letterboxed to the image; knockout
halo and chipped VP/D labels), and the
inspector lists that segment's Motion Plan facts read-only. Band labels are MOTION and FOOTAGE only.
The Shoot timeline height is resizable with the same separator
interaction as the story and project panels. The Shoot inspector can hide to a
reopen strip like the conversation and Project rails; that visibility is
session UI, not project persistence.
While a Motion Plan or Generate runs, that band uses the same generating
shimmer as Plan FPO thumbs. The app
can track more than one blocking or shooting operation at a time.
SHOOT on a staged leg uses the Motion Plan's A′/B′ and a configurable
video model chosen in Project settings. Pruna (`prunaai/p-video`) is the
development default. Mid-tier Luma Ray Flash 2 720p, Wan 2.2 First/Last
Frame, and Seedance 2.0 Fast, plus Seedance 2.5 HQ, are opt-in for the
same A′/B′ pipeline. Clip duration follows the generator (Pruna 6s,
Luma Ray Flash 2 720p 5s); the Shoot timeline follows the take.
After replacement, that destination
keeps its identity. First destination-construction observation:
[genesis/research/13-destination-construction.html](../genesis/research/13-destination-construction.html).
Forest A→F continuity evidence:
[genesis/research/14-forest-a-to-f.html](../genesis/research/14-forest-a-to-f.html).
Product Slice 4 UI:
[genesis/research/15-product-slice-4.html](../genesis/research/15-product-slice-4.html).
Product Slice 5 Project video model:
[genesis/research/16-product-slice-5.html](../genesis/research/16-product-slice-5.html).
Product Slice 6 destination look-ahead:
[genesis/research/17-product-slice-6.html](../genesis/research/17-product-slice-6.html).
Product Slice 7 Plan | Shoot UI:
[genesis/research/18-product-slice-7.html](../genesis/research/18-product-slice-7.html).
Do not implement a complete
Screenwriter or conversation-persistence
system now. Every subsequent MVP milestone should advance a real user
journey through the application and, where practical, extend
browser-level E2E coverage.

## Cinematographer --- how do we physically get there?

Inputs: accepted start/end **canonical** frames (actual generated
sets), intended destination/route. Provisional Plan storyboard images
are **not** CM inputs.

**Cinematographer inspects actual adjacent sets and determines how
the camera should move through their visible geography.** The
primary question is how to shoot this pair, not whether a stochastic
video model will succeed. A thin assessment lives in
`media/src/cinematographer/assess-journey.ts` and runs automatically
for one JourneyShot whenever that segment has two actual adjacent
canonicals. CM output lives on that segment's
Motion Plan and includes route, camera path, pace, visible geometry, transition strategy,
and a concise `segmentPromptAddition`, plus integer `setConsistency` and
`traversalConfidence` scores (0–100), advisory shootability, concerns, and
optional per-still travel geometry (semantic target, vanishing point /
focus of expansion, heading, confidence). Set consistency is whether the
adjacent stills belong to the same continuous world and route. Traversal
confidence is whether the camera can physically travel start→end in
continuous first-person motion. Shootability is the actionable summary
of that diagnosis. Camotion executes when valid travel geometry can be
bridged into CameraMotionPlan; there is no separate Camotion suitability
score.
Destinations stay canonical world
state; the JourneyShot owns the Motion Plan and the footage; boundary continuity remains
a later seam-level video concept.

Shootability is **advisory set analysis**. It does not gate
JourneyShot operational status and does not predict generation
success. Always choreograph, including when shootability is
`needs_review` or `not_shootable`. A mostly straight move is valid
when the geography supports it. Apparent foreground obstacles are
not automatic refusals; CM should say how the camera might negotiate
visible geometry. Both stills are first-person POV along the same
forward travel direction; the end still is the next forward viewpoint,
not a reverse angle. TunnelVision uses an unembodied first-person POV:
the camera has a position and trajectory, but the viewer/camera
operator must never be visible. People, animals, vehicles, objects, and
other subjects may appear naturally as part of the world. Product still
and video prompts add that constraint; filmmaker and Director story
text should not.

Do **not** generate CameraMotionPlan JSON, Camotion shooting frames, or
video from the Cinematographer assessment itself. Do not expand the Integration Test 01
pair planner into a product package. The same CM turn reports semantic
travel geometry (`travel.start` / `travel.end`); a deterministic
CameraMotionPlan v1 bridge (`cameraMotionPlansFromAssessment`) pins
`forward=1.0` and 16 samples, maps the existing CM `pace` to
`exposure.strength`, and fills vanishing_point /
destination from that object. Centered `[0.5, 0.5]` is only the fallback
when a still has no usable target. An actual adjacent canonical pair then
automatically renders Camotion A′/B′ for that
segment, and stores the complete Motion Plan on the JourneyShot. FOOTAGE
Generate uses those staged frames and `composeShootingPrompt` (`segmentPromptAddition` first, then the
frozen locomotion baseline). Do not have an LLM rewrite or merge those
two pieces. Terran Boylan's
original TunnelVision continuous-locomotion prompting is the
foundation of the baseline. Adaptive per-segment choreography is
current TunnelVision product work, not Terran's agent design.

Do **not** generate the final Cinematographer plan during Plan /
Storyboard. Architecture:

intent first → destination construction → actual generated set →
physical shooting solution

Adaptive choreography is now a product output so it can be tuned
through the application. Experiment 04 is evidence, not proof that
choreography is solved. Do not over-fit the production prompt or
schema to four Forest fixtures.

Do not move CM reasoning prematurely into Plan just because
storyboard images exist. Agent reasons. CV observes / measures.
Camotion renders. Video model films.

Video currently receives shooting frames A′ and B′ plus the composed
locomotion prompt. The Project settings Video control chooses the generator
for every SHOOT in the current project. Pruna maps those frames to
`image` and `last_frame_image`; Luma uses `start_image`/`end_image`;
Wan 2.2 I2V Fast uses `image`/`last_image`; Seedance 2.0 Fast and 2.5
use `image`/`last_frame_image`. Canonical frames stay
Shoot world-state authority; they are not currently video inputs. Plan
storyboard drawings are not canonicals.

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
parallax reveals new space ahead; the camera follows the available
route in the supplied world, crossing openings, thresholds, tunnels,
paths, or open space only when they naturally exist.

The frozen locomotion baseline now lives in
`media/src/cinematographer/shooting-prompt.ts` as
`TUNNELVISION_LOCOMOTION_BASELINE_TEMPLATE`. `{pace}` is a per-segment
macro: BLOCK sets `slow-motion`, `slow`, `moderate`, `fast`,
`hyperspeed`, or `variable` from the geography;
SHOOT fills the template with the matching speed phrase and concatenates `segmentPromptAddition` first, then the filled baseline, via
`composeShootingPrompt`. Clip duration stays fixed; pace is apparent
camera speed, not runtime. Do not LLM-merge the baseline and addition.
Preserve Terran
Boylan / original TunnelVision provenance for the baseline. Do not
treat that text as model-independent or as a Camotion input. The
genesis copy is also recorded in [IMPLEMENTATION.md](IMPLEMENTATION.md).
