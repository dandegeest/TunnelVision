# Grammar experiment report

Generated: 2026-09-18T18:58:42.874Z

## HEADLESS EXECUTION

SUCCESS

Journeys were created through the non-interactive `runJourneyAgent` path (`web/headless-journey.ts` / `web/journey-cli.ts`), not the browser UI.

Projects Folder: /Users/ddegeest/Source/tunnelvision/projects
Credentials: REPLICATE_API_TOKEN configured
Logs: /Users/ddegeest/Source/tunnelvision/docs/grammar_template_experiment/logs

## Grammar Template Test - POV Canyon Run

- Project name: Grammar Template Test - POV Canyon Run
- Project directory: /Users/ddegeest/Source/tunnelvision/projects/GrammarTemplateTest-POVCanyonRun
- grammar: pov
- original journey prompt:

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
- canonical reshoots: 1
- traversal retries/reshoots: 0
- takes: 4
- CM desired / actual durations: [{"id":"A-B","pace":"fast","desiredDurationSeconds":5,"actualDurationSeconds":6,"model":"google/veo-3.1-fast","generationIntent":"quality","takeCount":1},{"id":"B-C","pace":"fast","desiredDurationSeconds":8,"actualDurationSeconds":8,"model":"google/veo-3.1-fast","generationIntent":"quality","takeCount":1},{"id":"C-D","pace":"fast","desiredDurationSeconds":4,"actualDurationSeconds":4,"model":"google/veo-3.1-fast","generationIntent":"quality","takeCount":1},{"id":"D-E","pace":"fast","desiredDurationSeconds":8,"actualDurationSeconds":8,"model":"google/veo-3.1-fast","generationIntent":"quality","takeCount":1}]
- quality model(s) used: ["google/veo-3.1-fast","google/veo-3.1-fast","google/veo-3.1-fast","google/veo-3.1-fast"]
- final export path: /Users/ddegeest/Source/tunnelvision/projects/GrammarTemplateTest-POVCanyonRun/exports/GrammarTemplateTestPOVCanyonRun_v1.mp4
- total final journey duration: 26s
- errors/warnings: []
- execution notes: generating opening destination A | directing journey | generating destination B | evaluating A→B | evaluated A→B | RESHOOT · B A→B needs a stronger spatial connection. Set Consistency 45 · Traversal Confidence 10 Brief reason: Regenerate the end image from a low ground-level POV continuing along a straight or gently curving section of the multi-lane highway as it enters the canyon, strictly matching the road type, width, and camera elevation of the start image. | reevaluating A→B | reevaluated A→B | RESHOOT COMPLETE · B Set Consistency 45 → 95 Traversal Confidence 10 → 95 | planning A→B | creating A→B TAKE 1 | generating destination C | evaluating B→C | evaluated B→C | planning B→C | creating B→C TAKE 1 | generating destination D | evaluating C→D | evaluated C→D | planning C→D | creating C→D TAKE 1 | generating destination E | evaluating D→E | evaluated D→E | planning D→E | creating D→E TAKE 1 | assembling journey | complete

## Grammar Template Test - FOLLOW Canyon Run

- Project name: Grammar Template Test - FOLLOW Canyon Run
- Project directory: /Users/ddegeest/Source/tunnelvision/projects/GrammarTemplateTest-FOLLOWCanyonRun
- grammar: follow
- original journey prompt:

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
- takes: 4
- CM desired / actual durations: [{"id":"A-B","pace":"fast","desiredDurationSeconds":8,"actualDurationSeconds":8,"model":"google/veo-3.1-fast","generationIntent":"quality","takeCount":1},{"id":"B-C","pace":"fast","desiredDurationSeconds":6,"actualDurationSeconds":6,"model":"google/veo-3.1-fast","generationIntent":"quality","takeCount":1},{"id":"C-D","pace":"fast","desiredDurationSeconds":5,"actualDurationSeconds":6,"model":"google/veo-3.1-fast","generationIntent":"quality","takeCount":1},{"id":"D-E","pace":"fast","desiredDurationSeconds":8,"actualDurationSeconds":8,"model":"google/veo-3.1-fast","generationIntent":"quality","takeCount":1}]
- quality model(s) used: ["google/veo-3.1-fast","google/veo-3.1-fast","google/veo-3.1-fast","google/veo-3.1-fast"]
- final export path: /Users/ddegeest/Source/tunnelvision/projects/GrammarTemplateTest-FOLLOWCanyonRun/exports/GrammarTemplateTestFOLLOWCanyonR_v1.mp4
- total final journey duration: 28s
- errors/warnings: []
- execution notes: generating opening destination A | directing journey | generating destination B | evaluating A→B | evaluated A→B | planning A→B | creating A→B TAKE 1 | generating destination C | evaluating B→C | evaluated B→C | planning B→C | creating B→C TAKE 1 | generating destination D | evaluating C→D | evaluated C→D | planning C→D | creating C→D TAKE 1 | generating destination E | evaluating D→E | evaluated D→E | planning D→E | creating D→E TAKE 1 | assembling journey | complete

## Grammar Template Test - LEAD Canyon Run

- Project name: Grammar Template Test - LEAD Canyon Run
- Project directory: /Users/ddegeest/Source/tunnelvision/projects/GrammarTemplateTest-LEADCanyonRun
- grammar: lead
- original journey prompt:

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
- canonical reshoots: 1
- traversal retries/reshoots: 0
- takes: 4
- CM desired / actual durations: [{"id":"A-B","pace":"fast","desiredDurationSeconds":8,"actualDurationSeconds":8,"model":"google/veo-3.1-fast","generationIntent":"quality","takeCount":1},{"id":"B-C","pace":"fast","desiredDurationSeconds":6,"actualDurationSeconds":6,"model":"google/veo-3.1-fast","generationIntent":"quality","takeCount":1},{"id":"C-D","pace":"fast","desiredDurationSeconds":8,"actualDurationSeconds":8,"model":"google/veo-3.1-fast","generationIntent":"quality","takeCount":1},{"id":"D-E","pace":"fast","desiredDurationSeconds":15,"actualDurationSeconds":8,"model":"google/veo-3.1-fast","generationIntent":"quality","takeCount":1}]
- quality model(s) used: ["google/veo-3.1-fast","google/veo-3.1-fast","google/veo-3.1-fast","google/veo-3.1-fast"]
- final export path: /Users/ddegeest/Source/tunnelvision/projects/GrammarTemplateTest-LEADCanyonRun/exports/GrammarTemplateTestLEADCanyonRun_v1.mp4
- total final journey duration: 30s
- errors/warnings: []
- execution notes: generating opening destination A | directing journey | generating destination B | evaluating A→B | evaluated A→B | planning A→B | creating A→B TAKE 1 | generating destination C | evaluating B→C | evaluated B→C | RESHOOT · C B→C needs a stronger spatial connection. Set Consistency 35 · Traversal Confidence 15 Brief reason: Regenerate the END image to show the camera retreating along the open, winding paved road visible in front of the car in the START image, maintaining the steep open canyon environment rather than placing the camera inside an unestablished tunnel. | reevaluating B→C | reevaluated B→C | RESHOOT COMPLETE · C Set Consistency 35 → 95 Traversal Confidence 15 → 85 | planning B→C | creating B→C TAKE 1 | generating destination D | evaluating C→D | evaluated C→D | planning C→D | creating C→D TAKE 1 | generating destination E | evaluating D→E | evaluated D→E | planning D→E | creating D→E TAKE 1 | assembling journey | complete

## Grammar Template Test - MOUNTED Canyon Run

- Project name: Grammar Template Test - MOUNTED Canyon Run
- Project directory: /Users/ddegeest/Source/tunnelvision/projects/GrammarTemplateTest-MOUNTEDCanyonRun
- grammar: mounted
- original journey prompt:

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
- canonical reshoots: 0
- traversal retries/reshoots: 0
- takes: 4
- CM desired / actual durations: [{"id":"A-B","pace":"fast","desiredDurationSeconds":8,"actualDurationSeconds":8,"model":"google/veo-3.1-fast","generationIntent":"quality","takeCount":1},{"id":"B-C","pace":"fast","desiredDurationSeconds":6,"actualDurationSeconds":6,"model":"google/veo-3.1-fast","generationIntent":"quality","takeCount":1},{"id":"C-D","pace":"fast","desiredDurationSeconds":6,"actualDurationSeconds":6,"model":"google/veo-3.1-fast","generationIntent":"quality","takeCount":1},{"id":"D-E","pace":"fast","desiredDurationSeconds":6,"actualDurationSeconds":6,"model":"google/veo-3.1-fast","generationIntent":"quality","takeCount":1}]
- quality model(s) used: ["google/veo-3.1-fast","google/veo-3.1-fast","google/veo-3.1-fast","google/veo-3.1-fast"]
- final export path: /Users/ddegeest/Source/tunnelvision/projects/GrammarTemplateTest-MOUNTEDCanyonRun/exports/GrammarTemplateTestMOUNTEDCanyon_v1.mp4
- total final journey duration: 26s
- errors/warnings: []
- execution notes: generating opening destination A | directing journey | generating destination B | evaluating A→B | evaluated A→B | planning A→B | creating A→B TAKE 1 | generating destination C | evaluating B→C | evaluated B→C | planning B→C | creating B→C TAKE 1 | generating destination D | evaluating C→D | evaluated C→D | planning C→D | creating C→D TAKE 1 | generating destination E | evaluating D→E | evaluated D→E | planning D→E | creating D→E TAKE 1 | assembling journey | complete

