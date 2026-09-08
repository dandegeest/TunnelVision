# Forest Shot Evaluator Experiment 03: Post-Generation Shot Evaluation

Research / evidence. Not a product PR. Does not overwrite Experiments 01 or 02.
Does not modify production Cinematographer code.

## Question

Given generated A→B footage, can multimodal reasoning distinguish genuine
camera travel, scene transformation/replacement, morphing/dissolving,
spatial discontinuity, successful threshold traversal, and arrival at the
intended destination?

This is observation of generated footage, not prediction from stills.

## Role

Shot Evaluator watches what happened. It is not the Cinematographer.

## Method

Same Replicate model family as Experiments 01/02 (`google/gemini-3.1-pro`,
`thinking_level=high`). Production `ReasoningProvider` is images-only.
Native `videos[]` upload to the same Replicate model was attempted and
failed technically (unknown mime type on Buffer and File uploads). This
experiment therefore evaluates a deterministic chronological sample of
frames from each existing Forest clip, plus the canonical start and end
stills, through the existing images path. It does not switch models and
does not change the production adapter.

Frame sampling: ffmpeg output-seek (`-ss` after `-i`), first frame, then
every 1.0s, plus a last frame near duration. Exact timestamps are in each
pair’s `input.json`.

Pairs: A→B, C→D, D→E, E→F. Existing Forest videos only. No regeneration.

Do not supply Experiment 01/02 results, human clip rankings, or expected
answers.

One run per clip. Retry only technical failures.
