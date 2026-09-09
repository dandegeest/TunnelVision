# TunnelVision UX Plan

Product development has started. [`web/`](../web/) is a **Plan | Shoot**
filmmaking shell that starts from a genuinely new project. Forest A→F
stills and Journey videos remain research evidence and explicit test
fixtures; they do not initialize the running product. Camotion
v1 and the Integration Test 01 pipeline in `media/` are unchanged.
After Plan Movie, the filmmaker can construct the next planned
destination from the immediately preceding actual destination through
image-conditioned edit. Each construction is explicit. Export Movie
concatenates rendered journey clips that already exist.

## Primary interaction

**Decided product direction.** The primary filmmaking workspace is
**PLAN | SHOOT**. Plan the journey. Shoot the journey. There is
deliberately no Edit workspace.

**Current implementation:** Product Slice 3 Plan is a dominant
storyboard grid between a conversation history rail and a Project
panel. The left rail is conversation turn history only. The Project
panel holds the journey story, destination count (AUTO or a
number, typed or stepped), auto-generate-A, auto-generate-all, auto-block,
auto-shoot, and PLAN, and can collapse to the right
like conversation collapses to the left. Opening A can be uploaded
before a story exists. AUTO leaves later beats to the Director;
a number adds that many FPO destinations. After the first PLAN
response the count is read-only and follows storyboard add/delete.
When auto-generate starting destination is on, PLAN generates A from
the story then runs Director planning. When A is already actual and
the story is empty, PLAN first writes a journey story from that image.
When auto-generate all destinations is on,
PLAN then constructs B…N in travel order; later beats cannot run in
parallel because each is derived from the previous actual frame. Auto
blocking then blocks every actual adjacent pair. Auto shoot then
shoots blocked legs regardless of CM warnings. PLAN asks the Director to plan unspecified
beats around the complete ordered storyboard; supplied stills remain
authoritative. Planned beats start as FPO. Generate is centered beneath the
planned thumbnail and builds the next planned beat from the preceding
actual destination through image-conditioned edit; later beats stay
planned until the filmmaker generates them. Empty FPO thumbnails overlay
Director intent as readable text until an image exists; intent and visual
description for actual cards stay on-demand from the thumbnail, with an
editable prompt and Reshoot for generated stills. A generated still whose
plan later changes shows Plan changed until Reshoot. Construct is sequential **Derived**
construction, not
a global movie mode and not a requirement that every destination use
previous-frame conditioning. Shoot is a
production view of the current Project: consecutive actual adjacent
canonicals appear as Destinations / JourneyShots automatically. Unrendered
legs stay outlined. Legs that still need blocking use a neutral outline. After BLOCK, the
outline follows advisory shootability: solid green for clear, dashed gold
for hold, solid rust for no go. Those CM outlines are 2px. While BLOCK or SHOOT is running, the tile uses the
same generating shimmer as Plan FPO thumbs, and more than one shoot
can be in progress. Green fill appears only after the clip is
complete. Tile copy uses Ready to block / Ready to shoot / Ready for
edit, plus
clear / hold / no go when CM has returned. After BLOCK, the gutter
between destination stills shows a chevron pace mark: sparse for slow, denser
for fast and hyperspeed, a trailing hold for slow-motion, and a swell
for variable. The selected segment shows
the next Block or Shoot control until the clip exists. The timeline is
vertically resizable. Select
a real leg and BLOCK to run the existing Cinematographer on those
stills. Inspector Ready / Needs
review / Not shootable status is advisory and lives on the leg,
together with camera path, pace, and a concise summary. Route, transition
strategy, prompt addition, and remaining shot notes sit behind a
disclosure. After BLOCK, SHOOT generates that one leg. The preview
plays the rendered clip when present. Take evidence (A′, B′, effective
prompt, pace, model) sits behind disclosure so the clip stays primary.
Shootability does not block the journey. A-only projects
remain valid and simply have no directed production leg yet. Do not
redesign the Shoot timeline around diagnostics. The application starts untitled, with unresolved
opening frame A and no destinations or journeys. Forest A→F remains
research evidence and a controlled test fixture.
The Director runtime resolves starting-frame identity from
Project state; it does not independently substitute a catalog still.
Story edits update `Project.story` without planning. The filmmaker can replace
a destination's canonical still in place from the destination menu.
Replacing either canonical still on a production leg returns that
JourneyShot to not prepared and not shot. Uploaded media is
session/dev-runtime trusted media, not durable project persistence.
Constructed B is registered the same way so it can later be resolved
as provider input. After replacement, that destination's identity stays
the same. Slice 2 visual checkpoint:
[genesis/research/11-product-slice-2.html](../genesis/research/11-product-slice-2.html).
Slice 3 Director observation:
[genesis/research/12-product-slice-3.html](../genesis/research/12-product-slice-3.html).
First Director-derived destination construction:
[genesis/research/13-destination-construction.html](../genesis/research/13-destination-construction.html).
Forest A→F Camotion continuity evidence:
[genesis/research/14-forest-a-to-f.html](../genesis/research/14-forest-a-to-f.html).
Product Slice 4 UI:
[genesis/research/15-product-slice-4.html](../genesis/research/15-product-slice-4.html).

### Plan — conversational storyboard

**Slice 2 implements the storyboard grid visualization and a static
Conversation prompt fixture.** Product
Slice 3 enables Send to ask the Director to plan unspecified beats
around existing destinations.
Chat is not implemented.

Plan should be a **storyboard workspace driven by conversation**.
The user develops the movie with TunnelVision. As the conversation
develops, TunnelVision materializes a familiar visual storyboard
rather than exposing agent internals or filmmaking forms.

The storyboard represents **this is what we intend to make**. It
should communicate story progression, intended Destinations, shot /
destination composition, spatial relationships, route and
choreography, pacing, transition intent, and important visual
landmarks.

The conversation is an interaction mechanism, **not** the
authoritative project data model. The durable result is structured
Director intent:

conversation → structured Director intent → storyboard visualization
→ approved / revised movie plan

The storyboard is persistent and revisable after production begins.
Users should be able to make semantic revisions in conversation
("pull farther back", "put the bedroom window in the upper right",
"approach the house before turning toward the window", "make the
return to the bedroom physically traversable"). The system updates
the structured plan / storyboard. Do not design the complete
conversation / state / revision architecture yet.

Plan storyboard images are **provisional** visualizations of
Director intent. They are not canonical Destinations, production
sets, Camotion inputs, final frames, or evidence of actual generated
geometry. Shoot is where **this is what the generated world actually
gave us** becomes visible.

### Storyboard visual language

**Product / UX direction, not architecture.** Traditional professional
film storyboard:

- black-and-white graphite / ink / linework
- sparse / selective grayscale shading
- composition and spatial intent over polished illustration
- edge-to-edge artwork inside product UI

The generated image must **not** include paper, card borders, frames /
templates, desk or background around a physical sheet, artificial
tilt, or text labels / arrows baked into the drawing.

TunnelVision's UI owns cards, labels, sequence, status, selection,
borders, and other storyboard chrome.

> **The model generates the drawing. TunnelVision generates the
> storyboard.**

Do not over-specify exact styling in architecture. Selective color as
a destination cue is an **unvalidated** research idea; do not replace
the black-and-white direction. See
[RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md).

Plan **media preflight** marks aspect-ratio mismatch on the affected
storyboard thumbnail. Resolution and format differences remain
informational and do not produce warning icons. There is no global
preflight banner. Warning visibility is independent of Media Info.
The icon exposes the underlying finding; it does not crop, resize, or
convert source media.

Storyboard **Media Info** is an icon tool in the workspace header
toolbar. **Debug** sits beside it and is session UI, not project
persistence. With Debug on, Technical in the Project panel (and Shoot
inspector) shows session disk paths for canonical stills and shooting
frames. Camotion work dirs are kept only while Debug is on; product
shoot does not pass a depth map. Frame labels occupy a
full-width top strip. Destination-specific actions live in a quiet
kebab on that strip. Unresolved slots expose Upload image. Actual
stills expose Replace…, which swaps that
destination's canonical still in place. Later destinations also expose
Delete; opening A cannot be deleted. Delete is structural: it does not
invoke the Director or relabel remaining beats. An Add Destination affordance
follows the last configured destination once A is actual; it appends an
unresolved slot, is not itself a destination, does not invoke the
Director, and is disabled while PLAN or sequential destination
generation is running. It does not encode Provided / Generated / Derived / Discovered.
Approximate duration belongs to a Journey/segment, not the destination
thumbnail. Technical facts (provenance icon, friendly
aspect, dimensions, format) appear in a thin bottom strip only when
Media Info is on. Destination planning details (intent and visual
description) are available from the destination thumbnail, not as
persistent caption text under actual stills. Empty FPO thumbnails
overlay Director intent as readable text until an image exists. Storyboard
and other 16:9 thumbnails keep a fixed 16:9 tile. Source stills are
centered and scaled to fit so the entire image stays visible; unused
area letterboxes or pillarboxes. 16:9 stills fill the tile. Do not
stretch or crop source media to fill the tile. Do not silently alter filmmaker media.

The storyboard remains
the authoritative Plan artifact. Conversation is turn history only and
can hide to the left. Journey story, destination count, auto-generate-A,
auto-generate-all, auto-block, auto-shoot, and PLAN live in the Project panel,
which can hide to the right. Opening A can be uploaded before a journey
story is entered; later destinations still need a story. AUTO sizes later beats by Director choice; a number, typed or stepped,
adds that many FPO
slots. After the first PLAN response the count is read-only.
When auto-generate starting destination is on, PLAN generates A then
runs Director planning. Uploading A before the first plan unchecks and
disables that toggle. When A is actual and the story is empty, PLAN
writes a story from A first. When auto-generate all destinations is on,
PLAN then generates each remaining destination in order from the
previous actual frame. Auto blocking and Auto shoot continue that
pipeline after destinations exist. While PLAN or those auto stages run,
the PLAN button uses the generating shimmer and names the current
stage. PLAN appends a pending
Director turn in history; that same Director entry resolves
in place to structured evidence plus a concise filmmaker-facing
summary. Pending Director **Planning…**, **Blocking…**, and
**Shooting…** turns, and construction, show a
progress spinner beside that status copy. Timestamps are stored on each conversation entry when it is
created; the UI formats that stored time. Role labels are FILMMAKER
and DIRECTOR.

Shoot **boundary continuity** is a seam-level mark at the shared
destination between adjacent completed Journey clips. The timeline
stays media-dominant. Inspection shows classification, raw MAE/SSIM
where useful, and output raster mismatch as a separate fact. A strong
boundary match is not a traversal or shootability claim.

> **TunnelVision should feel like a filmmaking surface, not an AI
> control panel.**

### Shoot — production workspace (Slice 1, preserve)

1.  Destinations and journeys appear on a locked timeline.
2.  Optional cheap destination intervention: Approve, Redo, possibly
    Redo With Note / Adjust (Directed policy).
3.  User presses **Shoot** on the selected leg or **Export Movie**.
4.  Cinematographer planning, Camotion, video generation,
    evaluation/retry, and deterministic assembly run (not wired in
    the current slice).

The timeline is a readable representation of the crew's decisions. It
should reveal filmmaking intent without requiring filmmaking
vocabulary.

> **TunnelVision presents decisions, not generations.**

A redo of destination D invalidates adjacent journeys C→D and D→E.
Invalidation is displayable; regeneration is not implemented in this
slice.

## Shoot timeline

Preserve Product Slice 1's two locked lanes. Do not redesign this
timeline in this checkpoint.

Timeline has two locked lanes on one time axis:

- **Destinations** — generated sets. Loop closure may show another
  **occurrence** of destination A (`A | B | C | D | E | (A)`), not a
  sixth generated world.
- **Journeys** — shots between those occurrences. Destination frame
  **centers** sit on journey **boundaries**.

Preview sits above the timeline. A contextual inspector sits beside
it. Directed vs Autonomous is one project policy flag, not two UIs.

Shootability is **relational and advisory**: the Cinematographer
inspects an intended journey between actual generated sets and
describes how to shoot it. Timeline tiles use Ready to block / Ready
to shoot / Ready for edit, with clear / hold / no go outlines after
BLOCK, and a chevron pace mark in the gutter between destination stills.
Compact inspector Ready / Needs review / Not shootable,
camera path, and a concise summary remain on the analyzed leg;
destination cards stay world-state. CM `not_shootable` does not change
JourneyShot operational status.

A blocked journey is not automatically a Cinematographer repair.
Some failures should return to Plan so the Director can revise the
Destination design, then generate and inspect a new actual set. Plan
is where spatial filmmaking intent can be revised when production
evidence shows the planned movie cannot be physically shot as
intended. One later manual revised-E checkpoint recorded that loop;
it did not replace canonical E. See
[PRODUCT.md](PRODUCT.md) and
`camotion/integration/wardrobe-loop-01/experiments/upstream-e-replanning/`.

## Opening state

Minimum brief: a story / journey idea. The filmmaker can replace
starting frame A from Plan. Approximate duration is a Journey/segment
property, not a Destination HUD field, and remains a later
collaborative control.

Slice 1 uses a uniform journey duration of 6 seconds as fixture
geometry. Variable duration remains later: destination times are
derived from the sum of prior journey durations.

## Canonical vs candidates vs storyboard drawings

Plan storyboard drawings are provisional intent. They must not be
confused with Shoot Destinations.

Only selected frames permanently occupy the destination lane.
Candidates are transient editing material. Opening destination C can
reveal `C1 C2 C3 C4`, with the Director recommendation marked.
Choosing another candidate replaces C. Downstream frames can become
provisional and be re-evaluated.

> **TunnelVision presents decisions, not generations.**

**Canonical vs shooting frames.** Destinations show **canonical /
pristine** frames: authoritative world-state images. Camotion derives
**shooting frames** from them. Video generation currently receives
those shooting frames. Canonical images remain the destination
authority; they are not currently passed to the video model.

For **directed A→B** shots, the supplied start and end frames
(currently Camotion shooting frames derived from canonical A and B)
are the shot endpoints. Generated boundary frames should match those
endpoints as closely as the video model permits. Future Discovery /
open-exploration generation is a different mode (`endDestinationId:
null`) and is not the current planned-timeline contract.

## Frame modes

**Variations** --- alternate candidate viewpoints.

**Direction** --- large destination image plus Director destination
marker. The user clicks/drags elsewhere to mean **go there**. The user
manipulates a destination, not a vanishing point.

**Motion** --- Cinematographer interpretation and Camotion shooting-frame
preview.

Depth maps, masks and confidence values belong under Inspect/Advanced.
Camotion does not estimate depth. Optional near-weight maps are a
sidecar input beside CameraMotionPlan, not a plan field.

## Destination interaction

Coordinates are normalized `0..1` with `(0, 0)` top-left and `(1, 1)`
bottom-right. See [DATA_MODEL.md](DATA_MODEL.md).

The user manipulates a **destination**. Vanishing point / focus of
expansion is derived later (human, experiment, or Cinematographer).
How that derivation works, including any use of depth, is an **open
question**. Camotion does not estimate depth or infer vanishing
point; the plan supplies the vanishing point. Depth estimation and CV
scene analysis stay outside Camotion.

For straight-ahead travel, destination and focus of expansion may
nearly coincide. They may also be offset. An off-center supplied
focus of expansion is valid Camotion v1 geometry; v1 does **not**
treat that offset as a physically accurate camera turn. Lateral
translation / strafing and turning / yaw are out of scope for v1 and
must not be conflated. How a future Cinematographer derives changing
camera geometry while turning toward a user-selected destination is
an **open question**. Do not add yaw / turn fields now. Movie #2
should create off-axis route evidence first. See
[RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md).

## Variable autonomy

Use one project and one UI. `agency` is a policy flag:

- directed --- pause for human approval at meaningful gates;
- autonomous --- the same actions auto-advance unless blocked.

Human changes are preference signals. PreferenceState schema is an
**open question** --- do not design it for Camotion v1.

Blocked shootability always surfaces. Autonomous mode cannot silently
ignore an unshootable journey.

## Expensive-generation boundary

Approve still exploration before expensive video rendering. The
current primary action names are **Shoot** on the selected journey and
**Export Movie**. Destination Keep / Redo happens before those actions. In the
current slice those production actions are labeled and disabled.
Intended later Cinematographer review of actual canonicals (PASS /
REGEN / REPAIR) is recorded in
[RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md) and is **not** implemented.

## First product vertical slice (started)

`web/` is the product filmmaking surface. Plan is a storyboard plus an
editable filmmaker story in the Project panel. A new project begins
partially specified: unresolved opening frame A, empty story, no
fabricated destinations or journeys. The storyboard stays disabled
until a story is entered. Then the filmmaker provides or generates A, may set
destination count, asks the Director to PLAN, and generates
unresolved destinations. If auto-generate starting destination is on,
PLAN can create A from the story. Export Movie concatenates rendered takes that
exist.
Forest A→F remains available so Plan preflight, Shoot boundary
continuity, and CM tests can be exercised against a controlled
journey. After a Director replan, Construct still builds the
next planned beat from the preceding actual destination.
Shoot stays coherent when nothing is ready to shoot; it does not yet
generate video. Wardrobe Loop remains historical research evidence
(including E-A as a clip-less loop-closure leg, not a property of
destination E). Video generation, Camotion, and
Discovery remain unwired in the product. Integration Test 01 already
exercised the unattended filmmaking path after canonicals exist.

That slice now has MediaProvider image and video contracts in
`media/`. Current research also includes Camotion shooting frames, a
Replicate video runner, Integration Test 01, and a completed Wardrobe
A→B Seedance 2×2 (seed 70). A controlled
01.3–01.8 series exists. 01.5 remains the conservative
directed-traversal baseline. 01.8 Route-Preserved Exposure remains
the current Camotion baseline and is retained for Phase 1 as
motion-state conditioning complementary to Cinematographer locomotion
prompts. Scene-aware bounded strength `{0.02, 0.04, 0.08}` is preferred
over fixed `0.08`. **Camotion Phase 1 is frozen.** 01.9, 01.10, 01.11,
and 01.12 are still-only evidence and are not promoted.
**TunnelVision Research Phase 1 is complete.** Shootability /
intermediate volume is completed evidence; the product shell keeps
E→A as a journey, not as an intrinsic property of destination E. Unvalidated cinematographer control ideas (pace,
embodiment, Prompt Only vs Auto, velocity continuity) remain in
[RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md).
