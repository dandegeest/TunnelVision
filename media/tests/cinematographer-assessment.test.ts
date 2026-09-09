import assert from "node:assert/strict";
import { test } from "node:test";

import { MediaGenerationError } from "../src/errors.ts";
import {
  assessJourney,
  buildCinematographerAssessmentRequest,
  parseCinematographerAssessment,
  type CinematographerAssessmentInput,
} from "../src/cinematographer/assess-journey.ts";
import { CINEMATOGRAPHER_ASSESSMENT_SYSTEM_INSTRUCTION } from "../src/cinematographer/assessment-prompts.ts";
import { TUNNELVISION_LOCOMOTION_BASELINE } from "../src/cinematographer/shooting-prompt.ts";
import type { ReasoningProvider, ReasoningRequest, ReasoningResult } from "../src/reasoning/types.ts";

const input: CinematographerAssessmentInput = {
  journeyId: "A-B",
  story: "Travel forward through this night forest and keep going.",
  start: {
    id: "A",
    intent: "Night forest path toward the tree-trunk gateway.",
    image: { kind: "file", path: "/tmp/a.jpg" },
  },
  end: {
    id: "B",
    intent: "Root-tunnel mouth.",
    image: { kind: "file", path: "/tmp/b.jpg" },
  },
};

function validAssessmentJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    shootability: "shootable",
    summary: "Walk through the visible opening into the darker mouth.",
    route: "Advance along the path and pass through the opening.",
    threshold: "The dark opening slightly right of center.",
    camera: "Track forward along the path, passing between near structures toward the opening.",
    parallax: "Near structures the camera can pass beside.",
    transitionStrategy: "Pass through the visible opening so near geometry sweeps past the lens.",
    segmentPromptAddition:
      "Track forward along the path, pass between the near structures, and move through the visible opening toward the darker mouth.",
    camotionSuitability: "appropriate",
    concerns: [],
    ...overrides,
  });
}

test("Cinematographer assessment request asks how to shoot actual stills, not whether the video model will succeed", () => {
  const request = buildCinematographerAssessmentRequest(input);
  assert.equal(request.systemInstruction, CINEMATOGRAPHER_ASSESSMENT_SYSTEM_INSTRUCTION);
  assert.match(request.systemInstruction, /how the camera should move/i);
  assert.match(request.systemInstruction, /do not invent invisible/i);
  assert.match(request.systemInstruction, /mostly straight forward move is valid/i);
  assert.match(request.systemInstruction, /not automatically a reason to mark the shot not_shootable/i);
  assert.match(request.systemInstruction, /not predicting whether a stochastic video model will succeed/i);
  assert.match(request.systemInstruction, /always produce camera choreography/i);
  assert.doesNotMatch(request.systemInstruction, /will the video model succeed/i);
  assert.doesNotMatch(request.systemInstruction, /vanishing_point/);
  assert.doesNotMatch(request.systemInstruction, /exposure\.strength/);
  assert.match(request.prompt, /Journey A-B/);
  assert.match(request.prompt, /night forest/);
  assert.match(request.systemInstruction, /next viewpoint along that same travel direction/i);
  assert.match(request.systemInstruction, /not a reverse angle/i);
  assert.match(request.systemInstruction, /camera is unembodied/i);
  assert.match(request.systemInstruction, /People, animals, vehicles, objects, and other subjects in the stills are part of the world/);
  assert.doesNotMatch(request.systemInstruction, /no people/i);
  assert.match(request.prompt, /Image 1 is the START canonical set/);
  assert.match(request.prompt, /same travel direction/);
  assert.match(request.prompt, /not a reverse shot/i);
  assert.match(request.prompt, /Do not predict whether a video model will succeed/);
  assert.ok(request.prompt.includes(TUNNELVISION_LOCOMOTION_BASELINE));
  assert.deepEqual(request.images, [input.start.image, input.end.image]);
  assert.equal(request.payload.startId, "A");
  assert.equal(request.payload.endId, "B");
});

test("structured Cinematographer assessment JSON includes segment choreography", () => {
  const assessment = parseCinematographerAssessment(`\`\`\`json\n${validAssessmentJson()}\n\`\`\``);
  assert.equal(assessment.shootability, "shootable");
  assert.equal(assessment.camotionSuitability, "appropriate");
  assert.equal(assessment.concerns.length, 0);
  assert.match(assessment.camera, /Track forward/);
  assert.match(assessment.transitionStrategy, /visible opening/);
  assert.match(assessment.segmentPromptAddition, /pass between the near structures/);
});

test("a straight route is valid choreography and does not require a turn", () => {
  const assessment = parseCinematographerAssessment(
    validAssessmentJson({
      camera: "Push straight forward along the center of the visible corridor.",
      transitionStrategy: "Keep a centered forward trajectory as nearby walls sweep past.",
      segmentPromptAddition:
        "Push straight forward down the center of the corridor toward the destination ahead.",
    }),
  );
  assert.doesNotMatch(assessment.camera, /veer|turn|curve|drift/i);
  assert.doesNotMatch(assessment.segmentPromptAddition, /veer|turn|curve/i);
  assert.match(assessment.camera, /straight forward/);
});

test("visible foreground geometry can be choreographed as a pass rather than making the shot invalid", () => {
  const assessment = parseCinematographerAssessment(
    validAssessmentJson({
      shootability: "shootable",
      camera:
        "Approach the large foreground structure, veer slightly to pass close beside it, allow it to sweep the near foreground, then continue forward.",
      parallax: "A large structure occupies the path; pass beside it rather than stopping.",
      transitionStrategy:
        "Use the close pass as temporary cover while travel continues into the space beyond.",
      segmentPromptAddition:
        "Approach the foreground structure, veer slightly to pass close beside it, allow it to sweep through the near foreground and behind the camera, then continue toward the visible corridor.",
      concerns: ["The structure occupies much of the forward view."],
    }),
  );
  assert.equal(assessment.shootability, "shootable");
  assert.match(assessment.camera, /pass close beside/);
  assert.match(assessment.parallax, /pass beside it rather than stopping/);
});

test("invalid Cinematographer assessment fails instead of inventing shootability or choreography", () => {
  assert.throws(() => parseCinematographerAssessment("not json"), MediaGenerationError);
  assert.throws(
    () => parseCinematographerAssessment(JSON.stringify({ summary: "Go." })),
    /shootability/,
  );
  assert.throws(
    () =>
      parseCinematographerAssessment(
        validAssessmentJson({ shootability: "maybe", concerns: [] }),
      ),
    /shootability/,
  );
  assert.throws(
    () =>
      parseCinematographerAssessment(
        validAssessmentJson({ camotionSuitability: "0.08", concerns: [] }),
      ),
    /camotionSuitability/,
  );
  assert.throws(
    () =>
      parseCinematographerAssessment(
        validAssessmentJson({ segmentPromptAddition: "" }),
      ),
    /segmentPromptAddition/,
  );
  assert.throws(
    () =>
      parseCinematographerAssessment(
        validAssessmentJson({ transitionStrategy: "" }),
      ),
    /transitionStrategy/,
  );
});

test("Cinematographer.assessJourney uses ReasoningProvider only", async () => {
  let captured: ReasoningRequest | undefined;
  const reasoning: ReasoningProvider = {
    async complete(request) {
      captured = request;
      const result: ReasoningResult = {
        provider: "replicate",
        model: "mock/cinematographer",
        modelVersion: "test",
        predictionId: "pred-cm-1",
        status: "succeeded",
        text: validAssessmentJson({
          shootability: "not_shootable",
          summary: "No credible corridor is visible, but keep traveling toward the distant light.",
          camotionSuitability: "poor_fit",
          concerns: ["Open field with no traversable corridor."],
        }),
        metadata: {},
        startedAt: "2026-09-08T00:00:00.000Z",
        completedAt: "2026-09-08T00:00:01.000Z",
        elapsedMs: 900,
      };
      return result;
    },
  };
  const result = await assessJourney({ reasoning, ...input });
  assert.equal(captured?.images?.length, 2);
  assert.equal(result.assessment.shootability, "not_shootable");
  assert.ok(result.assessment.segmentPromptAddition.length > 0);
  assert.equal(result.predictionId, "pred-cm-1");
});
