# 18–19 September 2026 — Long-journey findings

**Kind:** Engineering / research note from the day’s validation and stress tests.  
**Not:** A feature proposal, implementation plan, or architecture decision record.

TunnelVision is feature-frozen for the hackathon. The 18 September work was primarily observation: Night Train grammar checks, far-field wording, a 26-beat FOLLOW mega-run, and a 13-beat POV control. 19 September added a short stylized POV journey (**Paper Chase**), an incremental continuation of that same project, and a closer look at segment-boundary kinetics. This note preserves what was seen. It does **not** ask for new product work.

Observations below are not requests for new features. Post-freeze ideas stay research or backlog notes. Before the hackathon, only a clear bug or a reliability/hardening issue should justify a change.

---

## 1. Overall status

The system is in a strong place.

**Keepers (already in product; not reopened here):**

- Feature set remains frozen.
- Camera-grammar architecture remains a keeper.
- Shared canonical prompt-template refactor remains a keeper.
- Far-field wording change remains a keeper.
- Adaptive duration remains a keeper.
- Autonomous / headless orchestration held up well on long unattended runs.
- Existing actual destinations remain authoritative; unresolved beats can be filled later (§14).
- Current export is flat concatenation and is already an acceptable baseline (§8).
- Stylized POV is viable; Paper Chase is a standout example, not a claim that stylized output is categorically better than photoreal (§14).
- Title-first, concise filmmaker prompts remain the Prompt Coach convention ([PROMPT_COACH.md](../PROMPT_COACH.md)).

Remaining concerns are mostly **reliability**, **long-horizon continuity**, and **segment-boundary polish** — not whether the core concept works. The remaining seam issue is finishing, not rescue of a broken continuity system.

---

## 2. Night Train: grammar-propagation bug

Empirical test (Night Train, FOLLOW and the other three grammars) surfaced a real bug. It was not a wording preference.

### Observed

- FOLLOW **canonical construction** used the project grammar correctly.
- **Cinematographer assessment** used the project grammar correctly.
- The **traversal / shooting prompt** incorrectly contained POV identity language, including:
  - “First person POV camera continuously moving forward…”
  - “Maintain an unembodied first-person POV.”

NEW TAKE reused that contaminated string.

### Root cause

Motion Plan construction did not receive `cameraGrammar`. Missing / unknown grammar fell through `cameraGrammarFromUnknown` to POV. The POV locomotion baseline was then baked into Motion Plan `effectivePrompt`. NEW TAKE, by design, reused the stored prompt unchanged.

### Architectural finding (keep)

- Grammar must be resolved **before** Motion Plan staging and passed into both interactive and headless staging paths.
- Once staged, Motion Plan `effectivePrompt` is the authoritative shooting artifact (CM choreography + pace + grammar-conditioned baseline + the frames Camotion conditioned).
- SHOOT should send that stored prompt, not recompose from current project grammar.
- If CAMERA changes after staging, restage. Do not pair Camotion frames made under grammar A with a prompt rebuilt under grammar B.

Follow-on wording from the same investigation (already applied; recorded here as context, not new work):

- FOLLOW was strengthened as an invisible objective camera **behind** a persistent subject, subject **ahead and receding**, elastic distance, no collapse into LEAD / POV / MOUNTED, no visible operator.
- Shared FOLLOW law should stay **subject-agnostic**. Avoid vehicle-only nouns (nose, headlights, bumper, hood) in generic FOLLOW rules. Relational language (“lead-facing view of the subject”, “camera physically mounted on the subject”) covers people, animals, balloons, trains, and arbitrary objects.
- Product copy should present POV, FOLLOW, LEAD, and MOUNTED **neutrally**. Do not rank two as primary and two as speciality.

Canonical repair already has a narrow FOLLOW geometry lock: repair may fix environment, spatial continuity, lighting, or far-field; it must not solve those problems by changing camera grammar (a pursuit still must not become a LEAD still). That remains a keeper, not a new scoring system.

---

## 3. Far-field prompt finding

### Final shared rule (shipped)

> This is optional distant environmental information only. Include it only if it fits naturally and spatially from the current destination viewpoint. It is acceptable for no far-field preview to appear. Do not force the next destination into the frame, and do not let it dominate, replace, or drive the composition, lighting, or style of the current destination.

### Nuance

“Drive the composition” was preferred over “alter the composition.” Natural distant context may legitimately influence composition slightly. The failure mode is **future-destination information controlling the current canonical** (lighting key, style, or composition owned by the next beat).

### Observed (long FOLLOW stress test)

Far-field behavior appeared improved. Several later spaces became naturally visible without obviously hijacking the current destination.

### Future research

Do not add Cinematographer-specific far-field scoring, retry logic, or other complexity on the basis of this test.

---

## 4. 26-beat FOLLOW mega-run — Runaway Parade Balloon

Unattended stress test at the current destination ceiling.

| | |
| --- | --- |
| Title | Runaway Parade Balloon |
| Grammar | FOLLOW |
| Destinations | A–Z (26; product cap) |
| Duration mode | Adaptive |
| Video | Kling (supported clip lengths 5s / 10s; requested ~8s often resolved to 10s) |
| Approx. length | ~4 minutes |
| Approx. cost | ~$20 |
| Concurrency | ~5 generations at a time |
| Provider failures | 1 prediction across ~25 traversals |
| Reshoot churn | Very little / none on most of the run |
| Scores | Set Consistency and Traversal Confidence generally high |
| Terminal pair | Y→Z generated successfully |

**Journey concept.** A giant bright red parade balloon breaks loose from a nighttime city parade and travels through increasingly large environments: downtown, skyscrapers, elevated rail, plaza, stadium district, stadium roof, river, suspension bridge, amusement park, Ferris wheel, highway interchange, highway, airport, farmland, crop rows, storm, foothills, mountains, mountain pass, cloud sea, alpine lake, coastal forest, ocean cliffs, sunrise / open ocean.

### Observed

Orchestration completed the board through Y→Z. Adaptive duration stayed useful. Kling’s discrete 5/10 mapping produced a long cut rather than a pile of 8-second clips. One provider prediction failed (see §6); that failure blocked assemble/download even though later material existed.

### Qualitative

Overall result was surprisingly strong. Many sections were spectacular. The result was “wonderfully weird.” The continuous long-form journey is itself valuable proof of the system and potentially useful website material.

### Interpretation

Do not assume this needs to be edited into a conventional montage. Uninterrupted travel is part of what the run proved.

---

## 5. FOLLOW long-horizon subject drift

One of the strongest findings from the mega-run.

### Observed identity progression

- Balloon identity began strong.
- It eventually acquired a hot-air-balloon-like basket.
- The basket appears to have broadened the model’s semantic interpretation of the subject.
- The balloon later became increasingly anatomical / body-like.
- It temporarily became a humanoid / superhero / caped figure.
- It later stabilized into strange balloon-like / object forms again.

**Spatial continuity and FOLLOW camera geometry remained strong** while subject identity failed badly.

### Interpretation

This looks like **recursive long-horizon identity drift**. Each generated canonical becomes the next generation’s visual truth. Small deviations can compound over many hops.

Camera-grammar correctness and subject-identity correctness are **separable**. The system can preserve excellent FOLLOW geometry while losing the identity of the thing being followed.

Paper Chase later showed a useful contrast: a paper motif that **evolved** (loose sheets → origami birds) while remaining the same story and style. That looked like intentional motif evolution, not this balloon-style recursive identity collapse. Record the distinction only; do not turn it into a score (§14).

### Future research (post-freeze only)

This is stronger evidence for eventually investigating a persistent subject / object reference mechanism for FOLLOW, LEAD, and MOUNTED.

Do not prescribe an implementation. Do not assume that passing canonical A into every generation is correct. Any future reference system would need to preserve identity **without** locking pose, framing, lighting, or camera relationship.

---

## 6. Provider prediction failure and assembly robustness

### Observed

One traversal failed with a Replicate provider error:

```
Prediction failed:
Async prediction failed:
ModelError: The input or output was flagged as sensitive.
E005
```

On the balloon run this was **U→V**: Motion Plan existed; `takes` stayed empty; `shootError` carried the E005 text. The visual at that hop was a highly body-like red balloon / superhero shape, so this **may** have been a visual false positive related to accumulated subject drift. That causal link is not proven.

The agent did **not** automatically retry the failed prediction. It continued far enough to generate later material (through Y→Z). One unresolved traversal still prevented final assembly, `exports/`, and the JOURNEY COMPLETE download card.

This matches current gates: Agent assemble and manual Download both require a selected take on every required segment.

### Interpretation (reliability / hardening, not a new feature area)

A single provider miss should not silently strand an otherwise-complete movie. That is distinct from Cinematographer quality-rejection / reshoot logic.

### Preferred hack-hardening direction (if reclassified as a reliability bug)

- One automatic generation retry for a failed provider / model prediction.
- Do not over-special-case moderation vs rate limiting yet.
- If the retry also fails, the traversal may remain unresolved, but the run should ideally still be able to produce a movie.

Preferred fallback **concept** if a movie is still required: insert a short black slate for unresolved segments rather than silently dropping content or fabricating a canonical still as motion. Example slate copy: `SEGMENT U→V MISSING` / `Generation failed after retry`. Keep raw provider error details in logs / UI, not necessarily on-screen.

Do not treat this section as a request to implement that slate now.

---

## 7. A–Z destination cap

### Observed

Destination IDs are capped at A–Z (26). The balloon prompt asked for 26 distinct beats and hit that ceiling. A requested “30 destination” mega-run is not representable without changing labels.

### Interpretation

This is a real arbitrary-length limitation. It is a **post-freeze hardening item**. It is not addressed in this note and should not be addressed as part of documenting it.

---

## 8. Segment-boundary motion

A repeated seam / hiccup was noticeable in the long FOLLOW movie and again in the later POV control. A later FOLLOW “snake” cut, where every leg used the same nominal pace and each generated clip was roughly 10 seconds, refined the diagnosis.

### Observed

- Adjacent CM pace values being different is **not** a sufficient explanation. Even with the **same requested pace**, independently generated traversals can have different instantaneous motion near their boundaries.
- Therefore: **same requested pace ≠ same boundary velocity.**
- Frame inspection on one join: the first clip lasted about 10.02s; the noticeable hitch sat only a few frames after that. The visual handoff around the shared conditioned destination was very close.
- The model-generated frame near the end of A→B and the conditioned / start frame of B→C looked extremely similar but were **not** the same frame.

**Notation.** A, B, C are pristine canonical destination frames. A′, B′, C′ are Camotion-conditioned shooting frames. A→B is the generated traversal between those conditioned states (A′→B′), not a clip that received pristine A and B.

**Provenance (do not mislabel the splice).** The video model does **not** receive pristine B when generating A→B. It is conditioned toward **B′**. A late generated frame that visually resembles B is the model converging toward B′, not pristine B inserted into the clip. Do not casually label two adjacent generated boundary frames as “B vs B′” unless provenance is actually known. The likely comparison is a generated near-B′ frame from the end of A′→B′ versus the conditioned / start state for B′→C′.

Use inspection labels when provenance is only “incoming last / outgoing first”:

- **Be** — final / near-final generated frame from the incoming traversal
- **Bs** — first / near-first generated frame of the outgoing traversal

**FOLLOW vs POV visibility.** Segment hiccups are definitely **less noticeable in POV than in FOLLOW**. Recorded as observation only.

**Flat concat baseline.** Current export is essentially simple concatenation: no optical-flow stitching, no boundary synthesis, no retiming pass, no advanced transition generation, no hidden smoothing. Despite that, many joins already read as one continuous journey in normal playback.

Baseline export quality is already strong. Independently generated traversals joined by flat concatenation usually read as one continuous journey. Remaining seam artifacts are localized kinetic / visual discontinuities rather than broad spatial continuity failures.

The remaining seam issue is **finishing / polish**, not rescue of a fundamentally broken continuity system. Paper Chase later showed that some boundaries may need **little or no** treatment (§8 Paper Chase inspection).

### Paper Chase boundary inspection

Paper Chase gave a particularly useful visual-boundary example (hallway / papers join).

**Observed.** Be and Bs were extremely similar. Hallway perspective, stair position, EXIT sign, ceiling light, major paper locations, wall geometry, and framing aligned almost perfectly. Differences were mostly small local changes in paper edges, blur / sharpness, linework, and shading.

**Interpretation.** TunnelVision is often landing remarkably close to the conditioned destination state. The visual handoff itself may already be much better than the perceived “hiccup” suggests. Some seam perception may come from **motion behavior around the boundary** rather than large spatial mismatch.

**Manual 50/50 blend (DaVinci Resolve; not product behavior).** Be on the lower track, Bs directly above, overlap of exactly one frame, Bs at 50% opacity: **Bm = 0.5·Be + 0.5·Bs**. The blend was visually valid. Because Be and Bs were already extremely similar, Bm was **not meaningfully better** than the unblended cut. Negative evidence: do **not** apply blending automatically just because it is available.

Paper Chase showed that the incoming and outgoing boundary frames can already be almost perfectly aligned. A manual 50/50 blend was visually valid but not noticeably better than the original cut, suggesting that highly similar boundaries may benefit more from simple redundant-frame trimming than synthetic blending. This strengthens the case for **adaptive** boundary treatment rather than a universal finishing operation.

**Trim vs blend (research only).** If Be and Bs are nearly redundant, a future export could keep only one of them (`… Be, Bs+1 …` or the equivalent from the other side). The earlier 50/50 looked valid but did not materially improve playback. The simplest solution may often be to **remove redundant visual information** rather than synthesize new information. Do not claim trimming is always better.

### Visual continuity vs kinetic continuity

These are **not** the same problem.

| Problem | What differs | What a trim / blend can do | What local retiming can do |
| --- | --- | --- | --- |
| Visual boundary | Be and Bs differ in appearance / alignment / blur | May improve the still handoff | Little, if the images already match |
| Kinetic boundary | Apparent motion velocity before vs after the cut (X vs Y) | May do nothing | May improve speed continuity |

A trim or blend may improve visual continuity while leaving outgoing velocity X and incoming velocity Y untouched. Local retiming may improve kinetic continuity while the images already match almost perfectly. Do not conflate these research areas.

### Initial hypotheses (still useful, none proven as the sole cause)

- Duplicate / near-duplicate boundary frames
- Stop / restart behavior
- Acceleration at the start of the next segment
- Adaptive pace mismatch
- Instantaneous kinetic mismatch around the join
- Motion behavior in the first few frames of the newly generated clip

A manual trim (removing the first B-side frame from B→C) reduced a blurred / repeated boundary appearance. That did **not** solve or explain a speed discontinuity. Trimming duplicated or blurred frames may improve visual matching; that is separate from kinetic-speed discontinuity. Do not conflate the two. An A→B−1 / B+1→C visual-boundary experiment was discussed and is **not** considered important enough to pursue before the hackathon.

### Interpretation

- A→B may end at apparent motion speed X.
- B→C may begin at apparent motion speed Y.
- Both clips can already be moving smoothly.
- If X and Y differ substantially, the cut is an instantaneous one-frame **velocity discontinuity**.
- That can feel like a stutter even when neither clip visibly stops or accelerates.
- Flat concatenation itself may already be doing a surprisingly good job. Some perceived “boundary” hiccups may come from motion in the first few frames of the new clip, or from instantaneous kinetic mismatch around the join.
- Do not overstate which specific mechanism is proven.

**Segment pace** is the overall cinematic energy / speed chosen for the traversal. **Boundary kinetic state** is the incoming / outgoing apparent velocity at the cut. They are related but not identical.

Adaptive pace remains valuable. Some pace changes looked excellent and dramatically intentional. Therefore: do **not** conclude that adjacent segments should simply share matching pace values.

**Hypothesis (not proven) — why FOLLOW seams read harder:** POV has a simpler motion field because the camera itself is the primary motion anchor. FOLLOW exposes both camera movement and subject-relative movement, so small kinetic discontinuities may be more perceptually obvious. Do not treat this causal story as established.

### Possible secondary hypothesis (unproven)

Improved destination fidelity may make the seam more visible because traversals now hit endpoints more precisely.

### Future research (post-freeze only)

Cinematographer might someday benefit from awareness of incoming / outgoing kinetic state. Do not convert that into an implementation.

**Baseline remains flat concat.** Do not imply the system needs a finishing stack. Paper Chase suggests many boundaries may need little or no treatment. Do not claim blending is the solution, trimming is always better, optical flow is necessary, exact thresholds are known, or the current export path is broken.

If finishing is added later, it should be **similarity-driven and minimally invasive**. Candidate decision categories (research hypotheses only — not production rules):

1. Extremely similar / nearly redundant — drop one of the two near-identical boundary frames; no synthetic blend.
2. Small visual difference, still well aligned — a one-frame 50/50 or weighted blend *may* reduce visible discontinuity.
3. Larger spatial mismatch — do **not** naïvely average (double edges / ghosting). Leave unchanged, or explore motion-aware interpolation later.

**Research hierarchy** (only if useful, in this order):

0. Flat concat (baseline)
1. Similarity-based redundant-frame trimming
2. One-frame blend for small aligned differences
3. Motion-aligned midpoint / optical-flow midpoint
4. Short optical-flow bridge
5. Local retiming for **kinetic** continuity (separate from visual match)

**If ever automated post-freeze:** custom boundary analysis classifies similarity / alignment / kinetic mismatch and chooses the minimal treatment; **FFmpeg** performs trim / blend / retime / optional interpolation, then concat / export. Do **not** propose building a custom video-processing engine.

**Practical validation method (not product behavior):** DaVinci Resolve can still be used to test trim, one-frame blend, small local speed adjustments, and Optical Flow / Speed Warp before automating anything. This is not part of TunnelVision architecture.

First compare older smooth POV runs against current runs to determine whether this is a true regression, a model-behavior change, or simply more visible because endpoint adherence is stronger. More systematic grammar-specific seam analysis remains post-freeze.

---

## 9. 13-destination POV control — Midnight Descent

| | |
| --- | --- |
| Title | Midnight Descent |
| Grammar | POV |

**Story (shape).** Photorealistic cinematic first-person journey beginning on a rooftop high above a dense city at night, descending through the building, alley, street, subway, waterfront, river path, flood channel, suburbs, forest, mountains, and ending at dawn.

**Director plan:**

| Beat | Place |
| --- | --- |
| A | rooftop |
| B | stairwell |
| C | service corridor |
| D | neon alley |
| E | downtown street |
| F | subway station |
| G | subway tunnel |
| H | industrial waterfront |
| I | river path |
| J | flood channel |
| K | suburban street |
| L | misty forest road |
| M | mountain overlook at dawn |

### Observed

POV was pretty solid. Spatial progression generally held up. World / style progression from city night to pre-dawn wilderness worked well. There was no equivalent long-horizon **visible-subject** identity problem, because POV has no persistent subject anchor. Segment-boundary speed hiccups were still present, but **less noticeable than in FOLLOW** (§8).

### Interpretation

The seam is not FOLLOW-specific. POV remaining spatially coherent while showing the same *class* of cut, and showing it less loudly, is useful evidence that boundary kinetic continuity is a separate dimension from grammar and subject identity. A later hypothesis that FOLLOW’s dual motion field (camera plus subject) makes seams more obvious is recorded in §8 and is **not** proven.

---

## 10. Opening canonical / A→B failure (POV)

This was the main POV weakness.

### Observed

**A** was a visually strong rooftop canonical: city depth, nighttime atmosphere, composition. Aesthetically good. Weak as a **launch state** for the planned B transition.

Director B intent: move from the rooftop through a heavy metal door and descend a dimly lit concrete stairwell.

The actual A image did not clearly present that stairwell / door threshold as a visible traversable route. The Director invented a semantically plausible continuation that was not sufficiently grounded in the visible geometry of the authoritative opening frame.

B could therefore be visually coherent with A and still hard to shoot from A. Set Consistency remained high while Traversal Confidence dropped substantially. The video model then had to invent the missing connection and produced a poor traversal.

### Finding

**High set consistency does not imply high traversal viability.**

A and B can belong to the same world, look individually good, and be semantically coherent, yet still form a bad traversal pair because the connective route is not physically available in the source frame.

Useful distinction:

| Dimension | Meaning in this failure |
| --- | --- |
| Destination quality | A (and B) can be strong stills |
| Launchability / onward shootability | A did not expose the planned threshold |

A canonical can score high on destination quality and low on launchability.

---

## 11. B reshoot and possible A reassessment

### Observed

B required a reshoot. The second B was materially better.

### Research question (not a rule)

If repeated attempts to construct B remain poor, should the system eventually reassess A rather than endlessly repairing B?

**Do not** turn this into a hard rule such as “two bad Bs means reshoot A.”

Repeated B failure could still be random generation variance, difficult B intent, poor route geometry, or model behavior.

Better question: after repeated failure on the **first** transition, should the agent be allowed to reassess whether the opening canonical itself is a poor launch state?

This matters because A is authoritative and is not, by default, an ordinary downstream repair.

**Post-freeze research question only.**

---

## 12. Director grounding

The current Director system instruction already contains the right principles: actual stills are authoritative; plan a journey the camera can actually travel; visual continuity alone is insufficient; transitions should use plausible thresholds and routes; later Cinematographer must be able to shoot between generated sets.

### Interpretation

The A→B failure does **not** necessarily imply missing architecture or missing policy. It is an empirical failure to obey an existing planning principle strongly enough: the Director chose a plausible **narrative** transition and did not ground it in the **visible geometry** of A.

### Watch item (unconfirmed)

Another potentially difficult pair in the POV plan:

- G — POV through the front window of a moving subway car in a dark tunnel
- H — emerge from the transit system onto an industrial waterfront

This may be the same class of hidden / off-screen route problem if the generated canonicals do not expose a credible exit path. **Do not claim it failed** unless logs or images confirm it. Record it as a transition worth watching.

---

## 13. Cross-grammar conclusion

The system is now exposing different dimensions of continuity **independently**.

| Observed split | What stayed strong | What failed or stayed weak |
| --- | --- | --- |
| FOLLOW mega-run | FOLLOW geometry, spatial continuity | Persistent-subject identity |
| POV A→B | Set consistency, still quality | Traversal viability / launchability |
| Individual clips vs cut | Smooth motion inside a take | Localized boundary kinetic / visual discontinuity |
| POV control | Spatial / world progression | Same *class* of seam as FOLLOW, less noticeable |
| Paper Chase (stylized POV) | Style, motif, incremental continuation | Not a photoreal / FOLLOW identity test |

Future evaluation should avoid collapsing everything into a single “good / bad.”

**Conceptual dimensions emerging from empirical work** (research observations only; do not redesign scoring now):

- destination quality
- spatial / set consistency
- traversal viability
- camera-grammar fidelity
- persistent-subject identity
- boundary kinetic continuity

---

## 14. Paper Chase — stylized POV and incremental continuation

Standout 19 September example. Recorded as a successful run, not as proof that stylized modes are categorically stronger than photoreal.

| | |
| --- | --- |
| Title | Paper Chase |
| Grammar | POV |
| Look | Hand-drawn / rotoscoped music-video: sketchy ink lines, lightly posterized shading, surreal animated feel |

**Original four-destination route**

| Beat | Place |
| --- | --- |
| A | desk covered in papers |
| B | hallway with airborne sheets |
| C | subway platform / paper vortex into tunnel |
| D | rooftop at sunset |

### Observed (first run)

The four-beat result was excellent — one of the strongest outputs so far. The hand-drawn / rotoscoped look held together extremely well. Stylized animation is clearly viable for TunnelVision; the system is not limited to photorealistic journeys. The result is strong enough to retain as a future demo / story seed.

Do **not** overclaim that stylized output is categorically better than photorealistic output. This example was especially successful.

The filmmaker prompt was compact: title first, then story / style / route. The Director expanded it into useful destinations. That supports the existing Prompt Coach stance — concise human intent is enough; camera grammar and shooting law stay internal ([PROMPT_COACH.md](../PROMPT_COACH.md)).

### Observed (incremental continuation)

After A–D were complete, four more unresolved beats were added and the agent was run again. The second run preserved A–D as existing actual destinations and filled E–H only.

| Beat | Continuation |
| --- | --- |
| E | launch from rooftop and follow papers into twilight sky |
| F | rise through clouds into starry upper atmosphere |
| G | papers become origami birds heading toward an oversized moon |
| H | plunge into the moon / white-ink vortex |

The second agent run preserved the established POV grammar, the stylized visual language, and the paper motif. It did not overwrite or destabilize A–D. It expanded the journey rather than repeating similar spaces. The resulting eight-destination movie was nearly flawless in playback.

### Interpretation (architecture, not a new feature)

This is concrete validation of the existing partially-specified-project / authoritative-storyboard architecture:

- existing actual destinations remain authoritative
- unresolved slots can be filled later
- a journey can be extended incrementally across separate agent runs

Do not treat this as a proposal for new continuation machinery.

### Interpretation (controlled surreal escalation)

The route escalated: desk → hallway → subway → rooftop → sky → clouds → moon → ink vortex. It became increasingly surreal while remaining legible as the same journey.

Loose paper becoming origami birds near the moon is a useful example: the visual motif changes, semantic continuity with “paper” remains, and it does not feel like unrelated subject drift.

**Empirical contrast only** (not a scoring mechanism):

| | Balloon FOLLOW mega-run | Paper Chase |
| --- | --- | --- |
| What changed | Recursive identity collapse (balloon → basket → body → superhero) | Motif evolution inside a stable style / story |
| What held | FOLLOW geometry, spatial continuity | POV, style, paper motif, A–D authority |

### Observed (boundary finishing)

A hallway join was inspected as Be / Bs (incoming last vs outgoing first; not labeled “B vs B′”). The frames were almost perfectly aligned; a one-frame 50/50 blend in DaVinci was valid but not noticeably better than flat concat. Detail and the adaptive-finishing hypotheses live in §8.

---

## 15. Feature freeze and decisions after experiment

### Keepers

- Current four-grammar architecture
- Shared canonical template structure
- Current far-field rule
- Adaptive duration
- Staged Motion Plan `effectivePrompt` as authoritative
- Autonomous long-form journey architecture
- Minimal hackathon feature surface
- Title-first Prompt Coach convention; concise human creative prompts
- Incremental journey continuation; authoritative existing destinations
- POV stylized output as a viable mode (Paper Chase as a strong example)
- Current flat-concat export as an acceptable baseline

### Observed / validated (19 September additions in italics)

- Paper Chase is a *strong example*, not a proof of every stylized mode
- *A second agent run successfully extended an existing journey without rewriting A–D*
- *Stylized output can remain coherent across multiple beats and a later continuation*
- *POV boundary hiccups are less noticeable than FOLLOW*
- *Same nominal pace does not guarantee identical boundary kinetics*
- *Flat concat is already surprisingly strong*
- *Paper Chase Be/Bs can already be almost perfectly aligned; a 50/50 blend was valid but not better*
- *Visual boundary match and kinetic-speed mismatch are separate problems*
- A failed provider prediction can still strand assemble/download
- Grammar must stay on the Motion Plan (already fixed; do not regress)

### Clear hardening / bug items

- A failed provider prediction should not silently strand an otherwise-complete movie
- Grammar propagation into Motion Plan must remain correct (already identified and fixed; do not regress)
- Unresolved-segment state should be surfaced clearly
- Arbitrary A–Z destination ceiling is a known hardening limitation

### Post-freeze research only

- Persistent subject reference / identity anchoring
- Incoming / outgoing kinetic-state awareness
- Adaptive boundary finishing after flat concat: similarity-based trim, then optional one-frame blend, then motion-aware / optical-flow midpoints or a short bridge, then local retiming for kinetic continuity (FFmpeg / off-app validation first; no custom video engine; no universal blend)
- More systematic grammar-specific seam analysis
- Reassessing / reshooting A after repeated first-transition failure
- Arbitrary-length journey addressing beyond A–Z
- LOOP

No new feature work should result from this report before the hackathon unless a finding is reclassified as a **clear reliability bug**.

---

## Bottom line

The 18–19 September tests substantially increased confidence in TunnelVision’s core architecture. The long FOLLOW run showed that the system can autonomously sustain a multi-minute, multi-environment journey with strong spatial and camera continuity. The POV control run showed that the system generalizes beyond FOLLOW. Paper Chase showed that a compact stylized POV prompt can hold a coherent look, and that a second agent run can extend an already-shot storyboard without destabilizing the established beats. The most important remaining findings are not failures of the core concept but clearer definitions of long-horizon identity drift versus motif evolution, launchability, provider-failure resilience, and localized segment-boundary issues. Visual handoff and kinetic-speed mismatch are separate. Flat concatenation is already a strong baseline; some Paper Chase joins were already so close that a blend added nothing. Remaining seams are polish. Feature freeze remains the correct strategy.
