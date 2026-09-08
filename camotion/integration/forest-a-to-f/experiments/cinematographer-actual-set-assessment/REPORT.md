# Forest Cinematographer actual-set assessment

Research / evidence. Not a product milestone. The Cinematographer prompt
and schema were not changed. Canonical stills were not altered. No
Camotion, CameraMotionPlan, or video was generated.

One run of the merged product path: `assessJourney` +
`ReplicateReasoningProvider` (`google/gemini-3.1-pro`,
`thinking_level=high`). Four pairs. Zero technical retries.

Harness: `media/experiments/forest-a-to-f/cinematographer-actual-set.ts`  
Evidence: this directory. Raw JSON is in each pair’s `raw.txt`.

Run: `2026-09-08T16:19:10.800Z` → `2026-09-08T16:20:35.760Z`  
Git: `9b10bc70e1546a7ac26ac655230e403dd15f46f5`

## CM results (no interpretation)

| Pair | Shootability | CM summary | Route / threshold | Camotion suitability | Main concerns |
| --- | --- | --- | --- | --- | --- |
| A→B | `not_shootable` | Destination geometry contradicts the open misty path ahead, so continuous forward traversal is prevented. | No continuous route. Forward path leads toward a misty tree opening beside a chasm, not into the enclosed root tunnel. Threshold: none visible. | `poor_fit` | Dark tunnel is not on the start forward vector. Right-side chasm disappears in B. Linking the stills would morph the environment rather than travel. |
| C→D | `not_shootable` | In-place scene replacement, not camera travel. Destination copies the start’s foreground framing and depth. | No continuous route. Same camera station; tunnel depth/mushrooms swapped for a crystal rather than a crystal further down the path. Start tunnel is an opening, but traveling through it conflicts with destination framing. | `appropriate` | Identical composition implies a morph. Crystal light should already be visible in C if the crystal were down-tunnel. Forward push would warp start foreground back into view. |
| D→E | `not_shootable` | Central crystal blocks the path; no physical route to the reflective corridor. | None. Crystal occludes the tunnel; destination space is spatially disconnected. Threshold: none visible. | `poor_fit` | Crystal blocks vanishing point / forward travel. Dirt floor → polished floor. Move would morph through solid geometry. |
| E→F | `shootable` | Bright vertical portal is a clear threshold into the void. | Push along the reflective floor, through the glowing vertical portal, into the debris field. Threshold: glowing vertical rectangular opening. | `appropriate` | Exposure/glow while crossing. Bounded corridor → open void requires the portal to envelop the camera. |

Provider records:

| Pair | Prediction | Elapsed |
| --- | --- | --- |
| A-B | `87vkrxzyy9rmt0d0g78bgzq3qw` | 22470 ms |
| C-D | `777qzqtnedrmt0d0g78rzmsn1g` | 31219 ms |
| D-E | `ss2bp6pf5srmr0d0g78resmpjm` | 17454 ms |
| E-F | `0bz1qf8jynrmr0d0g798x2x1w0` | 13786 ms |

`modelVersion` reported as `hidden`. Inputs were Forest trusted media
identities, fixture destination intents, and the Forest journey story.
Prior Seedance results and human pair rankings were not supplied.

## Comparison with prior observed video evidence

Compared only after the four CM runs. Source:
[`camotion/integration/forest-a-to-f/REPORT.md`](../../REPORT.md) and
[`genesis/research/14-forest-a-to-f.html`](../../../../../genesis/research/14-forest-a-to-f.html).
Those legs were Camotion-conditioned Seedance 2.5 clips, not still-only
judgments. Alignment below is against that generated-video evidence.

### A→B — contradicted

Prior video: strongest locomotion of the five. Forest path → gateway →
tunnel mouth reads as a walkable deepening; the gateway is entered, not
dissolved; foreground trunks pass.

CM: `not_shootable` / `poor_fit`. It treats B’s enclosed dark mouth as
not lying on A’s forward misty path, and treats the missing right-side
chasm as a structural break.

The generated clip did travel this pair. CM’s morph prediction is not
what that clip did.

### C→D — aligned (shootability); mixed (Camotion)

Prior video: weakest start-frame hold. C′ is abandoned early; the
crystal appears as a destination pull; C is replaced more than
traversed.

CM: `not_shootable` because D copies C’s camera station and swaps the
interior. That matches the observed replace-not-traverse behavior.

`camotionSuitability: appropriate` is only partly consistent with the
same evidence: radial-forward was applied, and the clip still flew at
the crystal rather than passing volume.

### D→E — partially aligned

Prior video: best threshold grammar of the five. Next space becomes
visible through an opening before the root tube is gone. Crystal is
not physically passed around (no strafe). Material language changes
(root/crystal → mirror corridor).

CM: `not_shootable` because the crystal is a dead end and no connecting
opening is visible in the two stills. The obstacle and floor-change
concerns match the video. The overall verdict does not: Seedance found
a mid-shot opening that is not present as a shared threshold in D or E
alone.

### E→F — contradicted

Prior video: spatial break. Corridor becomes void; portal is not
crossed as a doorway; radial-forward on F reads as warp. Human summary:
E→F is the break; A→B is the strongest walk.

CM: `shootable` / `appropriate`, with the portal as a clean threshold
into the debris field. That is the opposite of the observed clip.

## Questions

1. **Does CM distinguish traversability from mere visual similarity?**
   Partly. C→D is the clean case: similar tunnel language and matching
   foreground framing were treated as replacement, not travel. A→B went
   the other way: visual difference was treated as untraversable even
   though generated video walked it. E→F treated a shared central light /
   portal motif as enough to shoot.

2. **Does it identify concrete route/threshold evidence rather than
   inventing invisible geometry?**
   Mixed. A→B, C→D, and D→E refused to invent a path (strict, sometimes
   stricter than the video). E→F asserted a physical portal crossing
   into the void from stills that do not show the far-side space through
   that opening with E’s walls still around the camera.

3. **Does it recognize useful foreground/parallax geometry?**
   Yes at a semantic level: A’s trunks/roots, C/D’s edge roots, D’s
   crystal, E’s corridor walls, F’s debris. Recognition did not track
   shootability (A→B names useful parallax and still rejects the shot).

4. **Does it recognize cases where radial-forward Camotion is
   inappropriate?**
   Not on the pair where prior evidence most needed it. E→F was
   `appropriate`. A→B and D→E were `poor_fit`. C→D was `appropriate`
   while the same answer called the pair a morph.

5. **Does shootability meaningfully discriminate among these four pairs,
   or does the model tend to approve everything?**
   It did not approve everything (three `not_shootable`, one
   `shootable`). Discrimination polarity is inverted relative to the
   Forest video ranking (strongest observed walk rejected; weakest
   observed walk approved).

6. **Do its concerns correspond with failures actually observed in
   prior generated video?**
   C→D morph / last-frame magnet: yes. D→E crystal as an impassable
   radial-forward object, plus material change: yes. A→B “this will
   morph”: no, that clip traveled. E→F exposure/volume notes are weaker
   than the warp/replace failure actually observed.

7. **Did CM identify any useful issue or opportunity that previous
   human analysis missed?**
   Useful extras: A’s right-side chasm is gone in B; if D’s crystal
   were truly down-tunnel from C, its glow should already be in C’s
   dark depth. Those are still-to-still observations, not proof that
   A→B cannot be shot.

8. **Is the current CM assessment reliable enough to use as input to
   the next CameraMotionPlan experiment?**

**ITERATE CM FIRST**

Using this run as a shootability gate would skip A→B (best observed
Forest locomotion) and green-light E→F (observed void/warp). C→D’s
replacement diagnosis is worth keeping as a signal, but the four-pair
ranking is not a safe planner input yet.
