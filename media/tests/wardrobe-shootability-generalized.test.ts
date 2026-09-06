import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";

import { IMAGE_MODEL } from "../experiments/wardrobe-loop/story.ts";
import {
  EXPECTED_CANONICAL_SHA256,
  INTEGRATION_ROOT,
} from "../experiments/wardrobe-loop/scene-aware-strength.ts";
import {
  EXPERIMENT_ID as PARENT_ID,
  X_CANONICAL_SEED as PARENT_X_SEED,
} from "../experiments/wardrobe-loop/shootability-intermediate.ts";
import {
  EXPERIMENT_ID,
  GENERALIZED_PRINCIPLES,
  PARENT_EXPERIMENT_ID,
  PARENT_X_SEED as FOLLOW_ON_PARENT_SEED,
  REASONING_MODEL,
  STAGE1_SYSTEM,
  STAGE3_SYSTEM,
  X_CANONICAL_SEED,
  assertExperimentContract,
  assertPromptsAreBlind,
  parseFollowOnStage1,
  runGeneralizedRepairExperiment,
  type Diagnosis,
} from "../experiments/wardrobe-loop/shootability-generalized-repair.ts";
import type { MediaProvider } from "../src/types.ts";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const E_PNG = `${INTEGRATION_ROOT}/canonical/E.png`;

const X_PROMPT =
  "First-person cinematic POV on a walkable stone threshold after the cavern door has opened, looking into connected interior volume with remaining cavern geometry at the edges. Strong depth, no people, no text, 16:9.";

function diagnosis(): Diagnosis {
  return {
    camera_position_e: "On a cavern path facing a closed wooden door.",
    camera_orientation_e: "Looking forward toward the door.",
    camera_position_a: "Inside the attic, several feet from the wardrobe.",
    camera_orientation_a: "Looking toward the wardrobe, not back at a cavern door.",
    visible_geometry: "No shared walkable volume is visible between the closed door and the bedroom interior.",
    thresholds: "The cavern door is closed and has no visible depth into the bedroom.",
    occlusion: "The closed door occludes the destination world completely.",
    missing_spatial_volume: "The space immediately beyond the door and the route into A's camera pose are not evidenced.",
    spatial_strategy: "Open a physical threshold volume, then continue into a place from which A's wardrobe-facing pose can be reached without a teleport.",
    physical_route: "Approach and pass the door into an intermediate volume, then continue into the bedroom toward A's viewpoint.",
  };
}

function xSpec() {
  return {
    camera_position: "Just inside the opened cavern door, framed by the stone threshold.",
    threshold_crossed: "The closed wooden door has been opened.",
    remains_ahead: "Interior bedroom volume toward the wardrobe.",
    geometry_from_e: "Stone jamb and residual cavern light at the edges.",
    geometry_from_a: "Wooden floor beginning to appear ahead.",
    foreground: ["door jamb", "stone threshold"],
    route: "Pass the cavern door and continue forward into the bedroom.",
    why_ex_shootable: "E to X is a walk along the cavern path through a now-open threshold.",
    why_xa_shootable: "X to A continues through interior volume toward the wardrobe.",
    image_prompt: X_PROMPT,
  };
}

function mockImage(predictionId: string) {
  return {
    provider: "replicate" as const,
    model: IMAGE_MODEL,
    modelVersion: "version-1",
    predictionId,
    status: "succeeded" as const,
    outputUrl: `https://example.com/${predictionId}.png`,
    metadata: { seed: X_CANONICAL_SEED },
    startedAt: "2026-09-06T15:00:00.000Z",
    completedAt: "2026-09-06T15:01:00.000Z",
    elapsedMs: 60000,
  };
}

test("follow-on contract: distinct experiment, next seed, parent E/A hashes, no Camotion/video path", () => {
  assertExperimentContract();
  assert.equal(EXPERIMENT_ID, "shootability-generalized-repair");
  assert.equal(PARENT_EXPERIMENT_ID, PARENT_ID);
  assert.equal(X_CANONICAL_SEED, 10107);
  assert.equal(FOLLOW_ON_PARENT_SEED, PARENT_X_SEED);
  assert.equal(X_CANONICAL_SEED, PARENT_X_SEED + 1);
  assert.equal(REASONING_MODEL, "google/gemini-3.1-pro");
  assert.equal(EXPECTED_CANONICAL_SHA256.E, "49154292cb2534ab333c2fb1ec6329ca8fa82855b8baca2b7078a4356e9357ff");
  assert.equal(EXPECTED_CANONICAL_SHA256.A, "d71319696162eab7e9c2dbe3c2f7037fd21bcb2aea877a98d8a223ce1e7b6820");
});

test("prompts include generalized traversability principles and remain blind to the withheld house/window hypothesis", () => {
  assert.match(GENERALIZED_PRINCIPLES, /physically traversable camera route/);
  assert.match(GENERALIZED_PRINCIPLES, /destination object is not enough/i);
  assert.match(STAGE1_SYSTEM, /camera orientation/);
  assert.match(STAGE1_SYSTEM, /missing spatial volume/);
  assert.match(STAGE3_SYSTEM, /structural correspondence/);
  assert.match(STAGE3_SYSTEM, /teleportation/);
  assertPromptsAreBlind(`${STAGE1_SYSTEM}\n${STAGE3_SYSTEM}\n${GENERALIZED_PRINCIPLES}`);
  assert.throws(() => assertPromptsAreBlind("approach the house window upstairs"), /withheld/);
});

test("stage 1 parser freezes diagnosis plus X-as-place, and rejects a missing spec", () => {
  const parsed = parseFollowOnStage1(
    JSON.stringify({
      decision: "NEEDS_INTERMEDIATE",
      reasoning: "Closed door is a surface, and A's pose is not the far side of that door.",
      diagnosis: diagnosis(),
      x_spec: xSpec(),
    }),
  );
  assert.equal(parsed.decision, "NEEDS_INTERMEDIATE");
  assert.match(parsed.diagnosis.missing_spatial_volume, /beyond the door/);
  assert.equal(parsed.x_spec?.image_prompt, X_PROMPT);
  const shootable = parseFollowOnStage1(
    JSON.stringify({
      decision: "SHOOTABLE",
      reasoning: "Open connected volume exists.",
      diagnosis: diagnosis(),
      x_spec: null,
    }),
  );
  assert.equal(shootable.x_spec, null);
  assert.throws(() =>
    parseFollowOnStage1(
      JSON.stringify({
        decision: "NEEDS_INTERMEDIATE",
        reasoning: "Needs a place.",
        diagnosis: diagnosis(),
        x_spec: null,
      }),
    ),
  );
});

test("SHOOTABLE Stage 1 stops before X generation", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "tv-gen-shootable-"));
  const events: string[] = [];
  const provider: MediaProvider = {
    async generateImage() {
      events.push("image");
      throw new Error("X must not be generated");
    },
    async generateVideo() {
      events.push("video");
      throw new Error("videos must not be generated");
    },
  };
  const manifest = await runGeneralizedRepairExperiment({
    repoRoot,
    execute: true,
    outputDir,
    imageProvider: provider,
    stage1: async () => {
      events.push("stage1");
      return {
        decision: "SHOOTABLE",
        reasoning: "Independent inspection found a continuous route.",
        diagnosis: diagnosis(),
        x_spec: null,
        model: REASONING_MODEL,
        prediction_id: "s1",
        source: "injected",
        raw_text: null,
      };
    },
  });
  assert.deepEqual(events, ["stage1"]);
  assert.equal(manifest.stop_reason, "direct_declared_shootable");
  assert.equal(manifest.stage2, null);
  assert.equal(manifest.x_generation, null);
  assert.equal(manifest.camotion_run, false);
  assert.equal(manifest.video_generated, false);
});

test("dry-run freezes X spec before any image call", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "tv-gen-dry-"));
  const events: string[] = [];
  const provider: MediaProvider = {
    async generateImage() {
      events.push("image");
      throw new Error("dry-run must not generate X");
    },
    async generateVideo() {
      events.push("video");
      throw new Error("dry-run must not generate video");
    },
  };
  const manifest = await runGeneralizedRepairExperiment({
    repoRoot,
    execute: false,
    outputDir,
    imageProvider: provider,
    stage1: async () => {
      events.push("stage1");
      return {
        decision: "NEEDS_INTERMEDIATE",
        reasoning: "Closed door lacks traversable depth.",
        diagnosis: diagnosis(),
        x_spec: xSpec(),
        model: REASONING_MODEL,
        prediction_id: "s1",
        source: "injected",
        raw_text: JSON.stringify({
          decision: "NEEDS_INTERMEDIATE",
          reasoning: "Closed door lacks traversable depth.",
          diagnosis: diagnosis(),
          x_spec: xSpec(),
        }),
      };
    },
  });
  assert.deepEqual(events, ["stage1"]);
  assert.equal(manifest.stop_reason, "incomplete");
  assert.equal(manifest.stage2?.frozen_before_x_generation, true);
  assert.equal(manifest.stage2?.image_prompt, X_PROMPT);
  assert.equal(manifest.x_generation, null);
});

test("NOT_SHOOTABLE actual-X review stops without video or Camotion", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "tv-gen-leg-"));
  const events: string[] = [];
  const ePng = await readFile(resolve(repoRoot, E_PNG));
  const provider: MediaProvider = {
    async generateImage(request) {
      events.push("image");
      assert.equal(request.seed, X_CANONICAL_SEED);
      assert.equal(request.prompt, X_PROMPT);
      return mockImage("x-pred");
    },
    async generateVideo() {
      events.push("video");
      throw new Error("videos must not run");
    },
  };
  const manifest = await runGeneralizedRepairExperiment({
    repoRoot,
    execute: true,
    outputDir,
    imageProvider: provider,
    stage1: async () => {
      events.push("stage1");
      return {
        decision: "NEEDS_INTERMEDIATE",
        reasoning: "Closed door lacks traversable depth.",
        diagnosis: diagnosis(),
        x_spec: xSpec(),
        model: REASONING_MODEL,
        prediction_id: "s1",
        source: "injected",
        raw_text: JSON.stringify({
          decision: "NEEDS_INTERMEDIATE",
          reasoning: "Closed door lacks traversable depth.",
          diagnosis: diagnosis(),
          x_spec: xSpec(),
        }),
      };
    },
    stage3: async () => {
      events.push("stage3");
      return {
        e_to_x: { decision: "SHOOTABLE", reasoning: "Threshold volume exists." },
        x_to_a: { decision: "NOT_SHOOTABLE", reasoning: "X still requires a teleport into A's pose." },
        model: REASONING_MODEL,
        prediction_id: "s3",
        source: "injected",
        raw_text: null,
      };
    },
    fetchOutput: async () => ePng,
  });
  assert.deepEqual(events, ["stage1", "image", "stage3"]);
  assert.equal(manifest.stop_reason, "leg_not_shootable");
  assert.equal(manifest.camotion_run, false);
  assert.equal(manifest.video_generated, false);
  assert.equal((manifest.x_generation as { seed: number }).seed, 10107);
});

test("both-legs SHOOTABLE also stops before Camotion and video", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "tv-gen-pass-"));
  const events: string[] = [];
  const ePng = await readFile(resolve(repoRoot, E_PNG));
  const provider: MediaProvider = {
    async generateImage(request) {
      events.push("image");
      assert.equal(request.seed, 10107);
      return mockImage("x-ok");
    },
    async generateVideo() {
      events.push("video");
      throw new Error("follow-on must not generate video even if both legs are shootable");
    },
  };
  const manifest = await runGeneralizedRepairExperiment({
    repoRoot,
    execute: true,
    outputDir,
    imageProvider: provider,
    stage1: async () => {
      events.push("stage1");
      return {
        decision: "NEEDS_INTERMEDIATE",
        reasoning: "Needs an intermediate place.",
        diagnosis: diagnosis(),
        x_spec: xSpec(),
        model: REASONING_MODEL,
        prediction_id: "s1",
        source: "injected",
        raw_text: JSON.stringify({
          decision: "NEEDS_INTERMEDIATE",
          reasoning: "Needs an intermediate place.",
          diagnosis: diagnosis(),
          x_spec: xSpec(),
        }),
      };
    },
    stage3: async () => {
      events.push("stage3");
      return {
        e_to_x: { decision: "SHOOTABLE", reasoning: "E to X is a physical threshold crossing." },
        x_to_a: { decision: "SHOOTABLE", reasoning: "X to A continues through interior volume." },
        model: REASONING_MODEL,
        prediction_id: "s3",
        source: "injected",
        raw_text: null,
      };
    },
    fetchOutput: async () => ePng,
  });
  assert.deepEqual(events, ["stage1", "image", "stage3"]);
  assert.equal(manifest.stop_reason, "both_legs_shootable");
  assert.equal(manifest.camotion_run, false);
  assert.equal(manifest.video_generated, false);
});

test("Camotion implementation is not part of this follow-on", async () => {
  const result = await execFileAsync(
    "git",
    ["diff", "--stat", "--", "camotion/src", "camotion/tuning", "media/src/cinematographer"],
    { cwd: repoRoot },
  );
  assert.equal(result.stdout.trim(), "");
});
