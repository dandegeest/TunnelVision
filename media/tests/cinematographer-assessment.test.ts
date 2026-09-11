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
import { TUNNELVISION_LOCOMOTION_BASELINE_TEMPLATE } from "../src/cinematographer/shooting-prompt.ts";
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
    pace: "fast",
    setConsistency: 87,
    traversalConfidence: 74,
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
  assert.doesNotMatch(request.systemInstruction, /"vanishing_point"/);
  assert.doesNotMatch(request.systemInstruction, /exposure\.strength/);
  assert.match(request.systemInstruction, /vanishingPoint/);
  assert.match(request.systemInstruction, /semantic travel target/);
  assert.match(request.systemInstruction, /pupil/);
  assert.match(request.systemInstruction, /Winding road/);
  assert.match(request.systemInstruction, /Do not default to image center/);
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
  assert.match(request.systemInstruction, /Pace is a per-shot macro/);
  assert.match(request.systemInstruction, /pace must be slow-motion, slow, moderate, fast, hyperspeed, or variable/);
  assert.match(request.prompt, /Report travel geometry for each still/);
  assert.match(request.prompt, /Do not predict whether a video model will succeed/);
  assert.match(request.systemInstruction, /setConsistency/);
  assert.match(request.systemInstruction, /traversalConfidence/);
  assert.match(request.systemInstruction, /same continuous physical world and route/);
  assert.match(request.systemInstruction, /physically travel from the supplied start canonical/);
  assert.match(request.systemInstruction, /Do not collapse them into one general quality score/);
  assert.match(request.systemInstruction, /high setConsistency, low traversalConfidence/);
  assert.match(request.systemInstruction, /low setConsistency, possibly higher traversalConfidence/);
  assert.match(request.systemInstruction, /do not invent camotionSuitability/);
  assert.match(request.prompt, /Score setConsistency and traversalConfidence independently/);
  assert.match(request.prompt, /same continuous physical world and route/);
  assert.match(request.prompt, /physically travel from start to end in continuous first-person motion/);
  assert.doesNotMatch(request.systemInstruction, /camotionSuitability must be/);
  assert.ok(request.prompt.includes(TUNNELVISION_LOCOMOTION_BASELINE_TEMPLATE));
  assert.match(request.prompt, /\{pace\} is replaced from your pace field/);
  assert.deepEqual(request.images, [input.start.image, input.end.image]);
  assert.equal(request.payload.startId, "A");
  assert.equal(request.payload.endId, "B");
});

test("structured Cinematographer assessment JSON includes segment choreography", () => {
  const assessment = parseCinematographerAssessment(`\`\`\`json\n${validAssessmentJson()}\n\`\`\``);
  assert.equal(assessment.shootability, "shootable");
  assert.equal(assessment.setConsistency, 87);
  assert.equal(assessment.traversalConfidence, 74);
  assert.equal(assessment.concerns.length, 0);
  assert.match(assessment.camera, /Track forward/);
  assert.match(assessment.transitionStrategy, /visible opening/);
  assert.match(assessment.segmentPromptAddition, /pass between the near structures/);
  assert.equal(assessment.pace, "fast");
  assert.equal(assessment.travel, undefined);
});

test("Cinematographer travel geometry is optional and ignored when malformed", () => {
  const withTravel = parseCinematographerAssessment(
    validAssessmentJson({
      travel: {
        start: {
          vanishingPoint: [0.62, 0.41],
          destinationPoint: [0.64, 0.43],
          destinationBbox: [0.54, 0.33, 0.74, 0.53],
          vector: [0.1, -0.4],
          label: "pupil, not the reflected window",
        },
        end: {
          vanishingPoint: [0.71, 0.36],
          destinationPoint: [0.71, 0.36],
          label: "road vanishing on the right bend",
        },
        direction: "into the pupil, then along the right-hand road bend",
        confidence: "high",
      },
    }),
  );
  assert.deepEqual(withTravel.travel?.start?.vanishingPoint, [0.62, 0.41]);
  assert.equal(withTravel.travel?.start?.label, "pupil, not the reflected window");
  assert.deepEqual(withTravel.travel?.end?.vanishingPoint, [0.71, 0.36]);
  assert.equal(withTravel.travel?.confidence, "high");

  const missingSide = parseCinematographerAssessment(
    validAssessmentJson({
      travel: {
        start: { vanishingPoint: [1.4, 0.2], label: "off frame" },
        end: { destinationPoint: [0.33, 0.48], label: "door threshold" },
        confidence: "maybe",
      },
    }),
  );
  assert.equal(missingSide.travel?.start, undefined);
  assert.deepEqual(missingSide.travel?.end?.destinationPoint, [0.33, 0.48]);
  assert.equal(missingSide.travel?.confidence, "medium");

  const ignored = parseCinematographerAssessment(
    validAssessmentJson({
      travel: { start: { label: "no points" }, confidence: "high" },
    }),
  );
  assert.equal(ignored.travel, undefined);
});

test("Cinematographer pace accepts slow-motion, hyperspeed, and variable", () => {
  assert.equal(parseCinematographerAssessment(validAssessmentJson({ pace: "slow-motion" })).pace, "slow-motion");
  assert.equal(parseCinematographerAssessment(validAssessmentJson({ pace: "hyperspeed" })).pace, "hyperspeed");
  assert.equal(parseCinematographerAssessment(validAssessmentJson({ pace: "variable" })).pace, "variable");
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

test("Cinematographer accepts a high set-consistency and high traversal-confidence pair", () => {
  const assessment = parseCinematographerAssessment(
    validAssessmentJson({
      shootability: "shootable",
      setConsistency: 91,
      traversalConfidence: 88,
    }),
  );
  assert.equal(assessment.setConsistency, 91);
  assert.equal(assessment.traversalConfidence, 88);
  assert.equal(assessment.shootability, "shootable");
});

test("Cinematographer accepts high set consistency with low traversal confidence", () => {
  const assessment = parseCinematographerAssessment(
    validAssessmentJson({
      shootability: "needs_review",
      setConsistency: 86,
      traversalConfidence: 22,
      summary: "Same corridor world, but the opening is blocked and the heading conflicts.",
    }),
  );
  assert.equal(assessment.setConsistency, 86);
  assert.equal(assessment.traversalConfidence, 22);
  assert.equal(assessment.shootability, "needs_review");
});

test("Cinematographer accepts low set consistency with traversable-looking geometry", () => {
  const assessment = parseCinematographerAssessment(
    validAssessmentJson({
      shootability: "not_shootable",
      setConsistency: 18,
      traversalConfidence: 71,
      summary: "A forward corridor is visible, but the end still is a different world.",
    }),
  );
  assert.equal(assessment.setConsistency, 18);
  assert.equal(assessment.traversalConfidence, 71);
  assert.equal(assessment.shootability, "not_shootable");
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
        validAssessmentJson({ setConsistency: 101, concerns: [] }),
      ),
    /setConsistency/,
  );
  assert.throws(
    () =>
      parseCinematographerAssessment(
        validAssessmentJson({ traversalConfidence: -1, concerns: [] }),
      ),
    /traversalConfidence/,
  );
  assert.throws(
    () =>
      parseCinematographerAssessment(
        validAssessmentJson({ setConsistency: 87.5, concerns: [] }),
      ),
    /setConsistency/,
  );
  assert.throws(
    () =>
      parseCinematographerAssessment(
        validAssessmentJson({ traversalConfidence: "74", concerns: [] }),
      ),
    /traversalConfidence/,
  );
  assert.throws(
    () =>
      parseCinematographerAssessment(
        validAssessmentJson({ setConsistency: undefined, concerns: [] }),
      ),
    /setConsistency/,
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
        validAssessmentJson({ pace: "walking" }),
      ),
    /pace/,
  );
  assert.throws(
    () =>
      parseCinematographerAssessment(
        validAssessmentJson({ pace: undefined }),
      ),
    /pace/,
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
          setConsistency: 24,
          traversalConfidence: 17,
          summary: "No credible corridor is visible, but keep traveling toward the distant light.",
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
  assert.equal(result.assessment.pace, "fast");
  assert.ok(result.assessment.segmentPromptAddition.length > 0);
  assert.equal(result.predictionId, "pred-cm-1");
});
