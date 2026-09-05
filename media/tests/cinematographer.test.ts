import assert from "node:assert/strict";
import { test } from "node:test";

import { MediaGenerationError } from "../src/errors.ts";
import {
  BASELINE_EXPOSURE,
  BASELINE_FORWARD,
  extractShotMotionPlans,
  parseJsonObject,
} from "../src/cinematographer/plan-shot.ts";
import { toGemini31ProInput } from "../src/replicate/gemini-3.1-pro.ts";

test("cinematographer extracts CameraMotionPlan v1 from pair JSON and pins 01.8 exposure", () => {
  const text = `\`\`\`json
{
  "route": "walk through the wardrobe",
  "start": {
    "environment": "bedroom",
    "destination": {
      "description": "open wardrobe",
      "point": [0.51, 0.58],
      "protect": true,
      "bbox": [0.40, 0.20, 0.62, 0.88]
    },
    "camera": { "vanishing_point": [0.50, 0.52], "forward": 0.4 },
    "exposure": { "strength": 0.75, "samples": 8 }
  },
  "end": {
    "environment": "passage",
    "destination": {
      "description": "forest opening",
      "point": [0.48, 0.55],
      "protect": true,
      "bbox": [0.36, 0.30, 0.64, 0.78]
    },
    "camera": { "vanishing_point": [0.49, 0.47], "forward": 0.2 },
    "exposure": { "strength": 0.9, "samples": 32 }
  }
}
\`\`\``;
  const plans = extractShotMotionPlans(text);
  assert.equal(plans.start.version, 1);
  assert.deepEqual(plans.start.camera.vanishing_point, [0.5, 0.52]);
  assert.deepEqual(plans.start.destination.point, [0.51, 0.58]);
  assert.equal(plans.start.camera.forward, BASELINE_FORWARD);
  assert.equal(plans.start.exposure.strength, BASELINE_EXPOSURE.strength);
  assert.equal(plans.start.exposure.samples, BASELINE_EXPOSURE.samples);
  assert.equal(plans.end.camera.forward, BASELINE_FORWARD);
  assert.equal(plans.end.exposure.strength, BASELINE_EXPOSURE.strength);
  assert.equal(plans.route, "walk through the wardrobe");
});

test("cinematographer rejects coordinates outside the unit square", () => {
  assert.throws(
    () =>
      extractShotMotionPlans(
        JSON.stringify({
          start: {
            destination: {
              point: [1.2, 0.5],
              protect: true,
              bbox: [0.1, 0.1, 0.2, 0.2],
            },
            camera: { vanishing_point: [0.5, 0.5], forward: 1 },
          },
          end: {
            destination: {
              point: [0.5, 0.5],
              protect: true,
              bbox: [0.1, 0.1, 0.2, 0.2],
            },
            camera: { vanishing_point: [0.5, 0.5], forward: 1 },
          },
        }),
      ),
    (error: unknown) => {
      assert(error instanceof MediaGenerationError);
      assert.match(error.message, /\[0, 1\]/);
      return true;
    },
  );
});

test("parseJsonObject reads a bare object", () => {
  assert.deepEqual(parseJsonObject('{"ok": true}'), { ok: true });
});

test("Gemini reasoning input sends images as an array and keeps cinematographer settings", () => {
  const input = toGemini31ProInput(
    {
      prompt: "plan this shot",
      systemInstruction: "You are the Cinematographer",
    },
    [
      { kind: "url", url: "https://example.com/a.png" },
      { kind: "url", url: "https://example.com/b.png" },
    ],
  );
  assert.equal(input.thinking_level, "high");
  assert.equal(input.temperature, 1);
  assert.equal(input.top_p, 0.95);
  assert.deepEqual(input.images, [
    "https://example.com/a.png",
    "https://example.com/b.png",
  ]);
  assert.equal(input.system_instruction, "You are the Cinematographer");
});
