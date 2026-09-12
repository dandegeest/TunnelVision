# TunnelVision backlog

This is the **canonical GitHub-tracked product and engineering
backlog**. It is the source of intent for future implementation
plans. A later Cursor session should be able to turn any entry into
a detailed plan without prior chat history.

Research brainstorms and unvalidated Camotion questions stay in
[RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md). Current-code facts stay
in [PRODUCT.md](PRODUCT.md), [AGENTS.md](AGENTS.md),
[ARCHITECTURE.md](ARCHITECTURE.md), and
[IMPLEMENTATION.md](IMPLEMENTATION.md).

Do not implement from this file until a session is explicitly asked
to take an item. Do not re-litigate completed product work here.

## How to use this file

Each item records **goal, why, intended behavior, constraints,
likely code areas, and open questions**. Status is a planning label,
not a CI check.

Organize roughly as:

1.  Hackathon / Agent priorities
2.  Filmmaking intelligence
3.  Camotion / visual quality
4.  Output / persistence
5.  Provider / infrastructure
6.  Future UX

### Status

| Status | Meaning |
| --- | --- |
| **BACKLOG** | Accepted work; not started. |
| **VALIDATE** | Characterize current behavior; change only if it fails the spec. |
| **EXPERIMENT** | Evidence-gathering; do not productize from a single run. |
| **READY** | Scoped enough to implement. |
| **IN PROGRESS** | Actively being built. |
| **DONE** | Shipped; move narrative to product docs, do not keep as unfinished. |
| **DEFERRED** | Still valid, explicitly not now. |

Items below are **BACKLOG** unless a later edit changes the status.

---

## 1. Hackathon / Agent priorities

### Agent mode

**Status:** BACKLOG — highest-priority product feature.

**Goal.** Implement fully autonomous journey execution. AGENT
executes the journey. It does not merely press the existing
Directed UI buttons in sequence.

**Why it matters.** Directed mode is a filmmaker-in-the-loop
workspace. AGENT is the unattended movie: prompt in, finished
journey out. This is the hackathon product and the long-term
autonomous loop.

**Intended behavior / design.** Target loop:

1.  Journey prompt.
2.  Establish or generate canonical A.
3.  Director plans the journey (WHERE it goes).
4.  Generate the next canonical (currently DERIVE from the
    preceding actual still plus Director plan).
5.  Cinematographer evaluates the actual adjacent pair (HOW it can
    be shot).
6.  Deterministic bridge writes CameraMotionPlan; Camotion
    conditions A′/B′.
7.  Repair / reshoot when CM (and later Director critique) requires
    it, including regenerating a weak canonical while using the
    opposite endpoint as a visual reference. See
    [Agent CM repair / reshoot loop](#agent-cm-repair--reshoot-loop)
    and [Revise vs reshoot](#revise-vs-reshoot).
8.  Generate traversal footage from both conditioned frames plus
    the composed shooting prompt.
9.  Advance through remaining canonicals.
10. Assemble / export the finished journey. See
    [Final journey export](#final-journey-export).

Preserve the existing architecture. Do not invent a second
cinematic stack.

| Role | Decision |
| --- | --- |
| Director | WHERE the movie goes. Structured intent, not CameraMotionPlan JSON. |
| Cinematographer | HOW the **actual** adjacent canonical pair can be shot. Semantic travel + scores + pace. |
| Camotion | Deterministic execution of CameraMotionPlan. No LLM. |
| Video provider | Traversal footage. Adapter-mapped start/end frames. |
| Canonicals | Authoritative journey state. Never silently replaced. |

Initially AGENT has **no additional user-facing options**. Agency
(Directed vs Agent) already exists as an orthogonal control-mode
toggle. AGENT should not grow a settings panel, repair-policy UI,
or DERIVE/DISCOVER control until those strategies exist as real
behavior.

Directed Options (generate start, generate all, auto-block,
auto-shoot) are **not** AGENT. They automate filmmaker clicks
inside Directed. AGENT owns the loop, including when to repair,
when to continue, and when to export.

**Constraints / invariants.**

-   A is required before cinematic workflow begins (generate A if
    needed; do not start CM/video on FPO-only pairs).
-   Director resolves unspecified directing decisions; it does not
    overwrite specified filmmaking decisions or generate images.
-   Story edits do not invoke Director. AGENT may call Director as
    part of its own loop; that is not hidden Directed autonomy.
-   CM runs on actual adjacent canonical images only.
-   Motion Plans belong to segments. Changing either canonical
    invalidates and recomputes only affected adjacent segments
    (if B changes: A→B and B→C when C exists). Do not recompute
    unrelated legs.
-   Shared canonical B may have different inbound B′ and outbound
    B′.
-   Camotion stays deterministic. Centered VP is fallback only.
-   Video uses both start and end conditioned frames when the
    provider supports first/last frame.
-   Segment-specific shooting direction precedes the locomotion
    baseline. No second LLM rewrite of that compose.
-   No hidden autonomous behavior in Directed mode.
-   Provider IDs stay behind adapters.

**Likely implementation areas.**

-   `web/src/project/ProjectProvider.tsx` — agency, CREATE JOURNEY,
    sequential construct/block/shoot. Replace “flip auto flags” with
    an Agent runner that owns the loop.
-   New Agent orchestrator (product path, not a fourth filmmaking
    role): decide next action from project state + CM + later
    critique.
-   Existing Director (`web/src/project/director.ts`,
    `media/src` reasoning), destination construct
    (`web/src/project/destination.ts`, `web/destination-construct.ts`),
    CM (`media/src/cinematographer/assess-journey.ts`), Motion Plan
    bridge (`media/src/cinematographer/camera-motion-plan.ts`),
    shoot (`web/shoot-journey.ts`).
-   Conversation may show Agent turns as progress, but conversation
    is not project persistence.
-   Do not rebuild Plan | Shoot core for hackathon. A stripped
    Agent-facing timeline may sit on top. See
    [Runway hackathon integration](#runway-hackathon-integration).

**Open questions.**

-   When CM says hold / no-go, does AGENT always enter the repair
    loop, or is there a shoot-anyway policy after retries? Default:
    retry 1–2 times, then shoot or flag. See CM repair item.
-   Does AGENT re-plan remaining beats after a reshoot changes the
    actual world, or only re-run CM on the affected pair? Prefer
    pair-local repair first; Director replan only when the
    destination concept is no longer the intended movie.
-   How much of Directed conversation UX does AGENT reuse vs a
    minimal “building journey…” surface?

---

### Agent CM repair / reshoot loop

**Status:** BACKLOG

**Goal.** Let AGENT recover when the Cinematographer finds an
actual adjacent pair difficult or impossible to shoot continuously,
including by regenerating a weak canonical while passing the
opposite endpoint as a visual image reference.

**Why it matters.** CM already inspects actual sets. Without a
repair loop, AGENT stops or ships unshootable legs. Video prompts
cannot invent missing physical geography. Repair must change only
the requested canonical(s), use the opposite still as a visual
reference when that is the smallest fix, and re-evaluate the
affected pair(s).

**Core principle.** Fix the set before shooting the scene. Do not
compensate for fundamentally poor canonical geometry with
increasingly elaborate video prompts.

This is pair-endpoint repair, not construct-time look-ahead.
Look-ahead uses a *following* actual (C) as a secondary future
reference while generating B. Pair repair uses the *opposite*
endpoint of the pair CM just judged (B while regenerating A, or A
while regenerating B). See
[Canonical look-ahead / continuity tuning](#canonical-look-ahead--continuity-tuning).

**Intended behavior / design.**

CM recommendation vocabulary (new; not a Camotion suitability
enum). Prefer the smallest repair:

| Recommendation | Meaning |
| --- | --- |
| **SHOOT** | Pair is acceptable; proceed to Motion Plan / footage. |
| **RESHOOT_START** | Start canonical is the problem; regenerate only that still. Use END as visual reference. |
| **RESHOOT_END** | End canonical is the problem; regenerate only that still. Use START as visual reference. |
| **RESHOOT_BOTH** | Neither frame can reasonably anchor a continuous traversal; regenerate the pair. |

CM also emits, on the same assessment turn when possible:

-   **concise diagnosis** — why the pair is weak (missing route,
    impossible orientation, invented geography, and so on)
-   **concise repair instruction** — what the regenerated still
    must establish so the segment becomes physically shootable
-   **whether the opposite endpoint should be used as a visual
    reference** (yes for START/END; coordinated pair for BOTH)

Distinguish **canonical repair** from **prompt repair**:

| Problem | Action |
| --- | --- |
| Route is visible in the stills; video needs clearer choreography | Improve `segmentPromptAddition` / shoot. Do not replace canonicals. |
| Route is not actually represented by the canonical images | Canonical RESHOOT. Do not solve missing geography with text. |

Shootability scores (`setConsistency`, `traversalConfidence`)
remain advisory evidence. The recommendation is the Agent action.
Do not invent a second CM LLM call if the existing assessment turn
can carry the recommendation; prefer extending that JSON.

**RESHOOT_START** on A→B:

-   Preserve A’s semantic intent and its role in the journey.
-   Keep actual B authoritative and unchanged.
-   Pass actual B as an **image reference** while regenerating A.
-   The new A must still be that opening place, but its
    composition / viewpoint must provide a plausible continuous
    route toward B.
-   Do not make A resemble B. Make A and B belong to a shootable
    continuous space.

Example: A is a broad street; B is a narrow alley that is
completely invisible in A. CM reports low traversal confidence
because the video model would have to invent the alley entrance.
Desired recommendation: `RESHOOT_START`. Regenerate A so the alley
entrance or a spatially plausible approach is visible or implied,
then re-run CM on the new A→B pair.

**RESHOOT_END** on A→B:

-   Preserve B’s semantic intent.
-   Keep actual A unchanged.
-   Pass actual A as an **image reference** while regenerating B.
-   The new B must remain the intended arrival, with geography
    that is plausibly reachable from A.

**RESHOOT_BOTH:**

-   Use only when CM determines that neither frame can reasonably
    anchor a continuous traversal.
-   Preserve both Director intents.
-   Generate them as a coordinated pair.
-   Maintain larger-journey continuity with neighboring
    canonicals.
-   Never choose BOTH when changing only one endpoint can solve
    the problem.

Agent loop:

1.  Resolve / generate the actual adjacent canonical pair.
2.  CM evaluates those actual images (existing assessment plus
    the recommendation fields above).
3.  If SHOOT, continue (Motion Plan → Camotion → video).
4.  If canonical geometry is the problem, choose START / END /
    BOTH (smallest repair) and regenerate the requested
    canonical(s), passing the opposite still as an image
    reference where appropriate. See
    [Revise vs reshoot](#revise-vs-reshoot): missing alley
    entrance, impossible orientation, or severe spatial
    discontinuity is generally RESHOOT, not REVISE.
5.  Re-run CM on the affected pair.
6.  Retry at most **1–2** times (existing Agent repair limit).
7.  If acceptable → Camotion → video generation.
8.  If still weak: shoot anyway **or** flag the segment for
    review, according to the existing fallback policy. Do not
    loop forever.

**Constraints / invariants.**

-   Existing canonical images are authoritative until AGENT
    explicitly enters a repair operation.
-   A repair replaces only the endpoint CM identified as
    problematic. Never silently replace both when one is enough.
-   Preserve Director intent for the regenerated canonical.
    Preserve unrelated canonicals.
-   After repair, invalidate / recompute only affected adjacent
    SegmentMotionPlans and footage. If B is regenerated,
    reevaluate A→B and B→C when C exists. Do not recompute
    unrelated segments.
-   Opening A cannot be deleted; it can be regenerated if CM asks
    RESHOOT_START on A→B and A is generated (uploaded A stays
    Replace, not silent overwrite).
-   No Camotion suitability enum. CM does not emit CameraMotionPlan
    JSON.
-   Repair guidance and the opposite-still reference are for
    construction / reshoot of the **canonical**, not for
    video-model prompt rewriting by a second LLM.

**Likely implementation areas.**

-   `media/src/cinematographer/assess-journey.ts` parser/schema
-   `media/src/cinematographer/assessment-prompts.ts`
-   `web/src/project/types.ts` `CinematographerAssessment`
-   Agent runner (not Directed auto-block)
-   `destinationConstructionRequestFromProject` /
    `reshootDestination` / opening generation, extended to accept
    the opposite actual still as an image reference
-   Existing Motion Plan invalidation when canonical media identity
    changes (`motionPlanAutoKey`, `hasCurrentMotionPlan`)

**Open questions.**

-   Map today’s shootable / hold / no-go onto SHOOT vs repair, or
    replace that enum with the recommendation?
-   Flag-for-review surface in AGENT with no extra options: likely
    a conversation/timeline mark, not a settings pane.
-   Uploaded canonicals: skip silent reshoot; flag instead.
-   Does START repair of generated A use opening-frame generation
    with B attached as a reference image, or destination-construct
    edit of A with B as secondary input?
-   Provider support for a second reference image on opening A
    (Nano Banana accepts `image_input`; product A is still text-only
    today).

---

### Agent cinematic-quality critique

**Status:** BACKLOG

**Goal.** Add Director/Agent-level evaluation of whether generated
canonicals make a good movie, separate from CM shootability.

**Why it matters.** A still can be beautiful and fully shootable
and still fail the movie: no escalation, no payoff, two beats that
look like the same place, or a finale that ignores the journey
prompt. CM cannot be the only critic.

**Intended behavior / design.**

Two questions stay distinct:

| Role | Question |
| --- | --- |
| Cinematographer | Can I physically shoot this pair? |
| Director / Agent critique | Is this the shot / movie we want? |

Evaluate **concrete qualities**, not one vague quality score:

-   progression / escalation
-   visual distinction between beats
-   payoff
-   continuity (story/world, not only pixel seam)
-   fulfillment of journey intent

Example: a final destination may be technically excellent and
CM-SHOOT, yet fail because it does not escalate or pay off the
journey.

Critique runs on **actual** generated (or uploaded) canonicals in
journey context, after or beside CM. It may recommend Revise or
Reshoot with specific directing instructions. See
[Revise vs reshoot](#revise-vs-reshoot).

The experimental Shot Evaluator in research is **not** this
product path. Do not promote it into a top-level filmmaking role.

**Constraints / invariants.**

-   Do not merge critique into CM JSON as a single “quality”
    number.
-   Do not let critique silently replace canonicals; Agent applies
    Revise/Reshoot with the same pair-local invalidation rules.
-   Director still does not author CameraMotionPlan.
-   No extra Directed UI for this until AGENT exists; Directed may
    later show the same critique as advisory text.

**Likely implementation areas.**

-   New Director/Agent critique request + parser (ReasoningProvider)
-   Agent runner consumes critique + CM recommendation
-   Prompts must attach actual stills and the journey prompt /
    remaining plan
-   Do not reuse Integration Test 01 pair-planner or Wardrobe
    experiment parsers

**Open questions.**

-   Per-canonical, per-segment, or both? Likely per new canonical
    plus a light whole-journey check before export.
-   Structured fields vs short prose plus a repair type. Prefer
    structured qualities so Agent can act without a second parse.
-   How this interacts with CM repair retries (critique after a
    successful SHOOT, or in parallel?).

---

### Revise vs reshoot

**Status:** BACKLOG

**Goal.** Support two Agent canonical repair strategies, chosen by
Director/Agent with specific directing instructions.

**Why it matters.** Not every failure needs a new location. Some
stills are the right place with a wrong object, sky, or threshold.
Others are the wrong place entirely. One button that always
regenerates from the previous still throws away successful world
identity.

**Intended behavior / design.**

**REVISE** — targeted image-to-image edit when the canonical is
fundamentally successful but has a specific semantic weakness.
Preserve as much as possible: location, composition, viewpoint,
lighting, world identity. The current still is the source image;
instructions say what to change.

**RESHOOT** — generate a substantially new canonical when
location, composition, viewpoint, route, or overall concept is
fundamentally wrong. Use the preceding actual still (and plan /
repair guidance) the way Construct does today, not a light edit of
the failed frame. For CM pair-geometry failures, also pass the
**opposite** actual canonical as a visual image reference so the
new still can establish compatible geography. A missing alley
entrance, impossible orientation, or severe spatial discontinuity
is generally RESHOOT rather than REVISE. See
[Agent CM repair / reshoot loop](#agent-cm-repair--reshoot-loop).

After either operation:

-   The new still becomes the authoritative canonical at that
    letter.
-   Invalidate and recompute affected adjacent Motion Plans and
    Camotion A′/B′ (inbound and/or outbound).
-   Re-run CM (and critique if present).

Agent/Director chooses the type and writes **specific** directing
instructions. CM repair guidance informs physical shootability;
critique informs movie quality. Do not ask the filmmaker for a
new option in v1 AGENT.

**Constraints / invariants.**

-   Actual canonicals are not silently replaced except by this
    explicit Agent/Director repair (or filmmaker Replace / Reshoot).
-   Uploaded stills: prefer flag over silent REVISE/RESHOOT unless
    the filmmaker opted in later.
-   Motion Plans belong to segments; only legs that touch the
    changed media identity recompute.
-   Image-edit vs image-generate stay behind
    `ImageEditProvider` / image generation adapters.
-   No Editor agent. This is Plan-level canonical repair.

**Likely implementation areas.**

-   REVISE: `ImageEditProvider` / `web/destination-construct.ts`
    edit path with the **current** canonical as source, not only
    the previous beat.
-   RESHOOT: existing
    `destinationConstructionRequestFromProject` /
    `reshootDestination` / opening generation.
-   `projectWithReplacedFrameImage`,
    `projectWithConstructedDestination`, Motion Plan auto-key.
-   Agent policy: map CM recommendation + critique → REVISE vs
    RESHOOT.

**Open questions.**

-   When CM says RESHOOT END and critique says “same place, weaker
    threshold,” is that REVISE END or RESHOOT END?
-   Does REVISE of B keep B’s intent/visualDescription and only
    add a repair addendum, or rewrite the stored prompt?
-   Max revise-then-reshoot combinations inside the 1–2 retry
    budget.

---

### Discover canonical strategy

**Status:** BACKLOG — intended major hackathon feature.

**Goal.** Add a second strategy for creating the next canonical
from what actually emerges in generated traversal footage.

**Why it matters.** DERIVE follows the Director’s intended
destination. DISCOVER lets the journey evolve from the world the
video model actually produced. That is a different movie machine,
not a CM failure.

**Intended behavior / design.**

**DERIVE** (current Construct): next canonical from Director
intent / plan, conditioned on the preceding actual still.

**DISCOVER:** next canonical from the actual generated traversal.

Likely flow:

1.  Actual A exists.
2.  Generate traversal (A→B footage). For a first DISCOVER leg the
    “B” end condition may be weaker or absent; do not assume
    today’s A′/B′ pair is mandatory for the experiment.
3.  Inspect a useful ending region / frame.
4.  Choose or recover the best continuation frame.
5.  Upscale / normalize into canonical B (canonical resolution
    rules apply).
6.  Continue B→C.

DISCOVER must **not** enter the normal CM reshoot loop merely
because the discovered endpoint differs from a predetermined
destination. Emergence is the point. CM still evaluates whether
the *next* pair can be shot once two actuals exist.

Canonical-generation strategy is architecturally independent from
control mode:

| Axis | Meaning |
| --- | --- |
| DIRECTED vs AGENT | Who controls execution |
| DERIVE vs DISCOVER | How the next canonical is obtained |

Do **not** expose DERIVE/DISCOVER in the UI until DISCOVER
actually exists. Do not encode all construction strategies
(Provided / Generated / Derived / Discovered) as four global movie
modes.

**Constraints / invariants.**

-   Discovered B is an actual canonical. It is not a storyboard
    drawing and not a raw video frame left at provider resolution
    without normalization.
-   Agency stays orthogonal. Directed may later DISCOVER; AGENT
    may DERIVE.
-   Do not silently replace a filmmaker-specified actual B with a
    discovered frame.
-   Look-ahead and Director plan remain subordinate once a
    discovered still is accepted; the still wins.
-   Provider-specific video APIs stay in adapters (last-frame
    extract, etc.).

**Likely implementation areas.**

-   New discover path beside
    `destinationConstructionRequestFromProject` (do not overload
    Construct until the contract is clear)
-   Video output inspection (frame extract from take
    `videoUrl` / provider artifacts)
-   Canonical normalization
    (`web/src/project/canonical-aspect.ts`, runtime media)
-   Agent runner strategy flag (internal, not a Project settings
    control)
-   GWM / Discovery notes in RESEARCH_BACKLOG are hypothesis only;
    do not copy that schema

**Open questions.**

-   First DISCOVER shot: video from A only, or A plus a weak
    planned B that is allowed to lose?
-   How to pick the “best continuation frame” without a new
    filmmaking role (Director critique? heuristic near end of
    clip?).
-   After DISCOVER B, does Director replan C…N against the actual
    world?

---

### Start guide / start reference

**Status:** BACKLOG

**Goal.** Optional reference image that conditions generation of
canonical A without becoming canonical A.

**Why it matters.** Demos and controlled visual starts often have
a look-reference that should influence A but must not be the
authoritative opening still. Uploading A is the explicit way to
make an image canonical.

**Intended behavior / design.**

Terminology: **START GUIDE** or **START REFERENCE** (pick one
name in implementation and use it everywhere).

Semantics:

-   Reference influences generated A (image-conditioning /
    provider reference slot).
-   **Generated A** is the authoritative canonical.
-   The reference is **not** on the storyboard, not a destination
    letter, not inbound/outbound Camotion, not a Shoot tile.
-   **Upload A** remains the explicit “this image is canonical A”
    path.

Useful for hackathon demos: attach a guide, GENERATE A / CREATE
JOURNEY, get a new opening that rhymes with the guide.

**Constraints / invariants.**

-   Do not blur conditioning reference vs canonical.
-   Do not persist the guide as `storyboard[0].image`.
-   Replacing uploaded A is still Replace; a guide never overwrites
    an actual A.
-   Generated A still stores opening intent from the story and the
    TunnelVision opening prompt as visual description.
-   Provider reference-image fields stay in the image adapter.

**Likely implementation areas.**

-   `openingFrameGenerationRequestFromProject` /
    `generateOpeningFrameImage`
-   `media/src/replicate` image generation adapters (reference /
    image_prompt only if the chosen model supports it)
-   Project state: optional guide media id, **not** a storyboard
    frame
-   UI later: attach guide near Journey prompt or Generate A. Not
    required for AGENT v1 unless the hackathon demo needs it.

**Open questions.**

-   Strength of guidance vs “copy this photo.” Prefer influence,
    not identity.
-   Does a guide apply only to A, or also later DERIVE beats?
    v1: A only.

---

### Runway hackathon integration

**Status:** BACKLOG

**Goal.** At the hackathon, integrate appropriate Runway
APIs/models into the existing TunnelVision provider architecture
while treating the current core as a pre-existing library.

**Why it matters.** Hackathon time is for a fresh Agent-facing
product surface and new providers, not a rewrite of Plan | Shoot,
CM, or Camotion.

**Intended behavior / design.**

Hackathon-day focus:

-   Fresh **minimal** UI (stripped timeline that builds as the
    Agent works)
-   Agent layer ([Agent mode](#agent-mode))
-   Runway integration behind adapters
-   [DISCOVER](#discover-canonical-strategy) if time
-   Fully unattended journeys: prompt → CREATE JOURNEY → Agent
    directs, constructs, shoots, evaluates, repairs, continues

User-facing hackathon loop: starting journey prompt, press CREATE
JOURNEY, watch a thin timeline grow. No extra Agent options.

**Constraints / invariants.**

-   Do not rebuild stable core (Director schema, CM assessment,
    CameraMotionPlan bridge, Camotion operator, segment prompt
    compose, Directed Inspector) unless a blocker is proven.
-   Runway is a provider. Canonical semantics, storyboard
    semantics, Director behavior, CM behavior, and
    SegmentMotionPlan ownership must not change because the
    adapter is Runway.
-   Video still prefers first + last conditioned frames when the
    API supports them.
-   Secrets stay out of the repo; same env/token pattern as
    Replicate.

**Likely implementation areas.**

-   New `media/src` Runway adapters + catalog entries (image
    and/or video)
-   `web/src/project` video model id parsing / duration
-   Thin Agent UI shell; existing project state underneath
-   [Provider / model abstraction](#provider--model-abstraction)

**Open questions.**

-   Which Runway models are available that day, and which map to
    still construct vs video vs DISCOVER extract.
-   Whether hackathon UI hides Directed entirely or keeps a
    developer escape hatch (Debug).

---

## 2. Filmmaking intelligence

### CM curved-route reasoning

**Status:** BACKLOG

**Goal.** Stop Cinematographer reasoning from treating “continuous
forward travel” as “fixed camera heading.”

**Why it matters.** Roads, halls, stairs, and ramps routinely yaw
while the camera keeps advancing. Penalizing a left/right turn
from the opening heading produces false hold / no-go and bad
repair advice.

**Intended behavior / design.**

Valid continuous locomotion includes:

-   yaw while translating forward
-   road curves, hallway turns, bends
-   stairs, ramps
-   other physically plausible route changes

A camera can continuously advance while heading changes
substantially. CM should ask whether a **plausible continuous
physical route** exists between the two actual stills — not
whether start and end viewpoints lie on one straight ray.

Do not require a turn. Straight corridors remain valid. Do not
require a tunnel or threshold; traversability is not architecture
type.

This is prompt/schema/reasoning work on the existing CM turn, not
a new planner and not a Camotion heading solver.

**Constraints / invariants.**

-   Continuous forward travel may follow curved routes and change
    heading (see Architecture invariants).
-   Traversability does not imply tunnels or thresholds.
-   CM still does not emit CameraMotionPlan, `forward`, or
    exposure numbers.
-   Travel geometry (VP / destination / direction) may differ
    substantially between start and end; that is already allowed
    in the bridge.
-   Do not add a second LLM.

**Likely implementation areas.**

-   `media/src/cinematographer/assessment-prompts.ts`
-   Parser only if new fields are truly needed (prefer better
    `route` / `camera` / `concerns` / scores first)
-   Tests: curved-road and hallway-turn fixtures must not be
    “unshootable” solely for heading change
-   Product copy: Shoot Inspector camera path / concerns

**Open questions.**

-   Is a dedicated `headingChange` or `routeClass` field useful,
    or does prose + scores suffice?
-   How this interacts with Camotion radial-forward limits on
    sharp turns (CM may SHOOT with concerns; Camotion may still
    smear poorly). That is Camotion/quality, not a CM false
    refusal.

---

### Re-direct around filmmaker-supplied future canonicals

**Status:** BACKLOG / VALIDATE — characterize current CREATE
JOURNEY behavior before changing it.

**Goal.** Treat CREATE JOURNEY as resolving unspecified directing
decisions in a partially specified movie, including when the
filmmaker has already planted a later actual canonical (uploaded
or generated) with no intent or generation prompt.

**Why it matters.** During testing we:

1.  Entered a Journey Prompt.
2.  Created an initial journey A → B → C.
3.  Structurally added D → E → F (Add Destination; no Director).
4.  Uploaded an externally generated image directly into F.
5.  Supplied no intent or generation prompt for F.
6.  Pressed CREATE JOURNEY again.

The current app appeared to largely understand this: keep A/B/C,
keep actual F, and treat D and E as the directing gap from known
C toward known F. That is unexpectedly powerful mixed-workflow
behavior. Make it explicit, protect it, and cover it with tests
before “improving” it.

**Intended behavior / design.**

CREATE JOURNEY must treat every actual canonical already on the
storyboard as an authoritative filmmaking constraint.

Given A → B → C → D → E → F where A/B/C are established, D/E are
unresolved, and F is a filmmaker-supplied actual:

-   Preserve A, B, and C.
-   Preserve actual F **exactly**. Do not regenerate, replace, or
    reinterpret F as a request for a different image.
-   Director must understand F visually even when F has no
    user-supplied intent or generation prompt.
-   Director resolves D and E as intermediate directing decisions
    that create a coherent progression from C toward the known F
    endpoint.

Conceptually: **KNOWN C → resolve D → resolve E → KNOWN F**.

**Actual image is sufficient specification.** An actual canonical
image is sufficient specification of a destination. Intent and
generation-prompt metadata are optional once the filmmaker has
supplied the frame. Director may inspect and semantically
interpret the image in the context of the Journey Prompt and the
surrounding storyboard, and may derive internal / descriptive
intent metadata from it. That interpretation must never become
permission to replace the canonical.

**Relationship to visual look-ahead.** This workflow is the
Director-side counterpart of
[Canonical look-ahead / continuity tuning](#canonical-look-ahead--continuity-tuning).
Once D has been generated and E is being constructed:

-   actual D (source)
-   E intent (destination)
-   actual F as **visual look-ahead**

F is especially valuable here: generation gets a concrete visual
endpoint, not only semantic information about what comes next.
Director planning should likewise use F when deciding what D and
E need to accomplish.

**Generalization.** CREATE JOURNEY operates over the complete
current storyboard as a partially specified movie.

-   Actual canonicals are fixed constraints.
-   Unresolved canonicals are directing gaps.

Example: A(actual) → B(?) → C(actual) → D(?) → E(?) → F(actual).
Director solves B, D, and E in context while preserving A, C,
and F.

Provenance does not change authority. The same rule applies
whether an actual came from TunnelVision generation, user upload,
an external image generator, or another filmmaking workflow.

**CREATE JOURNEY means:** resolve the unspecified directing
decisions in this partially specified movie.

**CREATE JOURNEY does not mean:** generate a new movie and
overwrite the current storyboard.

Product docs already claim much of this (`PRODUCT.md` “partially
specified movie”; Director prompts in
`media/src/director/prompts.ts`). First document and characterize
what currently happens. Only implement later if required to make
the behavior explicit, deterministic, and covered by tests.

**Constraints / invariants.**

-   Actual canonicals are never silently replaced, restyled, or
    regenerated by CREATE JOURNEY.
-   An actual image is sufficient specification; empty intent /
    prompt on that destination is not a license to invent a new
    still.
-   Derived Director text on an image-only actual may be adopted
    when those fields are empty; later CREATE JOURNEY must not
    overwrite filled fields or the still.
-   Add Destination remains structural only and never secretly
    calls Director.
-   CREATE JOURNEY is the only Directed UI that invokes Director.
-   Director does not generate images. Construct fills image gaps
    after the plan exists.
-   Last-beat actuals still get no look-ahead *as a destination
    target*; they are look-ahead *for earlier unresolved beats*.
-   Do not require F (or any later actual) to exist. The
    unresolved-only path stays valid.

**Likely implementation areas (inspect first).**

-   `media/src/director/prompts.ts` — partially specified movie;
    “describe this destination from the attached image”
-   `web/src/project/director.ts` —
    `directorPlanRequestFromProject`, specified vs unresolved
    slots, attached media
-   `web/src/project/storyboard.ts` —
    `isSpecifiedStoryboardDestination`,
    `applyDirectorPlanToStoryboard`
-   Existing tests:
    `web/src/project/storyboard.test.ts` (“Director preserves
    specified destinations”, uploaded still with no plan text);
    `web/src/project/interaction-model.test.ts` (complete
    storyboard on PLAN)
-   CREATE JOURNEY in `web/src/project/ProjectProvider.tsx`
-   Later: construct visual look-ahead when the following beat is
    already actual (see look-ahead item; do not implement here)

**Open questions.**

-   What exactly happens today on the tested A–C + uploaded F
    path: plan-only vs also auto-construct D/E? Characterize
    Directed Options (`autoGenerateDestinations`) separately from
    Director planning.
-   Does Director reliably see the F image bytes (trusted media
    attachment), or only a “specified” flag? The visual
    understanding claim depends on the attachment.
-   After Director adopts intent/prompt onto image-only F, is
    that text treated as filmmaker-specified forever, or can a
    later CREATE JOURNEY refresh it if the still is replaced?
    (Upload/replace already asks whether to clear plan text.)
-   Should a later actual that is *generated* (not uploaded) have
    the same CREATE JOURNEY protection? Yes by principle;
    confirm tests treat `imageOrigin: "generated"` like `"user"`.
-   How many unresolved slots between two actuals should Director
    keep vs collapse? Today it fills existing ids and must not
    invent a destination after the last slot.

---

### Canonical look-ahead / continuity tuning

**Status:** BACKLOG

**Goal.** Keep evaluating how much information about canonical C
should influence generation of B — including, when C already
exists as an actual still, using that image as a secondary visual
reference.

**Why it matters.** Too little look-ahead and B cannot prepare a
handoff. Too much and B becomes C: same image, premature later
events, collapsed destinations.

Current B generation uses:

-   actual A as the source / reference image
-   B intent / prompt as the destination to generate
-   C intent / prompt as subordinate **semantic** look-ahead

That wastes authoritative visual information in mixed / manual
workflows: the filmmaker (or a prior generate) may already have
supplied C. TunnelVision should use every actual still already on
the storyboard, without letting C steal B.

This refinement came from **Terran Boylan** after reviewing the
working application and the existing look-ahead technique.

Director-side preservation of later actuals (upload F, then
CREATE JOURNEY to resolve D and E toward F) is
[Re-direct around filmmaker-supplied future
canonicals](#re-direct-around-filmmaker-supplied-future-canonicals).
Visual look-ahead is the construct-time counterpart: once D
exists and E is generated, actual F is the secondary future
reference.

**Intended behavior / design.**

Distinguish two forms of look-ahead:

| Kind | When | What |
| --- | --- | --- |
| **Semantic look-ahead** | C is unresolved, or as supporting context even when C exists | C intent / prompt (today’s far-field copy) |
| **Visual look-ahead** | C already exists as an actual filmmaker-supplied or generated image | Actual C still as an additional **secondary** visual reference |

When generating B, if C is an actual image, attach that still as
secondary visual reference alongside A. Actual C should inform
future world continuity, spatial orientation, visual / style
continuity, and where B should appear to lead next — not what B
*is*.

Do not conflate this with Agent pair repair. Look-ahead is
construct-time future context (C while making B). AGENT CM repair
may regenerate A using actual B, or B using actual A, because the
*current pair* is not traversable. That opposite-endpoint
reference is specified in
[Agent CM repair / reshoot loop](#agent-cm-repair--reshoot-loop).

Priority (highest first):

1.  **B intent / destination** — B must still depict B.
2.  **Actual A** — source / world continuity (primary reference
    image; camera move from A).
3.  **Actual C, when available** — secondary future-continuity
    reference (visual look-ahead).
4.  **C intent / prompt** — semantic look-ahead / support
    (unresolved C, or extra prose beside actual C).
5.  **Global unembodied FPOV constraints.**

Today’s far-field wording still applies to semantic look-ahead:
C’s visual details may appear through an opening or distant field
if physically appropriate; do not arrive there, replace B with C,
or adopt C’s overall lighting or style as the new destination.

This item is **tuning of DERIVE/Construct**, not DISCOVER and not
a new construction strategy. Last beat has no look-ahead.

**Constraints / invariants.**

-   **C is look-ahead, not the target of B generation.** Do not
    let the future canonical cause B to become a blend of B and C,
    skip B, or prematurely depict C.
-   Canonical look-ahead must remain subordinate to the current
    destination.
-   Actual C is stronger than C’s text, but still weaker than B
    and A.
-   Do not require C to exist. Unresolved C keeps semantic
    look-ahead only (current path).
-   Filmmaker-specified actual C is authoritative as *C*, not as
    a license to overwrite B’s plan.
-   Last beat has no look-ahead. Opening A’s generation prompt
    still must not depict later destinations.
-   Provider reference-image slots stay in the image-edit adapter.
    If a model accepts only one reference, A wins; do not drop A
    to attach C. Visual look-ahead then waits for a model that
    can take a secondary reference, or a documented fallback
    (semantic-only).
-   Do not silently replace actual B or C.

**Likely implementation areas.**

-   `web/src/project/destination.ts` —
    `destinationConstructionRequestFromProject`,
    `followingDestinationPlan`, `farFieldContinuity`,
    `farFieldVisualDetails`
-   `web/destination-construct.ts` / `ImageEditRequest` — optional
    second reference media id when following beat is actual
-   Image-edit adapters (Kontext / future providers): whether a
    secondary reference is supported
-   Tests: B with unresolved C (semantic only); B with actual C
    (request includes C media, prompt still forbids arriving at
    C); last beat has no C
-   Side-by-side stills: B with / without visual look-ahead

**Open questions.**

-   Is the current character cap and “distant environmental
    information only” wording enough for semantic look-ahead, or
    do some worlds still leak C into B?
-   When actual C exists, keep C’s prompt as supporting semantic
    look-ahead, or drop the prose to reduce blend risk?
-   How strongly to weight a second reference without B collapsing
    into C (provider-specific; measure, do not guess).
-   Does visual look-ahead apply only to the immediately following
    actual, or also D if C is FPO and D is actual? v1: immediate
    next actual only.

---

## 3. Camotion / visual quality

### Destination-aware Camotion / non-radial motion fields

**Status:** BACKLOG

**Goal.** Make Camotion's generated motion field respond to the
Cinematographer's semantic `destinationPoint`, especially when that
destination is substantially offset from the image's natural
vanishing point.

**Why it matters.** The I→K haunted-house pair is a clean failure
case. CM understood the route: advance through the cavern, approach
the central structure, then ascend toward the eye near the top of
the wall.

For I→K START′, CM produced approximately:

-   `vanishingPoint`: (0.50, 0.55)
-   `destinationPoint`: (0.50, 0.08)

D sits correctly on the eye. The Camotion field still behaves as
radial-forward around the VP. Generated travel therefore continues
through the lower vanishing region instead of bending / ascending
toward the semantic destination.

`destinationPoint` is calculated correctly and drawn on the
overlay. It does not exert enough control over the actual motion
field.

**Intended behavior / design.**

-   When VP and D are close, today's radial-forward field can
    remain appropriate.
-   When D is meaningfully offset from VP, that offset must change
    the motion field so conditioning communicates travel **toward
    D**.

Conceptually:

-   **VP** = perspective structure of the current image
-   **D** = semantic place the camera is trying to reach

D is motion-conditioning input, not merely visualization or
metadata.

For I→K START′, conditioning should first communicate forward
movement through the cavern, then increasingly bias motion upward
toward the eye.

Do **not** globally replace VP with D. VP still carries useful
perspective geometry. The desired field expresses: move through
this perspective structure toward that semantic destination.

Likely deterministic investigations (not a schema yet):

-   shift the radial field toward D
-   blend a VP-centered radial field with a D-directed vector field
-   spatially vary interpolation from VP guidance to D guidance
-   curved / path-aware fields
-   combine destination-aware fields with future depth / Z

**Constraints / invariants.**

-   Camotion stays deterministic given the plan.
-   CM already emits travel geometry; this item is Camotion
    execution / field math, not a second LLM or a new CM route
    parser.
-   Do not treat overlay correctness as field correctness.
-   Centered VP remains fallback only when CM has no better target.
-   Destination protect remains; smearing toward D must not destroy
    the protected eye / destination region.
-   Distinct from Adaptive Camotion (image-aware *strength*) and
    Depth / Z (near/far *amount*). This is *direction / shape* of
    the field. Related to [CM curved-route reasoning](#cm-curved-route-reasoning)
    (CM may already describe the bend; Camotion must express it).

**Likely implementation areas.**

-   Camotion engine / operator (radial-forward field construction)
-   `CameraMotionPlan` v1 `camera.vanishing_point` vs
    `destination.point` consumption at render time
-   Overlay / Inspector already visualize both points
    (`web/src/project/camotion-diagnostics.ts`,
    `web/src/app/CamotionDiagnostic.tsx`) — use them as diagnostics,
    not as the fix
-   I→K (or equivalent offset-D) pair as a regression fixture once
    an operator exists

**Open questions.**

-   What offset magnitude should switch from pure radial-forward to
    a blended / path-aware field?
-   Should START′ and END′ use the same blend, or should END′ stay
    more destination-locked?
-   How this multiplies with pace strength and future depth
    weights without fighting destination protect.

**Evidence.** Destination Inspector / I→K context:

![I→K destination evidence](backlog-assets/camotion-destination-i-k-destination.png)

Motion Inspector showing VP vs D (key diagnostic: D is on the eye
at the top; VP remains near the lower center; generated travel
followed VP):

![I→K motion evidence](backlog-assets/camotion-destination-i-k-motion.png)

---

### Adaptive Camotion

**Status:** BACKLOG

**Goal.** Move beyond the current deterministic pace → exposure
heuristic toward **image-aware** motion conditioning that still
becomes a frozen CameraMotionPlan.

**Why it matters.** Pace is a rough shutter analog. A sparse
horizon and a dense forest at the same `fast` pace should not
always smear the same way. Adaptive conditioning should protect
identity (faces, destination, structured rails) while still
selling travel.

**Intended behavior / design.**

**Current:** CM `pace` maps to `exposure.strength`
(`CAMOTION_EXPOSURE_STRENGTH_BY_PACE`). Samples stay 16.
`forward` stays 1.0. Product shoot does not pass `--depth`.

**Future:** Once inputs are known, Camotion remains deterministic.
The *plan* may incorporate image structure so strength / weights
vary for a reason, not a second hidden LLM at render time.

Potential inputs (not a schema yet):

-   image structure
-   semantic destination (already on CameraMotionPlan; see
    [Destination-aware Camotion](#destination-aware-camotion--non-radial-motion-fields)
    for field *direction*, not only strength)
-   foreground / background relationships
-   depth (see [Camotion depth / Z](#camotion-depth--z))
-   protected destination regions (already `destination.protect`)

Do not reopen Phase 1 LIGHT/MEDIUM/STRONG research as product
policy. Do not add an LLM that picks 0.02/0.04/0.08 per
canonical as the product path; that was Wardrobe evidence.

**Constraints / invariants.**

-   Camotion is deterministic given the plan.
-   Centered VP is fallback only.
-   Do not change operator/sample/forward/`--depth` casually;
    depth is its own workstream.
-   Pace can remain a prior (“how fast?”) that image-aware
    weights modulate.

**Likely implementation areas.**

-   `media/src/cinematographer/camera-motion-plan.ts` (bridge
    only after a new input exists)
-   Camotion engine (media/camotion) if per-pixel weights appear
-   Keep `camotionExposureStrengthFromPace` as the default when
    no image-aware plan is present

**Open questions.**

-   What is the smallest image-aware input that beats pace-only
    on a fixed pair set?
-   Overlap with depth: one plan field or two multiply? See
    depth item.

---

### Camotion depth / Z

**Status:** BACKLOG (experiment workstream; overlaps Adaptive
Camotion)

**Goal.** Revisit the AI depth-model experiment so Camotion knows
WHERE and HOW MUCH different regions should receive motion
conditioning.

**Why it matters.** Pace answers “how fast?” Depth answers “how
much should this part of the image move?” Without Z, near props
and far sky get the same radial smear.

**Intended behavior / design.**

Conceptual weighting:

-   near objects → stronger displacement / blur
-   mid-distance → moderate
-   far background → less
-   destination / vanishing region → protected / minimal

Desired conceptual formula:

`final motion conditioning = pace strength × depth weighting × destination protection`

Product shoot today does **not** pass `--depth`. Camotion work
dirs may still understand depth in the engine; do not wire it
into AGENT until the experiment says it helps.

This is a specific experiment, even though it overlaps Adaptive
Camotion. Do not collapse the write-ups.

**Constraints / invariants.**

-   Camotion stays deterministic once depth + plan are inputs.
-   Destination protect remains.
-   Do not claim 01.10 / depth-compositor research is product
    policy; read IMPLEMENTATION / RESEARCH_BACKLOG before
    reviving.
-   Depth model choice stays behind an adapter; not a CM concern.

**Likely implementation areas.**

-   Camotion CLI `--depth` and engine
-   Depth estimator adapter (not in CM JSON)
-   Product shoot path (`web/shoot-journey.ts`) only after
    evidence
-   Wardrobe / Forest pairs as regression fixtures

**Open questions.**

-   Which depth model, and does it fail on generated interiors?
-   Multiply vs replace pace strength.
-   Whether AGENT should ever wait on depth (latency/cost).

---

### Start/end boundary finishing experiment

**Status:** BACKLOG — do **not** implement until full multi-shot
export is the Agent/Directed delivery path in regular use.

**Goal.** When a finished multi-leg MP4 exists, evaluate
deterministic finishing of each traversal using its exact
Camotion-conditioned boundary frames.

**Why it matters.** Raw A→B is generated from A′ and B′. Concat
of clips can still click at the cut. Canonical handoffs are
supposed to make assembly mechanical; finishing is about the
one-frame seam, not an Editor.

**Intended behavior / design.**

Compare, on exported journeys:

-   hard one-frame A′ / B′ bookends
-   very short dissolves
-   optical-flow / interpolated boundary transitions
-   other **deterministic** finishing if needed

No Editor agent. No NLE. Directed may later share the same
finisher as EXPORT JOURNEY.

**Constraints / invariants.**

-   Do not implement before multi-shot export is real in the Agent
    completion path (Directed concat already exists; this
    experiment needs regular multi-leg files).
-   Do not invent new Camotion operators for a dissolve.
-   Shared B: inbound end′ and outbound start′ may differ; finishing
    must not pretend they are the same frame.

**Likely implementation areas.**

-   `web/src/project/export-movie.ts` / `web/export-movie.ts`
-   FFmpeg concat + optional bookend/dissolve filters
-   Stored A′/B′ on Motion Plan / take

**Open questions.**

-   Does a 1-frame A′ hold help more than a 2–3 frame dissolve?
-   Provider already ends on last_frame; bookends may double-stamp
    B′.

---

### Canonical resolution normalization

**Status:** BACKLOG

**Goal.** Normalize canonical width/height/resolution across
image providers while preserving aspect, composition, quality, and
provider independence.

**Why it matters.** Providers return different rasters. Storyboard
semantics must not become “whatever Kontext emitted this week.”
Shoot tiles, Camotion, and video adapters need a consistent
internal still.

**Intended behavior / design.**

Define an internal canonical representation (target raster or a
small allowed set) applied after generate/construct/DISCOVER
extract.

Preserve:

-   project canonical aspect (uploaded A already stamps
    `canonicalAspectRatio`; generated A requests 16:9)
-   composition (contain / letterbox policy already used on
    tiles — do not silently crop filmmaker media)
-   quality (avoid cheap stretch)
-   provider independence (normalize in TunnelVision, not in
    storyboard letters)

**Constraints / invariants.**

-   Do not silently alter uploaded filmmaker media except by
    explicit future Fit / Crop / Change Format (RESEARCH_BACKLOG
    Project Format). Normalization of *generated* stills is in
    scope.
-   Aspect is a project property, not a per-provider accident.
-   Later constructed destinations already pass explicit
    `aspectRatio`; this item is the remaining resolution scatter.

**Likely implementation areas.**

-   `web/src/project/canonical-aspect.ts`
-   Runtime media register after construct / opening / DISCOVER
-   Destination construct + opening generate
-   Tests: two fixtures from different fake providers → same
    internal raster

**Open questions.**

-   One target (e.g. 1280×720) vs “max dimension” vs Project
    Format later.
-   Whether Camotion should always see the normalized still (yes,
    once this ships).

---

## 4. Output / persistence

### Final journey export

**Status:** BACKLOG

**Goal.** A single finished MP4 from all successfully rendered
journey segments. AGENT completion should naturally produce
A→B + B→C + C→D + … → final file.

**Why it matters.** Without this, AGENT is a folder of clips.
Canonical handoffs exist so assembly can stay mechanical.

**Intended behavior / design.**

Initial implementation: **deterministic concatenation** of
existing rendered takes in storyboard order. No transitions
required for MVP (boundary finishing is a later experiment).

Directed already has Export Movie concat of whatever clips exist,
reporting missing legs. AGENT should call that completion path
automatically when the loop finishes. Directed may expose the
same action as **EXPORT JOURNEY**.

No Editor agent.

**Constraints / invariants.**

-   Incomplete exports report missing legs; do not invent bridges.
-   Clip duration follows the generator (already: 6s vs Kling 5s).
-   Do not require every advisory CM hold to block export unless
    Agent flagged the leg.
-   Provider concat stays ffmpeg/local; not a video-model restitch.

**Likely implementation areas.**

-   `web/src/project/export-movie.ts`, `web/export-movie.ts`,
    `web/export-movie-plugin.ts`
-   Agent runner final step
-   Optional Directed label/copy: EXPORT JOURNEY

**Open questions.**

-   AGENT: export only full success, or export partial with a
    clear incomplete mark (Directed already allows partial)?
-   Audio: current takes are silent; keep silent.

---

### Durable project persistence

**Status:** BACKLOG

**Goal.** Save and reopen a complete TunnelVision project so the
filmmaking workspace survives a reload.

**Why it matters.** Today media is session/dev-runtime trusted
storage. Conversation, Debug, and panel chrome are session UI.
A real project cannot be handed to another machine or resumed
tomorrow.

**Intended behavior / design.**

Persist enough to restore the actual workspace:

-   journey prompt / story
-   canonical storyboard order and letters
-   canonical images (bytes or durable blob refs)
-   canonical intents / visual descriptions
-   Director plan / specified-vs-unspecified state
-   SegmentMotionPlans (CM assessment, CameraMotionPlans, A′/B′,
    pace, prompts)
-   rendered traversal footage and take metadata
-   provider/model metadata needed for reproducibility
-   relevant project settings (agency, video model, aspect,
    Directed options if still used)

Do **not** persist redundant derived UI: selection, zoom,
conversation-open, inspector width, playhead, conversation
history (unless later promoted). Reconstruct layout from
destinations + journeys.

**Constraints / invariants.**

-   Session UI ≠ project persistence (already documented).
-   Trusted media IDs must remain valid after reopen or be
    remapped explicitly.
-   Do not persist secrets.
-   Reconstruct Motion Plan “current?” from stored media
    identities + `generatedFrom` / auto-key rules.

**Likely implementation areas.**

-   New project archive format (zip or directory) + load/save
-   `web/runtime-media.ts` / registry
-   `web/src/project/types.ts` Project
-   Project chooser (`UNTITLED` today)

**Open questions.**

-   File-backed vs browser-originated download/upload of an
    archive for v1.
-   Whether Camotion work dirs are persisted or only A′/B′
    outputs (prefer outputs + plan JSON, not debug trees).

---

## 5. Provider / infrastructure

### Canonical provider bakeoff

**Status:** BACKLOG (experiment)

**Goal.** Controlled TunnelVision-specific comparison of
image-generation providers/models for **our** construct/opening
jobs, not generic image-quality tweets.

**Why it matters.** Construct quality dominates AGENT. Natural
exteriors currently look easier than mechanical / interior-machine
journeys; a bakeoff must include both or we will overfit forests.

**Intended behavior / design.**

Candidates at time of writing (reconfirm at evaluation):

-   Nano Banana 2 Lite (current product still path for A and B…N)
-   Nano Banana 2
-   Kontext Pro (legacy experiment edit path)
-   FLUX.2 Pro
-   FLUX.2 Klein
-   other strong candidates available then

Identical TunnelVision cases. Score:

-   journey continuity
-   viewpoint / camera control
-   destination adherence
-   reference-image conditioning (including Start guide when it
    exists)
-   world / style consistency
-   speed
-   cost

Use existing journey fixtures (Forest, Wardrobe, plus at least one
mechanical/interior) rather than ad-hoc prompts.

**Constraints / invariants.**

-   Adapters only; do not fork destination prompt logic per vendor.
-   Do not promote a winner into hardcoded role IDs.
-   Record manifests like other media experiments; no secrets.

**Likely implementation areas.**

-   `media/experiments/` harness pattern
-   `web/destination-construct.ts` / opening generate
-   Image provider catalog

**Open questions.**

-   Edit (Kontext-style) vs text-to-image for A vs B…N.
-   Whether bakeoff includes video providers (separate; this item
    is canonical stills).

---

### Provider / model abstraction

**Status:** BACKLOG (ongoing discipline; extra urgency with
Runway)

**Goal.** Keep image/video implementation details behind
adapters/configuration so core concepts do not depend on Runway,
Pruna, Seedance, Kontext, Nano Banana, Replicate slugs, etc.

**Why it matters.** Hackathon Runway work and the bakeoff will
otherwise leak vendor fields into Director, CM, and storyboard
types.

**Intended behavior / design.**

Provider/model changes must not alter:

-   canonical semantics (letters, actual vs FPO, authority)
-   storyboard semantics
-   Director behavior
-   CM behavior
-   SegmentMotionPlan ownership

Catalog + adapter + project `videoModel` and `imageModel`
are the extension points. ReasoningProvider remains
how Director/CM are routed, not a hardcoded Gemini ID in role
code.

**Constraints / invariants.**

-   Provider-specific details stay behind adapters/configuration.
-   Do not hardcode provider or model IDs into a filmmaking role
    (AGENTS.md).
-   Video duration and start/last-frame field names are adapter
    concerns.

**Likely implementation areas.**

-   `media/src/replicate/*` and any new `media/src/runway/*`
-   `media/src/replicate/video-models.ts`
-   Image generate/edit request types in `media/src/types.ts`

**Open questions.**

-   Single image-model setting vs construct-edit vs opening-generate
    vs REVISE.
-   How much of Replicate-specific prediction metadata belongs on
    the take vs adapter-private evidence.

---

## 6. Future UX

### Named canonicals

**Status:** BACKLOG

**Goal.** Eventually show destination names in addition to
canonical letters.

**Why it matters.** A · B · C is the structural spine. Filmmakers
think “Museum Entrance,” not only “B.”

**Intended behavior / design.**

Sequence identity remains A → B → C → …

Possible display: `A · Museum Entrance`, `B · Dinosaur Hall`.

Letters stay stable structural identifiers (ids, journey `A-B`,
Motion Plan keys). Names are descriptive metadata, editable,
optional.

**Constraints / invariants.**

-   Do not relabel letters when adding/deleting beats (Delete
    already does not relabel).
-   Names must not become ids.
-   Director may propose names; filmmaker-specified names are
    specified decisions (do not overwrite).

**Likely implementation areas.**

-   `StoryboardFrame` / `Destination` display name field
-   Plan tiles, Shoot inspector headings, export filenames
-   Director beat schema optional `name`

**Open questions.**

-   Director-generated vs filmmaker-only in v1 of names.
-   Uniqueness: two “Hall” names allowed?

---

## Architecture invariants

Future backlog work must preserve these. They are product law, not
suggestions.

-   **A is required** before cinematic workflow begins.
-   **Add Destination is structural only** and never secretly
    calls Director.
-   **Actual canonicals are authoritative** and must not be
    silently replaced. An actual image is sufficient
    specification of a destination; intent and generation prompt
    are optional. Provenance (generated, uploaded, external) does
    not change that authority.
-   **Story edits do not automatically invoke Director.**
-   **CREATE JOURNEY / Director resolves unspecified directing
    decisions** in the current partially specified storyboard.
    It does not generate a new movie or overwrite specified
    filmmaking decisions. Derived text from an image-only actual
    must never become permission to replace that still.
-   **Shoot does not require Director** if actual adjacent
    canonicals exist.
-   **CM operates on actual adjacent canonical images.**
-   **Motion Plans belong to segments, not canonicals.**
-   **Motion Planning is automatically recomputed** when actual
    adjacent canonical inputs change.
-   **Shared canonical B** may have different inbound B′ and
    outbound B′ conditioning.
-   **Camotion is deterministic.**
-   **Centered vanishing-point behavior is fallback only.**
-   **Video generation must use both start and end conditioned
    frames** when the provider supports them.
-   **Segment-specific shooting direction precedes** the global
    locomotion baseline.
-   **Traversability does not imply tunnels or thresholds.**
-   **Continuous forward travel may follow curved routes** and
    change camera heading.
-   **Canonical look-ahead must remain subordinate** to the
    current destination. Semantic C text and, when present,
    actual C as a secondary visual reference are guidance only;
    they must not become the target of B.
-   **Provider-specific details stay behind
    adapters/configuration.**
-   **Avoid hidden autonomous behavior in DIRECTED mode.**

---

## Explicitly not unfinished work

Do not add or revive these as backlog items; they are current
product behavior (see product docs / recent commits):

-   Automatic Motion Planning when actual adjacent canonicals
    change
-   CM Set Consistency / Traversal Confidence scoring
-   Pace → Camotion exposure mapping
-   Current segment-specific video prompt architecture
    (`segmentPromptAddition` names the visible route, then the
    locomotion baseline enforces continuous travel)
-   Removal of forced tunnel / threshold behavior
-   Current generic A-generation opening-instant prompt
-   Shoot Inspector Destination / Motion / Footage presentation
