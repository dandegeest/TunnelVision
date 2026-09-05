# Scene-aware Camotion strength

Not Camotion 01.13. The 01.8 operator is unchanged. 01.12 is not reopened.

Research question: can scene-aware selection from `{0.02, 0.04, 0.08}` improve video behavior across already-shootable Wardrobe Loop shots compared with fixed `0.08`?

Shots: A→B (seed 80), B→C (seed 81), D→E (seed 82). Not C→D. Not E→A.

Control uses Integration Test 01 01.8 route-preserved shooting frames at strength 0.08.
Adaptive uses the same 01.8 renderer; only `CameraMotionPlan.exposure.strength` may differ, chosen before any Seedance call.

Prompts are the authoritative Integration Test 01 Seedance prompts, identical within each pair. `COMMON_VIDEO_INTENT` is not prepended.

Selections were frozen in `planning.json` before any Seedance call.
Human evaluation and the Phase 1 freeze are recorded in `REPORT.md`.
