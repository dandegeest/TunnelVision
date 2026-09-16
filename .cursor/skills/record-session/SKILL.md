---
name: record-session
description: >-
  Records a live TunnelVision Agent/Directed journey as a durable session
  playbook under docs/sessions/, with archived canonical stills and a
  reusable recipe. Use when the user asks to document, record, write up, or
  remember a session, run, journey, movie, best output, or to capture a
  project so similar results can be reproduced with another subject.
---

# Record a TunnelVision session

Canon: [docs/sessions/red-paper-airplane.md](../../../docs/sessions/red-paper-airplane.md). Match that shape. Do not invent Screenwriter, LOOP, or a new Agent pipeline.

Session docs are filmmaking evidence. Do not retune Camotion, CM scores, or Agent repair while recording.

## Output

```
docs/sessions/<slug>.md
docs/sessions/<slug>/*.jpg    # archived canonicals, descriptive names
docs/sessions/README.md       # add one index line
```

`<slug>` is lowercase hyphenated (`red-paper-airplane`). Prefix with `YYYY-MM-DD-` when two sessions share a subject.

Do not commit unless asked.

## Evidence first

Reconstruct from artifacts. Never guess the rest of a clipped prompt, beat letters, models, or scores.

**Collect, in this order:**

1. Live product UI on `localhost:5173` / `5174` — Project rail (story, destination count, agency, Generate all destinations, Shoot, image/video models, take intent) and Shoot inspector (pair scores, pace, CM summary, Agent conversation).
2. Newest **non-empty** runtime store. Dev media is ephemeral:

   ```bash
   ls -ltd /var/folders/*/*/T/tunnelvision-runtime-media-* 2>/dev/null | head
   curl -s http://127.0.0.1:5173/api/debug/media
   ```

   Cursor's browser tab is often a different untitled session than Chrome. Prefer the populated store and Desktop screenshots of the user's app over an empty IDE tab.
3. Camotion work dirs `tunnelvision-camotion-*` (plan.json exposure / VP) when Debug left them.
4. Desktop screenshots from the same window as the run.

Quote only text you can see. Mark inferred beat letters. If a story is truncated, leave it truncated and say so.

## Identify stills

Runtime files are anonymous `upload-<id>.jpg|.png`.

- Generated canonicals: jpg, often 1376×768 (Nano Banana 2 Lite / 1K).
- Camotion A′/B′: larger pngs.
- Open stills in chronological order; map to timeline thumbs A…N.
- Copy **key canonicals** into `docs/sessions/<slug>/` with names like `A-abandoned-office.jpg`, `E-hatch-lookback-rejected.jpg`. Runtime temp dirs die on Vite restart.
- Archive the winning pair, the opening, each distinct threshold, and any rejected repair still. Skip every A′/B′ unless the user asks.

## Write the playbook

Use this outline (same headings as the red-plane doc):

1. **Title + date + status** — one line on why this run matters.
2. **What this session proved** — one mechanism (not "it looked good"). Name the peak pair and its Set consistency / Traversal confidence / pace / CM summary.
3. **Exact project setup** — table of Agency, destination count, Generate all, Shoot, take intent, image model, video model (or "product default"), clip duration. Note defaults when the UI did not show a non-default.
4. **The journey prompt** — verbatim in a fenced block, then **Why this prompt works** as reusable *shape* (subject, opening, thresholds, weather, no POV words).
5. **Beat geography** — table: beat, place, still link, role.
6. **Scores and Agent repair** — per-pair scores; quote repair instructions; name the failed joint.
7. **Pipeline** — what actually ran (Agent vs Directed). Current Agent path: generate A → Director B…N → sequential construct → CM + Camotion → NEW TAKE → reshoot generated END if Traversal **< 30**. Do not describe LOOP or Screenwriter.
8. **Recipe: any subject, same results** — template story, project checklist, how to judge pairs (same world, camera forward, subject ahead).
9. **Anti-patterns** — from this run's failures (look-back hatch, world hop with no connector, etc.).
10. **Reproduction checklist** + **Source notes** — UI URL/time, runtime dir, honesty about clipped text.

Peak-pair test (quote this idea in "what it proved"):

> same world, camera advanced, subject still in frame, weather already moving

## Product facts (do not contradict)

- Story text must not mention FPOV / camera body. Product injects unembodied POV on stills and video.
- Construction: spatial progression is primary; same world; camera must advance.
- Repair: Traversal Confidence < 30; END only; START not rewritten; Set Consistency does not trigger repair.
- Fast takes discover the route; Quality recuts a loved pair later.

## Afterward

Update [docs/sessions/README.md](../../../docs/sessions/README.md). Then write the Desktop working-tree patch per the project rule.
