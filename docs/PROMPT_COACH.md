# TunnelVision Prompt Coach

This is a **design and experimental-findings** document. It is not a
current product surface, not a role to implement, and not permission
to change Director, Cinematographer, Camotion, prompts, generation,
or UI.

**Status labels used below**

| Label | Meaning |
| --- | --- |
| **Current** | Observed product practice or documented product law. |
| **Experimental** | Session and research findings. Do not productize from a single run. |
| **Future** | Direction only. Do not treat as implemented. |

Related current-code facts: [PRODUCT.md](PRODUCT.md),
[AGENTS.md](AGENTS.md), [ARCHITECTURE.md](ARCHITECTURE.md).
Related discovery work: [HACKATHON.md](HACKATHON.md),
[BACKLOG.md](BACKLOG.md), [RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md).
Qualitative session evidence:
[sessions/red-paper-airplane.md](sessions/red-paper-airplane.md).

Do not create a `PromptCoach` agent, Screenwriter, or Project schema
fields from this file. [AGENTS.md](AGENTS.md) already forbids
implementing Screenwriter. Prompt Coach is a related **future**
intent-conditioning layer, not that role.

---

## Purpose

TunnelVision Journey prompts are **not** ordinary text-to-video
prompts.

A filmmaker should not need to understand image-model prompting,
video-model prompting, Camotion, canonical construction, traversal
geometry, or the internal Director / Cinematographer architecture in
order to describe a journey.

The filmmaker's job is primarily to describe three things:

-   **Subject** — who/what matters visually and should persist
-   **Beats** — where the journey goes and what happens along the way
-   **Style** — look, tone, scale, genre, photographic/cinematic intent

Camera grammar (POV / FOLLOW / LEAD / MOUNTED) is a Project setting.
TunnelVision injects that law into Director, stills, Cinematographer, and
the locomotion baseline. Prompt Coach should **not** teach filmmakers to
restate invisible-objective, elastic-follow, lead-retreat, unembodied-POV,
or mount-geometry rules already encoded by CAMERA.

Naming a grammar in the story ("FOLLOW skier") is optional once CAMERA is
set. Continuity anchors that are the *subject* (the same red car, the same
skier) remain filmmaker-owned.

TunnelVision's job is to translate that creative intent into
something that can actually be constructed and filmed.

**Current** product loop (see [PRODUCT.md](PRODUCT.md)):

``` text
SPECIFY → DIRECT → CONSTRUCT → SHOOT
```

The filmmaker writes a Journey prompt. PLAN JOURNEY (Directed) /
CREATE JOURNEY (Agent) is the Director invocation. Construct builds
Destinations. The Cinematographer reasons over actual adjacent
canonicals. Camotion prepares shooting frames. NEW TAKE films the
traversal. The selected Take is the cut.

**Future** long-term stack (not implemented):

``` text
HUMAN CREATIVE INTENT
        ↓
PROMPT COACH / INTENT CONDITIONING
        ↓
DIRECTOR
        ↓
CANONICALS / DESTINATIONS
        ↓
CINEMATOGRAPHER
        ↓
CAMOTION / SHOOTING FRAMES
        ↓
VIDEO GENERATION
```

The human should behave like someone describing a movie idea to a
capable filmmaker, not like someone programming a video-generation
model.

---

## 1. A Journey prompt is creative intent

**Current.** The Journey prompt is project story / intent. It is an
instruction to the Director about the journey we want to experience.
It is not:

-   a raw image-generation prompt
-   a raw video-generation prompt
-   a frame-by-frame storyboard
-   detailed camera-control syntax
-   a list of Camotion commands
-   a specification of shooting frames A′ and B′
-   a replacement for Cinematographer reasoning

A useful mental model is:

> Where are we going, what happens along the way, what is visually
> important, and what should it feel like?

The Director interprets this intent and constructs a journey.
The Cinematographer determines how local traversals can actually be
shot.

**Experimental / observed practice.** Put a short project / story
title on the **first line** of the filmmaker prompt. Then the story,
style, and route.

``` text
Title

Story / journey intent

Style

Route / beats
```

This is a lightweight naming convention, not a prompt template.
It gives the journey immediate identity, reads as a film / project
rather than a raw generation instruction, and flows into Project
Save As without a separate naming step. **Paper Chase** (19
September 2026) demonstrated this especially well. See
[2026-09-18-long-journey-findings.md](experiments/2026-09-18-long-journey-findings.md).

Do **not** expand this into a verbose Prompt Coach form. Title first;
keep the rest compact.

---

## 2. Destinations matter more than micro-choreography

Journey prompts should emphasize strong narrative and visual
Destinations rather than every second of camera movement.

**Useful at the human-prompt level**

``` text
approach the station
→ enter the trench
→ race deeper as danger escalates
→ reach the target
→ escape through smoke
→ emerge into open space
```

**Usually unnecessary at the human-prompt level**

``` text
move forward 15 meters
rotate exactly 90 degrees
move another 8 meters
pitch camera upward 12 degrees
```

Detailed local camera choreography belongs primarily to the
Cinematographer (`segmentPromptAddition`, Motion Plan, Camotion).

**Future.** A Prompt Coach should resist expanding concise creative
intent into huge shot specifications unless a particular constraint
is essential to the story.

---

## 3. Strong canonicals are not just pretty pictures

A Destination / canonical should function as a **place from which
the next traversal can happen**.

A beautiful standalone composition is not necessarily a good
TunnelVision canonical.

Useful canonicals often contain visible onward structure:

-   paths, doors, windows, tunnels, corridors, alleys
-   stairways, ramps, trenches, bridges, openings
-   clouds, smoke, or other environmental structures that lead on

**Experimental.** Chernobyl / Pripyat sessions reinforced this. A
courtyard canonical could be visually attractive but spatially weak.
A Cinematographer-triggered reshoot produced a stronger canonical
because a ground-floor entrance became a clearer traversal target.

The lesson:

> Canonical quality includes future shootability.

That matches current product law: Cinematographer Set Consistency
and Traversal Confidence are advisory set analysis over **actual**
adjacent Destinations, not a beauty score. Agent repair currently
reshoots an END when Traversal Confidence is below 30. Do not
document that threshold as something the filmmaker must prompt.

---

## 4. Physical connectivity is central

TunnelVision works best when the journey implies a continuous
physical route through space.

**Good journey topology**

``` text
street → courtyard → doorway → lobby → stairwell → rooftop door → rooftop
```

``` text
space → station surface → trench → target opening → smoke → open space
```

**Thresholds** are especially useful. A threshold is an environmental
feature that naturally enables transition between spaces: doorway,
window, tunnel, alley, stairwell, opening, archway, bridge, train
door, cave, cloud, smoke, underwater boundary.

The filmmaker does not always need to design every threshold.
**Current** sequential **Derived** Construct (image-conditioned from
the preceding actual Destination) and the Cinematographer already
invent or strengthen local handoffs. **Future** Prompt Coach should
recognize when a story has no plausible physical connection between
major Destinations and may make the smallest useful clarification.

---

## 5. Let the Director direct

Do not over-condition the Journey prompt.

The Director should retain creative responsibility for:

-   decomposing the story into Destinations
-   inventing useful intermediate environments
-   finding compelling visual transitions
-   constructing narrative escalation
-   anticipating future traversal needs

**Future.** A Prompt Coach should make the **smallest useful
changes** to the filmmaker's idea. Avoid turning a concise movie
concept into a 500–1000 word generation specification.

The goal is not maximum prompt verbosity. The goal is enough
creative information for TunnelVision's filmmaking roles to do their
jobs.

---

## 6. Derive prompting

**Current.** Product Construct is sequential **Derived**: Destination
N is built from the immediately preceding actual Destination. Opening
A is story text-to-image (or an upload). PLAN JOURNEY / CREATE
JOURNEY plans Destinations; construction then proceeds in travel
order.

Conceptually:

``` text
A
→ Director / Construct derives B
→ CM evaluates A→B
→ B may be repaired / reshots if Traversal Confidence is too low
→ NEW TAKE films the traversal
→ continue toward C
```

Derive prompts benefit from meaningful Destination and story intent.
The filmmaker can say:

``` text
enter an abandoned apartment building
→ climb several floors
→ emerge into a rooftop garden
```

The Director should decide what those Destinations look like.
The Cinematographer should decide whether the adjacent pair is
shootable. The filmmaker should not have to construct A / B / C / D
manually.

Derived vs Discovered vs Provided vs Generated are **construction
strategies**, not four global movie modes. See
[PRODUCT.md](PRODUCT.md).

---

## 7. Discover prompting

**Future / BACKLOG.** **Discovered** Destinations — promoting a
useful late frame from generated traversal into the next canonical —
are **not implemented**. Discovery is HACKATHON / DISCOVERY, not
current Construct. See
[BACKLOG.md — Discover canonical strategy](BACKLOG.md#discover-canonical-strategy)
and [HACKATHON.md](HACKATHON.md).

In Discover:

``` text
current canonical
→ traversal generation
→ inspect late / generated frames
→ promote a useful resulting frame
→ next canonical
→ continue
```

Future Destinations emerge from what the generated journey discovers.

Prompt Coach guidance must **not** assume every TunnelVision journey
is a rigid predefined storyboard. Discover prompts may be looser and
more exploratory. Do not force Derive-style Destination specification
onto Discover. Do not implement Discover from this document.

---

## 8. Camera intent / Camera Grammar

Broad camera intent can change the meaning of a journey.

**Hackathon vocabulary** (pre-hackathon **target**, not current
product classification). Four whole-journey grammars only:

| Grammar | Relationship |
| --- | --- |
| **POV** | Camera **is** the traveler. Unembodied unless explicitly requested otherwise. |
| **FOLLOW** | Invisible objective camera pursues a persistent subject. **Not** true first-person. Preserves the **camera–subject relationship**, not a fixed following distance. |
| **LEAD** | Camera travels **ahead of** the traveler while facing them, usually retreating as they advance. Also objective / invisible. |
| **MOUNTED** | Camera is physically attached to the traveler, vehicle, or moving object. |

Older names, retired here: POV was sometimes called FPOV / first-person
POV; FOLLOW was called FP Follow; LEAD was called Reverse Lead. Use
**POV, FOLLOW, LEAD, MOUNTED** from here on. Later grammars
(SIDE_TRACK, ORBIT, ASCEND / DESCEND, OBJECT / PROJECTILE, SUBJECT
HANDOFF, FREE) remain **post-hackathon**.

See
[HACKATHON.md — Camera grammar](HACKATHON.md#camera-grammar--hackathon-decision).

### One journey = one camera grammar

For hackathon scope, the selected grammar applies across the **entire
continuous journey**.

Valid examples: POV rollercoaster; POV trench run; FOLLOW skier;
FOLLOW koi; FOLLOW tornado; LEAD astronaut; MOUNTED vehicle
journey.

Do **not** treat mixed-grammar journeys as supported hackathon
behavior (A→B = POV, B→C = FOLLOW, C→D = LEAD). That is explicitly
**post-hackathon**.

TunnelVision's core magic for this scope is a continuous cinematic
journey of arbitrary length while preserving **one coherent camera
relationship**. The goal is not general-purpose cinematography or
coverage planning. Keeping one grammar avoids prematurely
introducing canonical reinterpretation between adjacent grammars,
incoming vs outgoing camera-state variants around one canonical,
camera cuts at grammar boundaries, continuous grammar-transition
planning, coverage planning, and complex shot-to-shot camera
semantics. Those remain post-hackathon research.

The human may **state** a grammar directly:

``` text
Photorealistic FOLLOW journey chasing a downhill skier.
```

That name is optional once CAMERA is set. Prompt Coach must **not** expand
the story with camera-law already injected by TunnelVision (invisible
objective camera, stay behind, elastic distance, do not overtake, retreat
while facing, mount geometry, unembodied traveler). Subject, beats, and
style stay in the filmmaker prompt.

Prompt Coach may also **infer or clarify** a grammar when intent
strongly implies one:

``` text
"I am the camera moving through the maze."
  → POV

"Follow the same skier down the mountain."
  → FOLLOW

"Stay ahead of the astronaut while facing them."
  → LEAD

"Camera mounted to the front of the motorcycle."
  → MOUNTED
```

Then keep the **entire** journey compatible with that grammar. Coach
may help structure legs/beats. It must **not** switch grammar from
beat to beat.

Journey legs may vary in environment, speed, danger, lighting,
scale, topology, and narrative intensity while grammar stays
constant:

``` text
FOLLOW skier:
mountain start → steep descent → gates → rocky chute → tunnel → finish
(all FOLLOW)

POV trench attack:
space approach → trench entry → defensive fire → final attack run
→ target → smoke → open space
(all POV)
```

Optimize the **story and journey**. Preserve the selected camera
relationship.

### Grammar is not every local movement

Camera grammar is the persistent relationship between camera and
traveler/subject. It is **not** the same as every local movement.
Within one grammar the camera may still turn, bank, climb, descend,
accelerate, decelerate, pass through thresholds, and follow curved
paths. POV can still turn through a maze. FOLLOW can still bank,
lag, catch up, and let the subject pull ahead. MOUNTED can still
climb and roll with a vehicle. The grammar stays constant while
local movement changes.

### Segment duration / pace

**Nice to have** before hack day. Not part of the four grammar
definitions, and **not implemented**. Prefer pace or shot-length
intent over precise duration control.

If easy, CM may return `pace` or an approximate desired duration.
The generation layer would map that to the closest duration the
**currently selected** video model supports. If a Take is
regenerated with a different model, remap — models expose different
discrete durations.

``` text
CM desiredDuration ≈ 6s
Model A supports 5s / 10s  → nearest sensible value
Retry on Model B (4s / 6s / 8s) → remap again for Model B
```

Do not document exact mapping as live behavior. Current product
already maps CM `pace` onto Camotion exposure and shooting-prompt
speed phrases. Product Adaptive / Fixed duration now maps a target
onto the selected model's supported clip lengths; remapping on
retry uses the original target, not the previous clip. That
mapping is not Prompt Coach's job.

**FOLLOW duration observation (experimental, not a rule).** A
high-quality FOLLOW skier test at ~10s (Kling) showed more natural
cinematic pursuit than shorter rigid-feeling generations: the
subject pulled farther ahead, the camera continued following, and
distance closed again. Longer duration *may* give FOLLOW room for
breathing distance, acceleration/deceleration, lag and catch-up,
and more varied framing. Do **not** claim longer duration
automatically improves FOLLOW. This is another reason
CM-controlled `desiredDurationSeconds` is potentially valuable.

**Current.** Product locomotion uses four whole-journey camera grammars
— POV, FOLLOW, LEAD, MOUNTED — persisted as `cameraGrammar` on the
Project. Missing/legacy projects load as POV. The Director, still
construction, Cinematographer, and frozen locomotion baseline all
receive the selected grammar. One journey = one grammar. Mixed-grammar
journeys remain post-hackathon. See
[HACKATHON.md — Camera grammar](HACKATHON.md#camera-grammar--hackathon-decision).

**Useful prompting principle.** The filmmaker may express broad
camera intent. TunnelVision should translate that into the
appropriate internal grammar and conditioning. Do not require the
filmmaker to name the taxonomy or understand TV internals.

---

## 9. POV

POV means the camera itself is the traveler: through a maze, a
trench, a building, a road.

**Current product law** ([AGENTS.md](AGENTS.md)): TunnelVision uses
an **unembodied** POV unless the filmmaker explicitly asks
otherwise. Do not automatically introduce hands, feet, skis,
cockpit, handlebars, hood, vehicle body, camera operator, avatar, or
persistent foreground equipment. Filmmaker and Director story text
should not add a POV clause; the product injects the unembodied
constraint.

This distinction matters because **MOUNTED** exists as its own
grammar. If visible vehicle or body geometry is essential to the
concept, the intent may actually be MOUNTED rather than POV.

If the filmmaker explicitly requests embodied POV, those elements
may be appropriate. Do not treat that as the POV default.

**Future.** A Prompt Coach should not require humans to repeatedly
specify "no hands, no skis, no cockpit." That belongs in the POV
baseline.

---

## 10. FOLLOW

**Current product grammar.** FOLLOW is one of four whole-journey
camera grammars (`cameraGrammar: "follow"`). It is not a per-pair
CM classifier, and it is not mixed with POV mid-journey.

**FOLLOW preserves the relationship, not the distance.**

FOLLOW means an **invisible objective** camera follows a persistent
subject through space. The subject remains the primary continuity
anchor and stays visually and narratively dominant enough to
preserve continuity. The camera remains in pursuit. It should not
become another visible participant by accident (no camera operator,
no second traveler).

Following distance may **naturally expand and contract**. The
camera may lag, catch up, drift, bank, settle, or allow the
subject to pull ahead. The camera should **not** feel mechanically
locked at one exact distance, **not** arbitrarily overtake the
subject, and **not** lose the intended follow relationship.

Do **not** define FOLLOW as “camera stays exactly X feet behind
the subject” or “camera maintains identical full-body framing at
all times” unless the story explicitly requires that.
Over-constraining distance risks a rigid camera-rig feeling.
Prefer natural cinematic elasticity:

``` text
subject pulls ahead
→ camera continues pursuit
→ distance closes again
→ subject remains the anchor
```

Conceptually:

``` text
Good Journey prompt:
"Continuously follow the same rider through the landscape."

Better internal interpretation:
"Maintain the rider as the persistent subject and continuity
anchor while allowing natural cinematic variation in following
distance."

Avoid automatically adding:
"maintain exactly the same distance behind the rider"
```

unless the filmmaker specifically asks for a locked offset.

**Observed (FOLLOW skier / horse-and-rider, high-quality Kling
~10s).** The camera did not stay rigidly locked immediately behind
the subject. At times the horse pulled farther ahead; the camera
continued pursuing while preserving FOLLOW. That felt more
cinematic and less like a physical rig bolted directly behind the
subject. Capture this as a **positive** behavior, not a failure.
Longer duration *may* have given that elasticity more room. Do not
generalize it into a duration rule.

Subjects discussed in sessions and discovery notes: skier, koi,
tornado, roller coaster, paper airplane.

For a FOLLOW skier shot: the skier is visible. The camera
operator's skis should **not** automatically be visible. That would
imply a different camera relationship (embodied POV or a second
skier).

**FOLLOW vs MOUNTED.** FOLLOW is an invisible objective camera
that dynamically pursues a subject ahead / within the scene;
distance may vary. MOUNTED is physically attached; camera–subject
geometry is much more rigid, and persistent vehicle/body geometry
may be expected. If a shot looks bolted directly behind the
subject with almost no relational variation, that may visually
resemble **MOUNTED** more than cinematic FOLLOW.

**Current.** That distinction lives in the FOLLOW locomotion
baseline rather than requiring every Journey prompt to explain it.
The baseline encourages: persistent subject continuity; invisible
objective camera; natural pursuit; dynamic following distance; no
overtaking unless explicitly requested; no visible camera operator
/ second traveler; no rigid mounted-rig feel. Do not over-constrain
framing.

---

## 11. LEAD and MOUNTED

**LEAD** is a current whole-journey camera grammar, persisted as
`cameraGrammar: "lead"`.

LEAD means the subject remains visible; the camera travels **ahead
of** the subject while facing them, often retreating as the subject
advances. Example: an astronaut walks toward the camera while the
camera retreats through connected environments.

**Experimental observation (historical limitation, not desired
LEAD).** Earlier TunnelVision conditioning strongly favored forward
camera travel and could override this intent (astronaut exhibit: CM
rewrote a retreating, facing-the-subject plan into forward POV that
passed the astronaut). Do not present that override as part of the
desired LEAD grammar. The dedicated LEAD baseline is the intended
fix, not a more permissive universal POV template.

**MOUNTED** means the camera is physically associated with the
moving subject, vehicle, or object: hood-mounted car, motorcycle,
handlebars, train exterior, boat bow, aircraft-mounted perspective.

Unlike POV / FOLLOW / LEAD, persistent foreground vehicle geometry
may be **expected and desirable**. Do not apply POV's default "no
persistent foreground objects" rule blindly to MOUNTED shots. This
is why one universal camera baseline is insufficient.
[HACKATHON.md](HACKATHON.md#camera-grammar--hackathon-decision)
records the same conflict.

A FOLLOW shot that never lets distance breathe can look more like
MOUNTED (bolted behind the subject) than cinematic FOLLOW. See
§10.

---

## 12. Persistent subjects / continuity anchors

When a journey depends on one subject remaining recognizable across
environments, state that clearly once:

-   same glowing koi
-   same blue feather
-   same skier
-   same tornado
-   same roller coaster
-   same paper airplane

Do not redescribe the persistent subject in every beat. State the
continuity relationship once and let Director and Cinematographer
preserve it.

**Current.** Video subject persistence is shot-specific CM guidance
in `segmentPromptAddition`, not something the filmmaker must repeat
per Destination.

---

## 13. Visual style should be compact but strong

**Experimental.** Visual quality can suffer when the Journey prompt
provides no meaningful aesthetic direction. The red paper airplane
session produced some of the strongest-looking photoreal canonicals
so far and reinforced compact cinematic intent. See
[sessions/red-paper-airplane.md](sessions/red-paper-airplane.md).
**Paper Chase** later showed that a compact *stylized* direction
(hand-drawn / rotoscoped music-video look) can also hold across a
journey and a later continuation. That is a standout example, not a
claim that stylized output is categorically better than photoreal.

Filmmakers should **not** be expected to write long image-model
style prompts. A compact direction may be enough:

``` text
Photorealistic cinematic live action, natural physical lighting and
materials, feature-film scale.
```

``` text
Photorealistic cinematic FOLLOW.
```

**Future.** Prompt Coach / Intent Conditioning should expand compact
creative style language into appropriate downstream model-specific
conditioning. Do not make the filmmaker write that expansion. The
human prompt stays subject / story, beats, and style. Internal
camera grammar and shooting law stay internal.

---

## 14. Future creative-direction layers

**Future.** A useful architecture is:

``` text
TV DEFAULTS
      ↓
PROJECT CREATIVE DIRECTION
      ↓
JOURNEY CREATIVE INTENT
      ↓
SHOT-SPECIFIC CONDITIONING
```

Example: TV defaults supply a cinematic quality baseline. Project
says photorealistic naturalistic sci-fi. Journey says desperate
high-speed attack. Traversal adds specific local camera and geometry
requirements.

This prevents repeating the same visual language in every prompt.

Conceptual Project-level presets (examples only, not
implementation): Cinematic Photorealism, Documentary, 1970s Film,
Stop Motion, Dreamlike, Stylized Animation.

Do not add these as settings or schema from this document.

---

## 15. Escalation belongs in the story

Narrative escalation **is** useful journey-level information.

``` text
enter trench
→ defenses intensify
→ enemy pursuit closes in
→ trench becomes increasingly dangerous
→ target appears
→ attack
→ escape
```

This gives the Director a narrative arc without dictating every
camera movement.

A good TunnelVision journey often has:

``` text
SETUP → DEVELOPMENT → ESCALATION → CLIMAX → RELEASE / REVEAL
```

**Future.** Prompt Coach should strengthen that structure when it is
already present in the filmmaker's idea — smallest useful change.

**Experimental.** Paper Chase escalated desk → hallway → subway →
rooftop → sky → moon while remaining one journey; paper became
origami birds without feeling like unrelated subject drift. Useful
as a contrast with uncontrolled identity drift, not as a template
to copy.

---

## 16. Important actions should be explicit

If a particular visual event is essential, state it.

Example: for an attack run, if the filmmaker specifically wants to
**see** two torpedoes launch from the POV camera position, travel
ahead, and enter the target opening, that is important creative
intent. Do not leave essential story actions entirely to inference.

Distinguish:

| Keep | Avoid |
| --- | --- |
| Important story action | Low-level camera choreography |

Preserve the former. Do not unnecessarily specify the latter.

---

## 17. Environmental transitions as filmmaking tools

Some environments act as natural visual thresholds: smoke, fog,
darkness, clouds, water, tunnels, doorways, windows, bright light.

These are powerful in TunnelVision because they provide plausible
continuity while allowing major environmental change.

``` text
target
→ explosion
→ camera enters dense smoke
→ visibility disappears
→ camera emerges from smoke
→ clear open space
```

The smoke is not merely decoration. It is a physical transition
mechanism.

**Future.** Prompt Coach should recognize opportunities like this
without forcing them into every journey.

---

## 18. Experimental finding: turns / heading changes

**Experimental.** Current sessions indicate a weakness around turns,
observed in different environments:

-   Chernobyl switchback stairs
-   Pac-Man-style maze traversal

The issue appears broader than stair geometry. Direction changes
themselves can be difficult.

An experimental improvement was changing camera language from
generic continuous forward travel toward:

> Forward motion follows the physical path through the environment,
> not a fixed world-space direction.

And:

> When the route changes direction, physically rotate/bank onto
> the new heading, then continue forward.

For intersections, corners, landings, and switchbacks, explicitly
describing the heading change improved at least one Pac-Man
experiment.

**Do not** conclude that every human Journey prompt should contain
this language. This is likely **internal** grammar / Cinematographer
conditioning. Prompt Coach should absorb that knowledge instead of
leaking the workaround into user prompts.

**Future.** The POV baseline / Camera Grammar / Cinematographer
conditioning should understand path-relative forward motion
automatically. The filmmaker should eventually be able to say
"race through the maze" without understanding TunnelVision's
heading-change problem.

---

## 19. Stairs are not yet a special case

**Experimental.** Early Chernobyl testing suggested switchback
stairs might need special handling. Pac-Man-style **horizontal**
maze turns also struggled.

Current evidence suggests the broader problem may be
**direction / heading change**, not vertical architectural traversal
specifically.

Do not prematurely create a special STAIRS solution from the early
experiment. Continue testing. Potential **ASCEND / DESCEND** grammar
remains a research direction, not current work.

---

## 20. Do not leak implementation workarounds

This is a critical principle.

If TunnelVision currently needs special wording to overcome a
generation weakness, do **not** automatically teach every filmmaker
that workaround.

``` text
USER:          "race through a maze"
PROMPT COACH:  understands intended physical navigation
INTERNAL:      adds whatever heading / path guidance TV currently requires
```

**Future.** Prompt Coach is partly an abstraction boundary between
creative language and filmmaking / model language.

---

## 21. Prompt Coach responsibilities

**Future.** When reviewing a Journey idea, Prompt Coach should
quietly ask:

1.  Does the Director understand the story?
2.  Are there strong potential Destinations / canonicals?
3.  Is there a physically connected journey?
4.  Are important thresholds available or reasonably inferable?
5.  Are continuity anchors explicit?
6.  Is broad camera intent stated or clearly implied — and does the
    whole journey stay in one grammar (hackathon: POV, FOLLOW,
    LEAD, or MOUNTED)?
7.  Is there enough visual direction for the intended aesthetic?
8.  Is there an emotional / narrative progression?
9.  Are essential story actions explicit?
10. Am I accidentally doing the Director's or Cinematographer's job?

Then make the **smallest useful changes**.

---

## 22. What Prompt Coach should avoid

Avoid:

-   huge verbose prompts by default
-   unnecessary numbered shot choreography
-   raw model-specific prompt engineering
-   specifying every camera turn
-   specifying every meter of movement
-   repeating visual style in every beat
-   repeatedly describing persistent subjects
-   exposing Camotion terminology to normal filmmakers
-   exposing A′ / B′ terminology to normal filmmakers
-   forcing filmmakers to understand canonical construction
-   forcing current model weaknesses into the filmmaker's vocabulary
-   removing opportunities for Director creativity
-   treating every journey as Derive
-   encouraging grammar switching within a single journey
-   assuming more words means a better journey

---

## 23. Desired human experience

The ideal interaction is:

``` text
HUMAN:
"I want to start outside Chernobyl, enter Pripyat, pass the
amusement park, enter an apartment building, climb several
switchback floors, and emerge into a rooftop garden overlooking
the abandoned city. Photoreal cinematic."

TUNNELVISION:
understands the creative intent
constructs useful Destinations
creates physically plausible thresholds
preserves the visual style
handles camera grammar
handles traversal geometry
selects appropriate generation strategy
evaluates its own work
corrects weak canonicals / traversals
produces the journey
```

**Current** already covers parts of this (Journey prompt → Director
plan → Derived Construct → CM → Camotion → NEW TAKE → selected
Takes). Camera Grammar classification, Discover, Model Router
policy, and Prompt Coach itself are **not** current.

The filmmaker should not have to become a TunnelVision prompt
engineer.

---

## 24. Over-prompted vs TunnelVision-appropriate

**Over-prompted:** a long specification of exact lens behavior, every
camera turn, exact movement vectors, extensive negative prompts,
every lighting detail, every environmental object, every transition
mechanism, and every generation constraint.

**TunnelVision-appropriate:**

``` text
Photorealistic cinematic POV. Approach a colossal
planet-destroying space station and dive into its trench. Race
deeper as defensive fire becomes increasingly intense and enemy
fighters close in. The final trench run becomes brutally tense as
the target approaches. Launch two torpedoes and watch them streak
ahead into the target opening. Escape through the resulting smoke
and emerge into the calm expanse of open space for an epic final
reveal of the station's destruction.
```

Why the shorter version is better:

-   clear story
-   clear camera intent
-   strong potential canonicals
-   physical route
-   escalation
-   essential action is explicit
-   useful transition mechanism
-   strong payoff
-   enough aesthetic direction
-   leaves the Director room to direct
-   leaves the Cinematographer room to shoot

---

## 25. Red paper airplane lesson

**Experimental / session evidence.** Preserve the red paper airplane
journey as a qualitative reference, not a prompt to copy.
[sessions/red-paper-airplane.md](sessions/red-paper-airplane.md).

That Agent run produced some of TunnelVision's strongest visual
results and useful continuous-space planning. The journey followed a
persistent red paper airplane through distinct but physically
connected environments — a FOLLOW-shaped continuity anchor, not a
prompt to copy.

Structural lessons:

-   simple recognizable continuity anchor
-   visually distinct Destinations
-   obvious onward movement
-   physical thresholds
-   cinematic visual direction
-   Director freedom to solve transitions
-   strong local A→B opportunities

Do not overfit future prompting to the literal paper-airplane
scenario. Extract the structure.

---

## 26. Prompt Coach as intent compiler

**Future / reinforced by experiment.** Think of Prompt Coach less as
"make the prompt longer" and more as:

> Compile human creative intent into structured filmmaking intent.

Prompt Coach = **intent compiler**, not verbosity engine. Concise
human creative intent is enough. **Paper Chase** was a compact
title-first prompt; the Director expanded it into useful destinations
and later continued it into four additional beats. Do not stuff the
human prompt with raw geometry or video-model instructions.

Conceptual structured output (not a schema to add now):

-   creative intent
-   camera intent
-   persistent subjects
-   visual style
-   journey topology
-   important Destinations
-   essential actions
-   narrative arc
-   continuity constraints
-   environmental transition opportunities

That structured intent could later be consumed differently by
Director, Cinematographer, Camera Grammar, model routing, image
generation, and video generation.

Do **not** implement this architecture from this document.

---

## 27. Relationship to Camera Grammar

Prompt Coach and Camera Grammar solve different problems.

| Layer | Question |
| --- | --- |
| **Prompt Coach** (future) | What movie is the human asking for? |
| **Director** (current) | Where does that movie go? |
| **Cinematographer** (current) | Can / how should this local traversal be shot? |
| **Camera Grammar** | What family of camera behavior does this **journey** require? (POV, FOLLOW, LEAD, or MOUNTED — one grammar for the whole journey) |
| **Model Router** (discovery) | Which generation strategy / model is appropriate? |
| **Generation model** (current adapters) | Actually creates the media. |

Do not collapse these responsibilities into one giant prompt. Prompt Coach
does not author camera-grammar law; CAMERA already owns that.

---

## 28. Relationship to Project persistence

**Current.** The Project already persists Journey prompt (`story`),
storyboard Destinations, Takes, evaluations, and generation
metadata. The original human prompt is project story.

**Future.** As Prompt Coach / Creative Intent features become real,
their structured outputs should be persisted on the Project.
Do **not** add speculative fields to the current schema because they
are described here. Persistence follows implemented features.

When those features exist, Project history should continue
preserving:

-   original human Journey prompt
-   generated / resolved intent
-   canonical Takes
-   traversal Takes
-   evaluations
-   generation metadata
-   future grammar decisions
-   future model-routing decisions

Saved Projects then become experimental evidence about what
prompting, camera strategies, and models actually worked.

---

## 29. Current status vs future direction

| Kind | What is true now |
| --- | --- |
| **Current observed practice** | Journey prompt → PLAN JOURNEY / CREATE JOURNEY → sequential Derived Construct → CM on actual pairs → Camotion A′/B′ → NEW TAKE. Selected whole-journey camera grammar (POV / FOLLOW / LEAD / MOUNTED) conditions Director, stills, CM, and the locomotion baseline. Discover is unwired. |
| **Experimental findings** | Path-relative forward-motion wording; turn / heading-change weakness; Chernobyl / Pac-Man / Pripyat / paper-airplane session lessons; FOLLOW skier ~10s Kling: elastic following distance is cinematic, not a failure. Canyon grammar experiment (18 September 2026): four Projects, same route, POV / FOLLOW / LEAD / MOUNTED; grammar held in stills and CM; filmmaker Kling 2.5 Turbo Pro recuts. Paper Chase (19 September 2026): title-first compact stylized POV prompt; Director expanded beats; a second agent run filled E–H without rewriting A–D. |
| **Current / pre-hackathon** | POV, FOLLOW, LEAD, MOUNTED. One grammar per entire journey. Prompt Coach remains documentation, not a product agent. Segment Adaptive/Fixed duration mapping is live. |
| **Post-hackathon** | Mixed grammar within one journey; grammar switching between adjacent traversals; multiple camera interpretations of the same canonical; explicit camera cuts at grammar changes; continuous transitions between grammars; coverage planning; richer shot-duration planning. |
| **Future direction** | Prompt Coach / Intent Conditioning; structured creative intent; Project-level Creative Direction; agentic Runway Model Router control; Discover as a second construction strategy. |

Do not document future concepts as though they already exist.

---

## 30. Core principle

**THE HUMAN DESCRIBES THE MOVIE.
TUNNELVISION FIGURES OUT HOW TO MAKE THE JOURNEY.**

**THE HUMAN CHOOSES OR IMPLIES THE CAMERA RELATIONSHIP.
TUNNELVISION PRESERVES THAT GRAMMAR ACROSS THE JOURNEY.**

Prompt Coach should make the smallest useful intervention needed to
preserve story intent, physical continuity, camera grammar,
continuity anchors, cinematic quality, strong destinations, and
shootability — without replacing the creative contribution of
either the human or TunnelVision's filmmaking roles, and without
turning the idea into a giant low-level generation prompt.

The best Prompt Coach intervention is usually the **smallest one**
that gives the filmmaking system what it actually needs.
