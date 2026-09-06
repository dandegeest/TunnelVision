# Upstream Director replanning of E

Not a Camotion experiment. Camotion Phase 1 remains frozen.
This is **not** an experiment failure. The stop after human inspection
is the result.

Harness: none. One manual FLUX generation. No regeneration.
Machine record: `generation-manifest.json`
Provenance: `canonical/revised-E-generation.json`
Protocol freeze: `PROTOCOL.md`

Canonical Integration Test 01 **E is unchanged**. This file is
experiment-local evidence only. Call it **revised-E** / **E2** here;
it is not a new Wardrobe Loop movie canonical.

## Existing evidence

Original Wardrobe Loop E→A was the weakest shot: a closed freestanding
bedroom door in the cavern, then a world-change into the attic. Two
downstream repair attempts proposed intermediate X positions:

- `../shootability-intermediate-volume/` — wardrobe-interior X;
  both E→X and X→A NOT_SHOOTABLE on the actual set.
- `../shootability-generalized-repair/` — cavern-threshold X;
  both legs NOT_SHOOTABLE on the actual set.

Those repairs tried to save a poorly planned E after generation.

## Hypothesis

Instead of forcing the Cinematographer to repair E in Shoot, the
Director could revise E itself so the return route to A is spatially
plausible.

Product question:

> Can changing an upstream Destination design make a previously
> unshootable relationship directly shootable, without adding a
> repair Destination?

More generally: not every Shoot problem should be solved in Shoot.
Some failures should return upstream to Plan so the Director can
redesign the storyboard/route.

Intended revised-E geometry:

cavern → open stone arch → visible attic bedroom → open wardrobe

Keep original E generation conditions so Director/spatial intent is
the intentional variable: FLUX 1.1 Pro Ultra, seed **10105**, 16:9
PNG, raw false, one generation.

## Generation provenance

Downloads original was **not** moved or deleted.

| | |
| --- | --- |
| Downloads filename | `replicate-prediction-zwagbyqpfsrmr0d0exgrhwge3g.png` |
| Copied file | `canonical/revised-E.png` |
| SHA-256 | `888681cf4de2c223e91b724b5831d10ec1b8f15e8be552703ff551c6f29f245b` |
| Bytes | 5355630 |
| Size | 2752 × 1536 |
| Model | `black-forest-labs/flux-1.1-pro-ultra` |
| Seed | 10105 (same as original E) |
| Prediction | `zwagbyqpfsrmr0d0exgrhwge3g` |
| raw | false |
| Regenerations | 0 |

Original canonical E remains
`49154292cb2534ab333c2fb1ec6329ca8fa82855b8baca2b7078a4356e9357ff`.

Complete prompt in `canonical/revised-E-generation.json`.

## Human inspection

The revised image **did** improve approach geometry:

- substantial traversable foreground
- strong architectural depth
- clear stone arch
- plausible forward camera path toward the arch

It **failed** the intended world handoff.

Instead of:

cavern → open stone arch → visible attic bedroom → open wardrobe

the generated image is effectively:

cavern → stone arch → another stone/cavern chamber → **closed** wardrobe

The arch does not expose the destination world. The generator placed
the destination landmark as an object beyond the arch rather than
making the attic/bedroom itself visible through the threshold.

This recreates the deeper problem in a new form:

> A destination object is not enough. The shot needs traversable depth
> through the transition.

And reinforces:

> A strong transition lets the destination world become visible before
> the current world disappears.

Retain the image as **negative evidence**.

## Protocol stop

Stopped after human inspection.

- no regeneration
- no Cinematographer / Gemini shootability review
- no Camotion
- no Seedance video
- no attempt to repair this generated image

The actual generated set already violates the Director-level spatial
intent being tested. There is no value in asking the Cinematographer
to treat it as if that plan had been instantiated.

## Interpretation

Do **not** record this as evidence that upstream replanning does not
work. One manual still. Not a universal claim.

Useful result:

1. Upstream Director replanning successfully specified a substantially
   more traversable spatial design.
2. The image generator produced improved approach geometry but did not
   realize the critical world-to-world threshold relationship.
3. A good Director plan does not guarantee a shootable generated set.
4. The generated set must still be inspected after production.
5. “Return to Plan” should initiate another Plan → generate actual
   set → inspect loop, not assume the revised plan automatically
   solves the Shoot failure.

Emerging product loop, **not implemented here**:

Plan / Storyboard: design a route that should be shootable
→ generate the actual Destination/set
→ Shoot / Cinematographer: inspect whether that generated geometry
  actually is shootable
→ if the generated set fails: determine whether to repair downstream
  or return upstream to Plan

Insights:

> CM should not be forced to save a bad Director decision.

> A good Director decision can still produce a bad set.

Plan expresses spatial intent. Generation builds the set. CM evaluates
the actual set.

Plan is not merely a prompt entry screen. It is where spatial
filmmaking intent can be revised when production evidence shows that
the planned movie cannot be physically shot as intended.

## Limitations

- one revised-E still
- one seed (10105)
- human inspection only
- no CM review
- no video
- no proof that a later revised-E would succeed
- canonical E / A / movie evidence unchanged
