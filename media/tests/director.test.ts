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
  assert.match(request.systemInstruction, /partially specified/);
  assert.match(request.systemInstruction, /supplied destination/);
  assert.match(request.systemInstruction, /fewest destinations necessary/);
  assert.match(request.systemInstruction, /meaningfully new place, world state, or story moment/);
  assert.match(request.systemInstruction, /approaching and then crossing the same threshold/);
  assert.match(request.systemInstruction, /one continuous shot/);
  assert.match(request.systemInstruction, /Simple journeys may require only 2–4 subsequent destinations/);
  assert.match(request.systemInstruction, /Use more when the filmmaker's story genuinely requires them/);
  assert.doesNotMatch(request.systemInstruction, /typically 4 to 8/);
  assert.doesNotMatch(request.systemInstruction, /must (?:return|use|contain) \d+/i);
  assert.doesNotMatch(request.systemInstruction, /(?:minimum|maximum) of \d+/i);
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
    () => parseDirectorPlan(JSON.stringify({ beats: [{ id: "B", intent: "Go.", visualDescription: "There." }] })),
    /summary/,
  );
  assert.throws(
    () =>
      parseDirectorPlan(
        JSON.stringify({
          summary: "A journey.",
          beats: [{ id: "B", intent: "Go." }],
        }),
      ),
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
  let completeCalls = 0;
  const reasoning: ReasoningProvider = {
    async complete(request) {
      completeCalls += 1;
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
  assert.equal(completeCalls, 1);
  assert.equal(captured?.prompt, buildDirectorRequest(input).prompt);
  assert.equal(result.plan.summary, "Leave the attic through the wardrobe and keep moving.");
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

test("Director request lists existing destinations and attaches their stills", () => {
  const crystal = { kind: "file" as const, path: "/tmp/crystal.jpg" };
  const voidStill = { kind: "file" as const, path: "/tmp/void.jpg" };
  const request = buildDirectorRequest({
    ...input,
    story: "Travel forward through this night forest and keep going.",
    anchors: [
      {
        id: "A",
        label: "A",
        intent: "Night forest path.",
        image: input.startFrame.image,
      },
      {
        id: "D",
        label: "D",
        intent: "Crystal occupying the path.",
        visualDescription: "A glowing crystal cluster.",
        image: crystal,
      },
      {
        id: "F",
        label: "F",
        intent: "Open void around a central light.",
        image: voidStill,
      },
    ],
  });
  assert.match(request.prompt, /Existing destinations in travel order/);
  assert.match(request.prompt, /Image 2 is this destination/);
  assert.match(request.prompt, /Image 3 is this destination/);
  assert.match(request.prompt, /Crystal occupying the path/);
  assert.match(request.prompt, /You own the missing connective journey/);
  assert.match(request.prompt, /Include each existing non-opening destination/);
  assert.doesNotMatch(request.prompt, /Plan the subsequent spatially traversable beats from this opening/);
  assert.deepEqual(request.images, [input.startFrame.image, crystal, voidStill]);
  assert.deepEqual(
    request.payload.anchors?.map((anchor) => anchor.id),
    ["A", "D", "F"],
  );
});

test("Director.plan with existing destinations still drops the opening beat", async () => {
  const reasoning: ReasoningProvider = {
    async complete(request) {
      assert.match(request.prompt, /Existing destinations in travel order/);
      assert.equal(request.images?.length, 3);
      return {
        provider: "replicate",
        model: "mock/director",
        modelVersion: "test",
        predictionId: "pred-partial",
        status: "succeeded",
        text: validPlanJson([
          { id: "B", intent: "Approach the mouth.", visualDescription: "Root opening." },
          { id: "C", intent: "Enter the tunnel.", visualDescription: "Wooden tube." },
          { id: "D", intent: "Pass the crystal.", visualDescription: "Glowing cluster." },
          { id: "E", intent: "Continue to the portal.", visualDescription: "Dark hall." },
          { id: "F", intent: "Reach the void.", visualDescription: "Debris field." },
        ]),
        metadata: {},
        startedAt: "2026-09-06T00:00:00.000Z",
        completedAt: "2026-09-06T00:00:01.000Z",
        elapsedMs: 20,
      };
    },
  };
  const result = await plan({
    reasoning,
    ...input,
    story: "Travel forward through this night forest and keep going.",
    anchors: [
      { id: "A", label: "A", image: input.startFrame.image },
      { id: "D", label: "D", intent: "Crystal occupying the path.", image: { kind: "file", path: "/tmp/d.jpg" } },
      { id: "F", label: "F", image: { kind: "file", path: "/tmp/f.jpg" } },
    ],
  });
  assert.deepEqual(
    result.plan.beats.map((beat) => beat.id),
    ["B", "C", "D", "E", "F"],
  );
});
