import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canonicalImageResolution,
  routerAspectRatio,
  routerConfigId,
  routerGoalForIntent,
  routerImageInput,
  routerVideoInput,
} from "../src/runway/router.ts";

test("fast uses the latency router and other intents use quality", () => {
  assert.equal(routerGoalForIntent("fast"), "latency");
  assert.equal(routerGoalForIntent("balanced"), "quality");
  assert.equal(routerGoalForIntent("quality"), "quality");
  assert.equal(routerGoalForIntent(undefined), "quality");
});

test("router config ids default to the hackathon slugs", () => {
  const previousDraft = process.env.RUNWAY_ROUTER_DRAFT;
  const previousFinal = process.env.RUNWAY_ROUTER_FINAL;
  delete process.env.RUNWAY_ROUTER_DRAFT;
  delete process.env.RUNWAY_ROUTER_FINAL;
  try {
    assert.equal(routerConfigId("latency"), "tv-draft");
    assert.equal(routerConfigId("quality"), "tv-final");
  } finally {
    if (previousDraft === undefined) delete process.env.RUNWAY_ROUTER_DRAFT;
    else process.env.RUNWAY_ROUTER_DRAFT = previousDraft;
    if (previousFinal === undefined) delete process.env.RUNWAY_ROUTER_FINAL;
    else process.env.RUNWAY_ROUTER_FINAL = previousFinal;
  }
});

test("traversal input sends the start and end frames to the router", () => {
  const input = routerVideoInput({
    prompt: "Walk forward.",
    firstUri: "runway://first",
    lastUri: "runway://last",
    durationSeconds: 5.4,
    goal: "quality",
  });
  assert.equal(input.aspectRatio, "16:9");
  assert.equal(input.duration, 5);
  assert.equal(input.resolution, "1080p");
  assert.deepEqual(input.referenceImages, [
    { uri: "runway://first", role: "first" },
    { uri: "runway://last", role: "last" },
  ]);
});

test("canonical input keeps a reference still and a 16:9 frame", () => {
  const input = routerImageInput({
    prompt: "The next doorway.",
    aspect: { width: 1920, height: 1080 },
    referenceUris: ["runway://source"],
    goal: "quality",
  });
  assert.equal(input.aspectRatio, "16:9");
  assert.equal(input.resolution, "2k");
  assert.equal(input.model, undefined);
  assert.deepEqual(input.referenceImages, [{ uri: "runway://source" }]);
  assert.equal(routerAspectRatio({ width: 1080, height: 1920 }), "9:16");
});

test("fast canonicals use the draft router at 1k and quality uses the final router at 2k", () => {
  const previousDraft = process.env.RUNWAY_ROUTER_DRAFT;
  const previousFinal = process.env.RUNWAY_ROUTER_FINAL;
  delete process.env.RUNWAY_ROUTER_DRAFT;
  delete process.env.RUNWAY_ROUTER_FINAL;
  try {
  assert.equal(routerGoalForIntent("fast"), "latency");
  assert.equal(routerConfigId("latency"), "tv-draft");
  assert.equal(canonicalImageResolution("latency"), "1k");
  const fast = routerImageInput({ prompt: "The opening viewpoint.", goal: "latency" });
  assert.equal(fast.resolution, "1k");
  assert.equal(fast.aspectRatio, "16:9");
  assert.equal(fast.model, undefined);
  assert.equal(routerGoalForIntent("quality"), "quality");
  assert.equal(routerGoalForIntent("balanced"), "quality");
  assert.equal(routerConfigId("quality"), "tv-final");
  assert.equal(canonicalImageResolution("quality"), "2k");
  const quality = routerImageInput({ prompt: "The opening viewpoint.", goal: "quality" });
  assert.equal(quality.resolution, "2k");
  assert.equal(quality.model, undefined);
  } finally {
    if (previousDraft === undefined) delete process.env.RUNWAY_ROUTER_DRAFT;
    else process.env.RUNWAY_ROUTER_DRAFT = previousDraft;
    if (previousFinal === undefined) delete process.env.RUNWAY_ROUTER_FINAL;
    else process.env.RUNWAY_ROUTER_FINAL = previousFinal;
  }
});
