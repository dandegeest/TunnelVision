# Forest A→F Camotion evidence

Evidence spike. Not a product milestone. Destinations, Director, Camotion
operator, and prompts were not changed after seeing results.

TunnelVision is agentic filmmaking research extending filmmaker Terran
Boylan's original TunnelVision technique. Terran's original/manual workflow
established spatially contiguous travel, continuous locomotion,
threshold/opening traversal, anti-dissolve / anti-morph prompting,
motion-conditioned endpoint preparation, and human review of generated clips.
This Camotion implementation and the agentic pipeline are not Terran's code.

## Freeze held

- Exact runtime frames A–F copied byte-identically. No regeneration.
- Sequence A → B → C → D → E → F. No intermediates.
- One CameraMotionPlan v1 and one 01.8 render per canonical.
- Shared B′, C′, D′, E′ reused across adjacent legs.
- One locomotion prompt for all five legs.
- Seedance 2.5, 720p, adaptive, 6s, no audio, no watermark, mp4.
- One completed clip per leg. No aesthetic retries.
- Hard concat only.

## A-B / B-C provenance

`A-B.mp4` (10:41) and `B-C.mp4` (10:45) were produced by the first `--execute`
of this same frozen runner. That process was interrupted before
`generation-manifest.json` was written, so prediction ids and seeds for those
two legs were not captured. The completed `--execute` skipped those files
(resume of an already-accepted generation, not a quality retry) and generated
C-D, D-E, and E-F. Those two clips are first shots of this experiment.

## Replicate call count correction

The local manifest recorded 3 downloaded calls plus 2 skipped A-B/B-C files
(assumed 5 total). Replicate’s Recent predictions at 11:09 showed **8**
succeeded `bytedance/seedance-2.5` API jobs from this window, ~$1.39 each.

Cause: overlapping `--execute` processes after auto-review retries of the
same spike. Not prompt edits. Not quality reruns of kept clips. Extra
outputs were not saved as additional local movies; evidence still has
exactly five legs plus one review concat.

## Per-leg evaluation

Sampled at 0 / 1.5 / 3 / 4.5 / 5.8s plus the assembled movie at 0 / 6 / 12 /
18 / 24 / 29.5s. This is still-frame evidence, not a substitute for watching
the mp4s.

### A→B

- **Start-frame fidelity:** High. t=0 is the night forest path, stepping
  stones, left mushrooms, right trunk/drop, misty gateway. Camotion radial
  blur is visible at the edges.
- **End-frame fidelity:** High. t=5.8 is the root-tunnel mouth with the left
  mushroom alcove and a dark void ahead, matching B′.
- **Forward locomotion:** Yes. By 1.5s the camera is already between the
  trunks; by 3s it is inside a root-arched passage; by 5.8s it is at B.
- **Spatial plausibility:** Strongest leg. Forest path → gateway → tunnel
  mouth is a walkable deepening of one place.
- **Threshold traversal:** The tree-trunk gateway is entered, not dissolved.
- **Parallax / displacement:** Left roots and right trunk read as passing
  volume. Camotion edge streaks plus Seedance motion both contribute.
- **Dissolve/crossfade:** Not the dominant behavior. This is travel.
- **Morphing/warping:** Mild Camotion radial streak on start/end stills;
  interior does not look like a crossfade of A into B.
- **Camera stop/easing:** No obvious stop in the sampled stills. Requested
  speed is the frozen “constant, fast” phrase.
- **World solidity:** High relative to later legs.
- **Next space before previous disappears:** Yes. The misty opening and then
  the root mouth become the space you are in while forest flanks are still
  passing.

### B→C

- **Start-frame fidelity:** High. t=0 matches B′ (left mushrooms, ferns
  right, dark opening slightly right of center).
- **End-frame fidelity:** Mixed. t=3 already looks like the centered circular
  C tunnel. t=5.8 still reads as a circular root throat, but mushroom
  placement is less locked to C′’s left-side cluster than the start is to B′.
- **Forward locomotion:** Yes. The camera advances into the throat.
- **Spatial plausibility:** Good. B and C are the same tunnel language.
- **Threshold traversal:** Entering the mouth rather than cutting to C.
- **Parallax:** Foreground roots streak; interior ribs recede.
- **Dissolve/crossfade:** Low. This is the most “same room, deeper” cut.
- **Morphing/warping:** Some circularization toward C’s bullseye composition.
  More compression of space than a blend of two unrelated pictures.
- **Camera stop/easing:** No sampled freeze.
- **World solidity:** Medium-high. Tunnel walls hold.
- **Next space before previous disappears:** Partial. C is a tighter, more
  centered version of B’s mouth, so “new space” is mostly deeper-same rather
  than a revealed room beyond a threshold.

### C→D

- **Start-frame fidelity:** Weakest start of the five. C′ is a centered
  circular tunnel with mushrooms on the **left**. The t=0 still of this clip
  already looks more like a mushroom-lit throat with a right-biased glow and
  less of C’s bullseye. Seedance did not hold C′ as faithfully as it held A′
  and B′.
- **End-frame fidelity:** High. t=5.8 is D′: crystal cluster on the path,
  ribbed root tunnel, radial blur, protect-box region intact.
- **Forward locomotion:** Yes, and destination-eager. By 1.5s the crystal is
  already the vanishing-point light.
- **Spatial plausibility:** Medium. Same root-tunnel family, but C’s identity
  is abandoned early so the first second is not “leaving C.”
- **Threshold traversal:** No distinct doorway. The crystal appears ahead in
  the same tube.
- **Parallax:** Tunnel ribs and moss streak; crystal stays centered
  (protect + last-frame magnet).
- **Dissolve/crossfade:** The early C→crystal change is closer to a
  destination pull than a dissolve of two stills, but C′ is not traversed so
  much as replaced.
- **Morphing/warping:** Crystal grows in place. Camotion radial field is
  strong at the end.
- **Camera stop/easing:** No stop; the crystal never becomes an obstacle the
  camera physically sidesteps. Radial-forward Camotion cannot strafe around
  it, and the video model flies at it.
- **World solidity:** Medium. Tube holds; crystal is a last-frame magnet
  more than a solid object you pass.
- **Next space before previous disappears:** The crystal (D) is visible
  early, which is the desired Terran behavior, but C’s mushrooms/path
  landmarks do not persist long enough to prove you walked out of C.

### D→E

- **Start-frame fidelity:** High. t=0 is D′ with the crystal in the path.
- **End-frame fidelity:** High. t=5.8 is E′: dark reflective corridor, tall
  cyan vertical portal, floor reflection.
- **Forward locomotion:** Yes. t=3 already shows the portal through a
  remaining organic tunnel opening.
- **Spatial plausibility:** This is the first **architectural type change**
  (root tube + crystal → reflective canyon + portal). The sampled mid frame
  does the Terran thing: the next space is visible through an opening before
  the previous tube is gone. That is better spatial grammar than a blend.
- **Threshold traversal:** Best threshold of the five. Crystal is left
  behind; a hole opens; the portal corridor is beyond.
- **Parallax:** Tunnel ribs pass; later, canyon fins frame the portal.
- **Dissolve/crossfade:** Not a full-frame dissolve. There is still a world
  substitution at the opening (damp root floor becoming mirror floor).
- **Morphing/warping:** Crystal disappearance is not a documented physical
  pass-to-the-side (Camotion has no lateral operator). It reads as passed
  through / eaten by the move.
- **Camera stop/easing:** No stop at the crystal. Fast.
- **World solidity:** Medium. The mid-shot opening is believable; E itself
  is a different material language than D.
- **Next space before previous disappears:** Yes. This is the clearest
  example in the movie.

### E→F

- **Start-frame fidelity:** High. t=0 and t=1.5 are still the E corridor and
  vertical portal.
- **End-frame fidelity:** High. t=5.8 is F′: central light, radial debris,
  lens flare, open void.
- **Forward locomotion:** Apparent warp-speed rather than walking through
  the portal. By t=3 the corridor is already a debris field.
- **Spatial plausibility:** Weak. E is a solid corridor. F is an open void
  with no floor. Radial-forward Camotion is applied because that is the only
  current model; it cannot describe “step through a door into another kind
  of space” except as a vanishing-point push.
- **Threshold traversal:** The portal is not convincingly crossed as a
  doorway. The world becomes F while you are still looking at a centered
  light.
- **Parallax:** Debris shards at the end; little sense of passing the E
  walls and then being outside them.
- **Dissolve/crossfade:** This is the morph/replace risk. Corridor identity
  collapses into void around the same central light.
- **Morphing/warping:** Strong. F′’s Camotion radial blur plus F’s
  stargate composition invite a warp rather than a threshold.
- **Camera stop/easing:** No stop; acceleration into warp.
- **World solidity:** Low after t=3.
- **Next space before previous disappears:** No. F replaces E. You do not
  see the void *through* the portal with E’s walls still around you for
  long.

## Full A→F

- **One continuous journey?** Directionally yes: forest → mouth → tube →
  crystal → portal → void. As *one physical walk*, only A→D really holds.
  D→E is a type change with a visible opening. E→F is a different movie.
- **Velocity across seams:** Same prompt and duration on every leg, so
  requested speed is coherent. Perceived speed is not: A→B has nearby
  trunks to pass; E→F has warp streaks. Hard cuts make the seam a slight
  resolution jump (A-B is 1284×716; later clips are 1306×706) more than an
  editorial fade.
- **Shared boundaries:** B′, C′, D′, E′ were not independently regenerated.
  Still-frame matches at A-B end / B-C start and D-E start look consistent.
  C is the weak shared identity because C→D does not hold C′ at t=0 as well
  as B→C holds B′.
- **Where continuity breaks:**
  1. A vs B–F pixel format/resolution (uploaded JPEG 1000×558 vs generated
     1392×752). Video-model adaptive output then differs on A-B.
  2. C′ start fidelity on C→D.
  3. D→E material change (root/crystal → mirror corridor), even though the
     opening grammar is good.
  4. E→F genre change (doorway → cosmic debris). This is the break.
- **World transformation believable?** A→C as deepening woods/tunnel: yes.
  C→D as finding a crystal in the same tube: mostly, if you forgive C′
  drift. D→E as emerging from the tube into a lit hall: plausible as
  destination construction, not as one material. E→F: not a physical
  continuation of the forest run.
- **Camotion help vs hurt:** Helps A→B, B→C, and the corridor legs by
  putting the stills into a forward-motion state the video model already
  knows how to continue. Hurts F, where the same radial operator on an open
  void looks like a warp cue. Does not hurt D’s crystal by inventing a
  sidestep; it also cannot solve that obstacle.
- **Does F feel earned from A?** Narratively as “deeper and stranger,”
  somewhat. Spatially as the same walkable world, no. F is a new
  construction, not a place you could have seen from A.

## Failure attribution

| Failure | Mostly belongs to |
| --- | --- |
| A is a smaller uploaded JPEG, different aspect than B–F | Destination / capture path, not Camotion or video |
| B–F 1.851 aspect, not 16:9 | Destination construction |
| C→D start does not hold C′ | Video model (last-frame magnet / early destination pull) |
| Crystal is never physically passed around | Camotion vocabulary (radial-forward only) **and** destination (crystal blocks the path) |
| D→E material language change | Destination construction |
| D→E still shows the next space through an opening | Video model doing the locomotion grammar **well** |
| E→F void / warp | Destination construction of F **amplified by** Camotion radial blur on a non-corridor |
| Hard resolution seam A-B vs later clips | Adaptive Seedance + A’s different still size; concat did not transcode |
| No yaw/strafe at F | Recorded Camotion limitation, not a miss in this spike |

Director and destination construction were not rerun. Weak endpoints were
not repaired.

## Concat

Stream copy of mixed resolutions froze around 8s (A-B is 1284×716; later
clips are 1306×706). Players kept the first clip’s decoder state.

The five Seedance clips were not regenerated. The single review movie was
replaced in place with a minimum technical transcode:

- scale+pad to 1306×706 (majority clip size; A-B letterboxed, not stretched)
- H.264 yuv420p, 24 fps, no audio, hard concat, faststart
- no crossfades, titles, grading, or speed ramps

The broken stream-copy file was deleted so evidence contains exactly five
leg clips plus one review movie.

Duration 30.208s. SHA-256
`097ecbfbdc987582b834fbc6739ea36daf1897a419a7c86045a022d49ed71129`.

Human review of this assembled movie was positive (continuous journey
reads; freeze at ~8s is gone).
