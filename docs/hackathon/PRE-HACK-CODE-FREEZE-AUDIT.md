# TunnelVision Pre-Hack Code Freeze Audit

Date: 2026-09-23

Starting commit inspected: `a715ec3` (`main` / `origin/main`)  
Documentation for this freeze pass is uncommitted at audit writing time (HACKATHON.md, BACKLOG.md, MemoryLane experiment report, this file).

## Executive status

**GREEN WITH KNOWN RISKS**

The frozen filmmaking baseline is coherent and matches the hackathon plan closely enough to take to San Francisco. JourneyAgent DERIVE, Adaptive Pace, Adaptive Durations, Camotion production path, project-level Pull Forward, gated +1 seam trim, camera grammar, Agent UI, Session/Project split, and Runway Enhance Frame Rate scaffolding are present and tested. Hackathon P0/P1 intelligence items (CM OG vs PF per traversal, Continue, Discover, Model Router) are correctly **not** implemented.

Known risks are documentation staleness and a few partial claims — none block validating unattended DERIVE on the frozen MemoryLane-class configuration. No discrepancy found that **requires** breaking code freeze before the event.

## Frozen baseline

Preferred hackathon demo / regression configuration (MemoryLane SOTA):

| Knob | Value |
| --- | --- |
| Project | MemoryLane `tv-50bd64f2d153a637` (evidence) |
| Grammar | POV |
| Video | Kling 2.5 (`kling-v2.5-turbo-pro`) · intent balanced |
| Adaptive Durations | ON |
| Adaptive Pace | OFF · CM journeyPace (MemoryLane: `slow`) |
| Pull Forward | ON (project toggle) |
| +1 seam | ON · SSIM ≥ 0.89 · MAE ≤ 5 |
| Selected takes | Take 4 family (Kling / balanced / slow) |
| Agent | Agent-directed / Agent-created |

Evidence: [2026-09-23 MemoryLane Adaptive Pace vs +1 seams](../experiments/2026-09-23-memorylane-adaptive-pace-seams/REPORT.md).

## Plan vs implementation matrix

| Area | HACKATHON.md says | Actual code | Status | Evidence / files |
| --- | --- | --- | --- | --- |
| JourneyAgent DERIVE path | Pre-hack: A → DIRECT → construct → CM → repair → Camotion → take → assemble | Same sequence in `runJourneyAgent` / `executeJourneyAgent` | MATCH | `web/src/project/journey-agent.ts` |
| JourneyAgent repair | TC &lt; 30 END repair, max 2 | `canonicalPairNeedsRepair` / END-only repair | MATCH | `web/src/project/journey-agent-repair.ts`, `journey-agent.ts` establishEndCanonical |
| JourneyAgent provider-failure retry | Agent owns “provider-failure retry” | Failed take clears task entry; post-loop relaunch if `canShootJourney` && no takes; still **fails assemble** if retry also fails (no infinite/provider-policy retry) | PARTIAL | `journey-agent.ts` `launchFootageFor`, await + relaunch ~576–591 |
| Adaptive Pace | (now documented DONE/PRE-HACK) ON default; OFF = one journey pace | `DEFAULT_ADAPTIVE_PACE=true`; OFF → `ensureProjectJourneyPace` / `chooseJourneyPace`; persist + invalidate | MATCH | `web/src/project/adaptive-pace.ts`, `cinematographer.ts`, `ProjectProvider.setAdaptivePace` |
| Manual Slow/Normal/Fast | No project-level pace selector | Project rail Adaptive Pace checkbox only; Inspector still has **per-traversal** filmmaker Pace lock | PARTIAL | `ProjectRail.tsx`; `Inspector.tsx` PaceControl |
| Adaptive Durations | Product adaptive \| fixed | `durationMode` adaptive default; CM desired → model map | MATCH | `web/src/project/shot-duration.ts` |
| Camotion pace → strength | Production | `CAMOTION_EXPOSURE_STRENGTH_BY_PACE` | MATCH | `media/src/cinematographer/camera-motion-plan.ts` |
| Camotion radial + protect | Production | radial-forward + destination protect | MATCH | `camotion/src/camotion/` |
| Camotion adaptive weights | BACKLOG says STARTED / weights | `--adaptive` default on in CLI | MATCH | `web/camotion-cli.ts` |
| Camotion `--depth` | BACKLOG Adaptive Camotion body: “Product shoot does not pass `--depth`” | Shoot path estimates depth and passes `--depth` when available | DOC STALE | `web/shoot-dev-plugin.ts`, `web/camotion-cli.ts`; `docs/BACKLOG.md` ~2195 |
| Destination-aware non-radial | Backlog / research | Not productized | NOT IMPLEMENTED — EXPECTED | BACKLOG Destination-aware Camotion |
| Pull Forward project toggle | Exists | Default ON; forwarded to construct/CM/motion/shoot | MATCH | `new-project.ts`, `pullForwardReferenceEnabledFromProject` |
| CM OG vs PF **per traversal** | P0 HACK — does not exist | No CM enum / per-journey OG\|PF agent decision | NOT IMPLEMENTED — EXPECTED | HACKATHON §4b; JourneyAgent uses project bool only |
| Failure-driven technique switch | P0 HACK | Not present | NOT IMPLEMENTED — EXPECTED | — |
| +1 seam gate | SSIM ≥ 0.89, MAE ≤ 5 | `DROP_OUTGOING_START_GATE` identical | MATCH | `web/src/project/drop-outgoing-start.ts` |
| +1 on selected Takes / export | Gated drop at assemble | Measure selected seams; export applies drop on concat paths | MATCH | `outgoing-start-drop.ts`, `export-movie.ts`, `ProjectProvider` seam effect |
| Camera grammar | POV / FOLLOW / LEAD / MOUNTED; one per journey | Project `cameraGrammar`; locked with story | MATCH | `web/src/project/camera-grammar.ts` |
| Mixed grammar | Deferred | Not implemented | NOT IMPLEMENTED — EXPECTED | — |
| Session vs Project | Session owns chat; Project owns journey authority; refresh → new Session; open Project ≠ rebuild Agent history | Matches; `?session=` can reload explicitly | MATCH | `ProjectProvider.tsx`, session persistence |
| Continue Journey | P1; not implemented; `continuedFrom` schema only | Schema only; Send always NEW Project when journey exists | NOT IMPLEMENTED — EXPECTED | `session.ts`; `planAgentJourney` |
| Discover | P1; `construction: discovery` unwired | Type scaffolding; always `planned` on create | NOT IMPLEMENTED — EXPECTED | `new-project.ts` |
| Agent UI | Existing Agent tab; rich chat | Single `AgentWorkspace`; no `/agent.html` | MATCH | `web/src/app/agent/`, `Shell.tsx` |
| Runway client + Enhance Frame Rate | Pre-hack DONE | `media/src/runway/` Enhance Frame Rate only | MATCH | `client.ts`, `enhance-frame-rate.ts`, `provider.ts` |
| Model Router | P1 if useful; not implemented | No router / `routing.model` | NOT IMPLEMENTED — EXPECTED | — |
| Autonomous stop / LOOP / parallel redesign / Prompt Coach / Shot Evaluator / 120fps product / continuous velocity / color / GWM | Deferred / OUT | Not required by DERIVE path | MATCH | Deferred systems table below |

### Status counts

| Status | Count |
| --- | --- |
| MATCH | 18 |
| PARTIAL | 2 |
| DOC STALE | 1 |
| CODE RISK | 0 |
| NOT IMPLEMENTED — EXPECTED | 7 |

## P0 readiness

### 1. Validate unattended DERIVE (frozen baseline)

- **Prerequisites:** JourneyAgent, Agent Send, Adaptive Pace OFF path, Kling balanced, +1 export, Session/Project — all present.
- **Insertion point:** No code. Run Agent Send on a POV story with frozen settings; confirm COMPLETE + export.
- **Missing work:** Manual/event validation only.
- **Risk:** Provider flakiness (Pruna/Replicate aborts). JourneyAgent now relaunches missing takes once after await; persistent provider failure still fails assemble.

### 2. CM chooses OG vs Pull Forward per traversal

- **Prerequisites:** Project-level `pullForwardReferenceEnabled`; CM assess + motion plan + shoot pipelines accept the boolean.
- **Insertion point:** CM assessment output + apply before `planMotionFor` / `createTake` in `journey-agent.ts` (`establishEndCanonical` / `planMotionFor`). Do **not** treat the project toggle as the agent decision.
- **Missing work:** CM JSON vocabulary for OG vs PF; per-journey override; UI/diagnostics optional.
- **Risk:** Confusing project toggle with P0 feature — docs now explicit; keep them separate.

### 3. Failure-driven technique switching

- **Prerequisites:** Repair loop + take failure plumbing (`footageFailure`, repair END).
- **Insertion point:** After take fail or post-repair reevaluate; re-stage motion + retake with other technique.
- **Missing work:** Diagnosis → technique switch policy; second motion/take attempt.
- **Risk:** Overlap with repair (RESHOOT_END) — define ordering so they do not fight.

## P1 readiness

### Continue Journey

- **Prerequisites:** Session `continuedFrom` schema; Agent creates new Project on later Send.
- **Insertion:** `planAgentJourney` before `beginAgentJourney`; Director intent NEW\|CONTINUE; seed A from previous final canonical; write `continuedFrom`.
- **Missing:** Entire Director.intent path and A-seeding.
- **Risk:** Low — cleanly absent.

### Discover

- **Prerequisites:** Types (`construction: discovery`, provenance `"discovered"`); ≥720p generation capability via providers; FFmpeg exists for export.
- **Insertion:** Branch in JourneyAgent construct/shoot; late-frame harvest → PNG → promote canonical.
- **Missing:** Harvest/promote pipeline; CM “latest usable” selection.
- **Risk:** Do not wire `discovery` accidentally as Directed Mode UI.

### Optional Model Router

- **Prerequisites:** `media/src/runway/` client, tasks, upload, download.
- **Insertion:** Extend client with `generate.image` / `generate.video`; surface `routing.model`; keep JourneyAgent task choice; do not hard-code winners into Agent.
- **Missing:** Router config + MediaProvider adapter.
- **Risk:** Only attempt if P0/P1 core healthy (per HACKATHON).

## Frozen-system verification

| System | Verified |
| --- | --- |
| Director | `plan-storyboard` / `planWithDirector` / JourneyAgent `planJourney` |
| CM | Assess + repair recommendation vocabulary; TC&lt;30 END repair |
| Adaptive Pace | ON/OFF + journeyPace persistence + motion invalidation |
| Adaptive Durations | `durationMode` adaptive \| fixed |
| Camotion | Pace→strength, radial, protect, adaptive weights, depth when available |
| Pull Forward | Project-level only |
| +1 | Gate matches MemoryLane evidence; selected Takes; export applies |
| Camera grammar | Four grammars; one per Project |
| Agent | Single AgentWorkspace; live stages + completed thumbs |
| Session | Fresh on load; New Session; Project open does not rebuild Agent chat |
| Project | Directory persistence under Projects Folder |
| Export | ffmpeg concat + optional outgoing start drop |
| Providers | Replicate product path; Runway Enhance Frame Rate only |

## Tests

| Command | Result |
| --- | --- |
| `cd web && npm test` | **PASS** — 64 files, **698** tests |
| `cd media && npm test` | **PASS** — **200** tests |

No failing tests. Media suite requires unrestricted IPC (sandbox EPERM on first attempt; pass outside sandbox). No broad typecheck/lint forced beyond normal `npm test` workflow.

## Contradictions

1. **DOC STALE — Camotion `--depth`:** BACKLOG Adaptive Camotion “Current” still says product shoot does not pass `--depth`. Code path in `shoot-dev-plugin` / `camotion-cli` does pass `--depth` when depth is available.  
   - Expected (doc): no `--depth`  
   - Actual: `--depth` when cache provides a path  
   - Consequence: research status text misleading; production behavior already richer  
   - Smallest correction: update BACKLOG “Current” paragraph to match CLI — **do not change Camotion math under freeze**

2. **PARTIAL — provider-failure retry:** HACKATHON §5 lists “provider-failure retry” as JourneyAgent ownership. Code relaunches missing takes once after the first await; it does not implement provider-aware retry policy or recover after repeated failure.  
   - Smallest correction: narrow the doc wording to “one post-await relaunch of shootable journeys without takes” — **optional**; not a freeze break

3. **PARTIAL — Slow/Normal/Fast UI:** Journey Adaptive Pace has no project Slow/Normal/Fast selector (correct). Inspector still exposes per-traversal filmmaker Pace lock. Harmless for freeze; do not confuse with Adaptive Pace OFF.

No contradiction found that justifies breaking filmmaking code freeze before the event.

## Risks for September 30

1. **Provider flakiness** on Replicate (observed MemoryLane A-B abort) — mitigated by one relaunch; still a live-demo risk.
2. **Confusing project Pull Forward with P0 CM OG/PF** — keep event-day work on per-traversal CM decision.
3. **Doc drift on Camotion depth** — operators may think depth is off; it is often on. Does not change freeze.
4. **Demo settings drift** — Operator must explicitly set Adaptive Pace OFF + Kling balanced; default Adaptive Pace is still ON for new projects.

## Do-not-touch list

- Director planning behavior  
- Canonical construction  
- Current CM assessment behavior  
- Current camera grammar  
- Camotion math  
- Pull Forward implementation (project toggle)  
- Adaptive-duration implementation  
- Journey-level Adaptive Pace implementation  
- +1 seam thresholds (`minSsim: 0.89`, `maxMae: 5`)  
- Agent UI  
- Session persistence  
- Project persistence  
- Existing provider implementations  
- Export / assembly behavior  
- Continuous velocity trajectory (post-hack only)

## Event-day starting point

**Branch / state:** `main` at `a715ec3` (plus this freeze documentation commit when landed). Working tree after docs: HACKATHON / BACKLOG / MemoryLane report / this audit.

**Already working:** Unattended DERIVE JourneyAgent; Adaptive Pace ON/OFF; Adaptive Durations; Camotion production path; project Pull Forward; gated +1; four grammars; Agent rich chat + Session; Project Save/Open; Replicate shoot; Runway Enhance Frame Rate client.

**FIRST hackathon implementation task:**

> **Validate unattended DERIVE on the frozen baseline** (P0.1): open Agent, set Kling balanced + Adaptive Durations ON + Adaptive Pace OFF + Pull Forward ON, Send a POV journey, confirm COMPLETE with +1 drops on selected Takes and a playable export. No code changes unless a reproducible P0 regression appears.

**Where to begin in code if validation fails:**

1. Read `web/src/project/journey-agent.ts` (`executeJourneyAgent`)  
2. Trace ops wiring in `ProjectProvider.runAutonomousJourney`  
3. Inspect Adaptive Pace OFF via `ensureProjectJourneyPace` / `effectiveJourneyPace`  
4. Inspect +1 via `drop-outgoing-start.ts` + export `applyOutgoingStartDrops`

**First code task after green validation (P0.2):** CM chooses OG vs Pull Forward **per traversal** — start at CM assessment schema + `establishEndCanonical` / `planMotionFor` in `journey-agent.ts`, without collapsing into the project Pull Forward toggle.
