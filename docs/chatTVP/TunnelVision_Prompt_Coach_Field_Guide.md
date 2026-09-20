# TunnelVision Prompt Coach Field Guide

## Purpose

This guide contains the accumulated creative and empirical knowledge used by TunnelVision Prompt Coach.

It is reference material, not an instruction to expose TunnelVision internals in every filmmaker prompt.

The Prompt Coach should use these principles to improve story prompts while keeping final prompts concise.

---

# 1. What TunnelVision Is

TunnelVision creates continuous cinematic journeys through a sequence of visual destinations.

Conceptually:

A → B → C → D

A, B, C, etc. are pristine canonical destination frames representing story-space locations.

TunnelVision derives Camotion-conditioned shooting frames:

A′, B′, C′, etc.

Generated traversals are created between conditioned shooting states.

An A→B traversal may internally use A′ and B′.

The filmmaker should not normally need to think about this distinction. Prompt Coach should work at the level of story intent, destinations, visual motifs, and style.

---

# 2. Creative Roles

## Filmmaker

Provides creative intent:
- story
- subject
- important beats
- style
- destination count when useful

## Prompt Coach

Translates rough intent into a concise TunnelVision-native story prompt.

Prompt Coach should improve:
- clarity
- spatial progression
- motif consistency
- launchability
- journey structure

Prompt Coach should NOT micromanage:
- exact camera coordinates
- provider/model selection
- Camotion
- image conditioning
- evaluation thresholds
- retry logic
- implementation details

## Director

Decides where the movie goes.

The Director turns filmmaker intent into a sequence of spatially traversable destinations.

## Cinematographer

Determines how a traversal can be shot.

The CM reasons about:
- camera movement
- traversal viability
- duration
- pace
- shooting geometry

Prompt Coach should leave room for both Director and Cinematographer to do their jobs.

---

# 3. Prompt Coach Philosophy

The filmmaker prompt should primarily communicate:

1. SUBJECT / STORY
2. DESTINATIONS / BEATS
3. STYLE

The filmmaker should describe the movie, not the implementation.

Prefer:

> A giant parade balloon breaks loose from a nighttime city parade and travels from downtown through progressively larger environments until reaching ocean cliffs at sunrise.

over:

> Track exactly 12 feet behind the balloon, maintain a 35 mm lens, pan 20 degrees left, preserve a fixed horizon, and accelerate for 2.5 seconds.

Prompt Coach is an intent compiler, not a verbosity engine.

Short prompts can work extremely well.

---

# 4. Title-First Convention

Every finished story prompt should begin with a short evocative title.

Example:

Paper Chase

This convention proved useful because:
- it gives the journey immediate identity
- it reads like a film rather than a model request
- it naturally supplies the project name for TunnelVision Save As
- it creates a useful creative anchor for both filmmaker and agent

Do not write:

Title: Paper Chase

Just write:

Paper Chase

---

# 5. Camera Grammars

TunnelVision supports exactly four camera grammars.

## POV

The camera IS the traveler.

Characteristics:
- usually unembodied
- travel direction is camera direction
- turns should physically turn/bank the camera
- especially effective for environmental transformation
- strong for stairs, hallways, tunnels, doors, rides, paths, and surreal journeys

Avoid:
- viewer hands
- operator body
- visible camera equipment
- accidental transformation into FOLLOW or LEAD

POV has proven particularly robust because continuity depends primarily on world geometry rather than persistent character identity.

---

## FOLLOW

An invisible objective camera follows behind a visible persistent subject.

Core principle:

**FOLLOW preserves the relationship, not the distance.**

The subject should remain:
- ahead
- receding or traveling forward
- the visual anchor

The camera may:
- lag
- catch up
- drift slightly
- bank
- change distance naturally

Avoid:
- rigid fixed-distance locking
- overtaking the subject without narrative reason
- turning into LEAD
- visible second traveler/operator

FOLLOW has produced some of TunnelVision's strongest shots.

However, long FOLLOW journeys can reveal persistent-subject identity drift.

---

## LEAD

An invisible objective camera travels ahead of a visible subject while facing it.

The camera retreats as the subject advances.

Useful when:
- subject expression matters
- front-facing action matters
- seeing the subject's response is important

Avoid accidentally rewriting LEAD into:
- forward POV
- FOLLOW
- arbitrary fly-past shots

---

## MOUNTED

The camera is physically attached or closely associated with a moving subject, object, or vehicle.

It inherits:
- acceleration
- turns
- banking
- vibration
- orientation

The mount relationship may be somewhat cinematic rather than mechanically rigid.

Avoid unnecessarily specifying vehicle-specific geometry unless the story requires it.

---

# 6. Destinations Over Micro-Choreography

TunnelVision works best when prompts describe meaningful destinations.

Good:

office → hallway → subway → rooftop → clouds

Weak:

move five feet → turn left → move three feet → tilt upward

Each destination should represent:
- a new place
- a new spatial volume
- a significant story state
- or an important visual transformation

Do not create storyboard beats simply because the camera approaches and crosses the same threshold.

A single traversal can contain meaningful motion.

---

# 7. Physical Continuity

TunnelVision is strongest when the journey can plausibly exist as one connected physical route.

Useful spatial connectors include:

- doors
- stairs
- hallways
- alleys
- tunnels
- windows
- arches
- bridges
- ramps
- corners
- gates
- cave mouths
- channels
- paths
- openings
- shafts
- gaps between structures

Visual continuity alone is not enough.

Two images can:
- share style
- share environment
- look individually beautiful

and still be extremely difficult to traverse between.

Prompt Coach should encourage physically connected worlds without over-specifying every route.

---

# 8. Launchability

A major empirical finding:

**Destination quality and launchability are different things.**

A destination can be:
- beautiful
- stylistically correct
- high in set consistency

but still be a poor place from which to launch the next traversal.

Example from Midnight Descent:

The opening rooftop was visually excellent.

The Director then planned:

rooftop → heavy metal door → stairwell

But the opening canonical did not clearly expose that door as available traversable geometry.

The result:
- semantically sensible B
- visually related A and B
- poor traversal viability
- video model forced to invent connective geometry

Lesson:

Prefer destinations that plausibly expose somewhere to go next.

Especially for A, avoid beautiful scenic dead ends when another composition could preserve the beauty while also providing a viable route.

---

# 9. Thresholds and Direction Changes

Turns and threshold crossings are valuable for two reasons.

First, they improve spatial storytelling.

Second, they may help disguise generated segment boundaries.

Useful moments include:
- entering a stairwell
- turning through a corridor
- entering a tunnel
- passing through a doorway
- banking around a building
- launching from a rooftop
- emerging from a tunnel
- moving from enclosure into open landscape

A direction change can make a change in motion field feel intentional.

Do not force one at every destination.

Use them where they naturally serve the journey.

---

# 10. Persistent Subjects and Identity Drift

FOLLOW, LEAD, and MOUNTED often rely on visible persistent subjects.

Make the persistent subject clear.

Example:

> the same enormous bright red parade balloon

Do not redescribe it at every beat.

Long-horizon testing showed that subject identity can drift recursively.

## Runaway Parade Balloon

The balloon began as a clear red parade balloon.

Over many generated canonicals it:
- gained a basket
- became more hot-air-balloon-like
- became increasingly anatomical
- became a humanoid / superhero-like figure
- later stabilized into other strange red balloon-like forms

Important finding:

Camera geometry and subject identity are separate dimensions.

FOLLOW geometry remained strong even when identity degraded badly.

Likely mechanism:
each generated canonical becomes the next generation's visual truth, so small deviations compound.

Future subject-reference systems may help, but Prompt Coach should not attempt to solve this technically.

For long visible-subject journeys, favor distinctive, conceptually stable subjects.

---

# 11. Controlled Surrealism

Intentional transformation can work extremely well when semantic continuity survives.

Paper Chase demonstrated this.

Progression:

paper on desk  
→ flying sheets  
→ paper vortex  
→ airborne papers  
→ origami birds  
→ white ink vortex

The motif evolves, but remains recognizably related to paper.

This differs from accidental identity drift.

Useful principle:

**Transform the motif without abandoning it.**

Good surreal evolution often preserves:
- material
- shape family
- semantic association
- recurring color
- movement pattern
- symbolic idea

---

# 12. Style

TunnelVision is not limited to photorealism.

Successful directions include:

- photorealistic live action
- rotoscoped animation
- pencil-and-ink
- graphic animation
- watercolor
- claymation
- surreal illustration
- other visually coherent styles

Keep style descriptions compact.

## Photoreal baseline

Photorealistic live-action cinematography, natural physical lighting, realistic materials, atmospheric depth.

## Stylized baseline

Hand-drawn rotoscoped music-video look, sketchy ink lines, lightly posterized shading, surreal animated feel.

Avoid drowning the story in rendering terminology.

---

# 13. Paper Chase

Paper Chase is one of the strongest TunnelVision examples so far.

Initial journey:

desk  
→ narrow hallway with flying paper  
→ subway platform / paper vortex  
→ rooftop at sunset

The prompt was concise.

The output was unusually strong.

Four additional beats were later added in a second agent run:

rooftop  
→ sky  
→ cloud layer  
→ starry upper atmosphere  
→ oversized moon  
→ ink vortex

The second run:
- preserved A–D
- preserved POV
- preserved style
- preserved the paper motif
- expanded into genuinely new spaces
- remained nearly flawless in playback

Lessons:

- concise prompts can be enough
- stylized journeys are highly viable
- existing actual destinations can remain authoritative across later agent runs
- incremental extension can work naturally
- controlled surreal escalation can produce strong continuity
- POV is especially effective for journeys where the world itself is the continuity anchor

Use Paper Chase as a principle, not a template to copy.

---

# 14. Runaway Parade Balloon

A long FOLLOW stress test used approximately 26 destinations.

Progression included:

night parade  
→ downtown  
→ skyscrapers  
→ elevated rail  
→ stadium district  
→ river  
→ bridge  
→ amusement park  
→ highway  
→ airport  
→ farmland  
→ storm  
→ mountains  
→ cloud sea  
→ forest  
→ ocean cliffs  
→ sunrise

The resulting film was roughly four minutes.

Findings:
- long-form autonomous planning worked
- spatial progression remained strong
- FOLLOW camera relationship stayed surprisingly robust
- many shots were spectacular
- persistent-subject identity drift accumulated over time
- one provider failure occurred
- flat concatenation remained surprisingly watchable

This test supports long-form journey viability while revealing long-horizon identity challenges.

---

# 15. Incremental Journeys

TunnelVision supports partially specified projects.

Existing actual destinations are authoritative.

New agent runs may fill unresolved slots without replacing prior canonicals.

Prompt Coach should therefore treat continuation prompts as the next act of the same film.

When continuing:
- preserve the established visual language
- preserve camera grammar
- preserve subjects and motifs
- introduce genuinely new spaces
- increase scale, tension, surrealism, intimacy, or other meaningful dimension
- avoid merely generating four more variations of the previous scene

Paper Chase is the strongest example of successful incremental extension.

---

# 16. Far-Field Guidance

A destination does not need to visibly contain the next destination.

Future environmental information should be optional.

Useful principle:

Include distant future geography only when it fits naturally from the current viewpoint.

Do not force the next destination into the current frame.

Do not let distant future elements dominate or drive:
- composition
- lighting
- style
- current destination identity

A subtle glimpse can help spatial continuity.

A forced glimpse can contaminate the current scene.

---

# 17. Pace and Duration

Pace describes cinematic kinetic feel.

Duration is shot length.

These are related but distinct.

Prompt Coach generally should not specify exact duration.

The Cinematographer can select duration based on:
- distance
- complexity
- obstacles
- thresholds
- dramatic intent
- grammar
- action

Different traversals may appropriately use different pacing.

Do not force uniform speed merely for continuity.

---

# 18. Boundary Continuity Research

Current TunnelVision export is essentially flat concatenation of generated traversals.

Despite this simplicity, many boundaries are already very good.

There is:
- no mandatory optical-flow stitching
- no mandatory retiming
- no sophisticated boundary synthesis
- no hidden smoothing pass

Yet journeys often read as continuous.

This is important:

**Boundary finishing is polish, not rescue.**

---

# 19. Visual Boundary vs Kinetic Boundary

These are separate problems.

## Visual boundary continuity

Question:

Do the last frame of A→B and first frame of B→C look similar?

Possible issues:
- blur
- local geometry shift
- linework change
- subject position shift
- duplicated near-identical frame

## Kinetic continuity

Question:

Does apparent motion continue naturally through the cut?

Possible issue:

A→B may end at apparent velocity X.

B→C may begin at apparent velocity Y.

Even with identical nominal pace settings:

X may not equal Y.

Therefore:

**same requested pace does not guarantee same boundary velocity.**

Do not conflate visual matching with kinetic continuity.

---

# 20. Paper Chase Boundary Experiment

A Paper Chase boundary was inspected manually.

The incoming end frame and outgoing start frame were extremely similar.

Aligned elements included:
- hallway perspective
- stair placement
- EXIT sign
- ceiling light
- wall geometry
- major paper positions

Differences were mostly:
- blur
- tiny paper-edge changes
- minor line/shading differences

A manual 50/50 single-frame blend was tested in DaVinci Resolve.

Result:
- visually valid
- not meaningfully better than the original cut

Lesson:

Do not automatically blend every boundary.

When two frames are nearly redundant, simply dropping one may be preferable.

---

# 21. Adaptive Boundary Finishing

Future research may classify boundaries before applying any finishing.

Possible conceptual categories:

## Very high visual similarity

Frames are nearly redundant.

Possible treatment:
- keep only one

## Small aligned difference

Frames remain spatially aligned but differ slightly.

Possible treatment:
- single-frame blend
- weighted blend

## Significant mismatch

Naive averaging may produce ghosting.

Possible future treatment:
- leave unchanged
- motion-aligned interpolation
- optical-flow bridge

These are research ideas only.

Flat concat remains the baseline.

Use the least invasive treatment necessary.

---

# 22. Direction Changes as Natural Edit Masks

Paper Chase suggested another useful idea.

When the route changes direction at a boundary, the viewer already expects the motion field to change.

Therefore a seam may be less perceptible at:

- turns
- thresholds
- stairs
- tunnel entrances
- doorway exits
- rooftop launches
- bends in paths

Same-heading movement may expose velocity differences more clearly.

This suggests that good spatial storytelling can naturally create better edit points.

Do not force artificial turns just to hide seams.

---

# 23. FOLLOW vs POV Boundary Visibility

Observed:

Boundary hiccups have been more noticeable in FOLLOW than POV.

Hypothesis:

POV has one dominant motion reference: the traveling camera.

FOLLOW has at least two:
- camera motion
- subject motion relative to camera

Small velocity discontinuities may therefore be more perceptually obvious in FOLLOW.

This is an observation and plausible interpretation, not a proven law.

---

# 24. Future Boundary Finishing Ideas

Post-freeze research may explore:

1. flat concat baseline
2. redundant-frame trimming
3. one-frame blend
4. motion-aligned midpoint
5. short optical-flow bridge
6. localized retiming
7. optical-flow-assisted retiming

Potential architecture:

boundary analysis  
→ classify similarity / alignment / kinetic mismatch  
→ select minimal treatment  
→ FFmpeg performs trim / blend / retime / interpolation  
→ concat/export

Do not build a custom video-processing engine unless evidence demands it.

---

# 25. Destination Count

Honor requested destination count.

A useful rough heuristic:

Quick experiment:
4–6 destinations

Medium journey:
6–10

Long-form or stress test:
12+

Do not pad the journey merely to reach a number.

Each beat should materially advance:
- geography
- story
- visual state
- scale
- tone
- or motif

Current implementations may have addressing limits such as A–Z. Prompt Coach should respect known product constraints when relevant.

---

# 26. Strong Prompt Pattern

A strong TunnelVision prompt often looks like:

Title

Core journey/story concept.

Important progression or destinations.

Compact style statement.

Example:

Paper Chase

Stylized first-person journey following loose papers from a cluttered desk through a narrow hallway, down into a subway platform where the sheets swirl toward a dark tunnel, and finally out onto a windy rooftop at sunset.

Keep the journey physically continuous and let the papers act as a recurring visual motif as the environments grow increasingly surreal.

Hand-drawn rotoscoped music-video look with sketchy ink lines, lightly posterized shading, and expressive animated movement.

---

# 27. Weak Prompt Patterns

Avoid prompts dominated by:

## Excessive camera mechanics

Do not write:
- exact distances
- lens values
- pan degrees
- frame-by-frame choreography

unless explicitly required.

## Disconnected scene lists

Weak:

beach → Mars → basement → forest

without a plausible connective idea.

Improve by finding:
- thresholds
- transformations
- routes
- recurring motifs

## Repetitive geography

Avoid five consecutive beats that are merely slightly different versions of the same room or street.

## Scenic dead ends

A gorgeous overlook can be appropriate as a final destination.

It may be poor as an intermediate destination if there is nowhere obvious to continue.

## Accidental subject mutation

If a subject should remain persistent, do not casually introduce transformations that undermine identity.

---

# 28. Creative Generation Strategy

When asked for ideas, vary several dimensions at once.

## Environment

- architecture
- wilderness
- industrial
- domestic
- underwater
- aerial
- underground
- microscopic
- surreal

## Subject

- person
- animal
- vehicle
- object
- weather phenomenon
- flock
- artifact
- no visible subject

## Tone

- playful
- ominous
- peaceful
- absurd
- mysterious
- epic
- intimate

## Style

- live action
- ink
- rotoscope
- clay
- watercolor
- graphic novel
- miniature
- archival
- surreal collage

## Scale

- room-sized
- city
- landscape
- planetary
- microscopic
- abstract

Avoid falling repeatedly into:
- city fly-through
- sci-fi corridor
- generic chase
- generic fantasy landscape

---

# 29. Prompt Critique Checklist

When reviewing an existing story prompt, ask:

1. Is there a clear subject or journey premise?
2. Are destinations meaningfully different?
3. Can the spaces plausibly connect?
4. Is the opening launchable?
5. Are there useful thresholds?
6. Does the route contain some spatial variation?
7. Is a persistent subject clearly defined?
8. Is transformation intentional?
9. Is style clear but concise?
10. Is the prompt describing filmmaking intent rather than technical generation instructions?
11. Does the journey escalate?
12. Does it leave enough room for the Director to direct?

---

# 30. Final Principle

The strongest TunnelVision prompts are not the most detailed prompts.

They provide:

**clear intent  
+ memorable progression  
+ physically connected space  
+ a strong motif or subject  
+ concise visual style**

while leaving enough uncertainty for the autonomous Director and Cinematographer to make interesting decisions.

The goal is not to specify every frame.

The goal is to give TunnelVision a movie worth discovering.
