# Cinematographer benchmark fixture: Ghost Library

First controlled, blind comparison of frontier vision/reasoning models on the TunnelVision Cinematographer task:

``` text
pristine scene image
  → semantic route selection
  → normalized image geometry
  → CameraMotionPlan JSON
```

This fixture records a **repeatable method** and the **first result**. It is not enough evidence to permanently select a model.

## Prompts

Use these files unchanged:

- [`system-prompt.txt`](system-prompt.txt)
- [`prompt.txt`](prompt.txt)

They encode the Cinematographer JSON contract for this fixture (semantic shot fields plus CameraMotionPlan v1 geometry; `foreground_occluders` as strings; JSON only, no markdown). Do not add provider delivery URLs to the prompt.

## Source scene

- Scene: Ghost Library
- Image: [`camotion/tuning/01.jpeg`](../../../camotion/tuning/01.jpeg)
- Human CameraMotionPlan (established before the model tests, not shown to models): [`camotion/tuning/01.3-plan.json`](../../../camotion/tuning/01.3-plan.json)

## How to run a future model

1. Give the model `system-prompt.txt` and `prompt.txt` plus `01.jpeg`.
2. Do **not** show the human baseline, this README's results table, or previous model outputs first.
3. Do **not** tell the model the scene nickname or the doorway-vs-window answer.
4. Keep prompts unchanged so runs stay comparable.
5. Record settings, raw JSON, and whether output was bare JSON.
6. Score at least: semantic route / traversability correctness, destination localization, vanishing-point localization, destination bbox quality, schema adherence, token usage, latency, and approximate cost.

Do not treat Replicate prediction URLs or uploaded-image delivery URLs as part of this fixture. They are ephemeral.

Quality on the Cinematographer task is the primary criterion. Approximate cost is recorded for later routing decisions; do not optimize model selection on cost alone.

## Human baseline

Established manually before the model tests.

| Field | Value |
| --- | --- |
| Traversable destination | central doorway / threshold beneath the gothic window |
| `camera.vanishing_point` | `[0.50, 0.56]` |
| `destination.point` | `[0.50, 0.61]` |
| `destination.bbox` | `[0.445, 0.48, 0.555, 0.73]` |
| `camera.forward` | `1.0` |
| `exposure.strength` | `0.08` |
| `exposure.samples` | `16` |

Critical semantic test: can the model distinguish a visually salient focal object from the physically traversable destination? The glowing gothic window is salient; the ground-level doorway/threshold beneath it is the route.

## 2026-09-01 results

Same source image and the same system/user prompts. Blind: models did not see the human baseline or each other's outputs.

| | Claude Opus 4.6 | Gemini 3.1 Pro | GPT-5.2 |
| --- | --- | --- | --- |
| Traversable destination? | No. Chose the glowing gothic window | Yes. Doors / threshold at the end of the aisle | Yes. "wooden door directly beneath the arched window" |
| Central aisle? | Yes | Yes (straight down the aisle) | implied by the doorway description |
| `vanishing_point` | `[0.50, 0.38]` | `[0.48, 0.55]` | `[0.50, 0.29]` |
| `destination.point` | `[0.50, 0.30]` | `[0.48, 0.65]` | `[0.50, 0.83]` |
| `destination.bbox` | `[0.38, 0.12, 0.62, 0.50]` | `[0.42, 0.50, 0.55, 0.85]` | `[0.42, 0.47, 0.58, 0.92]` |
| `forward` | `1.0` | `1.0` | `1.0` |
| Schema | `foreground_occluders` became objects, not strings; JSON wrapped in markdown | good adherence; bare JSON | `foreground_occluders` became objects with labels/bboxes |
| Input tokens | 1264 | 1685 | 1230 |
| Output tokens | 603 | 317 | 856 (including 433 reasoning) |
| Wall time | ~11.35s | ~15.23s | ~15.87s |
| Approx. cost (Replicate UI) | $0.02 | less than $0.01 | $0.01 |
| Settings | Claude Opus 4.6 default; image resolution 0.5 | `thinking_level=high`, `temperature=1`, `top_p=0.95` | `reasoning_effort=high`, `verbosity=low` |

Costs above are **Replicate's approximate displayed costs** in the UI for these runs, not exact calculated or billed totals.

### Provisional ranking for this one scene only

1. Gemini 3.1 Pro
2. GPT-5.2
3. Claude Opus 4.6

This is **not** a general model ranking. Do not choose a Cinematographer model on cost alone.

## Observations

The models failed differently:

- **Claude Opus 4.6:** strong scene comprehension and a correct central-aisle read, but visual salience overrode physical traversability. Destination geometry sits on the window, not the doorway.
- **GPT-5.2:** correct semantic route (door beneath the window), but normalized coordinate grounding was substantially farther from the human reference than Gemini's (vanishing point too high in the frame; destination point too low).
- **Gemini 3.1 Pro:** correct traversable threshold plus geometry close to the human reference.

That split suggests different strengths among narrative/scene description, spatial/traversability reasoning, and image-coordinate grounding. Director, Cinematographer, and Evaluator may therefore need **different models**, routed by role, not hardcoded IDs.
