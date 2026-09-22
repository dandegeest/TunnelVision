# Next experiments and hackathon UI directions

Items 1, 2, 4, and 5 are **not** current product work. Do not
implement them from this file. Canonical event-day plan:
[HACKATHON.md](../HACKATHON.md).

Item 3 and Session persistence landed in the existing Agent
surface. The `/hackathon-mock` prototype was deleted. Plan and
Timeline remain specialist views.

Related unvalidated research: [RESEARCH_BACKLOG.md](../RESEARCH_BACKLOG.md).

| # | Direction | Role |
| --- | --- | --- |
| 1 | Automatic color continuity / finishing | **P2 optional.** After abandoned 120fps Temporal Seam. Do not implement from a product session. |
| 2 | Cinematographer-controlled OG vs Pull Forward | **P0 hack-day.** Do not implement from a product session. |
| 3 | Journey as a rich chat turn + Session | **Landed / pre-hack.** Agent tab. Session references Projects. |
| 4 | Continue Journey | **P1 hack-day.** Same Send → `Director.intent()`. |
| 5 | Discover late-frame harvest | **P1** if P0 is healthy. ≥720p A→?; latest usable frame. Spec: [HACKATHON.md](../HACKATHON.md) §17. |

---

## 1. Automatic Color Continuity / Finishing

Instead of trying to smooth **motion velocity** between independently
generated traversals, investigate whether automatic color correction /
grading can improve perceived continuity and polish of a completed
TunnelVision journey.

**Why this exists.** 120fps Temporal Seam was tested as a join
technique for velocity discontinuities and **abandoned** (20 September
2026). Technical processing worked; perceptual gain over untreated
Control was not compelling. Do not reopen velocity-smoothing joins.
Keep the Runway Dev provider and Enhance Frame Rate as plumbing, not
as this experiment. Record:
[2026-09-20 Temporal Seam / 120fps](../experiments/2026-09-20-temporal-seam-120fps.md).

Current export remains **flat concatenation** of selected takes. Color
work would sit on assembled footage, not inside Camotion or NEW TAKE.

There are two potentially separate operations.

### Boundary Color Matching

Analyze adjacent traversals around a canonical boundary B:

``` text
A→B | B→C
```

Look for discontinuities in:

-   exposure
-   white balance
-   color temperature
-   saturation
-   contrast
-   overall color distribution

Apply **restrained** correction so the two traversals feel as though
they belong to the same continuous world.

This is primarily a **continuity** operation, not a stylistic grade.

An especially interesting TunnelVision-specific possibility is using
**pristine canonical B** as the visual / color reference, because both
neighboring traversals conceptually belong to B's world.

### Journey-Level Grade

After the complete journey has been assembled, optionally apply a
subtle **global finishing grade** across the entire output.

Goal: make several independently generated traversals feel more like
one finished cinematic shot.

### Experimental philosophy

Start **deterministic and inexpensive**. Do not begin by adding
another generative model.

Potential first approaches: OpenCV / FFmpeg / conventional image
statistics, histogram matching, exposure / WB adjustment, LUTs.

Useful blind experiment:

``` text
CONTROL
AUTO COLOR MATCH
AUTO COLOR MATCH + GLOBAL GRADE
```

Do not implement from a product session. **P2** on the hack
board — below core agent behavior. Do not spend event-day hours
on this unless P0 and Continue Journey are already green.

---

## 2. Cinematographer-Controlled OG vs Pull Forward

**P0 hack-day.** Do not implement from a product session. This is
one of the central event-day experiments. See
[HACKATHON.md](../HACKATHON.md) §4b.

Allow the **Cinematographer (CM)** to select the traversal-generation
technique independently for each A→B shot. A journey would no longer
need one generation strategy throughout.

Example:

``` text
A ── OG ──▶ B ── PULL FORWARD ──▶ C ── PULL FORWARD ──▶ D ── OG ──▶ E
```

The selection should be **agent-controlled**, not a required user
setting.

### Current code (context only)

`pullForwardReferenceEnabled` is a **project-level** experimental
toggle, default **true**. ON: previous canonical is the image-edit
source plus world-continuity. OFF: construct N via `generateImage`
without that pull-forward reference, and traversal wording swaps the
invent-passageways sentence for threshold-connective travel. OFF is
not the preferred product default. Extra Agent-repair reference
images are not gated by this flag. Opening A already uses
`generateImage`.

That toggle is not per-segment, not CM-chosen, and not a reshoot
technique. Current Agent repair reshoots a weak **END canonical**
when Traversal Confidence is below 30; it does not retry the **same
pair** with a different generation technique.

### Initial hypothesis

**OG** may be preferable when:

-   the scene already provides strong natural depth and motion cues
-   subject-following is important
-   the model should have greater freedom to construct motion
-   previous OG behavior is already producing convincing spatial travel

**Pull Forward** may be preferable when:

-   stronger forward spatial commitment is needed
-   entering a doorway, tunnel, window, alley, passage, etc.
-   approaching or passing through a clearly defined destination
-   the shot is prone to hovering or insufficient travel
-   stronger geometric progression toward B is desirable

### Adaptive reshooting

A particularly interesting agent behavior: CM may **change technique**
after evaluating a failed traversal.

Example:

``` text
Generate B→C using OG

CM evaluation:
Spatial: acceptable
Travel: 68
Result: insufficient forward progression

CM decision:
Retry B→C using Pull Forward

New result:
Spatial: 93
Travel: 94
```

A reshoot would then be more than “try the same thing again.” The
Cinematographer would diagnose the failure and choose a different
shooting technique.

This is potentially a strong demonstration of **actual agentic
behavior** for the hackathon.

### UI

Technique should remain mostly an **implementation detail**.

A completed traversal might optionally expose compact metadata such
as:

``` text
A ─────────▶ B ─────────▶ C
    OG 94/91     PF 96/94
```

The user should **not** need to select OG / PF during normal agentic
generation.

Do not implement from a product session. Do not fold this into
the current project toggle. Do not expose a required filmmaker
control.

---

## 3. Hackathon UI: Journey as a Rich Chat Turn

**Landed in the existing Agent workspace** (21 September 2026). Do
not rebuild it as a parallel hack route. Do not replace Plan |
Shoot. Standard TunnelVision remains the detailed creative
workstation: header **Director | Agent | Shoot**; Project panel
title **PROJECT - DIRECTED** / **PROJECT - AGENT**.

Code: `web/src/app/agent/AgentWorkspace.tsx`. The static
`/hackathon-mock` conversation was rolled in and then deleted.

### Core interaction model

Agent is an **endless-scroll conversation**. Hidden scrollbars;
auto-scroll while generating.

On Agent, the conversation is the workspace. Director (Plan) and
Shoot (Timeline) stay as specialist views. Open is how you leave one
saved journey for another.

``` text
THE CONVERSATION IS THE WORKSPACE.
```

Each TunnelVision journey is a **rich chat turn**.

Conversation history grows **vertically downward**.

Each individual journey grows **spatially from left to right**.

Two meaningful dimensions:

``` text
→ spatial progression through the generated world
↓ temporal progression through the user's collaboration with the agent
```

### User turn

A journey begins with a conventional user prompt, for example:

``` text
A forest walk to a vista outlook
```

### Live Journey Turn

TunnelVision responds with a rich journey block.

As the agent works, the block grows from left to right:

``` text
[A] ─── [B] ─── (C) ─── (D) ─── (E)
Forest    Lake    Falls    Hill    Vista
```

Completed locations become media thumbnails **in the same path** as
the letter nodes, so a live journey reads:

``` text
THUMB A ── THUMB B ── C ── D ── E
```

Future / planned destinations stay lightweight letter nodes until
they complete. The **active edge** visually indicates where the agent
is currently working.

### Agent activity inside the journey

Director, Cinematographer, generation status, confidence, failures,
and repair actions aggregate under the live journey disclosure, not
as extra chat turns. The **JOURNEY —** live status is a quiet Krea-like line
(`Generating C′…` with a small spinner), not a boxed uppercase header.
Chrome is light: no nested You/Journey cards, no title bar, floating
pill composer. Director / Cinematographer / repair stay in the
disclosure as running text.

Reshoots of a destination stack **vertically under that destination's
thumb**. The horizontal spine is the accepted journey; the downward
branch is agent work. Reshoots are capped at **2**. Rejected thumbs are
**smaller and dimmed** relative to accepted thumbs and the generating
FPO. Rejected history on both completed and generating nodes
collapses behind **N RESHOOT ›** / **N RESHOOTS ›**, matching the
count of rejected thumbs (not the accepted spine frame, not the
generating FPO). Generation status lives in the journey header /
intervention log, not overlaid on the FPO — the FPO only shimmers.
The path line from the previous destination **redirects to the
accepted reshoot**.

``` text
THUMB A ──── THUMB B ════ FPO C′ ── D ── E
               │              │
               └── 2 RESHOOTS ▾   └── 1 RESHOOT ▾
                    B · 1              C · 1
                    B · 2
```

### Completed Journey Turn

When generation finishes, the **same live block** becomes the
permanent completed journey object.

Example:

``` text
✓ JOURNEY COMPLETE

[A] ─── [B] ─── [C] ─── [D] ─── [E]
Forest    Lake   Falls    Hill    Vista

┌────────────────────────────────────┐
│           video player             │
│           (click / ▶)              │
└────────────────────────────────────┘

5 locations · 4 traversals · 0:32
```

The completed player can be large while it is the current result.

As subsequent journeys are created, older journey turns naturally
move upward in conversation history and may collapse into more
compact forms.

**Journey complete** starts collapsed (heading + chevron only). Open
it for the small A–B–C still strip, location/traversal/clock line,
and Set / Travel. Video and Download sit under the card either way.
Click a still to select it; click the **selected** still to open the
storyboard reel lightbox (same reel as Director / Shoot).

A later Agent prompt currently **leaves that project saved and
starts a new one** (one project = one journey). Continue Journey
(P1) will let `Director.intent()` choose NEW vs CONTINUE instead
of always starting a fresh world. Continuation still creates a
**new** Project; it does not append to the previous one.

Opening a Project loads Plan / Timeline / player. It does **not**
reconstruct Agent conversation history. Agent renders from the
active Session + referenced Projects. Every refresh creates a
**new** Session; old Session JSON stays on disk. Session browser
/ rehydration is not hack scope.

### History

Previous journeys simply exist as earlier turns in the conversation:

``` text
YOU
Paper airplane...

[JOURNEY]
A → B → C → D → E → F


YOU
WWI trench...

[JOURNEY]
A → B → C → D → E → F → G


YOU
Massive marble run...

[JOURNEY]
A → B → C → D → E


YOU
Forest walk...

[JOURNEY — GENERATING B]
A → B → C → ◉ → ○
```

There is no need for a separate “Previous Journeys” dashboard in the
**primary** hackathon experience.

The persistent `Project` remains the source of truth for one
journey's media, plan, scores, and video. The Session is the
source of truth for conversation structure and project
references. Do not reconstruct a Session from an opened Project.

### Composer

Keep a floating pill composer at the bottom of the canvas, Krea-like:

``` text
Where should we go next?                              ⊕
```

Unsent composer text survives Director / Shoot. On a **new**
project the first send names and autosaves the folder. On a
loaded journey, send currently starts a new project from that
prompt. P1: the same Send asks `Director.intent()` whether the
prompt is NEW or CONTINUE.

### Design principle

Do not think: chat containing journeys.

Think:

``` text
JOURNEYS ARE A NEW KIND OF CHAT TURN.
```

The unusual object moving through the conversation is a **living
spatial journey**.

Do not gut Plan | Shoot. Do not invent a hackathon-only project
schema. Do not revive `/hackathon-mock`.

Live Agent chrome is quieter than the original mock: spinner + short
status only (`Planning…`, `Generating D…`, `Planning D→E…`); no
verbose Director / Cinematographer / reshoot prose on the card; no
green letter rail. Reshoot history still stacks under a destination
when rejected stills exist.

---

## 4. Continue Journey

**P1 hack-day.** Do not implement from a product session. Canonical
write-up: [HACKATHON.md](../HACKATHON.md) §4a.

Same composer. Same Send. No New Journey / Continue Journey
buttons. `Director.intent()` returns `new` | `continue` **before**
canonical A is resolved, because Director planning is grounded in
actual A.

Continue does **not** append to the previous Project. It creates a
new Project whose A is the previous completed journey's **actual**
final accepted canonical (do not assume letter `E`). Session
JourneyTurn records `continuedFrom: { projectId, canonicalId }`.

Bias NEW when ambiguous. Subtle UI only, e.g. “Continuing from
the mountaintop sanctuary.” Do not stitch continued Projects into
one MP4.

---

## 5. Discover late-frame harvest

**P1 if P0 is healthy.** Do not implement from a product session.
Canonical spec: [HACKATHON.md](../HACKATHON.md) §17.

No predetermined pristine B. Generate A→? at **≥720p**, choose
the **latest usable** late frame (not the prettiest frame in the
clip), extract lossless PNG, then promote / enhance to canonical
B.png. Repeat for the Director-planned journey extent.

No Discover button. No autonomous stopping loop. No draft-resolution
harvest.
