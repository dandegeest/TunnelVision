# Seedance 2.5 Draft → Final — hack-day contingency

**24 September 2026. Documentation only. Code freeze stays in force.**

This plan exists so TunnelVision can move on 30 September if Runway
Dev exposes the Draft workflow that was exercised by hand in the
Runway web app. It is not permission to implement.

The priority board in [HACKATHON.md](HACKATHON.md) remains the plan
until the [implementation gate](#implementation-gate) passes. If the
gate passes, the priorities in this file replace that board for the
day. If it fails, keep the current Replicate Seedance shoot path.

---

## Critical statement

> TunnelVision can finish the movie creatively in Draft quality,
> lock selected takes, and then finish those exact takes at
> production quality.

**Status: EMPIRICALLY SUPPORTED IN RUNWAY APP. NOT YET VERIFIED FOR RUNWAY DEV/API.**

Do not treat the manual observation as an API guarantee. When official
SDK or API documentation exists, reclassify this statement as one of:

- VERIFIED
- PARTIALLY VERIFIED
- NOT VERIFIED
- FALSE

---

## 1. Empirical finding (Runway web app only)

A Seedance 2.5 Draft was created and then enhanced in the Runway web
app. These are observations, not API contracts.

- Draft output was not a cheap proxy in the sense of Pruna Fast. Visually and behaviorally it looked nearly identical to the Seedance 2.5 output TunnelVision already generates through Replicate.
- Runway then allowed that Draft to be enhanced / finalized at higher quality.
- The enhanced result appeared to preserve the same creative take: same camera path, same motion, same events, same composition and content.
- It did not appear to be a fresh stochastic reroll.
- Enhancement / finalization was faster than generating the preliminary Draft.

**Not yet known:** whether Dev/API exposes this at all, which identifier binds Final to Draft, whether preservation is guaranteed, or what it costs and how long it takes.

---

## 2. Why it matters

The Cinematographer has to accept, reject, reshoot, or change shooting
strategy (including OG versus Pull Forward) on generated traversals.
Spending final-quality time and money on takes that will be rejected
is the expensive part of an agentic shoot.

A cheap preview model does not solve that. A good Pruna / fast
traversal does not guarantee that a later higher-quality generation
reproduces the same camera movement, performance, geometry, timing, or
events. Preview take ≠ final take.

If Draft is the creative take and Final only finishes that take, the
agent can evaluate the thing that will actually ship.

**Draft is the creative take. Final is the finishing step.**

Do not describe Final as a new generation unless official API behavior
proves otherwise.

---

## 3. Preferred pipeline

Only if Runway Dev exposes the same Draft → Final semantics:

```text
STORY IDEA
    ↓
SCREENWRITER
    ↓
DIRECTOR
    ↓
CANONICALS
    ↓
CINEMATOGRAPHER          (still-pair plan, as today)
    ↓
A′ / B′
    ↓
SEEDANCE 2.5 DRAFT A→B
    ↓
CM EVALUATION OF THE DRAFT
    ↓
   / \
REJECT   ACCEPT
  |        |
diagnose   mark SELECTED
retry      start Enhance / Final
OG ↔ PF         |
  |             ↓
  └── new Draft FINAL A→B
                    ↓
               NEXT TRAVERSAL
```

Screenwriter keeps overall duration as story intent. Director uses
that language as journey scope. Neither role assigns per-shot
durations. Cinematographer still owns individual traversal timing
downstream. Draft/Final does not change that ownership.

---

## 4. How the Cinematographer uses a Draft

CM evaluates **Draft traversals**. Existing conceptual gates still
apply: Spatial Continuity and Travel, at the acceptance thresholds
already in the product.

If a Draft fails:

```text
CM diagnoses the failure
    ↓
retry the traversal
```

A plausible switch, when the diagnosis supports it:

```text
OG fails because spatial commitment is weak
    ↓
CM switches that traversal to Pull Forward
    ↓
new Draft
    ↓
evaluate again
```

The reverse is allowed when Pull Forward is the thing that failed.
Only an **accepted** Draft is promoted. Rejected Drafts are never
enhanced.

### Conflict with the current CM

Today’s Cinematographer scores the canonical still pair and the
shooting plan **before** a clip exists (`CinematographerAssessment`
on the journey: set consistency, traversal confidence, shootability).
The agent can reshoot a still from that assessment. There is no
post-generation footage evaluator. Footage Evaluator is explicitly
out of hack scope in [HACKATHON.md](HACKATHON.md).

Draft review is therefore a new use of those gates on the generated
clip, not a relabel of `assess-journey`. The smallest shape, if the
API lands, is:

1. Keep the existing still-pair CM and A′/B′ plan.
2. After a Draft succeeds, run a review of that clip.
3. Record the review on the take and in the conversation, using the
   assessment fields and agent-turn statuses that already exist.
4. Do not build a second cinematographer.

Per-traversal OG versus Pull Forward is still the hack-day P0
decision. The project Pull Forward toggle is not that feature.

---

## 5. Finalization should not block the agent

If the API allows it, enhancement is not a blocking filmmaking step.
Once CM accepts Draft A→B:

```text
mark the Draft SELECTED
start Enhance / Final asynchronously

A→B Draft accepted
    ├── Finalize A→B asynchronously
    └── continue later traversals whose canonicals already exist
```

The movie can become creatively complete in Draft quality first.
Final finishing can catch up during the journey or after it.

Do not implement concurrency now. This is the preferred architecture
only if the API can do it safely (stable Draft identity, independent
Final failure, no requirement that later work wait on the Final
bytes).

---

## 6. Demo safety

During a live demo:

1. TunnelVision creates Draft traversals.
2. CM evaluates them.
3. Bad takes can fail in view and be reshot.
4. Accepted takes accumulate.
5. The journey can play in Draft quality.
6. Accepted takes are enhanced as they are accepted, or afterward.

**A complete Draft movie is the safe demo floor. A completed Final movie is upside.** The demo must not fail because HD finishing has not finished.

Visible lifecycle, if the Agent UI grows one:

```text
DRAFT → CM REVIEW → SELECTED → HD RENDERING… → FINAL
```

Example status:

```text
Draft A→B generated
CM · Spatial 94 · Travel 91
SELECTED
HD RENDERING…
```

Later: `FINAL`.

Do not add that UI until the gate passes.

---

## 7. Revised hack-day priorities

**Only if** the [implementation gate](#implementation-gate) passes.
Until then, [HACKATHON.md](HACKATHON.md) wins.

### P0

1. Validate the frozen unattended DERIVE baseline.
2. Integrate Seedance 2.5 Draft generation.
3. CM evaluates the Draft.
4. Accepted Draft → Final / Enhance.
5. Rejected Draft → the existing retry / reshoot path.
6. CM per-traversal OG versus Pull Forward, including failure-driven switching.

### P1

7. Non-blocking finalization, if it is straightforward and safe.
8. Draft / Selected / Rendering / Final on the Agent journey card.
9. Model Router only if it strengthens this pipeline without breaking Draft → Final promotion.

### Stretch

10. Discover.
11. Color continuity.
12. Worlds / GWM experiments.
13. Other speculative model routing.

Discover is demoted, not deleted. Do not keep every previous hack
experiment at P0.

---

## 8. Model Router

Do not force Model Router into this architecture.

If Draft → Final is Seedance-specific, sending the accepted Draft to
another model can destroy the property that matters: the accepted
creative take is the final creative take.

**Draft/Final outranks Router.**

Router earns a place only if Runway can route while keeping
accepted-take identity, or if routing helps some other part of the
pipeline and does not touch promotion.

---

## 9. Discover

Discover stays interesting research. If Draft/Final exists in the
API, it is no longer the highest-value hack-day experiment.

The stronger story is autonomous filmmaking decisions over real
production takes, not autonomous exploration of unknown destinations.

Discover moves to stretch. It is not removed. The full harvest spec
stays in [HACKATHON.md](HACKATHON.md) §17 for a later day.

---

## 10. Product / demo story

TunnelVision uses Runway as an agentic filmmaking platform. The
system behaves like a small film crew:

| Role | Job |
| --- | --- |
| Filmmaker | Gives the Story Idea |
| Screenwriter | Conditions creative intent into the Production Prompt |
| Director | Decides where the movie goes |
| Cinematographer | Decides how each traversal should be shot |
| Runway Draft | Produces dailies / takes |
| Cinematographer | Reviews the actual takes; accepts, rejects, reshoots, or changes technique |
| Runway Final | Finishes selected takes |
| TunnelVision | Assembles the continuous journey |

Draft means **dailies / takes**. Enhancement means **finishing selected takes**.

---

## 11. Verification checklist

Before any implementation, answer these from official Runway Dev /
API / SDK docs. Manual app behavior does not check a box.

| # | Question | Status |
| --- | --- | --- |
| 1 | Is Seedance 2.5 Draft exposed through Runway Dev? | NOT VERIFIED |
| 2 | What model identifier is used? | NOT VERIFIED |
| 3 | What resolution is Draft? | NOT VERIFIED |
| 4 | What durations are supported? | NOT VERIFIED |
| 5 | What is Draft pricing? | NOT VERIFIED |
| 6 | What is Draft latency in practice? | NOT VERIFIED |
| 7 | How is an accepted Draft promoted, finalized, or enhanced? | NOT VERIFIED |
| 8 | Does Finalization reference the Draft task ID, asset ID, video URL, or another immutable generation identifier? | NOT VERIFIED |
| 9 | Does Finalization preserve camera path, motion, subject performance, composition, event timing, duration, and frame content? | NOT VERIFIED |
| 10 | Is Finalization deterministic relative to the Draft? | NOT VERIFIED |
| 11 | What final resolutions are supported? | NOT VERIFIED |
| 12 | What is Finalization pricing? | NOT VERIFIED |
| 13 | What is Finalization latency? | NOT VERIFIED |
| 14 | Can multiple Finalizations run concurrently? | NOT VERIFIED |
| 15 | Can Finalization run while TunnelVision continues later filmmaking? | NOT VERIFIED |
| 16 | Are Draft assets temporary or persistent? | NOT VERIFIED |
| 17 | Are there task expiration or asset-lifetime constraints? | NOT VERIFIED |
| 18 | Does the API expose status or progress useful for the Agent UI? | NOT VERIFIED |
| 19 | Can Finalization fail independently after a successful Draft? | NOT VERIFIED |
| 20 | If Finalization fails, can the same accepted Draft be retried without rerunning the creative generation? | NOT VERIFIED |

Reclassify each row as VERIFIED, PARTIALLY VERIFIED, NOT VERIFIED, or
FALSE when docs exist. Items 1, 7, 8, and 9 are the gate.

Known adjacent fact, already in [HACKATHON.md](HACKATHON.md): Runway
Dev output URLs expire in 24–48 hours and must be downloaded. Any
Draft or Final URL has to be copied into project media the same way
current takes are. That is not evidence that Draft promotion exists.

---

## 12. Likely integration seams

Inspected 24 September 2026. Not an implementation design, and not a
guess at SDK method names.

### Runway package — reuse the client, do not reuse frame-rate upscale

`media/src/runway/` already has:

- `RunwayDevClient` — token, `POST` helper, `GET /v1/tasks/:id`, ephemeral video upload (`client.ts`)
- `waitForRunwayTask` / `runwayTaskOutputUrl` — poll no faster than 5s, 10 minute timeout, `SUCCEEDED` / `FAILED` / `CANCELLED`, `progress` and cost fields already on `RunwayTask` (`tasks.ts`)
- `download.ts` — pull the output bytes
- `RunwayDevProvider.enhanceFrameRate` — the only generation method, model `enhance_frame_rate` on `POST /v1/video_upscale`

That provider is **not** a product `MediaProvider`. Journey shooting
still goes through Replicate (`media/src/replicate/*`,
`web/shoot-journey.ts`, `web/shoot-dev-plugin.ts`).

If Draft/Final appears, the smallest seam is new methods beside
`enhanceFrameRate` on the existing client and poller: create a Draft
task, poll it, request Final from the accepted Draft’s stable id,
poll that second task, download both. Do not point Final at
`enhance_frame_rate`. That endpoint changes frame rate. The 120fps
temporal-seam experiment that used it was abandoned.

Do not invent the path, body, or model string until the docs name
them.

### Shoot path — one take, two media stages

`web/src/project/shoot.ts` and `ProjectProvider.completeJourneyShoot`
append one `JourneyShotTake` and mark the journey `rendered`. A
failed shoot sets `shootError` and, as of the current product, leaves
a retryable take bar. That retry reshoots the creative generation.
It is the right hook for a rejected Draft. It is the wrong hook for
a failed Final, which must retry finishing the same Draft.

`JourneyShot.status` is production state (`ready`, `shooting`,
`rendered`, `failed`, …). Do not overload it with Draft / Final.
`JourneyShotTake` already stores `provider`, `model`, `videoUrl`,
`videoMediaId`, `providerOutputUrl`, canonical pair ids, the motion
plan, pace, and prompt. `generation` is an open record that
persistence already round-trips. That bag is the smallest place to
remember a Draft task id and a Final task id if implementation
starts. Agent-visible lifecycle (`draft`, `evaluating`, `rejected`,
`selected`, `finalizing`, `final`) needs an explicit field only if
the bag is too opaque for the UI. Do not add it now.

`selectedTakeId` already chooses which clip plays and exports. A
selected Draft can occupy that slot so the journey is playable
before Final bytes replace `videoUrl` / `videoMediaId`.

### Conversation and provenance

What we already persist, without a new provenance system:

| Fact | Where it lives today |
| --- | --- |
| Which clip was shot, and the provider / model | `JourneyShotTake` on the journey; mirrored on the shooting conversation entry (`kind: "shooting"`, status `shot` or `failed`) |
| CM still-pair scores | `journey.cinematographer` plus blocking conversation entries |
| Canonical reshoot / reevaluation | agent conversation entries (`evaluating`, `reevaluating`, scores before and after) |
| Which take is the cut | `journey.selectedTakeId` |
| Retry of a failed creative generation | `shootError`, `failedShootIntent`, a new take appended on success |
| Project-wide Pull Forward | `pullForwardReferenceEnabled` (not per traversal) |

Smallest later extension, if the gate passes:

- On the take’s `generation` record: Draft task id, Draft media id, CM review of that Draft, technique used for that take (OG or Pull Forward), Final task id, Final media id.
- On the shooting or agent conversation entry: the same review, so the Agent card can show Spatial / Travel without a new log.
- Keep the Draft file in the project even after Final replaces the selected clip, so a failed Final can be retried from the Draft bytes or task id. Current copy-into-project behavior (`videoMediaId`) is the pattern. Runway URLs expire.

Do not add a parallel pipeline or a second take type.

### Agent progress

`web/src/project/journey-agent.ts` is the unattended loop. A
non-blocking Final would be a task started when a Draft is accepted,
not a step the loop awaits before the next traversal. That is P1,
and only after synchronous Draft → accept → Final works.

---

## 13. What this plan does not change

- No production code.
- No Runway API calls and no paid generations.
- No speculative endpoints, SDK method names, or request bodies.
- No change to the Replicate Seedance path or to defaults.
- No UI.
- No Project schema change.
- Screenwriter still preserves duration as prose. It does not turn “45 seconds” into a destination count.
- Director still does not assign per-shot durations.
- Cinematographer still owns traversal timing. Draft/Final does not calculate a schedule.
- The frozen Replicate pipeline remains the known-good fallback.

---

## Implementation gate

**IMPLEMENT ONLY IF:**

- **A.** Runway Dev/API exposes Seedance 2.5 Draft.
- **B.** An accepted Draft can be promoted or finalized without creatively rerolling the traversal.
- **C.** The API gives a stable way to associate Final with its Draft.
- **D.** Latency and cost are reasonable for the hack demo.

If any of A–C fail: **keep the current Replicate Seedance pipeline.**

If A–D pass: **Draft/Final becomes hack-day P0**, and the priority
list in this file replaces the board in [HACKATHON.md](HACKATHON.md)
for that day.

Until then this statement stays:

**EMPIRICALLY SUPPORTED IN RUNWAY APP. NOT YET VERIFIED FOR RUNWAY DEV/API.**
