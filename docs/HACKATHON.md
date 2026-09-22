# TunnelVision — Runway Hackathon Plan

This is the **definitive implementation plan** for the Runway hackathon
build. Hand it to Cursor on event day with no extra briefing.

Read this entire file before coding. Then inspect the live repository.
If a later fact contradicts this document, report **only** that
discrepancy and the smallest change. Do not invent a new plan.

Related current-code docs (do not treat them as optional):

-   [PRODUCT.md](PRODUCT.md)
-   [ARCHITECTURE.md](ARCHITECTURE.md)
-   [AGENTS.md](AGENTS.md)
-   [IMPLEMENTATION.md](IMPLEMENTATION.md)
-   [BACKLOG.md](BACKLOG.md) — DISCOVER / camera grammar / Model
    Router (Agent chat UI and Session persistence are **pre-hack**)
-   [DATA_MODEL.md](DATA_MODEL.md) — CameraMotionPlan v1 only
-   [RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md) — GWM Worlds 2 notes;
    LEAD (formerly Reverse Lead) exhibit; hypothesis only; closed
    120fps Temporal Seam note
-   [Next experiments and hackathon UI](hackathon/next-experiments-and-ui.md)
    — color continuity (**P2**), CM OG vs Pull Forward (**P0
    hack-day**), journey-as-chat + Session (**landed**), Continue
    Journey (**P1**). Do not implement those from a product session.
-   [PROMPT_COACH.md](PROMPT_COACH.md) — Journey-prompting philosophy;
    Prompt Coach is **future**, not a product agent. Hackathon camera
    grammar (POV / FOLLOW / LEAD / MOUNTED, one journey = one
    grammar) is decided in this file.
-   [2026-09-20 Temporal Seam / 120fps](experiments/2026-09-20-temporal-seam-120fps.md)
    — Enhance Frame Rate was proven live; velocity-smoothing joins
    were **abandoned**. Not event-day work.

Public Runway Dev documentation (source of truth for the API;
reopen on event day):

-   [API Documentation](https://docs.dev.runwayml.com/)
-   [Agent primer / `ai-context.md`](https://docs.dev.runwayml.com/ai-context.md) — read this first on event day
-   [`llms.txt` index](https://docs.dev.runwayml.com/llms.txt) — [`llms-full.txt`](https://docs.dev.runwayml.com/llms-full.txt), [OpenAPI](https://docs.dev.runwayml.com/openapi.json)
-   [Using the API](https://docs.dev.runwayml.com/guides/using-the-api/)
-   [Available models](https://docs.dev.runwayml.com/guides/models/)
-   [API reference](https://docs.dev.runwayml.com/api) ([machine-readable](https://docs.dev.runwayml.com/api.md))
-   [SDKs](https://docs.dev.runwayml.com/api-details/sdks/) — Node [`@runwayml/sdk`](https://www.npmjs.com/package/@runwayml/sdk)
-   [Task failures](https://docs.dev.runwayml.com/errors/task-failures/) / [HTTP errors](https://docs.dev.runwayml.com/errors/errors/)
-   [Model Routers](https://docs.dev.runwayml.com/model-routers/)
-   [Configuring a Model Router](https://docs.dev.runwayml.com/model-routers/configuration/)
-   [Generating through a Model Router](https://docs.dev.runwayml.com/model-routers/generating/)
-   [Inputs](https://docs.dev.runwayml.com/assets/inputs/)
-   [Outputs](https://docs.dev.runwayml.com/assets/outputs/) — result URLs expire in 24–48 hours; download them
-   [Reference media guidelines](https://docs.dev.runwayml.com/recipes/reference-media/) — Recipe/product-ad guidance; not Camotion
-   [Multi-Shot Video recipe](https://docs.dev.runwayml.com/recipes/multi-shot-video/) — **not**
    TunnelVision traversal; see §14
-   [Connect Dev MCP](https://docs.dev.runwayml.com/guides/mcp/) — [`https://dev.runwayml.com/mcp`](https://dev.runwayml.com/mcp)
-   [Agent setup paste](https://dev.runwayml.com/agents)
-   [API changelog](https://docs.dev.runwayml.com/api-details/api_changelog/)

Do **not** treat this file as permission to implement Continue
Journey, Discover, CM OG vs Pull Forward, Camotion redesign, a
Plan | Shoot rewrite, or a new JourneyAgent from a normal product
session. JourneyAgent, the Agent chat workspace, and lightweight
Session persistence are **pre-hack**. Freeze that pipeline except
for the hack-day intelligence items listed in the priority board.
See [BACKLOG.md](BACKLOG.md).

The existing TunnelVision core is a **pre-existing internal library**.
We are **not** claiming the entire TunnelVision application was built
during the hackathon. Hackathon-day work is **agent intelligence
and Runway API usage** on top of that core — not a second UI.

---

## Mission

The key product claim is **not** “AI video generation.”

TunnelVision is not merely repeatedly calling a video generation API.

``` text
The Director decides WHERE the journey should go.
The Cinematographer decides HOW each traversal should be shot.
TunnelVision watches and evaluates its own generated footage.
When a shot fails, the CM diagnoses, changes strategy, reshoots,
reevaluates, and continues.
The user can then say where to go next — including continuing
spatially from the previous journey's final canonical.
```

Desired reaction:

> I typed one prompt, watched the film crew make the journey,
> then told it to keep going.

``` text
THE CONVERSATION IS THE WORKSPACE.
A JOURNEY IS A RICH CHAT TURN.
```

Conversation / history grows **vertically**. Each journey grows
**spatially** left → right (`A → B → C → D → E`). Agent
reshoots branch **downward**. Plan and Timeline stay specialist
manual surfaces.

The Agent UI is **pre-hack**. Event day is **agent intelligence
and Runway API usage**, not UI construction.

### Priority board (lock this for event day)

| Status | Item |
| --- | --- |
| **DONE / PRE-HACK** | Runway Dev client + generic async task polling |
| **DONE / PRE-HACK** | Canonical A before Director plan |
| **DONE / PRE-HACK** | Director journey planning |
| **DONE / PRE-HACK** | Cinematographer evaluation; Set Consistency / Travel |
| **DONE / PRE-HACK** | Autonomous reshoot / repair (current TC&lt;30 END repair) |
| **DONE / PRE-HACK** | Agent rich-chat Journey UI (Director \| Agent \| Shoot) |
| **DONE / PRE-HACK** | Lightweight Session persistence; Project / Session split |
| **DONE / PRE-HACK** | Whole-journey camera grammar (POV / FOLLOW / LEAD / MOUNTED) |
| **DONE / PRE-HACK** | Shared Project Save / Open (Projects Folder) |
| **P0 HACK** | Fully unattended end-to-end journey orchestration (validate) |
| **P0 HACK** | CM chooses OG vs Pull Forward **per traversal** |
| **P0 HACK** | Failure-driven technique switching (OG → PF after diagnosis) |
| **P1 HACK** | Continue Journey (`Director.intent()` NEW \| CONTINUE) |
| **P1 HACK** | Discover with ≥720p late-frame canonical harvesting (not a UI mode) |
| **P1 HACK** | Runway model selection / routing **if** it shows useful intelligence |
| **P2 OPTIONAL** | Automatic color continuity / finishing |
| **STRETCH** | GWM / Worlds (do not jeopardize the working journey) |
| **ABANDONED** | 120fps Temporal Seam / velocity smoothing |
| **OUT / DEFERRED** | Autonomous Agent stopping / completion judgment |
| **OUT / DEFERRED** | Agent LOOP; provider-aware parallel filming; mixed camera grammar |
| **OUT / DEFERRED** | Prompt Coach; Footage Evaluator |
| **NOT HACK** | Session browser / rehydration / session management |
| **NOT HACK** | Combined Session export / chained-journey MP4 |
| **NOT HACK** | Dedicated second Vite surface / `/agent.html` |
| **NOT HACK** | New Journey / Continue Journey buttons or mode selector |

### Existing core vs hackathon-day work

``` text
ONE SURFACE (existing Agent tab).
ONE FILMMAKING ENGINE.
SESSION → PROJECT (never Project → reconstructed Session).
RUNWAY MODEL ROUTER AUGMENTS THAT ENGINE IF IT HELPS.
IT DOES NOT REPLACE DIRECTOR, CM, CAMOTION, OR JOURNEYAGENT.
```

**Pre-existing / library (do not rebuild, do not claim as event-day
invention):**

-   Director / storyboard / destination construction
-   Cinematographer assessment and current locomotion baseline
-   Camotion, shooting, Takes, assembly / export
-   JourneyAgent happy path (derive, CM repair, overlapping NEW TAKE)
-   Plan | Shoot workstation
-   Agent conversation workspace (`web/src/app/agent/`)
-   Session JSON under `~/.tunnelvision/sessions/`
-   Runway Dev HTTP client, task polling, upload/download, and
    Enhance Frame Rate (`media/src/runway/`, `RUNWAY_DEV_TOKEN`)

**Hackathon-day work:**

-   Cinematographer-controlled OG vs Pull Forward (before shoot
    **and** after failure)
-   Validate fully unattended orchestration in the existing Agent
-   Continue Journey via `Director.intent()` (P1)
-   Discover late-frame harvesting if P0 is healthy (P1)
-   Runway Model Router **if** it demonstrates useful intelligence
-   Subtle live visualization of those **new** decisions (not a
    new chrome system)

The hackathon should **not** depend on implementing JourneyAgent or
the Agent UI in 5–6 hours. A journey created in Agent must open
later in Director / Shoot for inspection, editing, reshooting, or
export. Opening a Project must **not** reconstruct Agent history.
Do not invent a second project format.

---

## From-scratch product

The Agent tab **already is** this surface. Do not build a second
one.

### Initial state

The existing Agent composer. No extra mode buttons.

``` text
[ Where should we go next?                           ]
                                                     >
```

Send starts the normal agentic loop. The agent — not a UI mode —
decides NEW JOURNEY vs CONTINUE JOURNEY (P1).

Director and Shoot remain available. Users should not need them
for the hero demo. Router configs live in the Runway Developer
Portal (and env vars), not in Agent chrome.

### After Send

Essentially no human interaction is required for the current
journey turn.

The prompt recedes into the conversation. The journey card is a
rich chat turn: Director plan, destination construction, CM
technique, Set Consistency / Traversal Confidence, shooting,
evaluation / repair, accepted traversal, next destination.

Conversation grows vertically. The journey path grows left →
right. Reshoots branch downward.

When complete, playback stays on the same journey card. A later
Send may start a **new** Project or **continue** from the previous
completed journey's final canonical — see Continue Journey.

``` text
✓ JOURNEY COMPLETE
[ path A → B → C → D → E ]
[ FINAL VIDEO PLAYER ]
```

### Two journey strategies

These are construction strategies, not UI modes and not Directed vs
Agent.

**DERIVE** (current product path; hackathon hero unless Discover
is proven that day):

1.  Director plans / derives intended canonical destinations.
2.  For each A→B: construct intended canonical B.
3.  Prepare shooting inputs; CM evaluates Set Consistency and
    Traversal Confidence.
4.  Shoot the traversal.
5.  CM may trigger corrective regeneration / reshoot (max 2
    retries on Agent-generated ENDs when Traversal Confidence is
    below 30; current product).
6.  Accept and continue unattended.

**DISCOVER** ([BACKLOG](BACKLOG.md#discover-canonical-strategy);
**P1** if P0 is healthy — not a UI mode). Full harvest spec: §17.

There is **no** predetermined pristine canonical B. Generate
A→? into the unknown at ≥720p, harvest the **latest usable**
late frame, extract it losslessly, promote it to pristine B,
then decide the next exploratory step from that actual world.

Directed-ish request: “Travel through the forest, enter a cave,
and eventually emerge above a waterfall.” Director can lock a
destination **arc** and still harvest B from footage.

Discover request: “Enter this abandoned amusement park and keep
going. Surprise me.” Director commits minimally ahead.

The same Agent UI and Project model support both behaviors. Do
not add a Discover button. Journey **extent** stays the Director’s
planned destination count — do not add an LLM “should we stop?”
loop. Do not spend event-day time here until the unattended
Derive demo already plays back.

<a id="camera-grammar--hackathon-decision"></a>

### Camera grammar — hackathon decision

**Status:** Implemented for hackathon scope (18 September 2026 canyon
experiment). Four whole-journey grammars (POV, FOLLOW, LEAD,
MOUNTED) persist as Project `cameraGrammar`, with grammar-specific
Director / still / CM / locomotion baselines. Mixed-grammar
journeys remain **post-hackathon**. Evidence:
[sessions/canyon-grammar.md](sessions/canyon-grammar.md).
Do **not** retune a single universal FPOV locomotion baseline
as a one-off prompt tweak. See
[BACKLOG.md — Camera grammar classification](BACKLOG.md#camera-grammar-classification)
and [PROMPT_COACH.md](PROMPT_COACH.md).

Simplify camera grammar aggressively for hackathon scope.
TunnelVision should support **four** grammars only. Use these
names consistently:

| Grammar | Meaning | Retired / related name |
| --- | --- | --- |
| **POV** | Camera is the traveler. Unembodied unless the filmmaker explicitly asks otherwise. Persistent FPS-style foreground objects are generally undesirable. | FPOV / first-person POV |
| **FOLLOW** | Invisible **objective** camera follows the subject. **Not** true first-person. The subject is the continuity anchor. **FOLLOW preserves the camera–subject relationship, not a fixed following distance.** Distance may expand and contract; the camera may lag, catch up, or allow the subject to pull ahead. Do not lock an exact offset or full-body frame unless the story requires it. Do not overtake or lose the follow relationship. A rigidly bolted-behind look is closer to **MOUNTED** than cinematic FOLLOW. | FP Follow / FP_FOLLOW / first-person follow |
| **LEAD** | Invisible objective camera retreats **ahead of** the subject while facing them. Must preserve backward travel; must not rewrite the shot into forward POV. | Reverse Lead / REVERSE_LEAD |
| **MOUNTED** | Camera is physically attached to the subject or vehicle (hood, handlebars, boat bow, aircraft, dashboard). Persistent foreground geometry is **expected** and can be a continuity anchor. This conflicts with POV’s “no FPS foreground” rule — the reason grammar-specific baselines matter. | — |

**FOLLOW principle.** FOLLOW preserves the relationship, not the
distance. It keeps the subject as the continuity anchor while
allowing natural cinematic variation in distance and framing.

Observed in a high-quality FOLLOW skier test: a longer Kling shot
(~10s) produced more natural pursuit — the horse/rider pulled
ahead, the camera continued following, and the relationship held
without a bolted-behind rig feel. Treat that elasticity as a
**success**, not a failure. Do **not** claim longer duration
automatically improves FOLLOW; it is an experimental observation
that longer shots may give distance room to breathe. That is
another reason CM `desiredDurationSeconds` is potentially
valuable. Full Prompt Coach wording:
[PROMPT_COACH.md — FOLLOW](PROMPT_COACH.md#10-follow).

The FOLLOW locomotion baseline encourages persistent subject
continuity, an invisible objective camera, natural pursuit, dynamic
following distance, no overtaking unless requested, no visible
camera operator / second traveler, and no rigid mounted-rig feel.
Do not over-constrain framing. Canyon FOLLOW stills (18 September
2026) show the car pulling farther ahead at the overlook without
becoming a bolted-behind MOUNTED shot.

Retire **FP Follow** and **Reverse Lead** as names in favor of
**FOLLOW** and **LEAD**.

Later grammars remain **post-hackathon**. Do not overbuild the
taxonomy: SIDE_TRACK, ORBIT, ASCEND/DESCEND, OBJECT/PROJECTILE,
SUBJECT HANDOFF, FREE.

#### One journey = one camera grammar

Camera grammar is chosen for the **entire continuous journey**.

Do **not** support grammar switching within a single journey
before hack day. Do **not** attempt mixed-grammar journeys such as
A→B = POV, B→C = FOLLOW, C→D = LEAD. That is explicitly
**post-hackathon**.

The value proposition:

> TunnelVision can create a long continuous shot of arbitrary
> length using a selected camera grammar.

The magic is the continuous-shot journey itself, not grammar
intermixing.

Valid hackathon journeys:

-   POV rollercoaster
-   POV trench run
-   FOLLOW skier
-   FOLLOW tornado
-   FOLLOW koi
-   LEAD astronaut
-   MOUNTED car chase

#### Current canonical architecture is sufficient

Because grammar remains constant across the whole journey, the
current canonical architecture is enough for hackathon scope.

-   Canonicals remain pristine story-space destinations.
-   Traversals / shots remain the generated segments between
    canonicals.
-   Canonicals do **not** yet need multiple explicit
    camera-interpretation variants for incoming vs outgoing
    grammars.

That more advanced architecture remains **post-hackathon**.

#### Pre-hackathon failure case (preserve)

In a LEAD (formerly Reverse Lead) astronaut experiment, the
Director correctly planned a backward-moving camera that
continually faced the astronaut. The Cinematographer overrode that
intent because its baseline required forward travel. It rewrote
the shots so the camera passed the astronaut and continued
forward.

That is a useful failure of the **single** FPOV baseline, not a
prompt-tweak ticket. The pre-hackathon target is grammar-specific
baselines so LEAD is not rewritten into POV.

#### Prompt Coach

Prompt Coach is still **future** as a product layer. Its hackathon
guidance must match this simplified model.

Prompt Coach **may**:

-   help the filmmaker express the desired whole-journey camera
    grammar clearly
-   refine the Journey prompt so the idea adheres to the selected
    grammar
-   help shape beats / legs while keeping the grammar consistent

Prompt Coach must **not**:

-   encourage grammar switching within a single journey
-   expose Camotion, A′/B′, or other internals
-   force the filmmaker to understand TunnelVision implementation

Guiding principle: Prompt Coach may help structure the legs/beats
of a journey, but **all legs must still adhere to the same
selected camera grammar** for hackathon scope.

#### Pre-hackathon implementation plan

Intended before hack day — **landed 18 September 2026** (canyon
control experiment). Event day **reuses** it. Do not invent a
fifth grammar, mixed-grammar journeys, or a more permissive
universal locomotion prompt in the 5–6 hour window.

1.  Camera-grammar choice / classification: POV, FOLLOW, LEAD,
    MOUNTED. Persisted as Project `cameraGrammar`.
2.  Director / Prompt Coach / Cinematographer prompts aligned to
    the selected grammar.
3.  Grammar-specific locomotion baselines for the full journey.
4.  Grammar stays stable across the entire journey.

Pipeline:

``` text
Journey grammar (POV | FOLLOW | LEAD | MOUNTED)
  → Prompt Coach / Director keep the whole journey in that grammar
  → grammar-specific baseline
  → CM evaluates each A→B under that same grammar
  → choreograph / shoot / evaluate / retry
  → continue
```

Expose the selected **journey** grammar in the hackathon UI, for
example:

``` text
CINEMATOGRAPHER · B → C
GRAMMAR: LEAD
SET CONSISTENCY: 85
TRAVERSAL CONFIDENCE: 82
```

Do not show a different grammar on the next card in the same
journey.

#### Segment duration / pace — nice to have if easy

Duration control is **not** core hackathon scope unless it turns
out to be easy. Prefer **pace** or **shot-length intent** over
precise low-level duration control.

If easy, CM may return a duration- or pace-related value for a
segment, mapped to the closest duration the currently selected
video model supports.

Practical consideration (not a fully designed feature):

``` text
CM: grammar FOLLOW · pace fast
  or desiredDuration ~5s
Generation: nearest supported duration for the selected model
If the model changes (routing or manual): remap for the new model
```

Exact duration support is model-dependent. If a Take is
regenerated with a different model, the originally requested
duration may need to be **remapped** to the closest supported
duration for that model. Anticipate remapping if Model Router or
manual model changes are involved.

Current product already maps CM `pace` onto Camotion
`exposure.strength` and shooting-prompt speed phrases, and
Adaptive / Fixed duration maps a target onto the selected model.
Do not confuse that product mapping with this optional grammar
duration note.

**FOLLOW duration observation (experimental, not a rule).** A
~10s high-quality FOLLOW skier generation showed more spatial and
framing variation than shorter, more rigid-feeling clips. Longer
duration may allow subject distance to breathe, lag and catch-up,
and a more organic pursuit relationship. Do not claim longer
duration automatically causes better FOLLOW.

#### Camera-grammar priorities

High:

1.  one-journey / one-grammar model
2.  four-grammar vocabulary: POV, FOLLOW, LEAD, MOUNTED
3.  Prompt Coach / Director / CM alignment around the selected
    grammar
4.  autonomous continuous-shot journey generation
5.  model routing / generation evaluation
6.  visually compelling hackathon UI

Lower / nice to have:

7.  per-segment pace/duration hints
8.  automatic mapping of pace/duration to model-supported shot
    lengths
9.  duration remapping when switching models

Explicitly **post-hackathon**:

-   mixed-grammar journeys
-   grammar switching within a journey
-   canonical reinterpretation for different incoming/outgoing
    shot grammars
-   advanced coverage planning across multiple grammars

#### Short summary

``` text
Camera Grammar Hackathon Rule:
- TunnelVision will support four whole-journey camera grammars:
  POV, FOLLOW, LEAD, MOUNTED.
- FOLLOW preserves the camera–subject relationship, not a fixed
  following distance.
- A single journey uses one grammar only.
- Prompt Coach, Director, and Cinematographer should all align
  to that selected grammar.
- Segment pace/duration is a possible nice-to-have, but only if
  easy.
- If different video models support different durations,
  duration must be remapped when the model changes.
- Mixed-grammar journeys are post-hackathon.
```

### Runway Model Router — P1 if it shows useful intelligence

Camera grammar already landed. Model Router must **not** displace
P0 (unattended loop + CM OG vs Pull Forward).

**P1:** can TunnelVision’s filmmaking agents reason about **which
Runway model / model route** should execute a particular
filmmaking task, instead of using one fixed model for every
traversal — **only if** that materially demonstrates useful API /
model intelligence?

``` text
Director
  → intended journey / shot
Cinematographer
  → camera grammar
  → A/B geometry and traversal difficulty
  → shooting strategy
Model-selection / routing decision
  → appropriate Runway model / model route
Runway Model Router
  → executes generation
CM
  → evaluates result
  → retry / revise / reroute when appropriate
```

Broader research question:

``` text
CAN AN AUTONOMOUS FILMMAKING AGENT USE CAMERA INTENT, VISUAL
GEOMETRY, TRAVERSAL CONFIDENCE, AND PREVIOUS GENERATION RESULTS
TO DECIDE HOW A SHOT SHOULD BE GENERATED?
```

Potential signals: camera grammar, Traversal Confidence, Set
Consistency, subject persistence, amount / type of camera motion,
environmental transformation, known model strengths / weaknesses,
previous failed / successful attempts, cost / latency if relevant.

Do **not** hard-code assumptions about Runway Model Router
capabilities until event-day API access and documentation are in
hand. This thread is discovery-driven. Public Router docs remain
the API source of truth in §14; they do not pre-answer *which*
route a given shot should use.

A compelling visible experiment (behavior discovered that day, not
predetermined now). Grammar stays **constant** for the journey;
routing may still change per segment:

``` text
DIRECTOR
Journey planned.
GRAMMAR: FOLLOW

CINEMATOGRAPHER · A→B
GRAMMAR: FOLLOW
Traversal Confidence: 91

MODEL ROUTING
Selected: [Runway route/model]
Reason: persistent subject + aggressive camera motion

SHOOTING...
✓ ACCEPTED

CINEMATOGRAPHER · B→C
GRAMMAR: FOLLOW
Traversal Confidence: 58

MODEL ROUTING
Selected: [different Runway route/model]
Reason: subject persistence under heavier motion

SHOOTING...
CM EVALUATION
Traversal insufficient.
↻ RETRY / REROUTE
```

### Hackathon story

**Before.** TunnelVision already has continuous-traversal
technology, whole-journey camera grammar (POV / FOLLOW / LEAD /
MOUNTED), Derive, Agent-as-conversation workspace, and
lightweight Session persistence. Discover is a planned second
planning behavior, not a second UI.

**Known limitation.** The Cinematographer does not yet choose
shooting **technique** (original generation vs Pull Forward) per
traversal, or switch technique after a diagnosed failure.

**Hackathon questions.**

1.  Can a fully unattended journey complete in the existing Agent
    tab without babysitting?
2.  Can the Cinematographer choose OG vs Pull Forward
    independently for each traversal?
3.  After a failure, can the CM diagnose, switch technique,
    reshoot, reevaluate, and continue?
4.  Can a later Send continue spatially from the previous
    journey's **actual** final canonical without appending to
    that Project?
5.  Can Discover evolve the journey from generated world state
    without a UI mode?
6.  Can agents use Runway’s Model Router intelligently rather
    than blindly choosing one generation model — **only if** that
    materially helps the demo?

**Hackathon product.** An ongoing conversation with an autonomous
cinematographic world-traversal agent. Agent decisions are
visible. User intervention is not required for the current
journey.

The product demonstrated to judges is the combination:

``` text
conversational Agent UX
  + autonomous Director / Cinematographer
  + self-evaluation
  + adaptive cinematography (OG vs Pull Forward)
  + repair
  + persistent spatial continuity across separate Projects
```

The goal is **not** another video editor. The goal is an autonomous
filmmaking system built around Runway.

### Session vs Project (pre-hack)

``` text
SESSION  = interaction / conversation history
PROJECT  = current state of one generated journey
```

A Session **references** Projects. Projects stay independently
loadable, editable, and exportable. Directed / Plan / Timeline
edits modify the Project, not the Session.

Opening a Project must **not** reconstruct or repopulate Agent
conversation history.

Every app refresh currently creates a **new** Session. Old Session
JSON remains on disk at `~/.tunnelvision/sessions/`. Session
rehydration / session browser is **not** hack-day work.

Chat history is the Session. Journey media, plans, scores, and
video live on the Project. Do not duplicate project state into
the Session. See [BACKLOG.md — Durable project persistence](BACKLOG.md#durable-project-persistence).

``` text
                    SESSION
                       │
              references projectIds
                       │
             ┌─────────┴─────────┐
             │                   │
         PROJECT 1           PROJECT 2
         A→B→C→D→E           A(=P1 final)→B→C→…
         independently       independently
         playable            playable
```

Director / Shoot: “I want to make and manipulate a journey.”
Agent: “I want to describe a journey and watch the agents make
it — then tell them where to go next.”

Do **not** build a dedicated second Vite surface or `/agent.html`.
The Agent tab is the hackathon surface.

### Chat is the workspace

The default first journey needs only the initial prompt. After
that, the same composer is how the user continues the
conversation — including Continue Journey.

Advanced chat (“Why did you choose C?”, “Reshoot B→C”) must
**not** jeopardize the hero demo:

``` text
PROMPT → SEND → HANDS OFF → WATCH AGENTS WORK → PLAY FILM
         → “keep going…” → NEW PROJECT FROM FINAL CANONICAL
```

### Implementation priority (one hackathon day)

1.  Validate fully unattended end-to-end orchestration (P0).
2.  CM chooses OG vs Pull Forward per traversal (P0).
3.  Failure-driven technique switching (P0).
4.  Continue Journey via `Director.intent()` (P1).
5.  Discover ≥720p late-frame harvesting if P0 is healthy (P1).
6.  Runway Model Router **only if** it shows useful intelligence
    (P1).
7.  Color continuity only after the above (P2).

Do **not** spend the day on Agent chrome, Session browsing, or
chained-video export.

---

## Repository map (as of 14 September 2026)

Do not assume a clean `apps/` + `shared/` monorepo. The actual tree
is:

``` text
web/          Vite + React Plan | Shoot product
media/        TypeScript providers, Director, Cinematographer
camotion/     Python deterministic Camotion renderer (no Node)
docs/         Product / architecture / this plan
genesis/      Research site (not the hackathon app)
```

### Filmmaking engine (reuse; do not duplicate)

| Concern | Actual location |
| --- | --- |
| Domain types | `web/src/project/types.ts` — `Project`, `StoryboardFrame`, `JourneyShot`, `SegmentMotionPlan`, `CinematographerAssessment`, `Agency` |
| Project operations | `web/src/project/ProjectProvider.tsx` — `planWithDirector`, construct, assess, shoot, `exportMovie` |
| JourneyAgent | `web/src/project/journey-agent.ts` — first happy-path orchestrator the workstation validates and the hack app reuses. Not a hackathon-only file under `web/src/agent/`. |
| Director | `media/src/director/plan-storyboard.ts`, `media/src/director/derive-story.ts`, `media/src/director/prompts.ts` |
| Director web glue | `web/src/project/director.ts`, `web/director-dev-plugin.ts` |
| Opening A | `web/src/project/starting-frame.ts`, `generateOpeningOn` in `ProjectProvider` |
| Construct B…N | `web/src/project/destination.ts` (`destinationConstructionRequestFromProject`), `web/destination-construct.ts`, `web/destination-dev-plugin.ts` |
| Cinematographer | `media/src/cinematographer/assess-journey.ts`, `assessment-prompts.ts` |
| CM web glue | `web/src/project/cinematographer.ts`, `web/cinematographer-dev-plugin.ts` |
| CameraMotionPlan bridge | `media/src/cinematographer/camera-motion-plan.ts` |
| Shooting prompt | `media/src/cinematographer/shooting-prompt.ts` (`composeShootingPrompt`) |
| Camotion | `camotion/` CLI; `web/camotion-cli.ts`; depth sidecar `web/camotion-depth.ts` |
| Shoot | `web/src/project/shoot.ts`, `web/shoot-journey.ts`, `web/shoot-dev-plugin.ts` |
| Assembly / export | `web/src/project/export-movie.ts`, `web/export-movie.ts`, `web/export-movie-plugin.ts` |
| Conversation model | `web/src/project/conversation.ts` |
| Trusted media | `web/runtime-media.ts`, `web/runtime-media-plugin.ts` |
| Image / video contracts | `media/src/types.ts` — `MediaProvider`, `ImageEditProvider` |
| Reasoning contract | `media/src/reasoning/types.ts` — `ReasoningProvider` |
| Current adapters | Replicate is the **product shoot path** (`media/src/replicate/*`). Runway Dev plumbing exists at `media/src/runway/` (HTTP client, task poll, ephemeral upload, download, Enhance Frame Rate only). Event-day work **extends** that package into Model Router `generate.image` / `generate.video` behind the same `MediaProvider` / `ImageEditProvider` contracts, with named-model fallback. Do not recreate auth, polling, or uploads. |
| Image catalog | `media/src/replicate/image-models.ts` — Nano Banana 2 Lite default; Nano Banana 2 opt-in |
| Video catalog | `media/src/replicate/video-models.ts` — Pruna default; Kling / Veo / Seedance opt-in |

### Existing UI to copy or wrap (do not extract a design system)

| Surface | Actual location |
| --- | --- |
| Conversation turn history | `web/src/app/ConversationRail.tsx` |
| Journey prompt composer | Agent: `web/src/app/agent/AgentWorkspace.tsx`. Directed still uses `ProjectRail` `composerDraft`. |
| CREATE JOURNEY / PLAN JOURNEY | Directed: `ProjectRail` → `planWithDirector()`. Agent: Send on the composer. |
| Storyboard tiles | `StoryboardFrameMedia` in `web/src/app/PlanView.tsx` |
| Video monitor | `web/src/app/Preview.tsx` |
| Progress | `web/src/ui/ProgressSpinner.tsx` |
| Visual tokens | existing Tailwind: `#0c0b0a`, `#12100d`, `#ece7df`, `#9a8f7e`, `#d4b36a` |
| Product entry | `web/src/main.tsx` → `web/src/App.tsx` → `Shell` |

### What exists vs what this plan still needs

| Capability | Status |
| --- | --- |
| Director CREATE JOURNEY | **Exists.** `planWithDirector` in `ProjectProvider`. |
| Sequential construct B…N | **Exists** as Directed Option `autoGenerateAllDestinations` (default **off**). |
| Generate opening A from story | **Exists.** CREATE JOURNEY always generates unresolved A unless A is already actual. |
| Automatic Motion Planning | **Exists.** Adjacent actuals trigger CM + Camotion A′/B′. |
| Explicit FOOTAGE shoot | **Exists.** `shootJourney` / `web/shoot-journey.ts`. |
| Directed auto-shoot | **Exists** as Option `autoShoot` (default **off**). Shoots including CM hold / no-go. |
| Export Movie concat | **Exists.** Deterministic ffmpeg concat of rendered takes. |
| Header Director \| Agent \| Shoot | **Exists (pre-hack).** Header is the agency chooser. Agent Send runs JourneyAgent (`web/src/project/journey-agent.ts`) on a Session-referenced Project. |
| `JourneyAgent` orchestrator | **Exists (happy path + experimental sequential canonical repair).** Shared module: establish A, DIRECT, then GENERATE → CM → REPAIR END → ESTABLISH → launch NEW TAKE → ADVANCE per destination. Footage may overlap later canonical work. Export Movie after all Takes. Hackathon day **reuses** it; do not reimplement the filmmaking Agent in the 5–6 hour window. |
| LOOP (close on exact canonical A) | **Does not exist.** BACKLOG. Explicit Agent/project option; not inferred from the Journey Prompt. Reuse opening A’s media as the final destination so N→A is a normal CM / Camotion / Take. Not event-day. See [BACKLOG.md — Agent LOOP option](BACKLOG.md#agent-loop-option). |
| Parallel segment filming | **Partial.** JourneyAgent launches NEW TAKE as soon as a segment is established and awaits all Takes before concat in storyboard order. Provider-aware concurrent filming (Runway THROTTLED/PENDING is wait, not fail; other adapters may bound locally) remains BACKLOG. JourneyAgent must not assume a universal 2/3 cap. Not event-day. See [BACKLOG.md — Parallel segment filming](BACKLOG.md#parallel-segment-filming). |
| Conversational Agent workspace | **Exists (pre-hack).** `web/src/app/agent/` — conversation is the workspace; a journey is a rich chat turn. ConversationRail remains Directed history. |
| Lightweight Session persistence | **Exists (pre-hack).** `~/.tunnelvision/sessions/<id>.json`. Session references Projects. Refresh creates a new Session. No session browser / rehydration. `continuedFrom` is on the schema and **not written yet**. |
| Continue Journey | **Does not exist.** P1. Same Send → `Director.intent()` NEW \| CONTINUE. Do not append to the previous Project. |
| CM OG vs Pull Forward per traversal | **Does not exist.** P0. Project `pullForwardReferenceEnabled` is a filmmaker toggle, not an agent decision. |
| Agent stopping / completion judgment | **OUT / DEFERRED.** JourneyAgent completes when the Director-planned destination count / required canonicals and traversals are processed and assembled. Do not add an LLM stop decision on hack day. |
| CM `SHOOT` / `RESHOOT_END` | **Exists (experimental).** CM assessment JSON returns a repair recommendation plus `repairInstruction` for the new END. JourneyAgent repairs when Traversal Confidence < 30, reshoots only that END (max 2), then continues. Low Set Consistency alone does not trigger repair; it remains a diagnostic. Established START is not rewritten. Dial-back of thresholds is still open. Not event-day work. |
| Opposite-canonical visual reference on repair | **Exists (experimental).** Agent END repair uses the established START still as the image/spatial source (and extra Nano Banana `image_input` when that still is not already the source). Flux ignores extra refs. Not event-day. |
| Footage evaluation / Agent take selection | **Retired exploration.** Experimental Shot Evaluator remains isolated research under `media/experiments/forest-a-to-f/`. Do not promote it. The filmmaker reviews footage and selects Takes. JourneyAgent does not automatically judge artistic clip quality. |
| Movie-evaluation preprocessor | **Does not exist** as product. Not planned. |
| Runway adapters | **Partial (20 September 2026).** `media/src/runway/` exists and Enhance Frame Rate @ 120fps is live-proven (`RUNWAY_DEV_TOKEN`). It is **not** a product `MediaProvider`. JourneyAgent still writes `"replicate"`. Event-day work: Model Router image + video on the existing client, visible `routing.model`, named-model fallback. 120fps Temporal Seam velocity smoothing was tested and **abandoned** — do not productize or spend event-day time on it. |
| Camera grammar (POV / FOLLOW / LEAD / MOUNTED) | **Exists (hackathon scope).** One grammar per journey, grammar-specific baselines, persisted as Project `cameraGrammar`. Canyon control experiment 18 September 2026. Mixed-grammar journeys are post-hackathon. See Camera grammar decision above. |
| DISCOVER | **Does not exist.** `Project.construction` includes `"discovery"` but it is unwired. **P1** if P0 is healthy: ≥720p A→? generation, latest-usable late-frame harvest, lossless PNG extract, then promote to pristine B. Do not expose a UI mode. Full spec: §17. |
| Destination-aware Camotion field | **Backlog.** Product already applies adaptive weights: pace × depth × dest protect × VP protect on the frozen radial field. Do not retune. |
| Durable project persistence | **Exists.** Directory format under the app Projects Folder. Same `Project` for Director, Shoot, and Agent. Opening a Project does **not** reconstruct Agent Session history. |

Directed Options (generate all, auto-shoot) are
**not** AGENT. They automate filmmaker clicks inside Directed.
[BACKLOG.md](BACKLOG.md) is explicit: AGENT owns the loop, including
when to repair, when to continue, and when to export.

Reuse those *operations* inside pre-hackathon JourneyAgent. Do not
ship the hackathon demo as “flip three checkboxes and press CREATE
JOURNEY,” and do not reimplement the loop on event day.

---

## 1. Hackathon-day product

The hackathon surface is the **existing Agent tab**. Do not add a
second Vite entry, `/agent.html`, or a parallel app.

Director and Shoot stay specialist / manual. The hero demo never
leaves Agent.

No extra composer modes. No New Journey / Continue Journey
buttons. No Inspector, Destinations, Options, provider chooser,
manual MOTION / FOOTAGE, or Debug chrome required for the demo.

Router configs live in the Runway Developer Portal (and env vars).

The experience should feel like watching an autonomous film crew
work, then watching the film, then telling the crew where to go
next.

JourneyAgent is **not** invented on event day. It already lives in
`web/src/project/journey-agent.ts`. Hack-day work extends
**intelligence** (technique choice, intent, Discover harvest) —
not a second orchestrator and not autonomous stopping.

---

## 2. Initial experience

Start in the existing Agent tab with the existing composer:

``` text
[ Where should we go next?                           ]
                                                     >
```

The hero path is paste or type a Journey Prompt and press Send.
That writes `Project.story` and starts the agentic loop.

Do **not** require conversational planning before Send. Optional
refinement turns that ask story questions are **not** Director
planning and **not** a Screenwriter role ([AGENTS.md](AGENTS.md) —
do not create `ScreenwriterAgent`). Drop refinement first if the
clock is slipping.

---

## 3. Filmmaker prompt boundary

Preserve the product principle:

``` text
FILMMAKER PROMPTING = STORY.
```

The filmmaker describes premise, world, journey, story beats,
progression, desired ending, and aesthetic / story intent when useful.

The filmmaker must **not** need to specify camera mechanics, traversal
syntax, locomotion prompting, optical flow, spatial route instructions,
negative video prompting, or model-specific instructions.

Those belong to Director / Cinematographer / Camotion / provider
layers. Existing prompts already enforce this:

-   Director: `media/src/director/prompts.ts`
-   Opening A: story + opening-instant prompt in
    `web/src/project/starting-frame.ts` / destination opening path
-   Construct: `web/src/project/destination.ts`
-   CM: `media/src/cinematographer/assessment-prompts.ts`
-   Video: `composeShootingPrompt` in
    `media/src/cinematographer/shooting-prompt.ts`
    (`segmentPromptAddition` first, then the frozen locomotion
    baseline)

The hack app should demonstrate this separation. Do not add a
“camera prompt” box.

---

## 4. Send starts the agentic loop

The only primary action is **Send** on the existing composer.

``` text
Before Send:  CONVERSATION / INTENT
After Send:   AGENT EXECUTION
```

The user should not make additional filmmaking decisions during
normal execution. There is no New Journey button and no Continue
Journey button.

**Wire this to the existing `JourneyAgent`, not to Directed Options
and not to a new event-day orchestrator.**

Today, Agent Send already:

1.  appends a UserTurn to the Session
2.  creates a new Project when the current one already has a
    journey (settings roll forward; conversation does not)
3.  generates unresolved A unless A is already actual
4.  runs Director (`requestDirectorPlan` /
    `directorPlanRequestFromProject`) **after** A exists
5.  runs JourneyAgent (construct, CM, repair, NEW TAKE, export)

P1 changes that sequence: `Director.intent()` must run **before**
canonical A is resolved, because NEW vs CONTINUE changes what A
is. See Continue Journey.

Directed CREATE JOURNEY / PLAN JOURNEY remains the specialist
Director invocation. Do not show Destinations / Options / Image /
Video / Debug in the Agent hero path.

---

## 4a. Continue Journey (P1)

Continue Journey is **not** another composer button or visible
mode. The same Send starts the Agent. The Agent decides whether
the prompt is a **new** journey or a **continuation**.

Continue Journey does **not** append to the previous Project.

``` text
Project 1
A → B → C → D → E

User: "Now descend into the city and find the abandoned subway."

Project 2
A (= Project 1 final accepted canonical) → B → C → D …
```

Project 1 stays completed and independent. Project 2 is
independently playable / editable / exportable.

### Why intent is before A

TunnelVision generates / resolves canonical A **before** Director
planning so the plan is grounded in the actual starting world, not
only prose. NEW vs CONTINUE must therefore be decided **before**
normal Director planning.

``` text
SEND
  ↓
Director.intent()
  ↓
NEW | CONTINUE
  ↓
resolve canonical A
  ↓
Director.plan(A)
  ↓
normal agent loop
```

**NEW JOURNEY**

``` text
create new Project
  → generate new canonical A
  → Director plans from actual A
  → normal journey agent loop
```

**CONTINUE JOURNEY**

``` text
locate previous completed JourneyTurn
  → load its referenced Project
  → locate its final accepted canonical
  → create a NEW Project
  → inherit / copy / reference that canonical as the new Project's A
  → record continuedFrom on the Session JourneyTurn
  → Director plans from inherited A
  → normal journey agent loop
```

Do **not** assume the previous final stop is letter `E`. Journey
lengths vary. Use the actual identifier of the final accepted
canonical.

### Session provenance

The JourneyTurn for a continuation should support metadata like:

``` json
{
  "type": "journey",
  "projectId": "project-002",
  "status": "completed",
  "continuedFrom": {
    "projectId": "project-001",
    "canonicalId": "<actual final canonical id>"
  }
}
```

`continuedFrom` is already on the Session schema and is **not
written yet**. Do not duplicate project state into the Session.

### `Director.intent()`

Lightweight structured call. Context:

-   current user prompt
-   whether the active Session has a previous completed JourneyTurn
-   lightweight information about that journey
-   final canonical identity / description if appropriate

Return conceptually:

``` json
{
  "journeyIntent": "new" | "continue",
  "intentReason": "..."
}
```

`intentReason` is for logging / debugging and optionally a concise
UI status. Do not expose hidden chain-of-thought.

### Intent bias / safety

Bias toward **NEW** when continuation is ambiguous.

Strong CONTINUE signals: “continue”, “keep going”, “from here”,
“where does this lead?”, “go through the doorway”, “descend into
the city”, “now enter the tunnel”, “begin exactly where the last
journey ended”.

Strong NEW signal: “Take me through a Formula 1 race from the
driver's POV.”

Do not silently force unrelated prompts into spatial continuity
merely because a previous journey exists. No ambiguity-confirmation
UX is required for the hack.

### Continuation UI

Keep it subtle. Example:

``` text
DIRECTOR
Continuing from the mountaintop sanctuary.
```

Then render the inherited canonical as A and proceed normally.
The user should not need to understand Project boundaries.

### Chained video is not hack scope

Each Project still creates its own final video. Do **not**
automatically compose continued Projects into one giant MP4.

Because chained Projects share canonical continuity, they can be
composited later. Possible future: Export Session → Combined
Journey. Users can also combine MP4s externally. Do not spend
hack time on this.

---

## 4b. Cinematographer OG vs Pull Forward (P0)

This is one of the **central** hack experiments.

The Cinematographer should choose shooting technique **before**
generation, independently for each traversal.

Working hypothesis:

**OG (ordinary generation)** may be preferred when:

-   the scene has strong natural motion / depth cues
-   subject following matters
-   model freedom is beneficial
-   ordinary generation already creates convincing travel

**Pull Forward** may be preferred when:

-   strong forward spatial commitment is needed
-   entering a doorway / tunnel / window / alley / passage
-   approaching or crossing a defined destination
-   the shot is prone to hovering
-   stronger geometric progression toward B is needed

CM must **also** be able to change technique **after** failure.

``` text
OG
  ↓
Travel 62
  ↓
CM diagnoses insufficient forward progression
  ↓
switch OG → Pull Forward
  ↓
reshoot
  ↓
reevaluate
  ↓
accept and continue
```

Technique selection therefore happens both:

``` text
before shooting
after evaluation / diagnosis
```

This is agent behavior, not merely a generation toggle. Today's
project-level `pullForwardReferenceEnabled` is **not** this
feature.

---

## 5. Agent layer

`JourneyAgent` is **pre-hackathon product work**. It already
lives in the existing Agent tab. Event day extends it; do not
reimplement it under a second `web/src/agent/` tree.

It owns:

-   execution state
-   progress / activity events
-   provider-failure retry
-   Traversal-Confidence canonical repair
-   overlapping NEW TAKE and assembly of selected Takes

Conversational Agent workspace is **pre-hack**. It feeds
`Project.story` / Send; it is not a second filmmaking Agent.

It **must** call existing TunnelVision operations. Do not duplicate
Director, CM, Camotion, generation, or assembly inside the Agent.

Call these — do not reimplement them:

| Stage | Call |
| --- | --- |
| Generate A | existing opening-frame generation (`generateOpeningOn` / `openingFrameGenerationRequestFromProject`) |
| Direct | `requestDirectorPlan` / `plan` in `media/src/director/plan-storyboard.ts` |
| Construct N | `destinationConstructionRequestFromProject` + `requestConstructDestination` |
| Motion plan | existing automatic assess + Camotion (`assessJourney` / `assessJourneyOn`) |
| Shoot | `shootJourneyOn` / `web/shoot-journey.ts` |
| Assemble | `requestExportMovie` / `web/src/project/export-movie.ts` |

Conceptual pipeline:

``` text
JOURNEY
  → DIRECTOR
  → GENERATE NEXT CANONICAL
  → CM EVALUATE INBOUND PAIR
  → REPAIR END IF TRAVERSAL CONFIDENCE < 30
  → ESTABLISH / CAMOTION
  → LAUNCH NEW TAKE (may overlap later canonicals)
  → (repeat until the Director-planned destination count is done)
  → AWAIT TAKES / ASSEMBLE SELECTED TAKES
  → COMPLETE
```

The Agent is **not** a fourth filmmaking role. Director still decides
WHERE. CM still decides HOW to shoot the actual pair. Camotion is
still deterministic. Video still films. The filmmaker still chooses
Takes.

---

## 6. Agent state model

Keep state explicit and inspectable in session UI (not project
persistence). Approximate machine:

``` text
CONVERSING
  → JOURNEY_READY
  → DIRECTING
  → CONSTRUCTING
  → PLANNING_MOTION          (existing automatic CM + Camotion)
  → REPAIRING_CANONICALS? ──┐
  → SHOOTING                │
  → NEXT_SEGMENT ───────────┘
  → ASSEMBLING
  → COMPLETE
```

Add `FAILED` / `RECOVERY` when a provider or construct call throws.
Use the existing conversation `failed` statuses
(`director` / `construction` / `blocking` / `shooting`) rather than a
second log.

Motion Planning already runs whenever an actual adjacent pair exists
(`motionPlanAutoKey` + `assessJourney` in `ProjectProvider`). AGENT
should wait for that segment’s `motionPlan` (or `motionPlanError`)
before shooting. Do not invent a second CM path.

`Project.agency` stays `"directed" | "autonomous"`. Existing AGENT
mode is where this machine is developed and validated. The hackathon
app may force `"autonomous"` for the session. That flag does not
itself advance this machine.

---

## 7. Visible agent activity

The filmmaker should **watch the movie being made**.

Do not hide execution behind one spinner.

Project existing conversation kinds into concise filmmaking language.
Extend `ConversationEntry` only if a new kind is truly required
(prefer `director`, `construction`, `blocking`, `shooting`, plus a
small `agent` activity kind for “Your journey is ready”).

Examples (translate; do not dump JSON / Director evidence):

``` text
DIRECTOR
Planning five destinations...

A  [thumbnail]
B  [generating...]
C  [...]
D  [...]
E  [...]

B generated.

CINEMATOGRAPHER
Analyzing A→B...
Traversal Confidence 82 · Moderate pace

A→B filming...
A→B complete ✓
```

If repair occurs:

``` text
CINEMATOGRAPHER
C is not spatially convincing from B.
Reshooting C using B as a spatial reference...
[thumbnail C updates]
```

Then continue automatically.

Hide `DirectorEvidenceDetails`, raw take provider IDs, and Camotion
A′/B′ stills in the primary hackathon UI. Debug remains a workstation
concern.

The feeling: “I am watching an AI film crew make my movie.”

Reuse `ProgressSpinner` and the existing generating shimmer classes
(`storyboard-generating`) for tiles.

---

## 8. Inline storyboard

Reuse `StoryboardFrameMedia` / FPO generating tiles from
`web/src/app/PlanView.tsx` if that is safe. If extraction threatens
Plan, **copy** a compact tile into `web/src/agent/` rather than
refactoring Plan.

Progressively populate A → B → C → … as construct completes.

Canonical model (do not blur):

-   A / B / C are pristine canonical destinations
-   A→B is footage / traversal (`JourneyShot`)
-   A′ / B′ are Camotion shooting frames on `SegmentMotionPlan`

Do **not** expose A′/B′ in the hackathon UI.

Useful visible tile states (map onto existing fields; do not invent
a new product schema):

| Visible | Existing signal |
| --- | --- |
| EMPTY | FPO, `imageOrigin: "none"` |
| GENERATING | `constructingBeatId` / `status: "generating"` |
| READY | actual still |
| REPAIRING | Agent repair in progress on that letter |
| SHOT | adjacent `JourneyShot.status === "rendered"` |

Keep the strip compact enough to live in the conversation.

---

## 9. Repair / reshoot loop

Desired conceptual outcomes (from [BACKLOG.md — Agent CM repair](BACKLOG.md#agent-cm-repair--reshoot-loop)):

| Recommendation | Meaning |
| --- | --- |
| `SHOOT` | Pair is acceptable; proceed. |
| `RESHOOT_END` | Regenerate only the new END. Use the established START as spatial reference. |

JourneyAgent sequential construction never rewrites an established START. `RESHOOT_START` / `RESHOOT_BOTH` may still parse from CM JSON, but Agent repair always targets the new END.

Current JourneyAgent policy:

-   Generate the next END from the accepted previous canonical.
-   CM-evaluate that inbound pair in the same assessment turn.
-   If Traversal Confidence is below 30, reshoot only that END (max 2) using
    the established START as spatial reference. Low Set Consistency
    alone does not trigger repair.
-   Preserve Director intent for that letter.
-   **Never silently overwrite a filmmaker-supplied actual**
    (`imageOrigin: "user"`). Fail through existing Agent activity.
-   After a generated canonical changes, existing Motion Plan
    invalidation already recomputes affected legs.
-   Opening A is established START and is not autonomously rewritten.

Distinguish canonical repair (missing geography in the stills) from
prompt repair (route is visible; `segmentPromptAddition` needs to
name it). Do not solve missing geography with a longer video prompt.

Retry budget: **1–2** repairs of the new END, then accept it and
continue if technically shootable. Do not loop forever.

---

## 10. Confidence is evidence, not truth

Low CM `traversalConfidence` does **not** mean the video model will
fail. Models sometimes produce convincing turns or reconcile awkward
geometry.

Do **not** blindly reshoot every low-confidence pair.

Conceptual policy (use these bands; do not invent new thresholds
unless the existing scores are unusable):

| Evidence | Agent |
| --- | --- |
| `shootability === "shootable"` or confidence ≥ ~70 | Shoot |
| `needs_review` or mid confidence | Shoot first |
| `not_shootable` or very low confidence | Repair canonicals **only if** the repair operation exists; otherwise shoot |

CM confidence is **pre-shoot evidence**, not proof of footage success
or failure. The filmmaker reviews generated Takes. JourneyAgent does
not automatically accept/retry footage based on artistic quality.

Shootability is already documented as advisory and does **not** gate
`JourneyShot.status` ([PRODUCT.md](PRODUCT.md), [AGENTS.md](AGENTS.md)).
Keep that.

---

## 11. Footage quality is the filmmaker's job

**There is no product Footage Evaluator and none is planned as an
Agent stage.**

CM answers whether the canonical pair can plausibly be **filmed** as
one continuous shot. The filmmaker answers whether a generated Take
is artistically good, and which Take is the cut.

Each segment may have multiple immutable Takes. A NEW TAKE may use a
different video provider/model. Because Takes share the same
canonical START/END, mixed-model cuts are valid:

``` text
A→B · Pruna · Take 1
B→C · Wan · Take 2
C→D · Pruna · Take 1
```

There is no separate Final project state. Export Movie concatenates
the currently selected Take per segment.

The experimental Shot Evaluator under
`media/experiments/forest-a-to-f/` is a retired research probe. Do
not port it. Do not build a clip judge on event day. Retry
`shootJourney` once on provider failure only.

---

## 12. Camotion

Reuse Camotion exactly as the workstation already does on SHOOT.

Current product path (`web/shoot-journey.ts` + `web/camotion-cli.ts`):

-   CM `pace` → `exposure.strength`
    (`camotionExposureStrengthFromPace`)
-   `forward` stays `1.0`; samples stay `16`
-   Adaptive weights:
    `motion ≈ pace × depth × destination protection × VP protection`
-   Depth is a reusable near-weight map per unchanged canonical
    (0 far, 1 near). Missing depth falls back; it does not block.
-   Semantic VP / D already come from CM `travel` via
    `cameraMotionPlansFromAssessment`

Camotion is **deterministic conditioning**. It is not an agent.

Do **not**:

-   redesign the operator
-   implement destination-aware / non-radial VP→D fields
    ([BACKLOG](BACKLOG.md#destination-aware-camotion--non-radial-motion-fields))
-   expose A′/B′ or work dirs in the hack app
-   change Phase 1 frozen constants

Camotion knows nothing about Runway. Keep it that way.

---

## 13. Canonical generation

Reuse the current construct architecture:

-   A: text-to-image (`ImageGenerationRequest` / opening path)
-   B…N: image-conditioned edit (`ImageEditProvider`, preceding
    actual as `sourceImage`, semantic look-ahead for the following
    beat)

Current **workstation** strong still path is Nano Banana 2 / 2K
(`gemini_image3.1_flash` on Runway Dev). That is product evidence,
not a reason to hard-code that model ID into JourneyAgent.

``` text
THE HACKATHON APPLICATION SHOULD USE RUNWAY GENERATION APIS.
PRIMARY PATH: MODEL ROUTER.
FALLBACK: NAMED DIRECT-MODEL CALLS.
```

Do not hard-code Nano Banana, Seedance, or Gen-4.5 into
`JourneyAgent` or hackathon UI.

Preserve provider abstraction. Agent code talks to
`destinationConstructionRequestFromProject` and opening generation,
not to a vendor SDK and not to a `configId`.

TV-specific construct requirement (product, not a Router API
feature): the next canonical must honor the reference still **and**
show genuine forward viewpoint displacement. Same-environment
progression is the hard case — the model must not keep the source
composition and only change lighting, activity, or style. See
[Product Slice 10](../genesis/research/21-product-slice-10.html).
Router chooses among eligible models; JourneyAgent / CM still
evaluate whether the still actually advanced.

---

## 14. Runway integration

### 14.0 Pre-hack Runway reconnaissance (14 September 2026)

Public docs + API spec reviewed again before the event. **Runway Dev
MCP config is present but OAuth is not complete**, so this session
still has no `runway` tools in the catalog. Gitignored project
`.cursor/mcp.json` matches
[Connect Dev MCP](https://docs.dev.runwayml.com/guides/mcp/)
(URL `https://dev.runwayml.com/mcp` + public OAuth `CLIENT_ID`; no
API key). Cursor registered it as streamable HTTP
(`project-0-tunnelvision-Runway Dev`) and stopped at Connect /
browser login. Unauthenticated `initialize` returns 401;
`WWW-Authenticate` scopes are `openid profile email mcp:read
mcp:write`; IdP is `https://identity.runwayml.com/`. There is **no**
Cursor marketplace plugin named Runway Dev. After a Developer Portal
account exists: Settings → MCP → Connect, finish OAuth in a normal
browser, then `whoami`. Then re-read
[`ai-context.md`](https://docs.dev.runwayml.com/ai-context.md)
and [`api.md`](https://docs.dev.runwayml.com/api.md) — do not invent
fields from memory.

This pass (14 September 2026) did **not** build `media/src/runway/`
or the hackathon app. It froze verified capabilities vs event-day
assumptions. A later dedicated PR **did** land the client; see §14.0a.

**Agent guidance (verified).**
[dev.runwayml.com/agents](https://dev.runwayml.com/agents) tells
coding agents: use a **recipe** when one covers the job; a **model
router** when the right model is unclear or the job varies; a
**single model** only when control is required at every step. For
TV: Router for construct/shoot; **direct model** when START+END
(or another specialized capability) must not be left to a wide
pool. Recipes (Multi-Shot, product ads) do **not** cover continuous
A′→B′ travel.

**Two MCPs (do not confuse).**

| Server | URL | Role for TV |
| --- | --- | --- |
| **Runway Dev MCP** | `https://dev.runwayml.com/mcp` | Inspect docs, tasks, router configs from Cursor. **OAuth. No API key in `mcp.json`.** |
| Generation MCP | `mcp.runwayml.com` | Chat-side media toys. **Not** the product shoot path |

Cursor setup: gitignored `.cursor/mcp.json` (preferred for this
repo) or `~/.cursor/mcp.json`. After Connect, ask the agent to call
`whoami`. Then: re-read specs, list/create routers, `dryRun` HTTP,
`GET /v1/tasks/:id` / MCP `get_task` on failures (`failure` +
`failureCode`). **Not verified live here** — no Dev account on this
Mac, so routers/tasks were not listed or created through MCP.

**Task lifecycle (verified).** Create → `{ id }` → poll
`GET /v1/tasks/{id}` until `PENDING` | `THROTTLED` | `RUNNING` |
`SUCCEEDED` | `FAILED` | `CANCELLED`. Only `SUCCEEDED` has
`output[]`. SDK: chain `.waitForTaskOutput()` on the **unawaited**
`create()`. `THROTTLED` is queued, not an error. Moderated tasks
are `FAILED` with `SAFETY.*` (credits not refunded for
`SAFETY.INPUT.*`). Output URLs expire 24–48h. Direct-model bodies
are **per-model discriminated unions** — never copy `ratio` /
`duration` across models. Router uses model-agnostic `aspectRatio`.
Video jobs share an **organization concurrency pool**; excess
submits enter THROTTLED rather than requiring TunnelVision to
serialize Takes. That is backlog for provider-aware JourneyAgent
queueing, not Agent serial waiting:
[BACKLOG.md — Parallel segment filming](BACKLOG.md#parallel-segment-filming).

**Image / canonical candidates (API + Models page).** Google Nano
Banana names on Runway: `gemini_2.5_flash` = Nano Banana,
`gemini_image3_pro` = Nano Banana Pro, `gemini_image3.1_flash` =
Nano Banana 2. All take `referenceImages`. NB2 / NB Pro accept up
to **14** refs and include **`2752:1536`** (TV’s 16:9 workstation
size) among direct `ratio` values. Router image `resolution` is
`1k` | `2k` | `4k` (eligibility filter), not pixel pairs.

| Direct model | TV fit (docs, not a bakeoff) |
| --- | --- |
| `gemini_image3.1_flash` (NB2) | Primary construct/opening candidate: refs + high-res including 2752:1536. **Assumption:** viewpoint displacement still needs TV evaluation |
| `gemini_image3_pro` (NB Pro) | Quality escalation / 4K-class direct ratios |
| `gemini_2.5_flash` (NB) | Cheaper/faster; only 3 refs; smaller ratio set |
| `gen4_image` / `gen4_image_turbo` | Runway-native refs (max 3); turbo requires image+text |
| `grok_imagine_image_2` | Documented `edit: true` with exactly one reference = edit the still rather than a loose style ref. **Direct-model** if we need that flag (Router image input has no `edit` field) |
| Seedream / GPT Image | Extra Router pool members; not TV’s first choice |

There is **no** documented “pull the camera forward” image API.
Construct remains `ImageEditProvider` mapped onto
`referenceImages` + the existing spatial-progression prompt.
Router cannot score same-environment failures.

**Video / START+END (verified on `POST /v1/image_to_video`).**
Router video `referenceImages[].role` = `first` | `last` |
`reference` (at most one first and one last). Sending `last`
filters to models that support an end frame.

| Direct model | Start+end? | Notes |
| --- | --- | --- |
| `seedance2_5` | **first+last** keyframe mode | 4–30s; 480p/720p/**1080p**. Cannot mix keyframe positions with unpositioned refs |
| `seedance2` / `_fast` / `_mini` | **first+last** | Fast/Mini: 480p–720p only; 2.0 has 4K ratios |
| `veo3.1` / `veo3.1_fast` | **first + optional last** | Not last-only. Duration **4 / 6 / 8** only. 1080p ratios |
| `hailuo3` | **first+last** keyframe or refs (not mixed) | MiniMax H3 |
| `h3_max` | **first + optional last** | 480p / 768p; last requires first |
| `wan3` / `wan3_prime` | **first+last** keyframe or refs (not mixed) | Keyframe I2V must use `auto_480p` / `auto_720p` / `auto_1080p` |
| `gemini_omni_flash_1.1` | **first + optional last** | In **API spec**; not listed on the Models HTML table — confirm org access |
| `gen4.5` / `gen4_turbo` | **first only** | Do not use as TV traversal when B′ exists |
| `gemini_omni_flash` | **first only** | Distinct from `_1.1` |
| `grok_imagine_1_5` / `happyhorse_1_0` | **first only** | |
| `act_two` | Character performance | Not traversal |
| `aleph2` | Video-to-video | Not A′/B′ I2V |

**Router vs direct for S/E.** Passing `first`+`last` on
`/v1/generate/video` is the right default: ineligible first-only
models drop out. That does **not** guarantee physical travel or
endpoint lock. If a latency router still picks a weak S/E model,
**allow-list** `tv-final` (and optionally a `tv-se` config) to
Seedance / Veo / Wan / Hailuo / H3 Max, or call a named model
(`seedance2_5` or `veo3.1`) directly. Do not invent a Router
“endpoint adherence” knob.

**Repair + Router (architecture).** TV Agent/CM decide whether a
canonical pair is unshootable and whether to RESHOOT_END. The
filmmaker decides whether a Take is the cut. Adapter maps generation
onto a latency or quality `configId`. Router picks the eligible
model. If S/E is mandatory and the routed choice is wrong, skip
Router for that retry.

**Provider readiness (14 September 2026 pass, still true).**
`GeneratedVideo.provider` / `GeneratedImage.provider` /
`ReasoningResult.provider` are `string` so a Runway adapter
can emit `"runway"` without a domain rewrite. Replicate adapters
still write `"replicate"`. Keep Director/CM/Camotion free of
`configId`. Map Runway task `id` onto today’s `predictionId`.
Persist `routing.model`, `optimizeFor`, and credits in `metadata`
only.

Do **not** add `@runwayml/sdk` as the generation path unless event-day
docs show it covers Model Router `generate.image` / `generate.video`.
The existing TV Runway client is HTTP; that is the proven pattern
(the published SDK VideoUpscale types did not include
`enhance_frame_rate`).

**Docs caveats / corrections vs earlier plan language.**

-   The Models HTML table is not the complete API: `wan3_prime` and
    `gemini_omni_flash_1.1` appear in [`api.md`](https://docs.dev.runwayml.com/api.md).
-   [`ai-context.md`](https://docs.dev.runwayml.com/ai-context.md)
    currently mentions `POST /v1/generate/video` under Router
    generate; **image and audio generate endpoints also exist**.
-   Router video `promptText` max in the spec is **6000**
    characters (earlier notes said 20000 in one dump — always
    re-read `api.md` before coding).
-   Recipe “reference media” guidance is for product/brand recipes,
    not Camotion A′/B′. High-res, uncluttered refs still apply.
-   No Runway LLM / reasoning endpoint in the catalog. Keep Gemini
    3.1 Pro on Replicate for Director and CM.

### 14.0a Current code (20 September 2026)

A dedicated integration PR landed before the event. Inspect
`media/src/runway/` before writing anything new. Do not recreate
auth, task polling, local upload, or download.

**Exists (keep; extend):**

| Piece | Role |
| --- | --- |
| [`media/src/runway/client.ts`](../media/src/runway/client.ts) | HTTP to `https://api.dev.runwayml.com`; Bearer `RUNWAY_DEV_TOKEN`; `X-Runway-Version: 2024-11-06`; ephemeral `POST /v1/uploads`; `POST /v1/video_upscale`; `GET /v1/tasks/{id}` |
| [`media/src/runway/tasks.ts`](../media/src/runway/tasks.ts) | Poll no faster than 5s; PENDING / THROTTLED / RUNNING wait; SUCCEEDED / FAILED / CANCELLED |
| [`media/src/runway/download.ts`](../media/src/runway/download.ts) | Fetch expiring output URLs |
| [`media/src/runway/enhance-frame-rate.ts`](../media/src/runway/enhance-frame-rate.ts) | `enhance_frame_rate` body; field is **`targetFramerate`** |
| [`media/src/runway/provider.ts`](../media/src/runway/provider.ts) | `RunwayDevProvider.enhanceFrameRate` only — not `MediaProvider` |
| CLI | `npm --prefix media run runway:enhance-frame-rate -- <input.mp4> <output.mp4>` |

**Live-proven.** Enhance Frame Rate @ 120fps on TunnelVision MP4s
(smoke test plus three FPSTEST clips: 11 credits, ~140s wall, no
meaningful API failures). Official `@runwayml/sdk` VideoUpscale
types did not include `enhance_frame_rate`; HTTP is the working
pattern.

**Does not exist yet (this is the event-day Runway work):**

-   Model Router `POST /v1/generate/image` and `/v1/generate/video`
-   Named-model `text_to_image` / `image_to_video` fallback
-   Runway behind `MediaProvider` / `ImageEditProvider`
-   JourneyAgent / construct / shoot emitting `"runway"`
-   Visible `routing.model` in a hackathon UI
-   Agentic Router policy (grammar / CM scores choosing a pool)

Product stills and traversals still generate through Replicate.

**Token name.** TunnelVision reads `RUNWAY_DEV_TOKEN`
([`.env.example`](../.env.example),
[FRESH_MACHINE_SETUP.md](../FRESH_MACHINE_SETUP.md)). The official
SDK default is `RUNWAYML_API_SECRET`. Same secret; alias on event
day if the packet uses the SDK name. Commented `RUNWAY_ROUTER_DRAFT`
/ `RUNWAY_ROUTER_FINAL` already exist in `.env.example`.

**120fps Temporal Seam: abandoned.** Do not productize velocity
smoothing. Do not enhance every take. Do not spend the 5–6 hour
window on join remapping. Export remains flat concatenation. Full
record:
[2026-09-20 Temporal Seam / 120fps](experiments/2026-09-20-temporal-seam-120fps.md).
Keep Enhance Frame Rate as a reusable primitive for other future
uses, not as the hackathon claim.

**Successor investigation (not event-day, do not implement yet):**
automatic **color** continuity / finishing instead of velocity
smoothing. Two operations: restrained boundary color matching
(canonical B as possible reference) and an optional journey-level
grade. Start with OpenCV / FFmpeg / statistics, not another
generative model. Full note:
[Next experiments — Automatic Color Continuity](hackathon/next-experiments-and-ui.md#1-automatic-color-continuity--finishing).

### 14.1 Verified public API (14 September 2026)

The public [Runway Dev API](https://docs.dev.runwayml.com/) is now
understood. Do **not** spend event morning “discovering whether
Runway has image and video APIs.” It does. Event-day reconnaissance
is credentials, account access, newly announced models, Router
availability in *this* hackathon’s org, and anything unique to the
event.

**Verified (public docs):**

| Surface | What exists |
| --- | --- |
| Auth / version | TV: Bearer `RUNWAY_DEV_TOKEN` (live). Official SDK / some docs: `RUNWAYML_API_SECRET`. Header `X-Runway-Version: 2024-11-06`. Alias the env names on event day; do not treat them as two secrets. |
| SDK | Node `@runwayml/sdk` (`generate.video.create`, `generate.image.create`, `imageToVideo.create`, `textToImage.create`, `waitForTaskOutput`); Python `runwayml` |
| Tasks | Async tasks; poll `GET /v1/tasks/:id`; `TaskFailedError` |
| Direct image | `POST /v1/text_to_image` — named `model` + `ratio` + optional `referenceImages` |
| Direct video | `POST /v1/image_to_video` (and `text_to_video`) — named `model` + model-specific `ratio` |
| Model Router | Saved configs; `POST /v1/generate/image`, `/v1/generate/video`, `/v1/generate/audio` with `configId` + model-agnostic `input` |
| Image models | Nano Banana family (`gemini_image3.1_flash` = NB2, `gemini_image3_pro`, `gemini_2.5_flash`), `gen4_image` / `gen4_image_turbo`, Seedream, GPT Image, Grok Imagine Image — text + optional `referenceImages` |
| Video models | Seedance 2 / Fast / Mini / 2.5, Wan 3 / Prime, Veo 3.1 / Fast, Hailuo 3, H3 Max, Gen-4.5, Gen-4 Turbo, Grok Imagine 1.5, Gemini Omni Flash / 1.1, others |
| Start + end frames | **Not universal.** Router `input.referenceImages[].role`: `first` \| `last` \| `reference` (at most one `first` and one `last`). Direct **first+last**: Seedance family, Veo 3.1 / Fast, Hailuo 3, H3 Max, Wan 3 / Prime, Gemini Omni Flash **1.1**. Direct **first only**: Gen-4.5, Gen-4 Turbo, Gemini Omni Flash (no suffix), Grok Imagine 1.5, HappyHorse. Sending `last` excludes first-only models |
| Image resolution (router) | `input.resolution`: `1k`, `2k`, `4k` — models that cannot meet the tier are excluded |
| Video resolution (router) | `input.resolution`: `480p`, `720p`, `1080p`, `4k` — same exclusion rule |
| Aspect | Router uses model-agnostic `aspectRatio` (`16:9`, …). Direct-model endpoints use model-specific `ratio` (`1280:720`, …). **Not interchangeable** |
| LLM / reasoning | **No public Runway LLM endpoint** in the current model catalog. Keep `ReplicateReasoningProvider` / Gemini 3.1 Pro for Director and CM unless the event adds one |

**Do not invent.** Router optimization is exactly one of `cost`,
`latency`, or `quality`. There is no documented Router knob for
“spatial pull-forward,” “Camotion compatibility,” or custom scoring.
Those remain TV evaluation criteria. Eligibility filtering is how
the request *shape* (first+last frames, resolution, duration, price
cap) narrows the pool. `dryRun: true` is HTTP today; SDK dry-run
support is documented as coming soon. Video `duration` is 2–30
seconds. Output URLs expire in 24–48 hours — persist locally as TV
already does for generated media.

**Verified vs assumption**

| Verified in public docs | Hackathon-day assumption (do not treat as API fact) |
| --- | --- |
| Router configs, `configId`, `optimizeFor`, eligibility, `routing.model` / cost | This hackathon org can create routers and has credit for live generate |
| `first` + `last` on routed video **requires** models that support those roles | The chosen start+end model will *physically travel* A′→B′ rather than restyle the stills — TV must still evaluate footage |
| Image `referenceImages` guide generation | A given image model will honor the source still *and* pull the viewpoint forward — TV must still evaluate canonicals |
| Seedance family, Veo 3.1 / Fast, Hailuo 3, H3 Max, Wan 3 / Prime, Omni Flash 1.1 support first+last on direct `image_to_video`; Gen-4.5 / Gen-4 Turbo / Omni Flash / Grok 1.5 / HappyHorse are first-only | Event catalog / allowlists will include at least one strong start+end model; Omni Flash 1.1 and Wan Prime may or may not be enabled on the hackathon org |
| No Runway LLM in the current catalog | The event will not require putting Director/CM on Runway |

**Not the traversal path:** the
[Multi-Shot Video recipe](https://docs.dev.runwayml.com/recipes/multi-shot-video/)
assembles 3–5 *cuts between scenes*. TunnelVision shoots continuous
first-person travel from A′ to B′. Do not replace `shootJourney`
with Multi-Shot.

**Not a world model for journeys:** `gwm1_avatars` is a real-time
conversational avatar. Do not treat it as GWM Worlds 2 or as
canonical/traversal generation.

### 14.2 Model Router is the primary generation strategy

Hack-day Runway integration should **strongly prefer Model Router**
for image and video generation. Named direct-model calls are the
fallback when a router config is missing, a request has no eligible
model, or a use case must pin one model.

Runway’s own docs: instead of integrating around a single model,
create a router and let the platform pick based on configured
preferences. As new models launch, routing keeps pace without
changing integration code. A creative app might run a **Draft**
router tuned for latency and a **Final Export** router tuned for
quality, each called by its own ID.

Verified Router concepts to use:

-   reusable configs with a **stable, immutable `configId`** slug
    (example: `preview-fast`)
-   optimize for **cost**, **latency**, or **quality** (one
    dimension per config)
-   **multiple routers per use case**
-   one config can serve image / video / audio; modality is the
    endpoint (`/v1/generate/image` vs `/v1/generate/video`)
-   eligibility = enabled models (allow list or deny list) ∩
    capabilities required by this request ∩ per-modality credit
    ceiling
-   new models become eligible automatically unless the config is
    an allow list
-   every response reports **which model ran**, **cost**,
    `configId`, and `optimizeFor`
-   `dryRun: true` inspects `routing.model` / `estimatedCost` /
    `resolvedSettings` without generating or billing
-   routed requests send `configId` + model-agnostic `input`;
    **do not** send `model`

``` text
JourneyAgent / CM     decide WHAT task and WHICH POLICY
                      (construct B, shoot A→B, retry quality)
Runway Model Router   chooses WHICH eligible MODEL
                      under that policy
```

Do **not** move Director, CM, Camotion, canonical repair, or
Take-selection orchestration into Runway. Router augments TV’s
filmmaking intelligence; it does not replace it.

### 14.3 TV tasks → router policies

Map filmmaking tasks onto **config IDs**, not model IDs. Create
these configs in the Developer Portal (or `POST /v1/routers`) once;
the adapter only passes `configId` + `input`.

Suggested configs (names are ours; settings are documented). These
are **Runway router policies**, not TunnelVision Draft/Final project
modes:

| TV generation policy | Router config (example ID) | Verified settings | Use |
| --- | --- | --- | --- |
| Fast / cheap | `tv-draft` | `optimizeFor: latency` (or `cost`); optional lower video `720p` / image `1k`; tighter credit ceiling | Quick complete journey; first construct/shoot |
| Quality-oriented | `tv-final` | `optimizeFor: quality`; video `1080p` and image `2k` when the request needs them | When the filmmaker or demo wants a stronger model pool |

Filmmaker quality iteration is **NEW TAKE** (optionally after
switching the project video model), not a Draft/Final movie mode.

Do not claim a “low-res vs high-res router type.” Resolution is an
**`input` field** that also filters eligibility. The same `tv-draft`
config can receive `720p` on a first shoot and `tv-final` can
receive `1080p` on a quality retry.

**Discover harvest is different.** Traversals that will become
canonical source must be **≥720p**. Do not feed a cheaper / smaller
draft generation into the Discover extract → promote chain. See §17.

**Canonical / image**

-   Opening A: `POST /v1/generate/image` with `promptText` (no
    reference).
-   Construct B…N: same endpoint with `referenceImages` = preceding
    actual. That is the documented reference-image path, not a
    separate “edit” API. Adapter maps `ImageEditProvider.sourceImage`
    onto router `referenceImages`.
-   Prefer models that honor a reference **and** displace viewpoint.
    Router cannot score that. Configure a quality image router with
    a sensible allow/deny list if event-day tests show some models
    only restyle the source. JourneyAgent still rejects a still that
    kept the source composition (existing construct prompt).
-   Escalate: first construct on `tv-draft`; if the still fails
    spatial progression / reference adherence, retry the **same
    construct operation** with `tv-final`.

**Video / traversal**

-   Always pass Camotion A′ as `role: "first"` and B′ as
    `role: "last"` when both exist. That is the TV preference for
    robust START+END conditioning.
-   Router then **excludes** models that cannot satisfy those roles
    (direct API first-only: Gen-4.5 / Gen-4 Turbo / Omni Flash
    without `_1.1` / Grok 1.5 / HappyHorse). Remaining eligible
    models (Seedance family, Veo 3.1 / Fast, Hailuo 3, H3 Max,
    Wan 3 / Prime, Omni Flash 1.1 if enabled) compete on the
    config’s `optimizeFor`.
-   **Integration risk (do not invent a Router flag to fix it):**
    there is no “force strong endpoint adherence” setting. A wide
    latency/cost pool can still pick a start+end-capable model that
    treats last-frame loosely. Mitigate with a documented **allow
    list** on `tv-final` (and optionally a dedicated traversal
    config) of models known to honor first+last, or fall back to a
    named direct model.
-   If no eligible model remains, **fallback**: either drop `last`
    and shoot first-frame-only (worse; log it), or call a named
    start+end model directly. Do not silently switch to Multi-Shot.
-   The selected model must travel from supplied start to supplied
    end, not treat them as loose style references. That judgment is
    the filmmaker's when reviewing Takes — not a Router setting.
-   Prefer a quality-oriented router (or a NEW TAKE after switching
    models) when the first clip is not the cut. Do not invent Agent
    footage-evaluation retries so Router has something to escalate.

**CM / Agent repair loop**

Repair operations themselves remain pre-hackathon product work
(§9). Router does not become a second Agent.

When JourneyAgent already retries **canonicals**:

-   CM/Agent diagnose **why** a pair is unshootable and **what**
    canonical repair is needed (RESHOOT_END).
-   JourneyAgent chooses the **task**. It does **not** pass a
    `configId` or model name, and it does not pick Takes.
-   The Runway adapter maps generation requests onto router
    `configId`s (`RUNWAY_ROUTER_DRAFT` / `RUNWAY_ROUTER_FINAL` as
    latency vs quality pools). Those are adapter configs, not
    product Draft/Final modes.
-   Canonical repair may use a stronger image generation route.
-   Log `routing.model` and credits on the take for debugging; do
    not show them in the hackathon UI.

Do **not** invent a footage-evaluator loop so Router has something
to escalate. For the demo movie, call the quality-oriented router
when you want stronger stills and footage; keep the fast router
wired for smoke tests and complete-journey scouting.

### 14.4 Adapter implementation

Desired hackathon configuration:

| Role | Preference |
| --- | --- |
| LLM / reasoning | Keep Gemini 3.1 Pro unless the event adds a Runway LLM |
| Image generation / edit | Runway **Model Router** (`/v1/generate/image`); direct `text_to_image` fallback |
| Video generation | Runway **Model Router** (`/v1/generate/video` with first+last); direct `image_to_video` fallback |

Do not compromise Agent architecture merely to claim every call uses
Runway. Director and CM are reasoning jobs.

Implement Runway generation as **extensions** of the existing package.
Do not create a second client.

``` text
media/src/runway/                 EXISTS — client, tasks, download, enhance-frame-rate
media/src/runway/provider.ts      EXISTS — Enhance Frame Rate only; extend toward MediaProvider / ImageEditProvider
media/src/runway/router.ts        NEW — configId + generate.image / generate.video
```

Env (same pattern as `media/src/config/environment.ts`):

-   `RUNWAY_DEV_TOKEN` — current TV name; already used by the client
-   `RUNWAYML_API_SECRET` — official SDK name; accept as an alias if
    the event packet uses it
-   `RUNWAY_ROUTER_DRAFT` — default `tv-draft` (latency/cost pool)
-   `RUNWAY_ROUTER_FINAL` — default `tv-final` (quality pool)

These env vars name Runway router configs. They are not TunnelVision
Draft/Final project modes.

Plus catalog entries beside (not inside) role code if a fallback
named model is required. Do not put `configId` on `Project`,
storyboard, or `JourneyShot` domain types. Storing the **selected**
`routing.model` on generated media (alongside today’s
`GeneratedVideo.model`) is fine.

First integration step (done in types; adapters still emit
`"replicate"`): `GeneratedVideo.provider` /
`GeneratedImage.provider` / `ReasoningResult.provider` are `string`.
A Runway adapter may write `"runway"` without touching Director, CM,
or Camotion.

Do **not** put Runway-specific fields into:

-   Director (`media/src/director/*`)
-   Cinematographer (`media/src/cinematographer/*`)
-   Agent (`web/src/agent/*` or JourneyAgent)
-   Camotion
-   `Project` / storyboard / `JourneyShot` domain types

Secrets stay in env / `.env.local`. Never commit tokens.

Smoke-test with `dryRun` before live generate. If the pool is empty,
widen the config or fall back to a named model — do not retune
Camotion.

---

## 15. Event-day reconnaissance

The public Runway Dev API is already reviewed in §14. **Do not**
re-derive “which APIs exist” from scratch.

**Before coding**, read:

1.  event packet / submission rules
2.  [docs.dev.runwayml.com](https://docs.dev.runwayml.com/) changelog
    for anything newer than this file
3.  Developer Portal: can this hackathon org create Model Router
    configs? Note the actual `configId` slugs
4.  credentials (`RUNWAY_DEV_TOKEN`; alias `RUNWAYML_API_SECRET` if
    the packet uses the SDK name), rate limits, credit budget
5.  models enabled on *this* account vs the public catalog
6.  any hackathon-only model, world-model, or LLM endpoint
7.  Cursor **Runway Dev MCP** connected (`whoami` works); re-read
    `api.md` for anything newer than §14.0

Then confirm, with one `dryRun` each:

-   image generate through `tv-draft` / `tv-final`
-   image generate with a reference still (construct B)
-   video generate with `first` + `last` (A′/B′)
-   what the router picks, and whether the pool is empty

Only modify this plan where a new capability **materially** changes
an assumption (no Router access; no start/end models enabled; a
world-model API that can replace one stage; a Runway LLM).

Do not redesign working Director / CM / Camotion merely because a
new API exists.

---

## 16. GMW2 / new world-model contingency

Do **not** design around a world-model announcement before the event.

[RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md) already notes Runway
GWM Worlds 2 (3 September 2026) as **external research, not a
TunnelVision dependency**. Not implemented. Not validated.

If such a capability is available that day, first ask:

> What existing TunnelVision stage can this improve or replace?

| New capability | Existing stage |
| --- | --- |
| Better image generation / edit | Canonical provider (`MediaProvider` / `ImageEditProvider`) |
| Better start/end video | Video provider |
| World / spatial reasoning | Director or CM *evidence*, not a new role |
| Persistent world generation | Maybe construct + traversal; still observe actuals |
| Video continuation / last-frame extract | Possible DISCOVER later |

Treat new APIs as modular substitutions. Do not throw away the proven
stack.

TunnelVision remains the filmmaking intelligence layer: Director
decides where to go, CM decides how to shoot actual adjacent
canonicals, Camotion conditions, JourneyAgent chooses the task
and canonical-repair policy, Runway Model Router chooses the eligible model,
the generator films.

Do not confuse `gwm1_avatars` (real-time conversational avatars
on the current catalog) with GWM Worlds 2. Avatars are not
canonical or traversal generation.

---

## 17. DISCOVER

**P1 if P0 is healthy. Not a UI mode. Not required for Definition
of Done.** Continue Journey stays ahead of or alongside Discover
(lower complexity, high demo value). Do **not** promote Discover
to P0.

Discover differs fundamentally from DERIVE. There is **no**
predetermined pristine canonical B.

``` text
DERIVE
  Director defines intended B
    → construct pristine canonical B
    → prepare A′ / B′
    → generate A→B

DISCOVER
  pristine canonical A
    → generate A→? into the unknown  (≥720p)
    → inspect the traversal's ending region
    → select the latest usable discovered frame
    → extract that exact source frame losslessly
    → promote / enhance → pristine canonical B
    → inspect B / decide next exploratory intent
    → generate B→?
    → harvest pristine C
    → repeat for the planned journey extent
```

Director still determines journey **extent** with the existing
destination-count / plan mechanism. JourneyAgent executes that
extent and completes when the required planned canonicals /
traversals are processed and assembled. Do **not** add an LLM
decision about whether the journey should stop.

`Project.construction: "planned" | "discovery"` already exists and
is **unwired**. Do not expose DERIVE / DISCOVER as UI modes. The
same Agent UI and Project model support both. A exists before
Director plans from A; each newly harvested canonical becomes
grounding truth for the next exploratory decision.

Do **not** start DISCOVER until P0 is green. Do not enter the
Derive CM reshoot loop merely because a discovered B differs from
a planned B. Emergence is the point.

Agency (Director vs Agent) stays orthogonal to DERIVE vs DISCOVER.

### 17.1 Quality floor

Discover relies on generated-video frames becoming future
canonical source material. That creates a generational chain:

``` text
pristine A → video → extracted frame → pristine B
  → video → extracted frame → pristine C → …
```

Hackathon requirement: Discover traversal generation is
**minimum 720p**. Do not harvest canonicals from low-resolution
draft video. If the Runway model / API selected that day offers a
better appropriate quality mode, use it. Do not hard-code
unsupported model names or resolutions into this plan.

### 17.2 Latest usable frame

The literal final frame is the preferred **candidate**, not an
automatic accept.

``` text
LATEST USABLE FRAME WINS.
```

Start at the end of the generated traversal and work backward.
Preserve **maximum spatial progression**. Do **not** search the
entire video for the prettiest or most cinematic frame.

CM asks whether a late frame can function as the next pristine
canonical. Relevant qualities:

-   spatial coherence
-   usable scene geometry
-   sufficient sharpness / stability
-   absence of severe generation corruption
-   absence of problematic motion smear
-   not caught in an awkward transitional state
-   useful depth / continuation possibilities
-   suitability as the starting world state for the next traversal

The best Discover canonical is the **latest frame that is
sufficiently usable**.

### 17.3 First evaluation: one contact sheet

Keep the first implementation simple and inexpensive.

Sample a small set of frames backward from the end, approximately:

``` text
END
END − 0.25 s
END − 0.50 s
END − 0.75 s
END − 1.00 s
…
```

Exact cadence is **not** locked. Do not treat those offsets as
product law.

Build **one** contact sheet from those late-frame candidates and
give that single visual artifact to CM. Prefer one evaluation
over N separate LLM calls.

Conceptual CM instruction: choose the latest frame suitable to
become the next pristine canonical. Prefer later frames unless an
earlier candidate is materially more coherent or usable.

Structured result should identify at least:

-   selected candidate
-   source timestamp
-   usable / unusable
-   concise selection reason

Example only — not a locked schema:

``` json
{
  "selectedCandidate": 3,
  "timestamp": 8.5,
  "usable": true,
  "reason": "Latest stable frame with coherent architecture and clear forward depth."
}
```

A finer second-stage search around the selected timestamp may be
explored only if coarse sampling proves insufficient.

### 17.4 Exact extraction, then promotion

Extraction and canonical promotion are **two** operations.

``` text
generated traversal MP4
  → CM-selected timestamp / frame
  → FFmpeg (or equivalent local tooling) exact frame extract
  → lossless B-source.png
  → enhance / upscale as appropriate
  → pristine canonical B.png
```

Do **not** ask an image model to recreate the selected frame.
Do **not** resize or JPEG-compress during extraction.

Use PNG for the harvested source (`B-source.png`) and for the
promoted canonical (`B.png`). The resulting canonical uses
TunnelVision’s normal canonical aspect / dimensions (normally
16:9 for the current journey format) and remains a lossless PNG.
Do not introduce JPEG into the recursive Discover chain.

The generated traversal determines **what** B is. Promotion makes
that discovered frame suitable as the authoritative canonical for
the next traversal. Minimize cumulative

``` text
video → frame → video → frame
```

degradation.

Do not specify a particular enhancement / upscaling model unless
one is already established in the product. Choosing the mechanism
is part of the Discover hack-day experiment.

### 17.5 Provenance (Project, not Session)

The Project should eventually retain enough metadata to explain
where a discovered canonical came from. Conceptually:

``` json
{
  "discoveredFrom": "<previous canonical id>",
  "sourceTraversal": "<traversal/take id>",
  "sourceTimestamp": 8.5,
  "sourceFrame": 1020,
  "selectionMethod": "discover-late-frame"
}
```

This is planning guidance. Do **not** invent a new persistence
schema before implementation. Current Project already has
`CanonicalTake.source` including `"discover"` and a
forward-compatible `generation` bag — use those if they fit; do
not add Session fields. Session must **not** own harvest
provenance.

### 17.6 Open before attempting Discover

Answer these on event day only if P0 is green:

1.  First Discover shot: generate from pristine A alone (no B′),
    or still require some end condition / Camotion pair?
2.  How OG vs Pull Forward applies when there is no predetermined
    B (Pull Forward is destination-seeking).
3.  Which established enhance / upscale path, if any, is used for
    `B-source.png` → `B.png`.
4.  Whether Director still writes a destination **count** only, or
    a loose arc of intents that harvest overwrites.

---

## 18. Completion experience

When accepted takes exist for the journey:

**ASSEMBLE THE MOVIE** using `requestExportMovie`.

Directed Export Movie already concatenates whatever rendered clips
exist, in storyboard order, without transitions, and reports missing
legs (`MovieExportResult.complete`). AGENT should call that
automatically when the loop finishes. Prefer a complete export; if a
leg failed after retries, still assemble what exists and say so in
one sentence.

Final Agent turn:

> Your journey is ready.

Then display the exported MP4 (`MovieExportResult.videoUrl`).

Optionally: compact storyboard strip, journey title (`Project.title`
or first line of story), one-line summary (N destinations, N shots).

Do not bury the payoff under metrics.

**The movie is the payoff.**

---

## 19. UI philosophy

The Agent UI is **pre-hack**. Event day may add only the smallest
status needed to make **new** agent decisions observable (CM
technique, intent NEW/CONTINUE, Discover harvest).

``` text
THE CONVERSATION IS THE WORKSPACE.
A JOURNEY IS A RICH CHAT TURN.
```

Avoid dashboards, configuration, inspectors, engineering / debug UI,
model selectors, exposed schemas, and manual workflow controls.

``` text
User writes one prompt.
User presses Send.
User watches the film crew work.
The movie plays in the same journey card.
User says where to go next.
```

A later prompt is **not** always a new world. `Director.intent()`
chooses NEW vs CONTINUE. One Project = one journey. Continuation
creates a **new** Project that inherits the previous final
canonical as A. No “Previous Journeys” dashboard; Open loads a
Project without reconstructing Agent history. Session browser is
not in scope. Full note:
[Next experiments](hackathon/next-experiments-and-ui.md).

---

## 20. Reuse existing UI

Inspect `web/src/app/agent/` before creating components.

Prefer reusing Agent journey cards, storyboard tiles, `Preview`,
`ProgressSpinner`, buttons, and the generating shimmer.

Create hack-specific chrome only where a **new decision** must be
visible (CM technique, Continue status). Do **not** rebuild the
Agent workspace.

Do **not** destabilize Director / Shoot.

---

## 21. Repo strategy

Stay in **this** repository. Do **not** add `web/agent.html` or
split into `apps/tunnelvision-agent/`.

``` text
web/src/app/agent/     existing Agent workspace (pre-hack)
web/src/project/       Session + JourneyAgent + Project ops
media/                 shared engine + media/src/runway/
camotion/              unchanged
```

Goal: one application, one filmmaking engine, one JourneyAgent.
Director / Shoot stay for inspection and manual work. The demo
URL is `/` on the Agent tab.

---

## 22. What counts as hackathon-day work

Be transparent if presenting:

The filmmaking primitives, JourneyAgent, Agent chat workspace, and
Session persistence came from prior TunnelVision work.

The hackathon project is **agent intelligence and Runway API
usage** on top of that library: CM technique choice, self-repair
strategy changes, Continue Journey, optional Discover harvest /
Model Router.

Camera grammar (POV / FOLLOW / LEAD / MOUNTED, one journey = one
grammar) **landed pre-hackathon**; event day reuses it and does
not invent mixed-grammar journeys.

Concentrate that day on:

1.  validate fully unattended orchestration (P0)
2.  CM OG vs Pull Forward per traversal (P0)
3.  failure-driven technique switching (P0)
4.  Continue Journey via `Director.intent()` (P1)
5.  Discover ≥720p late-frame harvesting if P0 is healthy (P1)
6.  Runway Model Router **only if** it shows useful intelligence
7.  credentials / newly announced models if they help the demo

Do **not** spend the day on Agent chrome, Session browsing,
chained-video export, or implementing JourneyAgent from scratch.

---

## 23. Target 5–6 hour schedule

Treat this as a hard timebox.

Assume pre-hackathon JourneyAgent, Agent chat, and Session
persistence already work. Event-day risk is **agent intelligence**
(CM technique, Continue Journey, Discover) and optional Runway
Model Router — not a new UI and not Runway auth/polling. If P0
slips, drop Discover, Model Router, and color continuity first.
Do not start implementing JourneyAgent or Agent chrome during
this window. Do not invent mixed-grammar journeys. Do **not**
reopen 120fps Temporal Seam / velocity smoothing. Do **not**
build session browsing or chained-video export.

### 0:00–0:30 — Event / API reconnaissance

Read hackathon requirements and the event packet.

Reopen [docs.dev.runwayml.com](https://docs.dev.runwayml.com/) only
for changelog / newly announced models. Do **not** rediscover the
public API from scratch.

Confirm:

-   `RUNWAY_DEV_TOKEN` (alias `RUNWAYML_API_SECRET` if needed) and
    credit / rate limits. Enhance Frame Rate already proved this
    token talks to `api.dev.runwayml.com`; recon is Router access
    and org-enabled models, not “does Runway work.”
-   Model Router access; create or note `tv-draft` / `tv-final`
    (`optimizeFor: latency` vs `quality`)
-   which models this org actually enables
-   anything unique to the hackathon (new model, LLM, world-model)

Keep Gemini for Director/CM unless a Runway LLM appears.

Do not code speculative features. Do not spend this block picking
a single image model and a single video model as the integration
strategy.

### 0:30–1:30 — Runway recon / optional Router

The Runway client and polling already exist. Do **not** spend
this hour rebuilding them. If Model Router access is real and
looks useful, extend `media/src/runway/` behind the existing
providers. If not, start P0 CM technique work early.

Do not recreate the client, task poller, upload, or download. Do
not implement Enhance Frame Rate again. Do not implement Temporal
Seam.

Add Model Router generation behind `MediaProvider` /
`ImageEditProvider`. Primary path: `POST /v1/generate/image` and
`POST /v1/generate/video` with `configId` (HTTP on the existing
client, or SDK `generate.image.create` / `generate.video.create` if
event-day docs confirm they wrap the same Router endpoints).
Fallback: named `text_to_image` / `image_to_video`.

Verify independently (prefer `dryRun` HTTP first, then one live
call each):

-   image through the draft and final routers
-   image with a reference still (construct B)
-   video with `first` + `last` (A′/B′)
-   that `routing.model` is populated and the pool is not empty

One minimal smoke test. Then stop.

### 1:30–3:30 — P0 agent intelligence

Use the **existing** Agent tab. Do not build a shell.

1.  Validate a fully unattended journey end to end.
2.  CM chooses OG vs Pull Forward **per traversal** before shoot.
3.  Failure-driven technique switch (diagnose → change strategy →
    reshoot → reevaluate → continue).
4.  Surface those decisions as concise status, not a new dashboard.

Do **not** reimplement JourneyAgent.

This is the critical milestone: the existing UI shows an
autonomous cinematographer adapting technique.

### 3:30–4:30 — P1 if P0 is green

-   Continue Journey: `Director.intent()` → NEW | CONTINUE;
    inherit the previous completed Project's actual final
    canonical as the new Project's A; write `continuedFrom`.
-   Discover ≥720p late-frame harvesting if time remains.

If P0 is not green, keep fixing P0. Do not start Continue Journey
on a broken unattended loop.

### 4:30–5:15 — Demo polish

Make the preferred demo story observable: one failed traversal,
one technique switch, one continuation prompt. Do not change
filmmaking algorithms unrelated to that story.

### 5:15–6:00 — Buffer / event-day opportunity

Use for unexpected integration problems, **or** if P0 + Continue
already work:

-   Discover
-   Model Router if it materially helps
-   a compelling newly announced Runway capability
-   demo recording / presentation prep

Never sacrifice the working autonomous journey for GWM, color
continuity, or stretch work.

---

## 24. Definition of done

**P0 is the submission bar.** P1 items are high value if P0 is
green. They are not required for “done.”

The hackathon product is **DONE** when:

1.  User opens the **existing Agent tab**.
2.  User types one journey prompt.
3.  User presses Send.
4.  That action drives the **existing** JourneyAgent (not a
    hackathon-day orchestrator).
5.  No further human filmmaking input is required.
6.  Director plan, destination construction, CM technique choice,
    evaluation, shooting, and repair appear as concise live
    status — not a spinner and not a new dashboard.
7.  Cinematographer chooses OG vs Pull Forward independently for
    each traversal, and can switch technique after a diagnosed
    failure.
8.  JourneyAgent uses the pre-hackathon Derive path: sequential
    canonicals, Traversal-Confidence repair, overlapping NEW TAKE,
    assembly of selected Takes. Opening the same Project in
    Director / Shoot later allows inspection and Take changes.
    Opening a Project does **not** reconstruct Agent history.
9.  Selected Takes are assembled (`requestExportMovie`).
10. Playback stays on the same journey card.

Continue Journey, Discover, Model Router, color continuity, and
GWM are **not** required for done. Autonomous stopping is
**out**.

That is the submission. Everything else is optional.

---

## 25. Explicit non-goals

Do **not** spend hackathon time on:

-   redesigning Plan | Shoot
-   rewriting Camotion
-   tuning CM prompts without a demonstrated failure
-   in-app model bakeoffs (configure routers in the Developer
    Portal instead; do not hard-code a winner into JourneyAgent)
-   moving Director / CM / Camotion / canonical repair
    orchestration into Runway
-   creating a parallel hack-app Agent or `/agent.html`
-   New Journey / Continue Journey buttons or a mode selector
-   session browser / session rehydration
-   combining continued Projects into one Session MP4
-   replacing `shootJourney` with Multi-Shot Video
-   120fps Temporal Seam / velocity smoothing (abandoned)
-   manual filmmaking controls
-   Inspector improvements
-   project-management UI
-   a second project format or isolated movie-only artifact
-   reconstructing Agent conversation from an opened Project
-   accounts / collaboration
-   elaborate settings
-   responsive perfection
-   arbitrary animations
-   named canonicals
-   filmmaker-adjustable D
-   CM-selected duration as a core feature (pace / nearest-supported
    duration mapping is nice-to-have **if easy**; see Camera grammar
    decision)
-   generalized plugin architecture
-   speculative world-model abstractions
-   DISCOVER before P0 is green
-   autonomous Agent stopping / “should this journey continue?”
    LLM loops
-   GWM / Worlds if it jeopardizes the working journey
-   mixed-grammar journeys, or “fixing” LEAD by making the single
    FPOV baseline more permissive
-   implementing JourneyAgent or the Agent chat UI (pre-hack)
-   advanced Project-tool chat before the hands-off demo works
-   Screenwriter
-   promoting the experimental Shot Evaluator into an Agent stage
-   destination-aware Camotion fields
-   extracting a shared UI package

---

## 26. Failure philosophy

A working simple demo beats an ambitious broken one.

When something fails:

1.  identify whether it is UI, orchestration, provider, canonical,
    CM, Camotion, video, or assembly
2.  fix the smallest responsible layer
3.  rerun
4.  do not compensate by adding prompt complexity elsewhere

Preserve architectural boundaries.

---

## 27. Core architecture invariants

Preserve these regardless of hackathon shortcuts:

-   A is required before cinematic traversal.
-   Canonicals are authoritative destinations.
-   Actual filmmaker-supplied canonicals are never silently replaced.
-   Director resolves unspecified directing decisions.
-   Director does not overwrite specified filmmaking decisions.
-   Add Destination is structural, not hidden Director behavior
    (the hack app simply should not offer it).
-   CM evaluates actual adjacent canonical images.
-   Motion Plans belong to segments.
-   Shared canonical B may have independent inbound B′ and outbound
    B′.
-   Camotion is deterministic, not an agent.
-   CM describes the actual route positively
    (`segmentPromptAddition`).
-   Global video prompting contains universal locomotion / POV
    invariants (`composeShootingPrompt`).
-   Filmmaker prompts remain story-focused.
-   Traversability does not imply tunnels / thresholds.
-   Continuous forward travel may include turns and curved routes.
-   Providers remain behind adapters.
-   Runway Model Router chooses eligible models; JourneyAgent
    chooses filmmaking tasks and canonical-repair policy.
-   Agent orchestrates existing typed operations rather than
    duplicating them.
-   The filmmaker, not the Agent, judges generated footage and
    selects Takes.
-   CREATE JOURNEY is the only Director invocation in Directed; AGENT
    may call Director as part of its own loop.
-   Session conversation is not project persistence.

---

## 28. Event-day instruction to Cursor

At the beginning of hackathon implementation:

1.  Read this entire file.
2.  Inspect the current repository state.
3.  Read current architecture / product / backlog documentation.
4.  Inspect the pre-hackathon JourneyAgent in the existing Agent
    tab. If it is missing or cannot run the unattended loop, stop
    and report that discrepancy; do not implement a parallel
    Agent.
5.  Inspect current provider adapters (`media/src/replicate/`,
    `media/src/types.ts`).
6.  Reopen the public Runway Dev docs linked at the top of this
    file, plus anything in the event packet. The public API is
    already summarized in §14.0–14.1; look for credentials, Router
    access, newly announced models, hackathon-only endpoints, and
    whether Cursor Runway Dev MCP (`whoami`) is connected.
7.  Identify any assumptions in this document invalidated by new
    information.
8.  Report **only** those discrepancies and proposed changes.
9.  If there are no material discrepancies, **do not** propose a new
    plan.
10. Begin implementation using this plan.

During implementation:

-   preserve existing working architecture
-   reuse before rewriting
-   keep `/` Plan | Shoot functional
-       optimize for an end-to-end unattended demo of the existing
    JourneyAgent (one prompt → watch crew → play movie → continue)
-   do not add scope without a demonstrated need
-   do not stop to ask for approval for routine decisions already
    covered here
-   test incrementally (fake / recorded providers first if live
    Runway is rate-limited)
-   commit logical milestones if the repo workflow permits

If new Runway capabilities are revealed: first decide whether they
materially improve the core demo. Only then alter the plan.

---

## 29. Demo story

The preferred demo makes **agent decisions observable** rather than
showing lots of controls.

Ideal visible sequence:

``` text
User prompt
  ↓
Director plans
  ↓
CM selects technique (OG or Pull Forward)
  ↓
traversal generated
  ↓
CM evaluates
  ↓
one traversal fails
  ↓
CM explains a concise failure
  ↓
CM switches technique
  ↓
reshoot succeeds
  ↓
journey completes
```

Then:

``` text
User: "Keep going. Descend through the doorway and find
       what is beneath the city."
  ↓
Director: Continuing from [previous destination].
  ↓
New Project begins from the exact previous final canonical.
```

That demonstrates:

-   conversational Agent UX
-   autonomous planning
-   Runway generation
-   self-evaluation
-   adaptive cinematography
-   repair
-   persistent spatial continuity across separate journeys

Then explain:

> I typed one prompt, watched the film crew make the journey,
> then told it to keep going from the last world.
>
> The core filmmaking engine and Agent workspace already existed.
> At the hackathon we taught the Cinematographer to choose and
> change shooting technique, and we let a later prompt continue
> spatially without appending to the previous Project.
>
> We are not claiming we built all of TunnelVision in a day. We
> built an autonomous cinematographic world-traversal agent on
> top of that library.

That is the product story. Director / Shoot remain the place to
inspect Takes. Opening a Project does not rebuild the
conversation.

---

## 30. Stretch priority

**Only after P0 (and preferably Continue Journey):**

1.  Discover ≥720p late-frame harvesting
2.  Runway Model Router if it shows useful intelligence
3.  a compelling new Runway capability
4.  color continuity (P2)
5.  GWM / Worlds (do not jeopardize the working journey)

Do not reverse this to put GWM or color before CM technique.

---

## Appendix A — Operation checklist for JourneyAgent

Pre-hackathon shopping list for the product JourneyAgent (existing
Agent tab). The sequencer now lives in
`web/src/project/journey-agent.ts`. Event day **calls and extends**
this Agent; it does not reimplement it. Canonical repair
(Traversal Confidence) and overlapping NEW TAKE already exist.

P1 adds `Director.intent()` **before** step 3 when the Session may
continue a previous journey.

1.  `createNewProject()` / `createNewProjectFromSession()` —
    `web/src/project/new-project.ts`
2.  Set `project.story` from the Agent Send
3.  Generate A if needed — **or** inherit the previous completed
    Project's final accepted canonical as A (Continue)
4.  `directorPlanRequestFromProject` → Director
5.  `projectWithDirectorPlan` / `applyDirectorPlanToStoryboard` —
    `web/src/project/storyboard.ts`
6.  Sequential construct + CM + Traversal-Confidence END repair
    (`runJourneyAgent`); P0: CM OG vs Pull Forward per traversal
7.  NEW TAKE as each inbound pair is established (`shootJourney`)
8.  `requestExportMovie` of currently selected Takes
9.  Update the Session JourneyTurn (`completed` / `failed`); write
    `continuedFrom` when this Project continues another

Do not call Camotion or `composeShootingPrompt` from Agent.
`web/shoot-journey.ts` already does.

LOOP (exact-A close) is **not** on this checklist. It is backlog:
[BACKLOG.md — Agent LOOP option](BACKLOG.md#agent-loop-option).

Parallel NEW TAKE filming is **not** on this checklist. JourneyAgent
already launches NEW TAKE as soon as a segment is established;
provider-aware concurrent submit (Runway THROTTLED queue, not a TV
cap) remains backlog:
[BACKLOG.md — Parallel segment filming](BACKLOG.md#parallel-segment-filming).

---

## Appendix B — Honest scope if the clock is slipping

Drop in this order (event work only):

1.  color continuity / finishing (P2)
2.  GWM / Worlds
3.  Model Router if it is not already helping the demo
4.  Discover ≥720p harvest
5.  Continue Journey (keep P0)
6.  extra visible decision chrome (keep concise CM status)

Never drop: existing Agent Send → existing JourneyAgent, CM OG vs
Pull Forward per traversal, failure-driven technique switch,
assembled movie playing on the journey card, Project independently
openable in Director / Shoot.

Do not spend slipping time implementing JourneyAgent, Agent UI,
session browsing, or chained-video export.
