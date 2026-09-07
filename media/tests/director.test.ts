import assert from "node:assert/strict";
import { test } from "node:test";

import { MediaGenerationError } from "../src/errors.ts";
import {
  buildDirectorRequest,
  parseDirectorPlan,
  plan,
  subsequentDirectorBeats,
  type DirectorPlanInput,
} from "../src/director/plan-storyboard.ts";
import { DIRECTOR_SYSTEM_INSTRUCTION } from "../src/director/prompts.ts";
import type { ReasoningProvider, ReasoningRequest, ReasoningResult } from "../src/reasoning/types.ts";

const input: DirectorPlanInput = {
  story: "Make a first-person POV journey through an impossible world at night.",
  startFrame: {
    id: "A",
    intent: "Inside the attic bedroom. Approach the open wardrobe.",
    image: { kind: "file", path: "/tmp/start.jpg" },
  },
  agency: "directed",
};

function validPlanJson(beats = [
  { id: "B", intent: "Enter the wardrobe.", visualDescription: "Dark coats, snow ahead." },
  { id: "C", intent: "Step into the winter forest.", visualDescription: "Snowy trees through the opening." },
]) {
  return JSON.stringify({
    summary: "Leave the attic through the wardrobe and keep moving.",
    beats,
  });
}

test("Director request includes story, starting frame, agency, and spatial principles", () => {
  const request = buildDirectorRequest(input);
  assert.match(request.prompt, /impossible world at night/);
  assert.match(request.prompt, /Authoritative starting frame id: A/);
  assert.match(request.prompt, /Agency: directed/);
  assert.equal(request.systemInstruction, DIRECTOR_SYSTEM_INSTRUCTION);
  assert.match(request.systemInstruction, /traversable/);
  assert.match(request.systemInstruction, /forward locomotion/);
  assert.doesNotMatch(request.systemInstruction, /vanishing_point/);
  assert.doesNotMatch(request.systemInstruction, /CameraMotionPlan/);
  assert.doesNotMatch(request.prompt, /EXACTLY/);
  assert.deepEqual(request.images, [input.startFrame.image]);
  assert.equal(request.payload.startFrameId, "A");
  assert.equal(request.payload.story, input.story);
  assert.equal(request.payload.startFrameIntent, input.startFrame.intent);
  assert.match(request.prompt, /Opening-beat intent already on the storyboard/);
  assert.match(request.prompt, /attic bedroom/);
});

test("Director request omits opening-beat intent when the starting frame has none", () => {
  const request = buildDirectorRequest({
    story: "Travel forward through a quiet abandoned greenhouse at night.",
    startFrame: {
      id: "A",
      image: { kind: "file", path: "/tmp/start.jpg" },
    },
    agency: "directed",
  });
  assert.equal("startFrameIntent" in request.payload, false);
  assert.doesNotMatch(request.prompt, /Opening-beat intent/);
  assert.doesNotMatch(request.prompt, /The opening beat is the supplied starting image/);
  assert.doesNotMatch(request.prompt, /attic bedroom/i);
  assert.doesNotMatch(request.prompt, /wardrobe/i);
  assert.match(request.prompt, /abandoned greenhouse/);
  assert.match(request.prompt, /Authoritative starting frame id: A/);
});

test("Director request rejects an empty story", () => {
  assert.throws(
    () => buildDirectorRequest({ ...input, story: "   " }),
    (error: unknown) => {
      assert(error instanceof MediaGenerationError);
      assert.equal(error.code, "invalid_input");
      return true;
    },
  );
});

test("structured Director JSON validates into a plan", () => {
  const planResult = parseDirectorPlan(`\`\`\`json\n${validPlanJson()}\n\`\`\``);
  assert.equal(planResult.summary, "Leave the attic through the wardrobe and keep moving.");
  assert.equal(planResult.beats.length, 2);
  assert.equal(planResult.beats[0]?.id, "B");
  assert.equal(planResult.beats[0]?.intent, "Enter the wardrobe.");
});

test("invalid Director output fails instead of inventing beats", () => {
  assert.throws(() => parseDirectorPlan("not json"), MediaGenerationError);
  assert.throws(() => parseDirectorPlan("{}"), /beats\[\]/);
  assert.throws(() => parseDirectorPlan(JSON.stringify({ beats: [] })), /no planned beats/);
  assert.throws(
    () => parseDirectorPlan(JSON.stringify({ beats: [{ id: "B", intent: "Go." }] })),
    /visualDescription/,
  );
});

test("starting frame is not treated as a subsequent Director beat", () => {
  const parsed = parseDirectorPlan(
    validPlanJson([
      { id: "A", intent: "Stay in the attic.", visualDescription: "The supplied bedroom." },
      { id: "B", intent: "Enter the wardrobe.", visualDescription: "Dark coats, snow ahead." },
    ]),
  );
  const subsequent = subsequentDirectorBeats(parsed, "A");
  assert.deepEqual(
    subsequent.map((beat) => beat.id),
    ["B"],
  );
});

test("Director.plan uses ReasoningProvider and returns validated beats plus evidence", async () => {
  let captured: ReasoningRequest | undefined;
  const reasoning: ReasoningProvider = {
    async complete(request) {
      captured = request;
      const result: ReasoningResult = {
        provider: "replicate",
        model: "mock/director",
        modelVersion: "test",
        predictionId: "pred-1",
        status: "succeeded",
        text: validPlanJson(),
        metadata: {},
        startedAt: "2026-09-06T00:00:00.000Z",
        completedAt: "2026-09-06T00:00:01.000Z",
        elapsedMs: 1000,
      };
      return result;
    },
  };

  const result = await plan({ reasoning, ...input });
  assert.equal(captured?.prompt, buildDirectorRequest(input).prompt);
  assert.equal(result.plan.beats[0]?.id, "B");
  assert.equal(result.rawText, validPlanJson());
  assert.equal(result.model, "mock/director");
  assert.equal(result.predictionId, "pred-1");
  assert.equal(result.request.startFrameId, "A");
});

test("Director.plan fails visibly when the model returns only the starting frame", async () => {
  const reasoning: ReasoningProvider = {
    async complete() {
      return {
        provider: "replicate",
        model: "mock/director",
        modelVersion: null,
        predictionId: "pred-2",
        status: "succeeded",
        text: validPlanJson([
          { id: "A", intent: "The attic.", visualDescription: "Opening still." },
        ]),
        metadata: {},
        startedAt: "2026-09-06T00:00:00.000Z",
        completedAt: "2026-09-06T00:00:01.000Z",
        elapsedMs: 10,
      };
    },
  };
  await assert.rejects(() => plan({ reasoning, ...input }), /no subsequent beats/);
});