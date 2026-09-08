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
    summary: "Walk through the root gateway into the darker mouth.",
    route: "Advance along the forest path and pass through the trunk opening.",
    threshold: "The dark root-mouth opening slightly right of center.",
    camera: "Aim forward through the gateway, keeping the opening in the travel axis.",
    parallax: "Near trunks and roots the camera can pass beside.",
    camotionSuitability: "appropriate",
    concerns: [],
    ...overrides,
  });
}

test("Cinematographer assessment request sends both actual stills and spatial principles", () => {
  const request = buildCinematographerAssessmentRequest(input);
  assert.equal(request.systemInstruction, CINEMATOGRAPHER_ASSESSMENT_SYSTEM_INSTRUCTION);
  assert.match(request.systemInstruction, /visual similarity is NOT sufficient/i);
  assert.match(request.systemInstruction, /not the same as spatial traversability/i);
  assert.match(request.systemInstruction, /do not invent invisible geometry/i);
  assert.doesNotMatch(request.systemInstruction, /vanishing_point/);
  assert.doesNotMatch(request.systemInstruction, /exposure\.strength/);
  assert.match(request.prompt, /Journey A-B/);
  assert.match(request.prompt, /night forest/);
  assert.match(request.prompt, /Image 1 is the START canonical set/);
  assert.deepEqual(request.images, [input.start.image, input.end.image]);
  assert.equal(request.payload.startId, "A");
  assert.equal(request.payload.endId, "B");
});

test("structured Cinematographer assessment JSON validates", () => {
  const assessment = parseCinematographerAssessment(`\`\`\`json\n${validAssessmentJson()}\n\`\`\``);
  assert.equal(assessment.shootability, "shootable");
  assert.equal(assessment.camotionSuitability, "appropriate");
  assert.equal(assessment.concerns.length, 0);
  assert.match(assessment.summary, /root gateway/);
});

test("invalid Cinematographer assessment fails instead of inventing shootability", () => {
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
});

test("Cinematographer.assessJourney uses ReasoningProvider and returns the assessment", async () => {
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
          summary: "No credible route into the void.",
          camotionSuitability: "poor_fit",
          concerns: ["Open debris field with no traversable corridor."],
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
  assert.equal(result.assessment.camotionSuitability, "poor_fit");
  assert.equal(result.assessment.concerns[0], "Open debris field with no traversable corridor.");
  assert.equal(result.predictionId, "pred-cm-1");
});
