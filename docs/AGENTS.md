# TunnelVision Filmmaking Roles

Use real filmmaking responsibilities rather than implementation-oriented
agent names. Do not hardcode provider or model IDs into a role.
Routing belongs on a configurable reasoning-provider profile so
Director, Cinematographer, and Evaluator may use different models.

## Screenwriter --- what is the journey? (unvalidated)

**Do not implement.** Integration Test 01 and movie-level review
suggest TunnelVision may benefit from a Screenwriter agent upstream
of the Director. This is an architectural/product hypothesis requiring
evidence, not a current role.

Potential separation:

-   **Screenwriter:** interpret the user's story concept; create
    narrative beats and spatial journey structure; determine important
    transitions / thresholds; describe pacing and dramatic emphasis;
    think in journey beats rather than camera geometry. Does **not**
    know about Camotion, vanishing points, or provider parameters.
-   **Director:** visual interpretation of those beats; world/style
    continuity; canonical visual intentions; which canonical positions
    should exist.
-   **Cinematographer:** sees the **actual** generated frames and asks
    whether they can be shot.

Do not create `ScreenwriterAgent` or Screenwriter schemas in this
checkpoint.

## Director --- where do we go next?

Inputs: current/prior canonical frames, journey brief, remaining
duration, preference state and optional user destination.

Responsibilities: understand the world, propose meaningful next camera
positions, preserve continuity, create discovery, avoid same-composition
scene evolution, request/evaluate candidates, learn from human choices
and audit the canonical sequence.

Candidate evaluation can include continuity, perceptible camera
displacement, novelty, navigability, preference fit and discovery.
Automated scoring of displacement or traversal is an **open question**.
PreferenceState schema is an **open question**. The Director is not
being implemented in the Camotion v1 milestone.

## Cinematographer --- how do we physically get there?

Inputs: accepted start/end **canonical** frames, intended
destination/route, scene analysis and user overrides.

Responsibilities (intended role, not a current module): infer
perspective/route geometry, identify destination and useful
focus-of-expansion geometry, identify parallax-producing foreground
objects and protected regions, produce ShotPlan and CameraMotionPlan
JSON, request any CV/depth observation **outside** Camotion, invoke
Camotion to produce shooting frames, fill a stable locomotion template,
and evaluate actual traversal.

Video currently receives those shooting frames plus the locomotion
prompt. Canonical frames stay storyboard/world-state authority; they
are not currently video inputs.

Integration Test 01 used a **thin** pair planner in
`media/src/cinematographer/`: inspect actual start/end stills, emit
shot-specific CameraMotionPlan v1 JSON, pin `forward=1.0` and 01.8
exposure. That is evidence that vision-on-actual-stills works (D was
planned upward from the generated stair, not from unused “descend”
story text). It is **not** a finished Cinematographer package.

**Phase 1 Camotion strength is now a Cinematographer decision**, not a
pinned constant. The CM inspects each **actual** canonical keyframe
and chooses Camotion conditioning strength from the frozen bounded
vocabulary:

-   LIGHT = `0.02`
-   MEDIUM = `0.04`
-   STRONG = `0.08`

No arbitrary intermediate values. Strength is per canonical / keyframe,
not necessarily one value per shot (Wardrobe B→C used B′ = `0.02` and
C′ = `0.04`). Use the minimum bounded conditioning needed to establish
useful motion state. Stronger Camotion does **not** automatically mean
stronger perceived camera travel. Qualitative scene evidence includes
foreground structure/density, perspective depth, natural parallax,
open traversal corridor, destination/threshold geometry,
structured-content smear or duplication risk, fine detail, rails /
trunks / furniture / door frames, and whether the scene already
provides strong evidence of camera travel.

The current thin Integration Test 01 planner still pins `0.08` in
code. That pin is historical IT01 behavior, not the frozen Phase 1
policy. Do not expand that planner into a product package in this
checkpoint. Do not scaffold a Cinematographer package alongside
Camotion.

**Final Cinematographer module boundaries remain an open question.**

Intended later shootability questions, **not implemented**:

-   Can I describe a continuous spatial route from this camera
    position into the next world? A destination object is not enough;
    the shot needs traversable depth through the transition.
-   If the pair can plausibly be covered as one continuous spatial
    move, describe and condition the route and let the video model
    invent intermediate volume. Do not mechanically insert an
    intermediate canonical for every transition. If not, recommend
    REGEN / REPAIR, or an intermediate canonical (`E → X → A`). The
    Integration Test E→A flat-door shot remains a useful future
    fixture.
-   Canonical review before expensive video: PASS / REGEN / REPAIR.
    Guideline: regeneration preserves exploration; editing preserves
    composition. Review + shot planning may later share one reasoning
    call when PASS.
-   Practical shot duration and physical camera pace, including exit
    and entry velocity across shot boundaries. Accidental speed jumps
    should not simply be repaired in post.
-   Evaluate **spatial continuity** (connected intermediate space vs
    cut/dissolve/replacement) separately from **temporal continuity**
    (motion carrying through B vs easing/stopping at B).

## Camotion Engine

Camotion is **not an agent**. It is deterministic graphics code. The
Cinematographer role decides what motion should mean, including
bounded per-canonical exposure strength; Camotion performs the math.
Current working hypothesis: Camotion shooting frames are
**machine-facing motion-state conditioning** for the video model, not
image enhancement. The 01.12 Ghost Library still-image
structured-copy limit remains. A Wardrobe A→B Seedance 2×2 (seed 70)
supported retaining Camotion together with Cinematographer locomotion
language as complementary Phase 1 inputs. A later three-pair
scene-aware strength experiment preferred bounded per-canonical
selection from `{0.02, 0.04, 0.08}` over fixed `0.08`. Camotion
Phase 1 is frozen.

The frozen v1 **plan** contract is `image + CameraMotionPlan JSON` and
emits one shooting-frame still. See [DATA_MODEL.md](DATA_MODEL.md).
An optional near-weight image may be supplied beside that contract.
Camotion does not estimate depth, run CV, or call generators.

Camotion v1 is a **radial-exposure experiment** (forward radial motion
field around a supplied focus of expansion, scaled by `camera.forward`,
multisample exposure, protected destination, optional near-weight
scaling of that same field). It approximates and extends aspects of
Terran Boylan's original TunnelVision motion-conditioning workflow.
It is **not** a recreation or port of
Terran Boylan's depth-aware Photoshop workflow, which used Z / depth,
two blur operations, and destination protection.

v1 does not implement lateral translation / strafing or turning / yaw.

Camotion must not call LLMs or generation providers and must have no
TypeScript or Node dependency.

## No Edit agent

Do not initially model an Editor. The storyboard handoff is the
canonical frame. Video currently uses Camotion shooting frames as
start/end images. Distinct `B_in` / `B_out` derivatives and whether
they can hand off invisibly remain an **open question**.

Deterministic final-movie assembly (ordered successful shot videos,
hard butt joins, no transitions, grading, or optical flow) is
plumbing, not an Edit agent. It is an implementation follow-up, not
current work in this checkpoint.

## Stable locomotion principle

Generated motion prioritizes uninterrupted physical travel: camera
continuously advances; foreground objects pass beside/behind it; strong
parallax reveals new space ahead; thresholds, turns, occlusions and
atmosphere can help preserve continuous locomotion.

The genesis prompt that demonstrated this on Seedance 2.5 / Krea is
recorded as an experimental artifact in
[IMPLEMENTATION.md](IMPLEMENTATION.md). Preserve Terran Boylan /
original TunnelVision provenance. Do not treat that text as model-independent or as
a Camotion input.
