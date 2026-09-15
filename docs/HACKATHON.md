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
-   [BACKLOG.md](BACKLOG.md) — Agent / repair / DISCOVER / Runway items
-   [DATA_MODEL.md](DATA_MODEL.md) — CameraMotionPlan v1 only
-   [RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md) — GWM Worlds 2 notes;
    hypothesis only

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

Do **not** begin DISCOVER, Camotion redesign, a Plan | Shoot
rewrite, or a new JourneyAgent from this file on event day.
JourneyAgent is pre-hackathon product work.

---

## Mission

Build a new, extremely focused agentic TunnelVision experience during
the hackathon.

The hackathon application should demonstrate:

> Describe a journey. An AI filmmaker directs it, constructs the
> destinations, plans and shoots the traversals, critiques/repairs
> its own work, and delivers the completed movie.

This is **not** a rewrite of TunnelVision.

The existing TunnelVision application and filmmaking engine are the
research, experimentation, and reusable technology developed before
the hackathon.

Hackathon narrative:

> TunnelVision already had an autonomous filmmaking agent. At the
> Runway hackathon, we made that filmmaker adaptive: instead of
> hard-coding generation models, TunnelVision uses Runway's
> model-routing infrastructure to choose the right model for each
> filmmaking task and escalate quality when a shot or destination
> needs repair.

TV already decides **what** filmmaking task needs to happen
(construct this destination, shoot this A→B, retry with higher
quality). Runway Model Router decides **which eligible model**
should perform that task. That is a stronger integration story than
replacing Replicate endpoints with named Runway models.

Hackathon-day work creates a **new application in this same
repository** that uses that technology as a filmmaking library.

Core principle:

``` text
TWO APPS.
ONE FILMMAKING ENGINE.
RUNWAY MODEL ROUTER AUGMENTS THAT ENGINE.
IT DOES NOT REPLACE DIRECTOR, CM, CAMOTION, OR JOURNEYAGENT.
```

The existing Plan | Shoot filmmaker workstation remains intact.

``` text
JourneyAgent        = reusable TunnelVision product capability,
                      built and validated in existing AGENT mode
                      BEFORE the hackathon.
Hackathon Agent app = new conversational Runway-powered expression
                      of that capability, built DURING the hackathon.
```

The hackathon should **not** depend on implementing the filmmaking
Agent itself in 5–6 hours. On event day, the new application
**reuses** the already-working JourneyAgent.

The hackathon app is a radically simplified agentic client.

It must still create and update a real TunnelVision `Project` while
it works. The conversational surface is another filmmaking surface,
not a separate movie/session format: its project output must open
directly in the full Plan | Shoot workstation. It must preserve the
complete generated journey state, including every Take alternative
and the selected Take for each segment, so the filmmaker can inspect
alternatives, continue production, create new Takes, and export a
different cut from the workstation.

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
| Current adapters | `media/src/replicate/*` only. **No Runway package exists.** Event-day work adds `media/src/runway/` behind the same contracts, with **Model Router as the primary generation path** and direct model calls as fallback. |
| Image catalog | `media/src/replicate/image-models.ts` — Nano Banana 2 Lite default; Nano Banana 2 opt-in |
| Video catalog | `media/src/replicate/video-models.ts` — Pruna default; Kling / Wan / Seedance opt-in |

### Existing UI to copy or wrap (do not extract a design system)

| Surface | Actual location |
| --- | --- |
| Conversation turn history | `web/src/app/ConversationRail.tsx` |
| Journey prompt composer | `web/src/app/ProjectRail.tsx` — `composerDraft` textarea, **not** a chat box |
| CREATE JOURNEY | `ProjectRail` button → `planWithDirector()` |
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
| Agency toggle DIRECTED / AGENT | **Exists.** AGENT hides Options. CREATE JOURNEY in AGENT mode runs JourneyAgent (`web/src/project/journey-agent.ts`) on the shared Project. Validate and extend it here before the event. |
| `JourneyAgent` orchestrator | **Exists (happy path + experimental sequential canonical repair).** Shared module: establish A, DIRECT, then GENERATE → CM → REPAIR END → ESTABLISH → launch NEW TAKE → ADVANCE per destination. Footage may overlap later canonical work. Export Movie after all Takes. Hackathon day **reuses** it; do not reimplement the filmmaking Agent in the 5–6 hour window. |
| LOOP (close on exact canonical A) | **Does not exist.** BACKLOG. Explicit Agent/project option; not inferred from the Journey Prompt. Reuse opening A’s media as the final destination so N→A is a normal CM / Camotion / Take. Not event-day. See [BACKLOG.md — Agent LOOP option](BACKLOG.md#agent-loop-option). |
| Parallel segment filming | **Partial.** JourneyAgent launches NEW TAKE as soon as a segment is established and awaits all Takes before concat in storyboard order. Provider-aware concurrent filming (Runway THROTTLED/PENDING is wait, not fail; other adapters may bound locally) remains BACKLOG. JourneyAgent must not assume a universal 2/3 cap. Not event-day. See [BACKLOG.md — Parallel segment filming](BACKLOG.md#parallel-segment-filming). |
| Conversational journey development | **Does not exist.** Chat is not implemented. ConversationRail is read-only history. |
| CM `SHOOT` / `RESHOOT_END` | **Exists (experimental).** CM assessment JSON returns a repair recommendation plus `repairInstruction` for the new END. JourneyAgent uses experimental score gates (Set < 60 or Traversal < 30), reshoots only that END (max 2), then continues. Established START is not rewritten. Dial-back of thresholds is still open. Not event-day work. |
| Opposite-canonical visual reference on repair | **Exists (experimental).** Agent END repair uses the established START still as the image/spatial source (and extra Nano Banana `image_input` when that still is not already the source). Flux ignores extra refs. Not event-day. |
| Footage Evaluator | **Does not exist** as product. Experimental Shot Evaluator is isolated research under `media/experiments/forest-a-to-f/`. Do not promote it. If a product evaluator exists by event day, JourneyAgent should already use it. |
| Movie-evaluation preprocessor | **Does not exist** as product. |
| Runway adapters | **Do not exist.** `GeneratedVideo.provider` / `GeneratedImage.provider` / `ReasoningResult.provider` are currently the literal `"replicate"`. Event-day work adds `media/src/runway/` with **Model Router as the primary generation path** and named direct-model calls as fallback. |
| DISCOVER | **Does not exist.** `Project.construction` includes `"discovery"` but it is unwired. Do not expose it. |
| Destination-aware Camotion field | **Backlog.** Product already applies adaptive weights: pace × depth × dest protect × VP protect on the frozen radial field. Do not retune. |
| Durable project persistence | **Does not exist.** Session/dev-runtime media only. When implemented, it must use one canonical TunnelVision project format shared by the workstation and JourneyAgent; the hackathon app may not create a separate project/session format or isolated movie artifact. |

Directed Options (generate all, auto-shoot) are
**not** AGENT. They automate filmmaker clicks inside Directed.
[BACKLOG.md](BACKLOG.md) is explicit: AGENT owns the loop, including
when to repair, when to continue, and when to export.

Reuse those *operations* inside pre-hackathon JourneyAgent. Do not
ship the hackathon demo as “flip three checkboxes and press CREATE
JOURNEY,” and do not reimplement the loop on event day.

---

## 1. Hackathon-day product

The hackathon application is essentially **one screen**.

It should visually derive from the current Director / conversation
experience (`ConversationRail` typography, stamps, tokens), but the
conversation becomes the **full primary viewport**.

No PLAN | SHOOT workstation.

No Inspector (`web/src/app/Inspector.tsx`, `DestinationInspector.tsx`).

No Project settings / provider chooser. Router configs live in the
Runway Developer Portal (and env vars), not in hackathon UI.

No manual canonical editing, storyboard kebab, drop-to-replace.

No manual MOTION / FOOTAGE controls.

No Debug / Camotion overlay chrome.

The hack app should feel like talking to an autonomous AI filmmaker.

**Repo adaptation:** add a second Vite entry beside the existing app.
Do **not** split the repo into `apps/tunnelvision/` and
`apps/tunnelvision-agent/`. Preferred shape:

``` text
web/index.html              existing Plan | Shoot
web/src/main.tsx
web/src/App.tsx
web/src/app/Shell.tsx

web/agent.html              NEW hackathon entry
web/src/agent/main.tsx      NEW
web/src/agent/AgentApp.tsx  NEW
```

JourneyAgent is **not** a file invented inside the hackathon entry.
Implement it in the existing product (AGENT mode) and import it.

Share `web/src/project/*`, `media/`, Camotion CLI, and the existing
Vite middleware plugins in `web/vite.config.ts`. Duplicate a tiny
presentational wrapper if extracting `ConversationRail` would risk
the workstation.

---

## 2. Initial experience

Start with a large conversational interface.

Opening invitation:

> What journey do you want to create?

The filmmaker may:

**A.** paste a complete Journey Prompt immediately and proceed

or

**B.** conversationally develop the idea with the Agent

Example:

``` text
USER:
I want something creepy involving an abandoned amusement park.

AGENT:
Do you want it grounded and physically plausible, or should it
become increasingly surreal?

USER:
Start real and become completely impossible.
```

The conversation resolves toward `Project.story` (the existing Journey
Prompt field).

Do **not** require conversational planning. A filmmaker who already
knows the journey pastes the prompt and presses CREATE JOURNEY.

**Repo adaptation:** there is no chat composer today. Build one only
in the hackathon app. It writes filmmaker `ConversationEntry` rows
(`web/src/project/conversation.ts`) and updates `Project.story` the
same way `composerDraft` does. Optional refinement turns may call
`ReasoningProvider` (`media/src/reasoning/types.ts`, Gemini 3.1 Pro
via `media/src/replicate/reasoning.ts`) to ask one or two story
questions. That is **not** Director planning and **not** a
Screenwriter role ([AGENTS.md](AGENTS.md) — do not create
`ScreenwriterAgent`).

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

## 4. CREATE JOURNEY

Once a usable Journey Prompt exists, expose one primary action:

**CREATE JOURNEY**

This is the key transition.

``` text
Before CREATE JOURNEY:  CONVERSATION / INTENT
After CREATE JOURNEY:   AGENT EXECUTION
```

The user should not make additional filmmaking decisions during
normal execution.

**Wire this to the existing pre-hackathon `JourneyAgent`, not to
Directed Options and not to a new event-day orchestrator.**

Existing CREATE JOURNEY (`planWithDirector`) already:

1.  generates unresolved A unless A is already actual
2.  optionally derives a story from actual A if `story` is empty
    (`requestDirectorStory` / `directorStoryRequestFromProject`)
3.  runs Director (`requestDirectorPlan` /
    `directorPlanRequestFromProject`)
4.  optionally constructs B…N
5.  optionally auto-blocks (redundant with automatic Motion Planning)
6.  optionally auto-shoots

Pre-hackathon JourneyAgent must own that sequence plus repair
policy, evaluation policy, and automatic export. Setting
`agency: "autonomous"` is not enough; AGENT mode is where that
orchestrator is built and proven.

For the hackathon app, CREATE JOURNEY should:

-   require a non-empty `Project.story` (or finish conversational
    refinement first)
-   generate A if it is not already actual
-   leave destination count on `storyDuration: "auto"` unless the
    filmmaker already typed a number
-   then enter the Agent state machine

Do not show Destinations / Options / Image / Video / Debug.

---

## 5. Agent layer

`JourneyAgent` is **pre-hackathon product work**. Implement and
validate it in the existing application’s AGENT mode before the
event. The hackathon app imports that same orchestrator. Do not
reimplement it under `web/src/agent/` on event day.

It owns:

-   execution state
-   progress / activity events
-   failure / retry policy
-   repair decisions (when those operations exist)
-   final completion / export

Conversational journey development (the full-screen chat) is
hackathon-app UI. It feeds `Project.story` / CREATE JOURNEY; it is
not a second filmmaking Agent.

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
  → REPAIR END IF NECESSARY
  → ESTABLISH / ADVANCE
  → (repeat until the journey is complete)
  → CAMOTION
  → VIDEO GENERATION
  → ASSEMBLY
  → COMPLETE
```

Agent is **not** a fourth filmmaking role. Director still decides
WHERE. CM still decides HOW to shoot the actual pair. Camotion is
still deterministic. Video still films.

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
  → EVALUATING_FOOTAGE      │
  → REPAIRING_FOOTAGE? ─────┤
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
-   If experimental gates trip, reshoot only that END (max 2) using
    the established START as spatial reference.
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
or failure.

If a Footage Evaluator exists by hackathon day, use its evidence to
decide whether generated footage should be accepted or retried.

If **no** Footage Evaluator exists by hackathon day, rendered /
playable footage may be accepted as a **pragmatic hackathon
fallback** so the autonomous pipeline can complete. That fallback
is **not** the intended long-term JourneyAgent evaluation policy.

Shootability is already documented as advisory and does **not** gate
`JourneyShot.status` ([PRODUCT.md](PRODUCT.md), [AGENTS.md](AGENTS.md)).
Keep that.

---

## 11. Footage Evaluator

**Product Footage Evaluator does not exist.**

Two questions stay distinct:

| Role | Question |
| --- | --- |
| Cinematographer | Can this canonical pair plausibly be shot? (set) |
| Footage Evaluator | Did the generated clip actually work? |

If a product Footage Evaluator exists by hackathon day, JourneyAgent
uses that evidence to accept or retry footage. Do **not** invent new
thresholds or evaluator behavior here.

If none exists, rendered / playable footage (`JourneyShot.status ===
"rendered"` and a playable `videoUrl`) may be accepted as a
**pragmatic hackathon fallback** so the pipeline can complete. Retry
the same `shootJourney` once on provider failure. That fallback is
**not** the intended long-term JourneyAgent evaluation policy.

Do **not** port
`media/experiments/forest-a-to-f/cinematographer-shot-evaluation.ts`
into a filmmaking role.

If a product evaluator exists by event day, reuse it. Useful
dimensions then: traversal continuity, spatial continuity, canonical
arrival, story progression, cheating, cuts / dissolves / teleport,
excessive morph, reverse motion, Camotion artifacts, shot quality.

Outcomes: `ACCEPT` | `REVIEW` / `RETRY` | `RESHOOT` / `REPAIR`.

Do not build a complex new evaluator during the hackathon.

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

This pass does **not** build `media/src/runway/` or the hackathon
app. It freezes verified capabilities vs event-day assumptions.

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

**Repair + Router (architecture).** TV Agent/CM/Evaluator decide
what failed, why, whether to repair canonical vs footage, which
endpoint (START / END / BOTH / footage), and which **policy**
(draft vs quality). Adapter maps policy → `configId`. Router
picks the eligible model. If S/E is mandatory and the routed
choice is wrong, skip Router for that retry.

**Provider readiness (this pass).**
`GeneratedVideo.provider` / `GeneratedImage.provider` /
`ReasoningResult.provider` are now `string` so a Runway adapter
can emit `"runway"` without a domain rewrite. Replicate adapters
still write `"replicate"`. Do **not** add `@runwayml/sdk` or
`media/src/runway/` until hack day (or a dedicated integration
PR). Keep Director/CM/Camotion free of `configId`. Map Runway
task `id` onto today’s `predictionId`. Persist `routing.model`,
`optimizeFor`, and credits in `metadata` only.

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
| Auth / version | Bearer `RUNWAYML_API_SECRET`; header `X-Runway-Version: 2024-11-06` |
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

Do **not** move Director, CM, Camotion, evaluation, or retry
orchestration into Runway. Router augments TV’s filmmaking
intelligence; it does not replace it.

### 14.3 TV tasks → router policies

Map filmmaking tasks onto **config IDs**, not model IDs. Create
these configs in the Developer Portal (or `POST /v1/routers`) once;
the adapter only passes `configId` + `input`.

Suggested configs (names are ours; settings are documented):

| TV policy | Router config (example ID) | Verified settings | Use |
| --- | --- | --- | --- |
| DRAFT / FAST | `tv-draft` | `optimizeFor: latency` (or `cost`); optional lower video `720p` / image `1k`; tighter credit ceiling | Previews, early construct/shoot, first attempt before evaluation |
| FINAL / QUALITY | `tv-final` | `optimizeFor: quality`; video `1080p` and image `2k` when the request needs them | Accepted canonicals, accepted footage, quality retries |
| (optional) CHEAP | `tv-cheap` | `optimizeFor: cost` + credit ceiling | Only if latency-optimized draft is still too expensive |

Do not claim a “low-res vs high-res router type.” Resolution is an
**`input` field** that also filters eligibility. The same `tv-draft`
config can receive `720p` on a first shoot and `tv-final` can
receive `1080p` on a quality retry.

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
    kept the source composition (existing construct prompt + any
    pre-hackathon evaluator).
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
    Footage Evaluator / pragmatic fallback — not a Router setting.
-   Escalate: first shoot on `tv-draft`; on `RETRY` / failed
    evaluation, reshoot through `tv-final` (same A′/B′, quality
    policy).

**CM / Agent repair loop**

Repair operations themselves remain pre-hackathon product work
(§9). Router does not become a second Agent.

When JourneyAgent already retries:

-   CM/Agent diagnose **why** a generation failed and **what** retry
    is needed (RESHOOT_END, construct retry, footage retry).
-   JourneyAgent chooses the **task and quality policy** (first
    attempt vs escalate). It does **not** pass a `configId` or
    model name.
-   The Runway adapter maps first attempt → `RUNWAY_ROUTER_DRAFT`
    and quality retry → `RUNWAY_ROUTER_FINAL`.
-   Example: a fast/draft A→B fails evaluation → Agent requests
    another shoot of the same Camotion-conditioned pair; the adapter
    calls the quality-oriented router. Canonical repair may
    similarly escalate from a fast image generation to a stronger
    reference-adherent / high-quality route.
-   Log `routing.model` and credits on the take for debugging; do
    not show them in the hackathon UI.

If no repair/evaluator loop exists by event day, do **not** invent
one so Router has something to escalate. **Assumption:** call
`tv-final` for the demo movie so accepted stills and footage are
quality-oriented; keep `tv-draft` wired for when retries exist or
for dry-run / smoke tests.

### 14.4 Adapter implementation

Desired hackathon configuration:

| Role | Preference |
| --- | --- |
| LLM / reasoning | Keep Gemini 3.1 Pro unless the event adds a Runway LLM |
| Image generation / edit | Runway **Model Router** (`/v1/generate/image`); direct `text_to_image` fallback |
| Video generation | Runway **Model Router** (`/v1/generate/video` with first+last); direct `image_to_video` fallback |

Do not compromise Agent architecture merely to claim every call uses
Runway. Director and CM are reasoning jobs.

Implement Runway as adapters:

``` text
media/src/runway/                 NEW
media/src/runway/provider.ts      MediaProvider / ImageEditProvider
media/src/runway/router.ts        configId + generate.image/video
```

Env (same pattern as `media/src/config/environment.ts`):

-   `RUNWAYML_API_SECRET`
-   `RUNWAY_ROUTER_DRAFT` — default `tv-draft`
-   `RUNWAY_ROUTER_FINAL` — default `tv-final`

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
4.  credentials (`RUNWAYML_API_SECRET`), rate limits, credit budget
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
and retry policy, Runway Model Router chooses the eligible model,
the generator films.

Do not confuse `gwm1_avatars` (real-time conversational avatars
on the current catalog) with GWM Worlds 2. Avatars are not
canonical or traversal generation.

---

## 17. DISCOVER

**OPTIONAL STRETCH. Not required for submission.**

DERIVE (current Construct): next canonical from Director intent,
conditioned on the preceding actual still.

DISCOVER: next canonical emerges from generated traversal.

Possible loop:

``` text
shoot A→B
  → inspect a useful ending frame
  → normalize / promote to canonical B
  → continue B→C
```

`Project.construction: "planned" | "discovery"` already exists and
is **unwired**. Do not expose DERIVE / DISCOVER in the UI.

DISCOVER becomes interesting if Runway ships strong continuation,
persistent worlds, or reliable final-frame extraction.

Do **not** start DISCOVER until Definition of Done is green.
Do not enter the CM reshoot loop merely because a discovered B
differs from a planned B. Emergence is the point.

Agency (DIRECTED vs AGENT) stays orthogonal to DERIVE vs DISCOVER.

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

Hackathon UI should be cinematic, minimal, conversational, visibly
agentic, immediately understandable, and visually related to
TunnelVision.

Avoid dashboards, configuration, inspectors, engineering / debug UI,
model selectors, exposed schemas, and manual workflow controls.

``` text
User writes idea.
Agent makes movie.
User watches filmmaking happen.
Movie appears.
```

---

## 20. Reuse existing UI

Inspect `web/src/app/` before creating components.

Prefer reusing typography, tokens, conversation stamps, storyboard
tiles, `Preview` video element, `ProgressSpinner`, buttons, and the
generating shimmer.

Create hack-specific components only where the interaction differs
(full-viewport chat, CREATE JOURNEY as the sole chrome, inline
storyboard, final video).

Do **not** destabilize Plan | Shoot while extracting. Duplicating a
tiny tile is better than a risky refactor during the hackathon.

---

## 21. Repo strategy

Keep both applications in **this** repository.

Do not create a separate repository unless event rules require it.

Conceptual organization (do **not** perform this refactor):

``` text
apps/tunnelvision/
apps/tunnelvision-agent/
shared/core  → already media/ + camotion/ + web/src/project/
shared/ui    → do not extract
```

**Actual organization to use:**

``` text
web/                 both apps (second HTML entry)
web/src/project/     shared operations + pre-hackathon JourneyAgent
                     (developed in existing AGENT mode)
web/src/agent/       hackathon conversational UI only
media/               shared engine + new media/src/runway/
camotion/            unchanged
```

Goal: two applications, one filmmaking engine, one JourneyAgent,
minimal duplication.

Leave `web/src/app/Shell.tsx` and Plan | Shoot working. Existing
AGENT mode is the pre-hackathon JourneyAgent workbench. A developer
may still open `/` for Directed debugging. The demo URL is
`/agent.html` (or whatever the second Vite entry is).

---

## 22. What counts as hackathon-day work

Be transparent if presenting:

The filmmaking primitives and JourneyAgent came from prior
TunnelVision work (including pre-hackathon AGENT-mode validation).

The hackathon project is a new conversational Runway-powered
expression of that already-working JourneyAgent.

Concentrate that day on:

1.  credentials, org access, newly announced models, and Router
    availability / config IDs (public API is already in §14)
2.  Runway **Model Router** adapters (direct-model fallback)
3.  new full-screen conversational Agent application
4.  presentation of JourneyAgent execution / activity
5.  final movie presentation
6.  event-specific opportunities / polish

Do **not** implement JourneyAgent on event day.

---

## 23. Target 5–6 hour schedule

Treat this as a hard timebox.

Assume pre-hackathon JourneyAgent already executes the unattended
workflow in existing AGENT mode. Event-day risk is Runway adapters
and the new conversational UI, not the filmmaking Agent. If Runway
or the new UI slips, drop DISCOVER and polish first. Do not start
implementing JourneyAgent during this window.

### 0:00–0:30 — Event / API reconnaissance

Read hackathon requirements and the event packet.

Reopen [docs.dev.runwayml.com](https://docs.dev.runwayml.com/) only
for changelog / newly announced models. Do **not** rediscover the
public API from scratch.

Confirm:

-   `RUNWAYML_API_SECRET` and credit / rate limits
-   Model Router access; create or note `tv-draft` / `tv-final`
    (`optimizeFor: latency` vs `quality`)
-   which models this org actually enables
-   anything unique to the hackathon (new model, LLM, world-model)

Keep Gemini for Director/CM unless a Runway LLM appears.

Do not code speculative features. Do not spend this block picking
a single image model and a single video model as the integration
strategy.

### 0:30–1:30 — Runway integration

Implement / configure Runway adapters behind `MediaProvider` /
`ImageEditProvider`. Primary path: `client.generate.image.create`
/ `client.generate.video.create` with `configId`. Fallback: named
`textToImage` / `imageToVideo`.

Verify independently (prefer `dryRun` HTTP first, then one live
call each):

-   image through the draft and final routers
-   image with a reference still (construct B)
-   video with `first` + `last` (A′/B′)
-   that `routing.model` is populated and the pool is not empty

One minimal smoke test. Then stop.

### 1:30–2:30 — Hack application shell

Second Vite entry.

Build:

-   full-screen conversation
-   Journey Prompt (paste or short refine)
-   CREATE JOURNEY
-   inline storyboard container
-   final video location

Reuse existing UI. Do not polish.

### 2:30–3:30 — Agent UI integration

Connect CREATE JOURNEY in the new conversational app to the
**existing** JourneyAgent.

Subscribe / render its execution events.

Show Director, canonical generation, CM, repair, shooting,
evaluation, and assembly activity conversationally.

Do **not** reimplement those operations.

This is the critical milestone: the new UI drives the already-working
Agent through a visible unattended journey.

### 3:30–4:30 — End-to-end testing and failure handling

Run more than one journey.

Fix provider mismatches, async / state bugs, missing assets,
assembly failures, UI dead states.

Prefer robust UI / provider fallback and completing the pipeline
over new features. Do not invent footage-evaluation policy on
event day.

### 4:30–5:15 — Demo polish

Pacing of activity messages, storyboard appearance, final video
presentation, loading states, title / branding, obvious rough edges.

Do not change filmmaking algorithms.

### 5:15–6:00 — Buffer / event-day opportunity

Use for unexpected integration problems, **or** if the core works:

-   a compelling newly announced Runway capability
-   DISCOVER experiment
-   demo recording / presentation prep

Never sacrifice the working core demo for stretch work.

---

## 24. Definition of done

The hackathon product is **DONE** when:

1.  User opens the one-screen agent experience.
2.  User describes a journey.
3.  Optional conversational refinement works (or can be skipped).
4.  User presses CREATE JOURNEY.
5.  That action drives the **existing** JourneyAgent (not a
    hackathon-day orchestrator).
6.  Director creates a journey.
7.  Storyboard visibly populates.
8.  Canonicals are generated through Runway **Model Router**
    (named direct-model fallback only if a router is unavailable
    or has no eligible model).
9.  CM plans actual adjacent canonical pairs (existing automatic
    Motion Planning).
10. Camotion conditions shots (existing product path).
11. Runway **Model Router** generates traversals with start+end
    frames when both A′ and B′ exist.
12. JourneyAgent handles repair / retry / evaluation using the
    pre-hackathon product path (evaluator if available; otherwise
    the pragmatic footage fallback in §10–11).
13. Progress is visible conversationally from JourneyAgent events.
14. Accepted footage is assembled (`requestExportMovie`).
15. Final movie appears in the conversation.
16. No manual filmmaking intervention was required after CREATE
    JOURNEY.

That is the submission. Everything else is optional.

---

## 25. Explicit non-goals

Do **not** spend hackathon time on:

-   redesigning Plan | Shoot
-   rewriting Camotion
-   tuning CM prompts without a demonstrated failure
-   in-app model bakeoffs (configure routers in the Developer
    Portal instead; do not hard-code a winner into JourneyAgent)
-   moving Director / CM / Camotion / evaluation / retry
    orchestration into Runway
-   creating a parallel hack-app Agent
-   replacing `shootJourney` with Multi-Shot Video
-   manual filmmaking controls
-   Inspector improvements
-   project-management UI
-   durable persistence
-   accounts / collaboration
-   elaborate settings
-   responsive perfection
-   arbitrary animations
-   named canonicals
-   filmmaker-adjustable D
-   CM-selected duration
-   generalized plugin architecture
-   speculative world-model abstractions
-   DISCOVER before core completion
-   implementing JourneyAgent (pre-hackathon product work)
-   Screenwriter
-   promoting the experimental Shot Evaluator
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
    chooses filmmaking tasks and retry policy.
-   Agent orchestrates existing typed operations rather than
    duplicating them.
-   Footage evaluation is distinct from pre-shoot CM evaluation.
-   CREATE JOURNEY is the only Director invocation in Directed; AGENT
    may call Director as part of its own loop.
-   Session conversation is not project persistence.

---

## 28. Event-day instruction to Cursor

At the beginning of hackathon implementation:

1.  Read this entire file.
2.  Inspect the current repository state.
3.  Read current architecture / product / backlog documentation.
4.  Inspect the pre-hackathon JourneyAgent in existing AGENT mode.
    If it is missing or cannot run the unattended loop, stop and
    report that discrepancy; do not implement a parallel Agent in
    the hackathon app.
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
-   optimize for an end-to-end working conversational demo of the
    existing JourneyAgent
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

The demo should be understandable without explaining the architecture
first.

Show:

1.  Empty conversational TunnelVision Agent.
2.  Type a short, imaginative Journey Prompt.
3.  CREATE JOURNEY.
4.  Watch destinations appear.
5.  Watch the Cinematographer analyze shots.
6.  Ideally show one visible autonomous repair / reshoot (only if
    that loop exists).
7.  Watch footage complete.
8.  Final movie appears.
9.  Play the movie.

Then explain:

> The filmmaker only described the journey.
>
> TunnelVision's Director decided where the movie needed to go.
>
> Its Cinematographer inspected the actual generated locations and
> figured out how to physically shoot between them.
>
> Camotion conditioned those shots for movement.
>
> Runway’s Model Router chose the generation model for each
> filmmaking task — and could escalate from a fast route to a
> quality route when a destination or shot needed to land.
>
> The Agent evaluated the results, repaired weak shots when it
> could, and assembled the movie.

That is the product story.

---

## 30. Stretch priority

**Only after Definition of Done:**

1.  exploit a compelling new Runway capability
2.  DISCOVER
3.  richer Agent conversation
4.  visual polish

Do not reverse this order.

---

## Appendix A — Operation checklist for JourneyAgent

Pre-hackathon shopping list for the product JourneyAgent (existing
AGENT mode). The sequencer now lives in
`web/src/project/journey-agent.ts`. The hackathon app only calls this
Agent. Repair / reshoot is still missing; do not reimplement the
happy path on event day.

1.  `createNewProject()` — `web/src/project/new-project.ts`
2.  Set `project.story` from the conversation
3.  Generate A if needed — opening path in `ProjectProvider` /
    `starting-frame.ts`
4.  `directorPlanRequestFromProject` → Director
5.  `projectWithDirectorPlan` / `applyDirectorPlanToStoryboard` —
    `web/src/project/storyboard.ts`
6.  Loop `nextConstructableDestinationId` +
    `destinationConstructionRequestFromProject`
7.  Wait for automatic Motion Planning on each new adjacent pair
8.  `shootJourney` for each `JourneyShot` with a current
    `motionPlan`
9.  `requestExportMovie`
10. Append a final conversation turn with `videoUrl`

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

Drop in this order (hackathon UI / event work only):

1.  conversational refinement (keep paste-prompt only)
2.  extra visible repair / evaluation chrome
3.  DISCOVER
4.  polish

Never drop: Runway **Model Router** image + video (direct-model
fallback only if Router is unavailable), CREATE JOURNEY → existing
JourneyAgent, visible storyboard / activity, assembled movie in
the conversation.

Do not spend slipping time implementing JourneyAgent.
