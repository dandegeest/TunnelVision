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

The filmmaker's job is primarily to describe:

-   where they want to go
-   what happens along the way
-   what is visually and narratively important
-   how the journey should feel
-   important continuity anchors
-   broad camera intent when it matters

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

**Researched / planned categories** (HACKATHON / DISCOVERY; not
current product classification):

| Grammar | Meaning |
| --- | --- |
| **FPOV** | Camera itself is the traveler. |
| **FP_FOLLOW** | Camera follows a persistent subject. |
| **REVERSE_LEAD** | Camera retreats while facing an advancing subject. |
| **MOUNTED** | Camera is physically mounted on a vehicle or object. |
| Later | SIDE_TRACK, ORBIT, ASCEND / DESCEND, OBJECT / PROJECTILE, SUBJECT HANDOFF, FREE |

**Current.** Product locomotion law is forward unembodied FPOV
(`TUNNELVISION_LOCOMOTION_BASELINE_TEMPLATE`). The Director can
already write non-FPOV intent in a plan; the Cinematographer
baseline can still override it (Reverse Lead astronaut exhibit).
Camera Grammar classification is **not** implemented. Do not
document it as live behavior. See
[BACKLOG.md — Camera grammar classification](BACKLOG.md#camera-grammar-classification)
and [RESEARCH_BACKLOG.md](RESEARCH_BACKLOG.md#camera-grammar).

**Useful prompting principle (current + future).** The filmmaker may
express broad camera intent. TunnelVision should **eventually**
translate that into the appropriate internal grammar and
conditioning. Do not require the filmmaker to name the taxonomy.

---

## 9. FPOV

FPOV means the camera itself is the traveler: through a maze, a
trench, a building, a road.

**Current product law** ([AGENTS.md](AGENTS.md)): TunnelVision uses
an **unembodied** first-person POV unless the filmmaker explicitly
asks otherwise. Do not automatically introduce hands, feet, skis,
cockpit, handlebars, hood, vehicle body, camera operator, avatar, or
persistent foreground equipment. Filmmaker and Director story text
should not add a POV clause; the product injects the unembodied
constraint.

If the filmmaker explicitly requests embodied or mounted POV, those
elements may be appropriate.

**Future.** A Prompt Coach should not require humans to repeatedly
specify "no hands, no skis, no cockpit." That belongs in the FPOV
baseline.

---

## 10. FP Follow

**Experimental / discovery.** FP_FOLLOW is a researched grammar, not
a current CM classifier.

FP Follow means the camera follows a persistent subject through the
environment. Subjects discussed in sessions and discovery notes:
glowing koi, downhill skier, tornado, roller coaster, red paper
airplane.

The followed subject is the primary continuity anchor. The camera
should follow the subject's physical route without overtaking it or
arbitrarily changing perspective. The camera itself should generally
remain invisible.

Example: a downhill skier is visible ahead. The pursuing camera is
**not** necessarily another visible skier. Skis, poles, or a body
belonging to a camera operator should not appear automatically.

**Future.** That distinction should live in an FP Follow baseline
rather than requiring every Journey prompt to explain it.

---

## 11. Mounted is different

**Discovery.** MOUNTED is a researched grammar, not current product
classification.

If the camera is physically mounted to a vehicle or object,
persistent foreground geometry may be **desirable**: car hood,
handlebars, boat bow, aircraft structure.

Do not apply FPOV's default "no persistent foreground objects" rule
blindly to Mounted shots. This is one reason grammar-specific
baselines are preferable to one universal locomotion baseline.
[HACKATHON.md](HACKATHON.md) records the same conflict.

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
session produced some of the strongest-looking canonicals so far and
reinforced compact cinematic intent. See
[sessions/red-paper-airplane.md](sessions/red-paper-airplane.md).

Filmmakers should **not** be expected to write long image-model
style prompts. A compact direction may be enough:

``` text
Photorealistic cinematic live action, natural physical lighting and
materials, feature-film scale.
```

``` text
Photorealistic cinematic FP Follow.
```

**Future.** Prompt Coach / Intent Conditioning should expand compact
creative style language into appropriate downstream model-specific
conditioning. Do not make the filmmaker write that expansion.

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

---

## 16. Important actions should be explicit

If a particular visual event is essential, state it.

Example: for an attack run, if the filmmaker specifically wants to
**see** two torpedoes launch from the FPOV camera position, travel
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

> When the route changes direction, the camera physically rotates
> onto the new heading, then continues forward.

For intersections, corners, landings, and switchbacks, explicitly
describing the heading change improved at least one Pac-Man
experiment.

**Do not** conclude that every human Journey prompt should contain
this language.

**Future.** The likely solution is for the FPOV baseline / Camera
Grammar / Cinematographer conditioning to understand path-relative
forward motion automatically. The filmmaker should eventually be
able to say "race through the maze" without understanding
TunnelVision's heading-change problem.

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
6.  Is broad camera intent clear when it matters?
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
Photorealistic cinematic FPOV. Approach a colossal
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
connected environments.

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

**Future.** Think of Prompt Coach less as "make the prompt longer"
and more as:

> Compile human creative intent into structured filmmaking intent.

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
| **Camera Grammar** (discovery) | What family of camera behavior does this traversal require? |
| **Model Router** (discovery) | Which generation strategy / model is appropriate? |
| **Generation model** (current adapters) | Actually creates the media. |

Do not collapse these responsibilities into one giant prompt.

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
| **Current observed practice** | Journey prompt → PLAN JOURNEY / CREATE JOURNEY → sequential Derived Construct → CM on actual pairs → Camotion A′/B′ → NEW TAKE. Unembodied FPOV baseline. Discover is unwired. |
| **Experimental findings** | Path-relative forward-motion wording; turn / heading-change weakness; Chernobyl / Pac-Man / Pripyat / paper-airplane session lessons; Camera Grammar exploration. |
| **Future direction** | Prompt Coach / Intent Conditioning; structured creative intent; Project-level Creative Direction; automatic Camera Grammar classification; agentic Runway Model Router control; Discover as a second construction strategy. |

Do not document future concepts as though they already exist.

---

## 30. Core principle

**THE HUMAN DESCRIBES THE MOVIE.
TUNNELVISION FIGURES OUT HOW TO MAKE THE JOURNEY.**

Prompt Coach should improve clarity, continuity, cinematic intent,
and shootability without replacing the creative contribution of
either the human or TunnelVision's filmmaking roles.

The best Prompt Coach intervention is usually the **smallest one**
that gives the filmmaking system what it actually needs.
