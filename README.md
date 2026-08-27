# TunnelVision

**An agentic video director for creating seamless first-person journeys through impossible worlds.**

TunnelVision explores a filmmaking workflow in which an AI agent plans, generates, evaluates, and repairs a continuous visual journey rather than generating isolated video clips.

The project is inspired by a manually developed workflow used to create continuous first-person sequences for *Digging in the Dirt*, developed as part of my creative practice with [50:50](https://www.5050.dev/creators/dan-degeest). That process involved generating large numbers of candidate keyframes, selecting compatible start/end frame pairs, applying motion guidance, generating transitions, editing successful sequences together, and progressively restyling portions of the resulting video.

TunnelVision investigates how much of that workflow can be intelligently automated while keeping the creator in control of the visual direction.

## Concept

A creator describes a world and how they want the journey through it to evolve.

For example:

> Descend through an endless underground concrete structure being slowly overtaken by organic growth. Begin photorealistic and become increasingly dreamlike and abstract.

TunnelVision then attempts to:

1. Generate candidate visual keyframes.
2. Analyze their visual and semantic characteristics.
3. Determine which frames are likely to produce strong transitions.
4. Construct a path through the candidate frames.
5. Generate motion-guided start/end frames.
6. Generate first-person video transitions between keyframes.
7. Evaluate the resulting transitions for continuity and motion.
8. Regenerate or reroute around unsuccessful transitions.
9. Assemble successful transitions into a seamless journey.
10. Progressively restyle the journey according to the creator's desired visual arc.

## Human-Guided Visual Refinement

Before constructing the journey, TunnelVision may allow the creator to iteratively refine its understanding of their visual intent.

Rather than treating **More Like This** as a simple image variation operation, the system can compare selected and rejected generations to infer why the creator preferred one image.

Over several rounds:

**Prompt → Generate → Select → Evaluate → Refine Prompt → Generate**

The resulting preferences can guide subsequent keyframe generation.

## Architecture

TunnelVision is designed around provider-independent components so that generation models can be replaced without changing the directing and evaluation pipeline.

Initial areas of experimentation include:

* Python orchestration
* Image and video generation providers
* Multimodal image/video evaluation
* Image embeddings and similarity
* Composition and perspective analysis
* Graph-based keyframe path planning
* Programmatic motion guidance
* FFmpeg video processing
* Agentic generation/evaluation/repair loops
* Progressive video restyling

Generation providers will be abstracted behind common interfaces. Early prototypes may use Replicate, with Runway integration planned separately.

## Status

Early experimental prototype.

The initial goal is to determine whether automated keyframe analysis, path planning, motion guidance, and iterative evaluation can reliably improve the creation of seamless generative first-person video journeys.
