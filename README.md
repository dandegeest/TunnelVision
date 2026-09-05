# TunnelVision

**An agentic filmmaking experiment for directing continuous journeys through AI-imagined worlds.**

TunnelVision explores whether generative image and video models can be orchestrated into a system that doesn't simply create individual shots, but **directs an evolving journey through a continuous imagined world**.

The goal is a system that can decide where to go next, learn from human creative choices, maintain the visual and spatial logic of the world, and generate convincing continuous camera movement between selected viewpoints.

## Origin

**TunnelVision** originated with filmmaker **Terran Boylan**. He developed the concept and manual generative filmmaking technique through work for his own YouTube channel and video content, before the Peter Gabriel *Digging in the Dirt* project. The technique was later adapted for that film, where we used the playful name **TunnelTV** — an homage to MTV.

Terran's original TunnelVision workflow used successive generated frames to move a first-person camera through an imagined environment, with each selected frame becoming the visual foundation for the next step.

This repository is agentic filmmaking research extending that original TunnelVision work:

- **Original TunnelVision:** Terran Boylan's concept and manual filmmaking technique.
- **TunnelTV:** playful DITD-era label for that application's adaptation of TunnelVision.
- **Current research:** agentic exploration and filmmaking through imagined worlds, including Director/Cinematographer architecture and Camotion.

This project asks:

> **What happens if that process becomes self-directing?**

Rather than replacing Terran's original technique, this research attempts to understand, automate, and generalize it into a system where an AI Director decides where the journey should go and an AI Cinematographer determines how to move the camera there.

## The Core Idea

A good next frame should:

> **Preserve the world's rules while changing the viewer's question.**

TunnelVision maintains a sequence of canonical viewpoints:

`A → B → C → D → E → F → ...`

Each selected frame becomes both part of the visual history of the journey and the starting point for deciding where to go next.

The emerging loop is:

`OBSERVE → PROPOSE → GENERATE → EVALUATE → SELECT → MOVE`

Human selections become creative feedback. Features that emerge accidentally can become preferences, landmarks, or even future routes.

## Director + Cinematographer

The system is organized around real filmmaking responsibilities rather than implementation-oriented "AI agents."

### Director

The **Director** decides where the journey should go next.

It considers:

- the current canonical frame
- the journey so far
- continuity with the established world
- learned creative preferences
- novelty and discovery
- navigability
- perceptible camera displacement

An important prototype finding was that **scene evolution can masquerade as camera movement**.

Several frames looked like successful progression when evaluated individually, but viewing the entire sequence as a reel revealed that the environment had changed while the camera appeared to remain almost stationary.

The Director therefore needs to evaluate not only whether a candidate looks different, but whether it provides convincing evidence that the **camera itself has moved through space**.

### Cinematographer

The **Cinematographer** determines how to physically travel between the Director's canonical viewpoints.

It considers:

- continuous camera locomotion
- parallax
- foreground occlusion
- route geometry
- environment-specific motion cues
- bounded Camotion conditioning strength (`0.02` / `0.04` / `0.08`)
- velocity continuity
- shared canonical anchors

Integration Test 01 assembled those clips into a loop and showed that
**exit/entry velocity across shot boundaries** can also jump
accidentally. Through-motion at canonical anchors remains the intended
constraint; movie-level rhythm is a later Cinematographer concern, not
a post-process patch. See `docs/RESEARCH_BACKLOG.md`.

Experiments revealed an important distinction:

> **Visual continuity does not guarantee spatial traversability.**

Video models can produce beautiful transitions while effectively dissolving or transforming one environment into another rather than moving a camera between them.

A key breakthrough came from returning to Terran Boylan's original TunnelVision motion-prompting philosophy.

Instead of instructing the model primarily to **arrive at the destination frame**, the prompt establishes continuous locomotion as the governing constraint:

> **Never stop moving.**

Using the same start and destination frames that previously produced a dissolve-like transition, this strategy generated substantially more convincing physical travel.

Foreground objects passed the camera, natural occlusions provided opportunities to reconstruct unseen geometry, and strong parallax maintained the perception of movement through a continuous world.

## Canonical Frames as Shared Anchors

The ideal generated sequence looks like:

`A → B | B → C | C → D | D → E`

The final frame of `A → B` and the first frame of `B → C` are the **exact same canonical image B**.

This creates an important constraint.

The camera should arrive at B **while still moving** and depart from B **already moving**.

Canonical frames should therefore behave like positions sampled from the middle of a continuous camera trajectory rather than places where the camera stops.

This becomes especially important when constructing longer sequences. Individual video clips often ease into and out of their anchor frames. While aesthetically pleasing in isolation, repeated easing would expose every clip boundary:

`accelerate → travel → decelerate → accelerate → travel → decelerate`

TunnelVision ultimately needs **through-motion at shared canonical anchors**.

## The Edit

Ideally, there isn't much of one.

If the Director produces:

`A → B → C → D`

and the Cinematographer successfully generates:

`A → B`
`B → C`
`C → D`

with identical shared anchors and continuous velocity, the finished journey should require little more than placing those clips back to back.

The canonical sequence has already determined the edit.

Rather than relying on an Editor agent to repair mismatched material afterward, TunnelVision attempts to push that complexity upstream and generate material that is **inherently editable**.

## Preference Learning

One of the discoveries from the manual prototype was that:

> **Selection itself becomes a form of prompting.**

When a generated candidate is selected, its visual characteristics become part of the reference context for the next generation.

During the prototype, unexpected glowing mushrooms emerged in one generation. Selecting that frame allowed them to persist. They subsequently became an explicit navigational breadcrumb through the environment.

This suggests a progression from:

`accident → selection → preference → affordance → route`

A future Director can learn from both selected and rejected candidates and gradually develop a model of the human collaborator's creative preferences.

## The Reel as Working Memory

The canonical reel is not merely a presentation of the finished journey.

It can become part of the Director's **working visual memory**.

Rather than evaluating every new frame only against its immediate predecessor, the agent can periodically review the growing sequence and ask:

- Is the camera actually progressing?
- Are we repeating compositions?
- Is the world evolving coherently?
- Are important visual motifs becoming meaningful?
- Has aesthetic change begun substituting for spatial movement?
- Does the journey still create curiosity about what comes next?

The manual prototype demonstrated why this matters: weaknesses that were difficult to notice while selecting individual generations became immediately apparent when clicking through the complete reel.

## Current Prototype

The initial exploration uses:

**Still generation**
- Nano Banana Pro
- Runway
- 16:9
- 2752 × 1536

**Motion experiments**
- Seedance 2.5
- Krea
- first/last-frame conditioning

The prototype exploration log documents the prompts, selected and rejected frames, motion experiments, failures, and discoveries that led to the current architecture.

See:

[`genesis/TunnelVision_Prototype_Exploration_Log.html`](genesis/TunnelVision_Prototype_Exploration_Log.html)

## First Coding Milestone

The initial agentic implementation will focus on the **Director**.

Given a current canonical frame:

1. Propose several meaningful next-camera moves.
2. Generate candidate viewpoints.
3. Evaluate continuity, camera displacement, novelty, navigability, preference fit, and discovery.
4. Present the strongest candidates for human selection.
5. Update the preference state from that choice.
6. Add the selected frame to the canonical reel.
7. Periodically re-evaluate the sequence for weak spatial transitions.
8. Repeat.

The Cinematographer can then operate on accepted canonical frame pairs, using the continuous-locomotion principles established by the motion experiments.

## Status

**Experimental / research prototype.**

Camotion v1 exists. Integration Test 01 — The Wardrobe Loop completed
the first unattended end-to-end movie experiment. A later Wardrobe
A→B Seedance 2×2 (seed 70) supported retaining Camotion plus
Cinematographer locomotion prompting as complementary Phase 1 pieces.
A three-pair scene-aware strength experiment preferred bounded
per-canonical selection from `{0.02, 0.04, 0.08}` over fixed `0.08`.
**Camotion Phase 1 is frozen.** Camotion shooting frames are treated
as motion-state conditioning, not image enhancement. Current product
direction is a simple autonomous storyboard, not a large editor; that
UI is not built.

The exploration phase intentionally documents failures as well as successes because several of the most important architectural discoveries came from understanding **why seemingly good generations failed when treated as parts of a continuous journey**.

## Acknowledgments

**Terran Boylan** originated **TunnelVision**: the concept, the manual filmmaking technique, and the motion-conditioning workflow later examined in this research. He developed that work through his own YouTube and video practice. It was later adapted for the AI music video for Peter Gabriel's *Digging in the Dirt*, where we used the playful label **TunnelTV**.

Later agentic Director/Cinematographer architecture and Camotion research in this repository are subsequent development built from that foundation, not a restatement of Terran's original system.

AI music video for Peter Gabriel's *Digging in the Dirt*:  
https://www.5050.dev/videos/v/4bkjb3htbteraepxtc9cnb9rc7azp2

## License

Licensed under the **Apache License 2.0**.

See [`LICENSE`](LICENSE) for details.