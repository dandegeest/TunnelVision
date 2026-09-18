# Grammar experiment report

Generated: 2026-09-18 (overnight Veo pass + morning Kling recut + afternoon unique retakes)

## HEADLESS EXECUTION

PARTIAL for overnight Quality/Veo generation.

SUCCESS as a grammar experiment after filmmaker Kling 2.5 Turbo Pro recuts.

Overnight journeys were created through the non-interactive `runJourneyAgent` path (`web/headless-journey.ts` / `web/journey-cli.ts`), not the browser UI. Director, stills, CM, Camotion, and Veo takes (where the provider allowed them) all used that path.

The first assemble step failed for complete journeys because the concatenated MP4 was registered into the stills runtime registry (12 MB image limit; PNG/JPEG/WebP only). That is a headless-export bug, not a grammar failure. Local-file copy into `exports/` is the fix.

FOLLOW and MOUNTED lost Veo takes to provider limits (Veo request cap / third-party content refusal), not to grammar conditioning.

**Filmmaker Kling recuts (18 September 2026):** Balanced **Kling 2.5 Turbo Pro** NEW TAKEs after overnight Veo. The first morning assemblies were not unique grammar cuts (shared persisted take video ids). Afternoon unique retakes are the archived MP4s. Grammar is solid. Session playbook: [sessions/canyon-grammar.md](sessions/canyon-grammar.md).

Logs: `docs/grammar_experiment/logs` (`pov.log`, `follow.log`, `lead.log`, `mounted.log`).

Projects Folder: `/Users/ddegeest/Source/tunnelvision/projects`

Quality intent overnight: `quality` → `google/veo-3.1-fast`

Morning recut intent: `balanced` → `kwaivgi/kling-v2.5-turbo-pro`

Duration mode: Adaptive (CM `desiredDurationSeconds` mapped onto each model’s discrete lengths)

Leftover from a first aborted launcher: `GrammarTest-POVCanyonRun` (opening still only). Actual POV run: `GrammarTest-POVCanyonRun2`.

Preflight save-only project: `GrammarTest-PreflightSave`

---

## Kling recut (selected Takes, exported)

| Grammar | Project directory | Downloads original | Archived MP4 | Kling cut length |
| --- | --- | --- | --- | ---: |
| POV | `projects/GrammarTest-POVCanyonRun2` | `~/Downloads/GrammarTestPOVCanyonRun_v3.mp4` | [kling-pov-canyon-run.mp4](sessions/canyon-grammar/kling-pov-canyon-run.mp4) | ~30.3s |
| FOLLOW | `projects/GrammarTest-FOLLOWCanyonRun` | `~/Downloads/GrammarTestFOLLOWCanyonRun_v3.mp4` | [kling-follow-canyon-run.mp4](sessions/canyon-grammar/kling-follow-canyon-run.mp4) | ~30.3s |
| LEAD | `projects/GrammarTest-LEADCanyonRun` | `~/Downloads/GrammarTestLEADCanyonRun_v3.mp4` | [kling-lead-canyon-run.mp4](sessions/canyon-grammar/kling-lead-canyon-run.mp4) | ~35.3s |
| MOUNTED | `projects/GrammarTest-MOUNTEDCanyonRun` | `~/Downloads/GrammarTestMOUNTEDCanyonRun_v4.mp4` | [kling-mounted-canyon-run.mp4](sessions/canyon-grammar/kling-mounted-canyon-run.mp4) | ~30.3s |

Selected traversal Takes (afternoon unique retakes) are all `kwaivgi/kling-v2.5-turbo-pro` / `balanced`. Kling 2.5 mapped CM desired 4–8s onto 5s or 10s (10+5+5+10 except LEAD C→D/D→E at 10s). POV take 3 every pair; FOLLOW take 3 every pair; LEAD take 3 on A→B/B→C/D→E and take 4 on C→D; MOUNTED take 2 on A→D and take 3 on D→E.

LEAD’s git copy is transcoded under GitHub’s 100 MiB limit; the other three archives are byte copies of Downloads. Morning `*_v2` / MOUNTED `*_v3` assemblies are not archived.

---

## Grammar Test - POV Canyon Run

- Project name: Grammar Test - POV Canyon Run
- Project directory: `/Users/ddegeest/Source/tunnelvision/projects/GrammarTest-POVCanyonRun2`
- grammar: pov
- original journey prompt:

```
Photorealistic cinematic POV high-speed journey through a dramatic desert canyon.

Race along an open desert highway toward towering red-rock cliffs, enter a twisting canyon road, plunge through a narrow rock tunnel, cross a high bridge above a deep gorge, and emerge onto a spectacular open mountain road overlooking the desert.

The camera is the traveler. Maintain continuous physical travel through the entire route, naturally turning and banking as the road changes direction.

High-end live-action automotive cinematography, realistic terrain, natural light, extreme speed and monumental scale.

Do not show a cockpit, vehicle body, driver, hands, hood, or other persistent foreground rig.
```

- overnight status: generation COMPLETE (5 canonicals, 4 Veo takes); first headless assemble FAILED (`Image is too large.`); export recovered
- morning status: first Kling take 2 assembly was not unique (collided media ids). Afternoon: take 3 selected on A→B, B→C, C→D, D→E; export `GrammarTestPOVCanyonRun_v3.mp4`
- number of canonicals: 5
- number of traversals: 4
- canonical reshoots: 0
- traversal retries/reshoots: overnight 0; morning +1 Kling take per pair
- CM desired / actual (overnight Veo / morning Kling):
  - A-B: desired 8s / Veo 8s / Kling 10s / pace hyperspeed / set 92 / trav 95
  - B-C: desired 4s / Veo 4s / Kling 5s / pace fast / set 95 / trav 95
  - C-D: desired 5s / Veo 6s / Kling 5s / pace hyperspeed / set 95 / trav 95
  - D-E: desired 8s / Veo 8s / Kling 10s / pace fast / set 95 / trav 85
- models: overnight `google/veo-3.1-fast` (quality); selected `kwaivgi/kling-v2.5-turbo-pro` (balanced)
- final export path (filmmaker): `~/Downloads/GrammarTestPOVCanyonRun_v3.mp4`
- total final journey duration: ~30.3s (Kling)
- errors/warnings: overnight assemble `Image is too large.` (stills-registry). Grammar/stills/CM succeeded.

---

## Grammar Test - FOLLOW Canyon Run

- Project name: Grammar Test - FOLLOW Canyon Run
- Project directory: `/Users/ddegeest/Source/tunnelvision/projects/GrammarTest-FOLLOWCanyonRun`
- grammar: follow
- original journey prompt:

```
Photorealistic cinematic FOLLOW journey tracking the same bright red sports car at high speed through a dramatic desert canyon.

Follow the car along an open desert highway toward towering red-rock cliffs, through a twisting canyon road, into a narrow rock tunnel, across a high bridge above a deep gorge, and finally onto a spectacular open mountain road overlooking the desert.

The red car remains the persistent subject and continuity anchor throughout.

The invisible objective camera stays in pursuit while allowing natural cinematic variation in distance and framing as the car accelerates, pulls ahead, banks through turns and moves through the changing landscape.

High-end live-action automotive cinematography, realistic terrain, natural light, extreme speed and monumental scale.
```

- overnight status: FAILED (`Prediction failed:` empty Replicate error / Veo request cap). A-B and D-E Veo takes preserved; B-C and C-D missing until morning.
- morning status: first Kling take 2 assembly was not unique (collided media ids). Afternoon: take 3 selected on A→B, B→C, C→D, D→E; export `GrammarTestFOLLOWCanyonRun_v3.mp4`
- number of canonicals: 5
- number of traversals: 4
- canonical reshoots: 0
- CM desired / actual:
  - A-B: desired 8s / Veo 8s / Kling 10s / pace fast / set 92 / trav 95
  - B-C: desired 5s / Veo 6s then Kling 5s / pace fast / set 85 / trav 80
  - C-D: desired 6s / Veo 6s then Kling 5s / pace fast / set 90 / trav 90
  - D-E: desired 8s / Veo 8s (takes 1–2) / Kling 10s / pace fast / set 85 / trav 90
- models: overnight Veo quality (partial); selected Kling 2.5 turbo pro balanced
- final export path (filmmaker): `~/Downloads/GrammarTestFOLLOWCanyonRun_v3.mp4`
- total final journey duration: ~30.3s (Kling, complete A→E)
- errors/warnings: overnight `Prediction failed:` while B-C / C-D were in flight. Not a FOLLOW-baseline failure.

---

## Grammar Test - LEAD Canyon Run

- Project name: Grammar Test - LEAD Canyon Run
- Project directory: `/Users/ddegeest/Source/tunnelvision/projects/GrammarTest-LEADCanyonRun`
- grammar: lead
- original journey prompt:

```
Photorealistic cinematic LEAD journey with the same bright red sports car racing toward the camera through a dramatic desert canyon.

Stay ahead of the car while continuously facing it as it races along an open desert highway toward towering red-rock cliffs, enters a twisting canyon road, passes through a narrow rock tunnel, crosses a high bridge above a deep gorge, and reaches a spectacular open mountain road overlooking the desert.

The red car remains the persistent subject and continuity anchor throughout.

The invisible objective camera retreats ahead of the approaching car, preserving the lead relationship while moving naturally through the same physical route.

High-end live-action automotive cinematography, realistic terrain, natural light, extreme speed and monumental scale.
```

- overnight status: generation COMPLETE (5 canonicals, 4 Veo takes); first headless assemble FAILED (`Image is too large.`); export recovered
- morning status: first Kling take 2 assembly was not unique (collided media ids). Afternoon: take 3 on A→B, B→C, D→E; take 4 on C→D; export `GrammarTestLEADCanyonRun_v3.mp4`
- number of canonicals: 5
- number of traversals: 4
- canonical reshoots: 0
- CM desired / actual:
  - A-B: desired 8s / Veo 8s / Kling 10s / pace fast / set 80 / trav 65
  - B-C: desired 6s / Veo 6s / Kling 5s / pace fast / set 70 / trav 85
  - C-D: desired 8s / Veo 8s / Kling 10s / pace fast / set 95 / trav 95
  - D-E: desired 8s / Veo 8s / Kling 10s / pace fast / set 95 / trav 90
- models: overnight Veo quality; selected Kling 2.5 turbo pro balanced
- final export path (filmmaker): `~/Downloads/GrammarTestLEADCanyonRun_v3.mp4`
- total final journey duration: ~35.3s (Kling)
- errors/warnings: overnight assemble `Image is too large.` CM stayed in lead language (retreat / facing the subject), including the weaker A→B pair.

---

## Grammar Test - MOUNTED Canyon Run

- Project name: Grammar Test - MOUNTED Canyon Run
- Project directory: `/Users/ddegeest/Source/tunnelvision/projects/GrammarTest-MOUNTEDCanyonRun`
- grammar: mounted
- original journey prompt:

```
Photorealistic cinematic MOUNTED journey attached to the same bright red sports car during a high-speed run through a dramatic desert canyon.

Travel with the car along an open desert highway toward towering red-rock cliffs, through a twisting canyon road, into a narrow rock tunnel, across a high bridge above a deep gorge, and finally onto a spectacular open mountain road overlooking the desert.

The camera is physically mounted to the moving car and inherits its acceleration, turns, banking and vibration. A small amount of persistent vehicle geometry may remain visible when natural to the mounted perspective.

High-end live-action automotive cinematography, realistic terrain, natural light, extreme speed and monumental scale.
```

- overnight status: FAILED on D-E (Veo third-party content-provider refusal, `code: 3`). A-B, B-C, C-D Veo takes preserved.
- morning status: take 2 on A→D was already unique Kling; D-E never had a Veo take. Afternoon: take 3 on D→E; export `GrammarTestMOUNTEDCanyonRun_v4.mp4`
- number of canonicals: 5
- number of traversals: 4
- canonical reshoots: 0
- CM desired / actual:
  - A-B: desired 8s / Veo 8s / Kling 10s / pace fast / set 95 / trav 90
  - B-C: desired 5s / Veo 6s / Kling 5s / pace fast / set 95 / trav 92
  - C-D: desired 5s / Veo 6s / Kling 5s / pace fast / set 95 / trav 95
  - D-E: desired 8s / Veo missing / Kling 8s then 10s / pace fast / set 92 / trav 85
- models: overnight Veo quality (A→D); selected Kling 2.5 turbo pro balanced
- final export path (filmmaker): `~/Downloads/GrammarTestMOUNTEDCanyonRun_v4.mp4`
- total final journey duration: ~30.3s (Kling, complete A→E)
- errors/warnings: overnight Veo D-E content-policy refusal. Not a MOUNTED-baseline failure. Persistent hood/decklid geometry is present in opening A as intended.

---

## Resume

```
cd web
npx tsx journey-cli.ts --experiment-canyon
```

Re-export a saved project:

```
cd web
npx tsx journey-cli.ts --export-project GrammarTest-POVCanyonRun2
```
