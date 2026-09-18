# Grammar template regression report

Generated: 2026-09-18 (afternoon headless run, ~18:31–18:58 UTC)

FM-only prompts + current prompt-template assembly. Comparison against the earlier verbose-prompt canyon experiment (`Grammar Test - * Canyon Run`, overnight Quality/Veo then Kling recuts).

## HEADLESS EXECUTION

SUCCESS — all four JourneyAgent runs reached `COMPLETE` with a concatenated MP4.

Path: `web/grammar-template-experiment.ts` → `runHeadlessJourney` / `runJourneyAgent` (same stack as `web/journey-cli.ts` / `web/headless-journey.ts`). Not the browser UI.

Projects Folder: `/Users/ddegeest/Source/tunnelvision/projects`

Logs: `docs/grammar_template_experiment/logs/` (`pov.log`, `follow.log`, `lead.log`, `mounted.log`)

Quality intent: `quality` → `veo-3.1-fast` (`google/veo-3.1-fast`) via `DEFAULT_VIDEO_MODELS_BY_INTENT`

Duration mode: Adaptive (CM `desiredDurationSeconds` mapped onto Veo 4/6/8)

Elapsed: ~27.6 minutes for all four sequential journeys.

---

## Grammar Template Test - POV Canyon Run

- Project name: Grammar Template Test - POV Canyon Run
- Project directory: `/Users/ddegeest/Source/tunnelvision/projects/GrammarTemplateTest-POVCanyonRun`
- grammar: pov
- FM-only prompt:

```
Photorealistic high-speed journey through a dramatic desert canyon:
open highway toward towering red-rock cliffs, twisting canyon road,
narrow rock tunnel, high bridge over a deep gorge, then an open
mountain road overlooking the desert.

High-end live-action cinematography, natural light, monumental scale.
```

- journey status: COMPLETE
- number of canonicals: 5
- number of traversals: 4
- canonical reshoots: 1 (B after A→B set 45 / trav 10 → 95 / 95)
- traversal retries/reshoots: 0 (one Quality take per pair)
- CM desired / actual (Veo 3.1 Fast):
  - A-B: desired 5s / actual 6s / pace fast / set 95 / trav 95 / shootable
  - B-C: desired 8s / actual 8s / pace fast / set 85 / trav 85 / shootable
  - C-D: desired 4s / actual 4s / pace fast / set 40 / trav 85 / shootable
  - D-E: desired 8s / actual 8s / pace fast / set 95 / trav 80 / shootable
- final provider/model: `google/veo-3.1-fast` (quality)
- final export path: `/Users/ddegeest/Source/tunnelvision/projects/GrammarTemplateTest-POVCanyonRun/exports/GrammarTemplateTestPOVCanyonRun_v1.mp4`
- final journey duration: 26.0s
- errors/warnings: none on export. C→D setConsistency 40 (tunnel/bridge world match), still shootable.
- notes: Opening A is unembodied highway toward cliffs. Distant world vehicles are visible on the road (allowed by still law; the old verbose prompt had explicitly forbidden vehicle bodies). Tunnel C is empty-road POV with the bridge as far-field through the opening.

---

## Grammar Template Test - FOLLOW Canyon Run

- Project name: Grammar Template Test - FOLLOW Canyon Run
- Project directory: `/Users/ddegeest/Source/tunnelvision/projects/GrammarTemplateTest-FOLLOWCanyonRun`
- grammar: follow
- FM-only prompt:

```
Photorealistic high-speed journey tracking the same bright red sports car
through a dramatic desert canyon: open highway toward towering red-rock
cliffs, twisting canyon road, narrow rock tunnel, high bridge over a deep
gorge, then an open mountain road overlooking the desert.

High-end live-action automotive cinematography, natural light,
monumental scale.
```

- journey status: COMPLETE
- number of canonicals: 5
- number of traversals: 4
- canonical reshoots: 0
- traversal retries/reshoots: 0
- CM desired / actual:
  - A-B: desired 8s / actual 8s / pace fast / set 95 / trav 85 / shootable
  - B-C: desired 6s / actual 6s / pace fast / set 90 / trav 85 / shootable
  - C-D: desired 5s / actual 6s / pace fast / set 85 / trav 95 / shootable
  - D-E: desired 8s / actual 8s / pace fast / set 92 / trav 85 / shootable
- final provider/model: `google/veo-3.1-fast` (quality)
- final export path: `/Users/ddegeest/Source/tunnelvision/projects/GrammarTemplateTest-FOLLOWCanyonRun/exports/GrammarTemplateTestFOLLOWCanyonR_v1.mp4`
- final journey duration: 28.0s
- errors/warnings: none. D→E CM summary mentions a tunnel; the E still is a cliff-road overlook with the car farther ahead.
- notes: Opening A is pursuit from behind a red sports car. E keeps the same car with opened distance (elastic FOLLOW). Director beat E explicitly “pulling back slightly.” No grammar-law text in the story.

---

## Grammar Template Test - LEAD Canyon Run

- Project name: Grammar Template Test - LEAD Canyon Run
- Project directory: `/Users/ddegeest/Source/tunnelvision/projects/GrammarTemplateTest-LEADCanyonRun`
- grammar: lead
- FM-only prompt:

```
Photorealistic high-speed journey with the same bright red sports car
through a dramatic desert canyon: open highway toward towering red-rock
cliffs, twisting canyon road, narrow rock tunnel, high bridge over a deep
gorge, then an open mountain road overlooking the desert.

High-end live-action automotive cinematography, natural light,
monumental scale.
```

- journey status: COMPLETE
- number of canonicals: 5
- number of traversals: 4
- canonical reshoots: 1 (C after B→C set 35 / trav 15 → 95 / 85)
- traversal retries/reshoots: 0
- CM desired / actual:
  - A-B: desired 8s / actual 8s / pace fast / set 85 / trav 85 / shootable
  - B-C: desired 6s / actual 6s / pace fast / set 95 / trav 85 / shootable
  - C-D: desired 8s / actual 8s / pace fast / set 90 / trav 95 / shootable
  - D-E: desired 15s / actual 8s (Veo cap) / pace fast / set 95 / trav 85 / shootable
- final provider/model: `google/veo-3.1-fast` (quality)
- final export path: `/Users/ddegeest/Source/tunnelvision/projects/GrammarTemplateTest-LEADCanyonRun/exports/GrammarTemplateTestLEADCanyonRun_v1.mp4`
- final journey duration: 30.0s
- errors/warnings: first C was repaired because CM treated an early tunnel as unestablished. After repair, C is inside the tunnel facing the oncoming car (LEAD).
- notes: Opening A is the red car racing toward camera. Director intents use retreat / facing language without the story restating LEAD law. A→B scores (85/85) are stronger than the old verbose-prompt overnight A→B (80/65).

---

## Grammar Template Test - MOUNTED Canyon Run

- Project name: Grammar Template Test - MOUNTED Canyon Run
- Project directory: `/Users/ddegeest/Source/tunnelvision/projects/GrammarTemplateTest-MOUNTEDCanyonRun`
- grammar: mounted
- FM-only prompt: same as LEAD (subject + route + automotive style; no mount-geometry paragraph)
- journey status: COMPLETE
- number of canonicals: 5
- number of traversals: 4
- canonical reshoots: 0
- traversal retries/reshoots: 0
- CM desired / actual:
  - A-B: desired 8s / actual 8s / pace fast / set 92 / trav 85 / shootable
  - B-C: desired 6s / actual 6s / pace fast / set 90 / trav 45 / **needs_review** / repairRecommendation RESHOOT_END (Agent still filmed)
  - C-D: desired 6s / actual 6s / pace fast / set 85 / trav 75 / **needs_review** / SHOOT
  - D-E: desired 6s / actual 6s / pace fast / set 80 / trav 85 / shootable
- final provider/model: `google/veo-3.1-fast` (quality)
- final export path: `/Users/ddegeest/Source/tunnelvision/projects/GrammarTemplateTest-MOUNTEDCanyonRun/exports/GrammarTemplateTestMOUNTEDCanyon_v1.mp4`
- final journey duration: 26.0s
- errors/warnings: B→C and C→D marked needs_review. CM notes the mount point changing (hood vs side window) and a boom-over-roof move on C→D.
- notes: Opening A and B show persistent hood/fender geometry. C is still attached to the car but from a side-window mount, not the hood. Mount association is not lost; it is not locked to one rig.

---

## Comparison to verbose-prompt experiment

| | Old | New |
| --- | --- | --- |
| POV | `GrammarTest-POVCanyonRun2` | `GrammarTemplateTest-POVCanyonRun` |
| FOLLOW | `GrammarTest-FOLLOWCanyonRun` | `GrammarTemplateTest-FOLLOWCanyonRun` |
| LEAD | `GrammarTest-LEADCanyonRun` | `GrammarTemplateTest-LEADCanyonRun` |
| MOUNTED | `GrammarTest-MOUNTEDCanyonRun` | `GrammarTemplateTest-MOUNTEDCanyonRun` |

Old watchable cuts were afternoon Kling recuts after Veo caps. This run’s exports are first-pass Quality Veo 3.1 Fast, so duration/model are not a like-for-like footage comparison. Grammar reading is compared on canonicals + CM language.

### Did grammar still read correctly?

- **POV:** yes. Unembodied traveler; no hood/cockpit. Distant highway cars appear as world subjects (old prompt had extra “do not show vehicle body”).
- **FOLLOW:** yes. Persistent red car from behind; E opens distance.
- **LEAD:** yes. Facing the oncoming car, including repaired tunnel C. No fly-past rewrite in Director/CM text.
- **MOUNTED:** mostly yes at A/B; C shifts to a side mount. Not unembodied POV, not a detached follow.

### Subject continuity

- FOLLOW / LEAD / MOUNTED kept a bright red sports car without naming grammar law. Similar to the old run.
- POV had no persistent car by design. Similar, slightly more world traffic in A.

### Route / thresholds

- All four Director plans still used highway → canyon → tunnel → bridge → overlook (five destinations).
- POV and LEAD each needed one Agent canonical repair (old overnight: 0 POV / 0 LEAD canonical reshoots). Thresholds still landed.
- FOLLOW needed no canonical repair (cleaner than POV/LEAD this run).

### CM duration

- Adaptive still mapped onto Veo 4/6/8. Totals 26 / 28 / 30 / 26s vs old Kling ~30.3 / 30.3 / 35.3 / 30.3s (different model discrete lengths).
- LEAD D→E desired 15s, Veo capped at 8s. Old Kling LEAD was longer because 10s clips were available.

### Shorter prompts: help / hurt / neutral

- **Neutral to slightly helpful** for FOLLOW and LEAD openings: grammar came through from CAMERA without restated law.
- **Neutral** for POV, with one extra canonical repair and a low C→D set score.
- **Mixed** for MOUNTED: openings are strong; later stills change mount point and two pairs are needs_review. Cannot claim the short prompt caused that; the old MOUNTED overnight also had a Veo D→E refusal.

---

## Risk check

| Risk | This run |
| --- | --- |
| Grammar less distinct than before | Openings are as distinct as the old control stills. MOUNTED C is the weakest later-beat distinction (side window vs hood). |
| Continuity degraded | POV C→D set 40. LEAD first C failed then repaired. FOLLOW stills look continuous. |
| LEAD regressed | Not on stills/CM language. A→B scores improved vs old overnight. One tunnel-timing repair. |
| MOUNTED lost mount association | Did not lose it. Mount **point** jumped (hood A/B → side window C). CM flagged B→C (trav 45, needs_review) and still shot it. |
| POV showed unwanted mount/body | No hood/cockpit. Distant cars on A are world subjects. |
| FOLLOW stopped reading as pursuit | No. A–E keep the car ahead of an objective camera. |

Footage quality of these Veo first takes was not scored against the archived Kling recuts.

---

## Resume

```
cd web
npx tsx grammar-template-experiment.ts
```
