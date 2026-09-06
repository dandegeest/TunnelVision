# Generalized spatial repair reasoning (E→X→A follow-on)

Not a Camotion tuning experiment. Camotion Phase 1 remains frozen.
This is **not** an experiment failure. The protocol stop after Stage 3
is the result.

Parent: `../shootability-intermediate-volume/`
Harness: `media/experiments/wardrobe-loop/shootability-generalized-repair.ts`
Machine record: `generation-manifest.json`
Protocol freeze: `PROTOCOL.md`
Stages: `stage1-shootability.json`, `stage2-x-spec.json`,
`stage3-actual-x-review.json`

Reuse Integration Test 01 canonical E and A exactly. One X. No
Camotion. No Seedance video.

## Existing evidence

The original E→X→A experiment
(`../shootability-intermediate-volume/`) established:

1. Direct E→A was independently judged NEEDS_INTERMEDIATE. E’s closed
   door provides insufficient visible traversable volume, and A has an
   incompatible camera position/orientation for a continuous route
   through that door.
2. Semantic continuity is insufficient. A destination object is not
   enough; the shot needs traversable depth through the transition.
3. The original generated X did not physically connect the surrounding
   sets. Both E→X and X→A were NOT_SHOOTABLE on the actual still.
   Protocol stopped before video.

That original X is frozen parent evidence. It was not shown to the
agent in this follow-on.

## New hypothesis

Generalized traversability knowledge may allow the filmmaking agent to
propose a better spatial repair without being given a human-designed
solution.

Available to the agent, and only this:

> A proposed intermediate must create a physically traversable camera
> route between the actual endpoint images. Prefer continuous spatial
> handoffs over semantic connections. The camera should be able to
> move through plausible intermediate positions rather than relying on
> scene replacement, morphing, or an unexplained camera teleport.

> A destination object is not enough. The shot needs traversable depth
> through the transition.

The agent was not given a specific visual solution. A withheld human
hypothesis existed for later comparison only and was not present in
the prompts.

The interesting question:

> Can a filmmaking agent generalize a learned spatial-continuity
> principle into a viable set/camera strategy, rather than merely
> proposing a semantically plausible intermediate image?

## Agent proposal

**NEEDS_INTERMEDIATE**

Gemini 3.1 Pro inspected the actual E and A vision stills plus
existing E→A CameraMotionPlan geometry. Frozen
`2026-09-06T15:16:59.733Z`, prediction `hkzx4yf4wxrmr0d0ex58jtcg80`,
before any image call. Same prediction froze the X specification.

Exact Stage 1 reasoning:

> The cavern door in E is closed, blocking all line of sight to the
> destination. An intermediate frame is required to open the door and
> establish physical depth through the portal into the bedroom.

Proposed X: a physical camera position **inside the stone doorframe of
the cavern, crossing the threshold**, with cavern geometry remaining
in the peripheral foreground and the attic bedroom (wardrobe, bed,
lamp) visible ahead through the now-open doorway.

Intended physical route:

cavern path → open the door → pause at the threshold (X) → step
through into the bedroom (A)

This is a threshold-handoff strategy, not a 50/50 blend and not a
repeat of the parent wardrobe-interior X. Complete prompt in
`stage2-x-spec.json`. The proposal was not altered after freeze.

Canonical hashes matched Integration Test 01:

- E `49154292cb2534ab333c2fb1ec6329ca8fa82855b8baca2b7078a4356e9357ff`
- A `d71319696162eab7e9c2dbe3c2f7037fd21bcb2aea877a98d8a223ce1e7b6820`

## X generation provenance

Exactly one canonical X. No aesthetic retry. Seed continues the
wardrobe canonical sequence after parent X seed 10106.

| | |
| --- | --- |
| File | `canonical/X.png` |
| Model | `black-forest-labs/flux-1.1-pro-ultra` |
| Seed | 10107 |
| Prediction | `wjpmcjmg5drmy0d0exat5khac8` |
| SHA-256 | `210847862d59b88c875a6e4c0f32b12195206dc6c931970fe34ccd21a7002ac0` |
| Bytes | 4138736 |
| Settings | aspect 16:9 · raw false · png · safety_tolerance 2 |
| Retries | 0 |

## Actual generated X

The generated still did **not** fully realize the requested geometry.

Observed:

- camera inside a deep stone cave tunnel
- rounded stone archway as the threshold
- attic bedroom visible through the arch
- bed centered in front of a **closed** wardrobe
- no freestanding wooden bedroom door matching E

The Cinematographer inspected this actual image rather than assuming
the requested X had been produced.

## Actual-X review

| Leg | Decision | Reasoning |
| --- | --- | --- |
| E→X | **NOT_SHOOTABLE** | E presents a closed wooden door in a freestanding frame. X places the camera inside a cave tunnel looking through a deep stone archway. Traversing this requires teleportation or morphing the structural threshold. |
| X→A | **NOT_SHOOTABLE** | In X, the bed is centered directly in front of a closed wardrobe. In A, the camera faces a different, open wardrobe with the bed shifted entirely to the left wall. Connecting them requires a spatial reorganization of the room. |

Gemini 3.1 Pro, frozen `2026-09-06T15:28:46.949Z`, prediction
`v7vsz5ecd5rmw0d0exarch2e40`.

## Protocol stop

Zero video generations. No Camotion plans. No shooting frames. X was
not regenerated. `stop_reason=leg_not_shootable`.

## Withheld human hypothesis (comparison only)

Recorded **after** the agent proposal was frozen. Not used as a prompt.
Not ground truth. The agent may discover a different and equally or
more plausible solution.

The human hypothesis was to replace the opaque/poorly connected return
with a wider spatial composition involving an exterior approach to a
multi-story house, where the original attic bedroom is faintly visible
through an upper-story window. The intended route would approach the
house, redirect toward the visible window, pass through that
threshold, and arrive back in the bedroom. The hypothesis is that
exposing part of the destination world before the source world
disappears may provide a stronger continuous spatial handoff.

The agent did **not** propose a house, an exterior approach, or a
window. It proposed a forward threshold inside E’s cavern door, with
destination-bedroom evidence visible through that opening while cavern
geometry remains in the periphery. That is a different attempt at a
continuous spatial handoff. On the actual generated set, it still
failed both legs.

## Interpretation

Do not overclaim from one example.

What this follow-on shows:

1. Given only the generalized traversability principle, the agent
   again rejected direct E→A and proposed a **spatial** repair rather
   than an aesthetic midpoint.
2. The new proposal was not a copy of the parent wardrobe-interior X.
   It tried to keep source-world geometry at the edges while revealing
   destination-world geometry through an opening.
3. The actual generated X still failed structural correspondence:
   E’s freestanding wooden door did not become X’s stone tunnel/arch,
   and X’s bedroom layout did not match A.
4. Generalized principle + one X is not enough, on this case, to
   produce a shootable E→X→A repair. The agent can name a better
   *class* of solution (threshold handoff) and still lose the specific
   geometry that would make the route filmable.

A proposed intermediate canonical is still **not** automatically
accepted as canonical. Generated media is evidence that agents
inspect.

This experiment did not reach Camotion or video stages. Infer nothing
new about Camotion performance from it.

## UNTESTED observation, not a conclusion

Most existing TunnelVision canonical tests have relatively strong
near-central one-point perspective and destinations near the forward
axis. This follow-on’s proposed X and the generated still also stay
on that axis.

A wide composition with a substantially off-axis destination — as in
the withheld human hypothesis — may expose limitations in the current
radial-forward CameraMotionPlan / Camotion model and could later be
useful in Movie #2. Do not modify Camotion or add yaw/turn support
from this experiment.

## Limitations

- one pair (E and A)
- one X generation
- one reasoning model (Gemini 3.1 Pro)
- Wardrobe Loop only
- no video comparison
- no proof that a different X would have been shootable
- no proof that the withheld human hypothesis would have been
  shootable
- no camera-pose schema
- no production planner implementation

## Phase 1 stop line

TunnelVision Research Phase 1 remains **complete**. This follow-on is
diagnostic evidence under the existing shootability protocol, not a
reopening of Camotion Phase 1 and not a new product requirement.
