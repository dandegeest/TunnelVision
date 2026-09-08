# Forest Cinematographer actual-set assessment

Research / evidence. Not a product PR.

## Question

Can the current product Cinematographer independently distinguish actual
adjacent sets that plausibly support continuous physical camera traversal
from pairs that are visually related but spatially difficult or discontinuous?

## Method

Invoke the merged product `assessJourney` path with
`ReplicateReasoningProvider` (Gemini 3.1 Pro, default thinking settings)
against the Forest A→F canonical stills.

Pairs: A→B, C→D, D→E, E→F.

Inputs are only what the product Cinematographer already receives: actual
start/end stills resolved through trusted media identities, destination
intents already on those beats, and the Forest journey story.

Do not supply prior Seedance results, expected classifications, or
human qualitative judgments of these pairs.

Do not change the CM prompt or schema for this run.
Do not generate video, Camotion, or CameraMotionPlan.
Do not alter canonical images.

One technical retry is allowed per pair. Record retries. Do not retry
because a completed assessment is disliked.
