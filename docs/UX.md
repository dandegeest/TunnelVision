# TunnelVision UX Plan

Product development has started. [`web/`](../web/) is a **Plan | Shoot**
filmmaking shell that starts from a genuinely new project. Forest A→F
stills and Journey videos remain research evidence and explicit test
fixtures; they do not initialize the running product. Camotion
v1 and the Integration Test 01 pipeline in `media/` are unchanged.
After DIRECT, the filmmaker can construct the next planned
destination from the immediately preceding actual destination through
image-conditioned edit. When a following beat already has a plan,
Construct includes that plan's visual as demoted far-field continuity after this
destination and the camera move from the source still; spatial
progression from the source viewpoint is primary — the next canonical
must show a physically advanced camera, not the source composition with
new content — and this
viewpoint stays this destination. The last beat has no look-ahead.
Each construction is explicit. There is no filmmaker look-ahead
control. DOWNLOAD
assembles the current cut from the Takes selected on the timeline.
A cached assembly is reused only while that selection fingerprint
matches; changing selected Takes rebuilds the file. The download name
uses the current project title, so renaming after untitled assemblies
starts that name at v1. Concat keeps
audio when those Takes have it.

## Primary interaction

**Decided product direction.** The primary filmmaking workspace is
**PLAN | SHOOT**. Plan the journey. Shoot the journey. There is
deliberately no Edit workspace.

**Current implementation:** Product Slice 3 Plan is a dominant
storyboard grid between a Director conversation rail and a Project
panel. A full-width app header keeps TunnelVision on the left and Plan | Shoot
centered. The left rail is conversation turn history only. The Project
panel holds the project selector, then Directed | Agent, Journey prompt
(creative intent — [PROMPT_COACH.md](PROMPT_COACH.md); philosophy
only, not a new control), destination count (AUTO or a
number, typed or stepped), and, in Directed, Options (Generate all destinations,
Generate all segments, Generate audio, Adaptive duration). Blocking is not a user automation option.
CREATE JOURNEY is the primary action. Video, Default Take Intent, and Debug mode live in Project
settings, opened from the gear. Agent hides Options. The panel can collapse to the right
like conversation collapses to the left. Director, Project, and Inspector
headers put the panel name and collapse control on one row, below the app header. Shoot Inspector titles are Inspector - Destination, Inspector - Motion, or Inspector - Footage. The project selector sits in the Project panel under that header. Opening A can be uploaded
before a story exists. AUTO leaves later beats to the Director;
a number adds that many FPO destinations. After the first DIRECT
response the count is read-only and follows storyboard add/delete.
When A is unresolved, CREATE JOURNEY generates A from
the story then runs Director planning. That generated still stores opening
intent from the story. The opening still prompt is rebuilt from the story
when generating and is not stored as a beat. The
prompt asks for the opening instant only and does not depict later
destinations. When A is already actual and
the story is empty, DIRECT first writes a journey story from that image.
When auto-generate all destinations is on,
DIRECT then constructs B…N in travel order; later beats cannot run in
parallel because each is derived from the previous actual frame. Auto
blocking is not a checkbox; Motion Planning runs automatically on
actual adjacent pairs. Auto shoot is a Directed Option. In Agent,
CREATE JOURNEY runs that whole loop unattended via JourneyAgent:
Director, sequential canonicals, CM, Traversal-Confidence repair,
Camotion, overlapping NEW TAKE, assembly of selected Takes. Stop
under CREATE JOURNEY aborts the loop at the next step and keeps
partial work. Agent
hides Options. The filmmaker remains the authority over footage
quality and Take selection.
LOOP (close on exact opening A) is backlog, not a current Agent
control. See
[BACKLOG.md — Agent LOOP option](BACKLOG.md#agent-loop-option).
Agent launches NEW TAKE as soon as each inbound pair is established;
footage may overlap later canonical work. Assembly uses the currently
selected Take per segment, named `{ProjectName}_vN.mp4`. When a generated
still is plan-changed, a later Agent CREATE JOURNEY reshoots those
stills and appends NEW TAKEs on the affected legs. Provider-aware
concurrent filming (Runway-managed queue, not a TV concurrency
cap) is backlog. See
[BACKLOG.md — Parallel segment filming](BACKLOG.md#parallel-segment-filming).
DIRECT asks the Director to plan unspecified
beats around the complete ordered storyboard; supplied stills remain
authoritative. Planned beats start as FPO. Generate is centered beneath the
planned thumbnail and builds the next planned beat from the preceding
actual destination through image-conditioned edit. Generated A is requested
at 16:9. Uploaded A records its pixel aspect for later destinations, which
pass that ratio explicitly instead of matching the input image's resolution
path. Following-beat
look-ahead is part of that Construct algorithm, not a Project-panel
toggle; later beats stay
planned until the filmmaker generates them. Empty FPO thumbnails overlay
Director intent as readable text. A storyboard kebab on Plan offers Intent
and Beat as checked on/off overlays over generated stills, off by default;
when both are on the
overlay labels them and scrolls if needed. Intent and visual
description for actual cards also stay on-demand in the lightbox Inspector -
Destination panel, with an
editable prompt and Reshoot for generated stills on the kebab and in that
inspector. A generated still whose
plan later changes, including a following destination used as look-ahead while
that next beat is still FPO, shows Plan changed until Reshoot. Once the following
destination is actual, look-ahead mismatch no longer keeps the badge; this beat's
own intent/beat still does until Reshoot. Construct is sequential **Derived**
construction, not
a global movie mode and not a requirement that every destination use
previous-frame conditioning. Shoot is a
production view of the current Project: consecutive actual adjacent
canonicals appear as Destinations / JourneyShots automatically. Each
interval stacks MOTION and, once footage exists, TAKES
under the destination rail.
When only A is actual, Shoot still shows A and an FPO B; clicking that
FPO opens Plan with B selected. MOTION appears once adjacent
canonicals exist. Unrendered motion stays outlined. After a Motion Plan exists, the
band follows advisory shootability: 2px solid green for clear, 2px
solid gold fill and border for hold, 2px solid rust for no go.
Clear MOTION uses the same green fill as a selected Take. Hold uses
the same filled-band treatment in the current gold. While a Motion Plan or Generate is running, the matching band uses the
same generating shimmer as Plan FPO thumbs, and more than one shoot
can be in progress. While a destination still is generating in Plan, the
matching Shoot destination slot uses that same shimmer. Green fill on a Take appears only after the clip is
complete. MOTION bands show that label plus the Set consistency and
Traversal confidence pills when CM has scored the pair; MOTION is
inspect/status for the automatically generated Motion Plan. **NEW TAKE**
is a compact centered split control under the stack when that segment
is selected: `+ NEW TAKE · ⚡` uses the project Default Take Intent, and the
arrow opens Fast / Balanced / Quality. While a take is rendering, the
TAKES gutter appears immediately and the in-flight Take uses the same
row as other Takes, with a number badge and Generating… on that bar. **NEW TAKE** stays
hidden until generation finishes.
If automatic Motion Planning fails, that MOTION band and the inspector offer Retry for that pair only.
Motion preview previous/next arrows step among adjacent MOTION pairs and
update the selected journey on the timeline. Destination Camotion preview
previous/next arrows step among actual Shoot destinations and skip FPO
slots so they never open Plan.
After a Motion Plan exists, the gutter
between destination stills shows a chevron pace mark: sparse for slow, denser
for fast and hyperspeed, a trailing hold for slow-motion, and a swell
for variable. Desired (or Fixed) seconds sit in a gold badge above those chevrons, number only.
Motion Inspector lists Pace under Traversal conf. with that
same chevron mark plus the pace label, and Duration as `4s | 4s`
(intent | model). **NEW TAKE** sits under the Take stack when MOTION
or either endpoint of that segment is selected. The main control starts a
Take with the Default Take Intent. The arrow offers Fast /
Balanced / Quality. Clicking an intent appends another
Take without deleting earlier Takes. Footer **NEW TAKE ALL** launches
those Takes together instead of waiting for each segment to finish.
The ALL arrow changes intent without generating unless that intent is
already selected — then it generates on that click. The main control
starts the batch.
Takes stack vertically; the timeline already resizes and scrolls
vertically. Each Take row uses a number badge on the left instead of a
TAKE N label. Takes stamped to a previous START/END show a
previous-canonical mark. Completing Takes, Motion Plans, or canonicals
does not move the current selection. The selected Take is outlined. Clicking a Take selects it
for preview, playback, and download. Each Take bar shows an × on the
right when selected or hovered; deleting a non-selected Take leaves the
current selection alone. Deleting the selected Take asks for confirmation,
then removes that Take from the project and its clip file. Remaining
Takes keep their numbers; the next NEW TAKE continues after the highest
remaining number. Deleting the last Take on a segment returns it to Ready
and keeps the Motion Plan. Selecting MOTION, a Take, or a
destination moves the playhead to that item's place on the cut.
That selected Take is the cut;
there is no separate Final mode. A NEW TAKE may use a different
video model on the same canonical pair. Canonical destination **Reshoot** is a
different action. Do not show revision/continuity pickers yet; Takes
already stamp the canonical media pair for a later non-destructive
RESHOOT. The timeline is
vertically resizable. The Shoot inspector is horizontally resizable and can hide to a reopen strip like the
conversation and Project rails; that visibility is session UI, not project
persistence. Canonicals are places;
MOTION is how the camera traverses between
canonicals; the selected Take is the footage for that traversal.
Canonical destinations stay clickable places on the rail above those
bands. MOTION inspects that segment's automatically generated Motion Plan: when an actual adjacent pair exists, CM
inspects the actual pair, Camotion derives A′/B′ for that shot, and
neighboring segments stay untouched. Advisory shootability lives on the
motion band as clear / hold / no go. Inspector Motion uses Motion | Details
tabs. Motion shows compact SET CONSISTENCY and TRAVERSAL CONF. scores (0–100)
as the same rounded pills as Plan / Shoot and preview tabs, filled with the
MOTION clear / hold / no-go colors, concerns under those scores, camera path,
pace, and a concise summary. Details holds Camotion then Prompt, both
collapsible and open by default with copy-to-clipboard, and the Start′/End′
thumbs with the Camotion facts. Clicking Start′ or End′ selects that destination
and opens the destination inspector on Motion. Clicking the start or end
canonical still on Motion selects that destination on Source. Generate on FOOTAGE remains explicit and produces that one take from the
staged frames. The preview
shows the A|B stills, canonical vs conditioned frames, and Camotion overlay on MOTION, and the
rendered clip on FOOTAGE. MOTION sizes that pair to the stills'
aspect instead of a 16:9 / 32:9 frame, and contains rather than
stretching or cropping. Selecting a destination still
offers a compact read-only Camotion diagnostic: canonical vs stored A′/B′
in the preview, a thin overlay of the stored CameraMotionPlan on the
displayed still (that segment's VP / travel direction), and Exposure
showing the mapped pace strength actually used for that segment. Overlay marks use a
knockout halo and chipped VP/D labels so they read on both dark and bright
stills. CameraMotionPlan facts sit in the inspector. Take evidence (effective
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
Replacing either canonical still on a production leg invalidates that
JourneyShot's Motion Plan and keeps existing Takes. Uploaded media first lands in session/dev-runtime trusted media.
Save Project copies those bytes into the project directory; Open
restores them. Constructed B is registered the same way so it can later
be resolved as provider input. After replacement, that destination's identity stays
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
Product Slice 5 Project video model:
[genesis/research/16-product-slice-5.html](../genesis/research/16-product-slice-5.html).
Product Slice 6 destination look-ahead:
[genesis/research/17-product-slice-6.html](../genesis/research/17-product-slice-6.html).
Product Slice 7 Plan | Shoot UI:
[genesis/research/18-product-slice-7.html](../genesis/research/18-product-slice-7.html).
Product Slice 8 current product:
[genesis/research/19-product-slice-8.html](../genesis/research/19-product-slice-8.html).
Product Slice 9 photographic-A Camotion:
[genesis/research/20-product-slice-9.html](../genesis/research/20-product-slice-9.html).
Product Slice 10 canonical spatial progression:
[genesis/research/21-product-slice-10.html](../genesis/research/21-product-slice-10.html).
Product Slice 11 Takes:
[genesis/research/22-product-slice-11.html](../genesis/research/22-product-slice-11.html).
Product Slice 12 Agent CREATE JOURNEY:
[genesis/research/23-product-slice-12.html](../genesis/research/23-product-slice-12.html).

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
preflight banner. Warning visibility is independent of the selected-tile media strip.
The icon exposes the underlying finding; it does not crop, resize, or
convert source media.

Storyboard media facts appear on the selected still as a thin bottom
strip (provenance icon, friendly aspect, dimensions, format). There is
no Media Info toolbar toggle. Generated stills store the same facts as
uploads once the image exists. **Debug** is a session
toggle in Project settings, not project
persistence. Debug is on by default for now. **Agency** is a Directed / Agent segmented control
at the top of that panel, not a native OS menu and not in the workspace header. The Shoot
inspector destination view uses Source | Motion | Details tabs. Source is the
canonical still, Intent and Story (on A) or Beat (later destinations), and
Reshoot when allowed. Motion is the Camotion-conditioned still when it exists,
or “Awaiting next destination.” Details opens with a compact aspect · resolution ·
model line, then Prompt and Camotion, both collapsible and open by default, each
with copy-to-clipboard. Camotion lists direction, vanishing point, destination,
protected, exposure; working directory only while Debug is on. Empty Camotion
copy is “Awaiting next destination.” Clicking Start′ or End′ on Motion or Take
selects that destination. The footage inspector heading is the pair in arrow form (A→B), with
Take (Start′/End′), Pace, Shot direction when CM
travel exists, a collapsed Prompt, Reshoot, and Model only while Debug is on.
It does not show destination status, opening-destination
copy, or Technical/Debug path panels. Camotion work dirs are kept only while Debug is on; product
shoot may estimate a reusable canonical depth map for adaptive
weighting; Debug keeps those previews in the Camotion work dir, not in
normal filmmaker UI. Frame labels occupy a
full-width top strip. Destination-specific actions live in a quiet
kebab on that strip. Unresolved slots expose Upload image. Actual
stills expose Replace…, which swaps that
destination's canonical still in place. Dropping a PNG, JPEG, or WebP
from the desktop onto a destination thumb uses that same upload /
replace path. When every destination already has a still, dropping on
the storyboard appends a new destination and places that image. Add
Destination remains a click-to-append empty slot. Generated stills also expose
Reshoot, which regenerates that canonical from the current prompt.
If the slot already has intent or a
visual description, that action asks Keep or Clear so the next DIRECT can
describe the new still. Later destinations also expose
Delete; opening A cannot be deleted. Delete is structural: it does not
invoke the Director or relabel remaining beats. An Add Destination affordance
follows the last configured destination once A is actual; it appends an
unresolved slot, is not itself a destination, does not invoke the
Director, and is disabled while DIRECT or sequential destination
generation is running. Motion Planning and footage generation on an
earlier pair do not lock the storyboard: drop, Add Destination, and
Generate may continue. It does not encode Provided / Generated / Derived / Discovered.
Approximate duration belongs to a Journey/segment, not the destination
thumbnail. Destination planning details (intent, story on A or beat visual
description on later destinations, a compact media-facts line above Prompt and Camotion in a Details pane) live
in the same Inspector - Destination panel used on Shoot, docked to the
right of the storyboard reel — not as a popup under the tile
or persistent caption text. That inspector uses Source | Motion | Details
tabs. Intent and story/beat are click-to-edit: they keep a
dimmed border at rest, look like an editor when focused, commit on each
keystroke, and keep that text when the filmmaker leaves the field or closes the
reel. Selecting that text and pressing Backspace deletes characters; arrows
move the caret. They do not close the reel or step destination. Escape closes
an open popup menu first, then the reel when no field is focused. Prompt and Camotion in Details are read-only, open by default, and offer
copy-to-clipboard. Motion shows A′ when Camotion has conditioned that
destination, and that tab also switches the reel still. Uploaded A with a journey story
stores opening intent from that story. The opening still prompt lives under
Prompt, not as a beat. Actual A can still open the reel inspector when those fields are empty. Clicking an unselected still outside the
label, kebab, and media-info strips selects it. Clicking the selected
still or the label strip opens that storyboard reel in the
storyboard area, with previous and next among every storyboard
destination, including empty FPO slots. The inspector keeps Shoot visible
on those FPO destinations and disables it until intent and beat are set.
A desktop still can drop onto
the reel image the same way it drops onto a tile. On Shoot, clicking a timeline still selects that
occurrence. The destination inspector still opens the same storyboard reel
over the timeline. Motion preview previous/next arrows step to the
adjacent MOTION pair and select that journey on the timeline. Plan and Shoot
close the reel. A Plan changed badge does not add a special tile border and does not
block opening that reel. Ungenerated reel stills use the start frame's
aspect. The image is
contained at the largest scale that fits that area and does not cover the
conversation or Project rails. Empty FPO thumbnails overlay Director intent as readable text. A storyboard kebab on Plan offers
Intent and Beat as checked on/off overlays over generated stills, off by default. When both are on,
the overlay labels them and scrolls if the copy does not fit. Storyboard
and other 16:9 thumbnails keep a fixed 16:9 tile. Source stills are
centered and scaled to fit so the entire image stays visible; unused
area letterboxes or pillarboxes. 16:9 stills fill the tile. Do not
stretch or crop source media to fill the tile. Do not silently alter filmmaker media.

The storyboard remains
the authoritative Plan artifact. Conversation is turn history only and
can hide to the left. The project selector, Directed | Agent, Journey prompt, destination count, and PLAN JOURNEY (CREATE JOURNEY in Agent) live in the Project panel,
which can hide to the right. The selector offers New, Rename, Open, and Save.
New names the project and creates its folder in the Projects Folder so
the session autosaves. Rename changes the current project's title and
folder. Projects Folder is chosen in Project settings. Directed Options are Generate all destinations and Generate all segments. Generate audio is available in Directed and Agent; it asks audio-capable video models for sound on NEW TAKE. Adaptive duration is also in Directed and Agent; when off, Fixed duration targets that many seconds for every traversal.
Video, Default Take Intent, and Debug mode are in Project settings. Those
model, format, and resolution controls are in-app menus, not native OS
selects. Clicking outside a popup menu closes it; opening one menu closes any
other. When
Kling 3 is mapped, settings also show Standard (720p) / Pro (1080p) / 4K.
Helper copy does not sit under PLAN JOURNEY. Opening A can be uploaded before a journey
story is entered; later destinations still need a story. AUTO sizes later beats by Director choice; a number, typed or stepped,
adds that many FPO
slots. After the first DIRECT response the count is read-only.
When A is unresolved, PLAN JOURNEY generates A then
runs Director planning. Uploading A before the first plan supplies that
opening still instead of generating it. When A is actual and the story is empty, DIRECT
writes a story from A first. When auto-generate all destinations is on,
DIRECT then generates each remaining destination in order from the
previous actual frame. After the journey is planned, turning that option
on generates remaining unfilled destinations from that plan without another
Director call. Before the first plan, the checkbox only stores the option.
Auto blocking and Auto shoot continue that
pipeline after destinations exist. While CREATE JOURNEY or those auto stages run,
the CREATE JOURNEY button uses the generating shimmer and names the current
stage on that button only: Generating A…, Planning Destinations…,
Planning A→B…, Generating A→B…. In Agent, a **Stop** control appears
directly under CREATE JOURNEY while JourneyAgent is in flight; it
halts further destinations, repairs, and new Takes without treating
the run as a failure. Do not repeat that status as helper
copy under the button, and do not prefix it with "Director is". CREATE JOURNEY appends a pending
Director turn in history; that same Director entry resolves
in place to structured evidence plus a concise filmmaker-facing
summary. The conversation rail presents that history as compact
production cards: a journey progress rail once a journey exists
(`A > B > C` badges: dim until a canonical still exists, olive when
it does; the `>` lights when that leg has accepted footage; long
rows scroll),
destination stills, grouped Cinematographer evaluation with the
existing Set Consistency / Traversal Confidence scores, shot
accepted/in-progress status, and a journey-complete card with Play
and Download. Play journey moves the playhead to the start of the
cut, opens Shoot, then plays. Pending Director **Planning…**, Cinematographer, and
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
3.  User presses **NEW TAKE** on the selected leg or **DOWNLOAD**.
4.  Cinematographer planning, Camotion, video generation,
    and deterministic assembly of selected Takes.

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
  **centers** sit on journey **boundaries**. Tile width follows the
  actual clip duration. Unshot legs preview the current video model's
  length. After SHOOT, each Take keeps that generator's length, so a 5s
  Kling Take is shorter than a 6s Pruna Take on the same segment. The
  cut clock follows the selected Takes.

Preview sits above the timeline. A contextual inspector sits beside
it. DIRECTED vs AGENT is one project policy flag, not two UIs.

Shootability is **relational and advisory**: the Cinematographer
inspects an intended journey between actual generated sets and
describes how to shoot it. Timeline tiles use Stage / Film / Export, with clear / hold / no go outlines after
BLOCK, and a chevron pace mark in the gutter between destination stills.
Motion Inspector keeps camera path and a concise summary on the Motion tab;
Camotion, Start′/End′, and Prompt live on Details. Destination cards stay world-state. CM `not_shootable` does not change
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
Camotion's renderer does not estimate depth. Product shoot may supply
a cached sidecar near-weight map. Optional near-weight maps are a
sidecar input beside CameraMotionPlan, not a plan field.

## Destination interaction

Coordinates are normalized `0..1` with `(0, 0)` top-left and `(1, 1)`
bottom-right. See [DATA_MODEL.md](DATA_MODEL.md).

The user manipulates a **destination**. Vanishing point / focus of
expansion is derived later (human, experiment, or Cinematographer).
How that derivation works, including any use of depth, is an **open
question**. Camotion does not infer vanishing
point; the plan supplies the vanishing point. Depth estimation and CV
scene analysis stay outside the renderer and CameraMotionPlan.

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

- DIRECTED --- pause for human approval at meaningful gates;
- AGENT --- the same actions auto-advance unless blocked.

Human changes are preference signals. PreferenceState schema is an
**open question** --- do not design it for Camotion v1.

Blocked shootability always surfaces. AGENT cannot silently
ignore an unshootable journey.

## Expensive-generation boundary

Approve still exploration before expensive video rendering. The
current primary action names are **NEW TAKE**
under the Take stack, and
**DOWNLOAD**. Destination Keep / Redo / Reshoot happens before those actions. In the
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
destination count, asks the Director with DIRECT, and generates
unresolved destinations. CREATE JOURNEY generates unresolved A from the story
unless the filmmaker already supplied A. DOWNLOAD concatenates the current cut.
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
