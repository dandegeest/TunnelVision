# Forest A→F Camotion evidence spike

Evidence spike only. Not a product milestone.

TunnelVision is agentic filmmaking research extending filmmaker Terran
Boylan's original TunnelVision technique. Terran's original/manual
workflow established spatially contiguous travel, continuous locomotion,
threshold/opening traversal, anti-dissolve / anti-morph prompting,
motion-conditioned endpoint preparation, and human review of generated
clips. The current agentic architecture and this Camotion implementation
are not Terran's code.

## Freeze

- Exact runtime frames A–F from this forest run. No regeneration.
- Sequence is A → B → C → D → E → F. No intermediates, repairs, or reorder.
- One CameraMotionPlan v1 per canonical. One 01.8 Camotion render per
  canonical. Shared boundaries reuse the same shooting frame.
- No Cinematographer. No Director. No destination construction.
- No Camotion research changes. Strength pinned at 0.08 / samples 16 /
  forward 1, route-preserved 01.8, adaptive_exposure false.
- One locomotion prompt for all five legs. No post-result prompt edits.
- Seedance 2.5, same settings for every leg. One shot per leg.
- Hard concatenation only. No product UI.

## Known input limitations (recorded, not repaired)

- A is a smaller uploaded JPEG (1000×558). B–F are 1392×752 PNGs.
- B–F aspect ratio is 1.8511, not 16:9. Seedance uses adaptive.
- F is an open debris void around a central light, not a corridor.
  Radial-forward Camotion is still applied toward that light. The
  current model has no yaw/strafe vocabulary for this space.
