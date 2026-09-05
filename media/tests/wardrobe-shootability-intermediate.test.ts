import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";

import { MediaGenerationError } from "../src/errors.ts";
import { BASELINE_EXPOSURE } from "../src/cinematographer/plan-shot.ts";
import { toSeedance25Input } from "../src/replicate/seedance-2.5.ts";
import type { MediaProvider } from "../src/types.ts";
import { IMAGE_MODEL } from "../experiments/wardrobe-loop/story.ts";
import {
  ADAPTIVE_STRENGTHS,
  EXPECTED_CANONICAL_SHA256,
  INTEGRATION_ROOT,
  isAllowedStrength,
  seedanceSettingsForSeed,
} from "../experiments/wardrobe-loop/scene-aware-strength.ts";
import {
  CANONICAL_PATHS,
  DIRECT_SEED,
  EX_SEED,
  EXPERIMENT_ID,
  VIDEO_DURATION_SECONDS,
  VIDEO_GENERATIONS,
  VIDEO_MODEL,
  XA_SEED,
  X_CANONICAL_SEED,
  assertCanGenerateVideos,
  assertCanGenerateX,
  assertExperimentContract,
  parseLegReview,
  parseShootabilityDecision,
  parseShotCinematography,
  parseXSpecification,
  runShootabilityExperiment,
  type ShotCinematography,
  type Stage1Record,
  type Stage2Record,
} from "../experiments/wardrobe-loop/shootability-intermediate.ts";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const E_PNG = `${INTEGRATION_ROOT}/canonical/E.png`;
const A_PNG = `${INTEGRATION_ROOT}/canonical/A.png`;
const EA_START = `${INTEGRATION_ROOT}/shooting/E-A/start.png`;
const EA_END = `${INTEGRATION_ROOT}/shooting/E-A/end.png`;

const X_PROMPT =
  "First-person cinematic POV just inside the cavern bedroom door after it has been opened, looking through the stone threshold into the attic bedroom beyond. Wet cavern stone and bioluminescent mushrooms remain visible at the edges of the doorframe. Ahead, wooden floorboards, the rug, and the distant wardrobe begin to appear. Strong depth, no people, no text, 16:9.";

function mockVideo(predictionId: string, seed: number) {
  return {
    provider: "replicate" as const,
    model: VIDEO_MODEL,
    modelVersion: "version-1",
    predictionId,
    status: "succeeded" as const,
    outputUrl: `https://example.com/${predictionId}.mp4`,
    metadata: { seed },
    startedAt: "2026-09-05T22:00:00.000Z",
    completedAt: "2026-09-05T22:03:00.000Z",
    elapsedMs: 180000,
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
    startedAt: "2026-09-05T22:00:00.000Z",
    completedAt: "2026-09-05T22:01:00.000Z",
    elapsedMs: 60000,
  };
}

function stage1Needs(): Pick<
  Stage1Record,
  "decision" | "reasoning" | "model" | "prediction_id" | "source" | "raw_text"
> {
  return {
    decision: "NEEDS_INTERMEDIATE",
    reasoning: "The cavern door is a closed opaque surface with no visible bedroom volume behind it.",
    model: "google/gemini-3.1-pro",
    prediction_id: "stage1-pred",
    source: "injected",
    raw_text: null,
  };
}

function stage2Spec(): Omit<Stage2Record, "frozen_before_x_generation" | "frozen_at"> {
  return {
    camera_position: "Just inside the opened cavern door, still framed by the stone threshold.",
    threshold_crossed: "The closed wooden door has been opened and the camera has stepped through the jamb.",
    remains_ahead: "The attic bedroom volume and the wardrobe remain ahead.",
    geometry_from_e: "Stone jamb, cavern path behind, residual bioluminescence at the edges.",
    geometry_from_a: "Wooden floorboards, rug, and distant wardrobe beginning to appear.",
    foreground: ["door jamb", "stone threshold", "hanging roots at the sides"],
    route: "Open and pass the cavern door, then continue forward into the bedroom toward the wardrobe.",
    why_ex_shootable: "E to X is a walk along the cavern path through a now-open threshold.",
    why_xa_shootable: "X to A is a walk through already-interior bedroom volume toward the wardrobe.",
    image_prompt: X_PROMPT,
    model: "google/gemini-3.1-pro",
    prediction_id: "stage2-pred",
    source: "injected",
    raw_text: null,
  };
}

function stage3Review(eToX: "SHOOTABLE" | "NOT_SHOOTABLE", xToA: "SHOOTABLE" | "NOT_SHOOTABLE") {
  return {
    e_to_x: { decision: eToX, reasoning: `E to X is ${eToX} from the actual X still.` },
    x_to_a: { decision: xToA, reasoning: `X to A is ${xToA} from the actual X still.` },
    model: "google/gemini-3.1-pro",
    prediction_id: "stage3-pred",
    source: "injected" as const,
    raw_text: null,
  };
}

function cineJson(shot: "E-A" | "E-X" | "X-A", startStrength: number, endStrength: number): string {
  const label = (strength: number) => (strength === 0.02 ? "LIGHT" : strength === 0.04 ? "MEDIUM" : "STRONG");
  return JSON.stringify({
    route: `${shot} forward route through connected space`,
    prompt: `First-person camera travels continuously forward for shot ${shot} through connected three-dimensional space. Nearby objects pass with parallax. Do not dissolve.`,
    start: {
      destination: { point: [0.5, 0.5], protect: true, bbox: [0.45, 0.33, 0.55, 0.69] },
      camera: { vanishing_point: [0.5, 0.5], forward: 1 },
      exposure: {
        label: label(startStrength),
        strength: startStrength,
        reasoning: `${shot} start inspected from the actual still.`,
        samples: 16,
      },
    },
    end: {
      destination: { point: [0.51, 0.47], protect: true, bbox: [0.49, 0.16, 0.54, 0.78] },
      camera: { vanishing_point: [0.51, 0.47], forward: 1 },
      exposure: {
        label: label(endStrength),
        strength: endStrength,
        reasoning: `${shot} end inspected from the actual still.`,
        samples: 16,
      },
    },
  });
}

function stage4Shots(): Record<"E-A" | "E-X" | "X-A", ShotCinematography> {
  return {
    "E-A": parseShotCinematography(cineJson("E-A", 0.02, 0.02), "E-A", "E", "A"),
    "E-X": parseShotCinematography(cineJson("E-X", 0.02, 0.04), "E-X", "E", "X"),
    "X-A": parseShotCinematography(cineJson("X-A", 0.04, 0.02), "X-A", "X", "A"),
  };
}

async function prepareIt01Endpoints() {
  return {
    startImage: EA_START,
    endImage: EA_END,
  };
}

test("experiment contract: three videos, seeds 90/90/91, E/A/X only, frozen Phase 1 strengths", () => {
  assertExperimentContract();
  assert.equal(EXPERIMENT_ID, "shootability-intermediate-volume");
  assert.equal(VIDEO_GENERATIONS.length, 3);
  assert.deepEqual(
    VIDEO_GENERATIONS.map((generation) => generation.filename),
    ["01-E-A-direct.mp4", "02-E-X.mp4", "03-X-A.mp4"],
  );
  assert.deepEqual(
    VIDEO_GENERATIONS.map((generation) => generation.shot),
    ["E-A", "E-X", "X-A"],
  );
  assert.deepEqual(
    VIDEO_GENERATIONS.map((generation) => generation.seed),
    [90, 90, 91],
  );
  assert.equal(DIRECT_SEED, 90);
  assert.equal(EX_SEED, 90);
  assert.equal(XA_SEED, 91);
  assert.equal(X_CANONICAL_SEED, 10106);
  assert.equal(VIDEO_DURATION_SECONDS, 6);
  assert.equal(VIDEO_MODEL, "bytedance/seedance-2.5");
  assert.deepEqual(ADAPTIVE_STRENGTHS, [0.02, 0.04, 0.08]);
  assert.equal(CANONICAL_PATHS.E, `${INTEGRATION_ROOT}/canonical/E.png`);
  assert.equal(CANONICAL_PATHS.A, `${INTEGRATION_ROOT}/canonical/A.png`);
  assert.equal(EXPECTED_CANONICAL_SHA256.E, "49154292cb2534ab333c2fb1ec6329ca8fa82855b8baca2b7078a4356e9357ff");
  assert.equal(EXPECTED_CANONICAL_SHA256.A, "d71319696162eab7e9c2dbe3c2f7037fd21bcb2aea877a98d8a223ce1e7b6820");
  for (const generation of VIDEO_GENERATIONS) {
    assert.equal(["B", "C", "D"].some((id) => generation.shot.includes(id)), false);
  }
});

test("production cinematographer still pins 0.08; experiment parser uses {.02,.04,.08}", () => {
  assert.equal(BASELINE_EXPOSURE.strength, 0.08);
  assert.equal(BASELINE_EXPOSURE.samples, 16);
  const parsed = parseShotCinematography(cineJson("E-X", 0.02, 0.08), "E-X", "E", "X");
  assert.equal(parsed.start_strength, 0.02);
  assert.equal(parsed.end_strength, 0.08);
  assert.equal(isAllowedStrength(parsed.start_strength), true);
  assert.throws(() => parseShotCinematography(cineJson("E-X", 0.06, 0.08), "E-X", "E", "X"), /0\.02, 0\.04, 0\.08|no valid LIGHT/);
  assert.throws(
    () =>
      assertCanGenerateX({
        decision: "SHOOTABLE",
      } as Stage1Record),
    /NEEDS_INTERMEDIATE/,
  );
  assert.throws(
    () =>
      assertCanGenerateVideos({
        e_to_x: { decision: "SHOOTABLE", reasoning: "ok" },
        x_to_a: { decision: "NOT_SHOOTABLE", reasoning: "no" },
      } as never),
    /both legs SHOOTABLE/,
  );
});

test("Seedance mapping keeps 720p silent adaptive mp4 and seeds 90/91", () => {
  for (const seed of [90, 91]) {
    const settings = seedanceSettingsForSeed(seed);
    const input = toSeedance25Input(
      {
        startImage: { kind: "url", url: "https://example.com/a.png" },
        endImage: { kind: "url", url: "https://example.com/b.png" },
        prompt: "forward travel",
        durationSeconds: 6,
      },
      { kind: "url", url: "https://example.com/a.png" },
      { kind: "url", url: "https://example.com/b.png" },
      settings,
    );
    assert.equal(input.seed, seed);
    assert.equal(input.aspect_ratio, "adaptive");
    assert.equal(input.resolution, "720p");
    assert.equal(input.generate_audio, false);
    assert.equal(input.watermark, false);
    assert.equal(input.output_format, "mp4");
    assert.equal(input.duration, 6);
  }
});

test("parsers freeze image-grounded shootability and X-as-place, not a blend recipe", () => {
  const shootable = parseShootabilityDecision(
    JSON.stringify({ decision: "SHOOTABLE", reasoning: "Open volume connects both rooms." }),
  );
  assert.equal(shootable.decision, "SHOOTABLE");
  const needs = parseShootabilityDecision(
    JSON.stringify({ decision: "NEEDS_INTERMEDIATE", reasoning: "Closed door is a surface." }),
  );
  assert.equal(needs.decision, "NEEDS_INTERMEDIATE");
  assert.throws(() => parseShootabilityDecision(JSON.stringify({ decision: "MAYBE", reasoning: "nope" })));
  const spec = parseXSpecification(
    JSON.stringify({
      camera_position: "inside the doorframe",
      threshold_crossed: "the closed door",
      remains_ahead: "the bedroom",
      geometry_from_e: "stone jamb",
      geometry_from_a: "wardrobe ahead",
      foreground: ["jamb"],
      route: "through the door",
      why_ex_shootable: "path then threshold",
      why_xa_shootable: "interior volume",
      image_prompt: X_PROMPT,
    }),
  );
  assert.match(spec.camera_position, /doorframe/);
  assert.equal(spec.image_prompt, X_PROMPT);
  const review = parseLegReview(
    JSON.stringify({
      "E-X": { decision: "SHOOTABLE", reasoning: "threshold volume exists" },
      "X-A": { decision: "NOT_SHOOTABLE", reasoning: "X is a morph" },
    }),
  );
  assert.equal(review.e_to_x.decision, "SHOOTABLE");
  assert.equal(review.x_to_a.decision, "NOT_SHOOTABLE");
});

test("SHOOTABLE Stage 1 stops before X or video generation", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "tv-shoot-shootable-"));
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
  const manifest = await runShootabilityExperiment({
    repoRoot,
    execute: true,
    outputDir,
    imageProvider: provider,
    provider,
    stage1: async () => {
      events.push("stage1");
      return {
        decision: "SHOOTABLE",
        reasoning: "Independent inspection found a continuous route.",
        model: "google/gemini-3.1-pro",
        prediction_id: "s1",
        source: "injected",
        raw_text: null,
      };
    },
    stage2: async () => {
      events.push("stage2");
      return stage2Spec();
    },
  });
  assert.deepEqual(events, ["stage1"]);
  assert.equal(manifest.stop_reason, "direct_declared_shootable");
  assert.equal(manifest.stage2, null);
  assert.equal(manifest.x_generation, null);
  assert.ok(manifest.generations.every((generation) => generation.status === "not_attempted"));
  const frozen = JSON.parse(await readFile(join(outputDir, "stage1-shootability.json"), "utf8"));
  assert.equal(frozen.frozen_before_generation, true);
  assert.equal(frozen.decision, "SHOOTABLE");
  assert.equal(frozen.image_e.sha256, EXPECTED_CANONICAL_SHA256.E);
  assert.equal(frozen.image_a.sha256, EXPECTED_CANONICAL_SHA256.A);
});

test("NEEDS_INTERMEDIATE freezes X spec before any image call, and dry-run does not generate X", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "tv-shoot-dry-"));
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
  const manifest = await runShootabilityExperiment({
    repoRoot,
    execute: false,
    outputDir,
    imageProvider: provider,
    provider,
    stage1: async () => {
      events.push("stage1");
      return stage1Needs();
    },
    stage2: async () => {
      events.push("stage2");
      return stage2Spec();
    },
  });
  assert.deepEqual(events, ["stage1", "stage2"]);
  assert.equal(manifest.stop_reason, "incomplete");
  assert.equal(manifest.stage2?.frozen_before_x_generation, true);
  assert.equal(manifest.x_generation, null);
  const spec = JSON.parse(await readFile(join(outputDir, "stage2-x-spec.json"), "utf8"));
  assert.equal(spec.image_prompt, X_PROMPT);
});

test("NOT_SHOOTABLE actual-X review stops before video generation", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "tv-shoot-leg-"));
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
      throw new Error("videos must not run if a leg is NOT_SHOOTABLE");
    },
  };
  const manifest = await runShootabilityExperiment({
    repoRoot,
    execute: true,
    outputDir,
    imageProvider: provider,
    provider,
    stage1: async () => {
      events.push("stage1");
      return stage1Needs();
    },
    stage2: async () => {
      events.push("stage2");
      return stage2Spec();
    },
    stage3: async () => {
      events.push("stage3");
      return stage3Review("SHOOTABLE", "NOT_SHOOTABLE");
    },
    fetchOutput: async () => ePng,
  });
  assert.deepEqual(events, ["stage1", "stage2", "image", "stage3"]);
  assert.equal(manifest.stop_reason, "leg_not_shootable");
  assert.equal(manifest.stage3?.x_to_a.decision, "NOT_SHOOTABLE");
  assert.ok(manifest.generations.every((generation) => generation.status === "not_attempted"));
});

test("full path freezes plans before three Seedance calls with seeds 90/90/91 and one identical X retry", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "tv-shoot-full-"));
  const events: string[] = [];
  const seeds: number[] = [];
  const imagePrompts: string[] = [];
  const ePng = await readFile(resolve(repoRoot, E_PNG));
  const aPng = await readFile(resolve(repoRoot, A_PNG));
  assert.notEqual(ePng.equals(aPng), true);
  const imageProvider: MediaProvider = {
    async generateImage(request) {
      imagePrompts.push(request.prompt);
      events.push("image");
      if (imagePrompts.length === 1) {
        throw new MediaGenerationError("generation_failed", "flux failed once", {
          predictionId: "x-fail",
        });
      }
      return mockImage("x-ok");
    },
    async generateVideo() {
      throw new Error("imageProvider must not generate video");
    },
  };
  const manifest = await runShootabilityExperiment({
    repoRoot,
    execute: true,
    outputDir,
    imageProvider,
    createVideoProvider: (seed) => {
      seeds.push(seed);
      return {
        async generateImage() {
          throw new Error("unused");
        },
        async generateVideo(request) {
          const stage4 = JSON.parse(await readFile(join(outputDir, "stage4-cinematography.json"), "utf8"));
          assert.equal(stage4.frozen_before_video, true);
          const cine = stage4.shots[VIDEO_GENERATIONS[seeds.length - 1].shot];
          assert.equal(request.prompt, cine.prompt);
          events.push(`video:${VIDEO_GENERATIONS[seeds.length - 1].id}`);
          return mockVideo(`vid_${VIDEO_GENERATIONS[seeds.length - 1].id}`, seed);
        },
      };
    },
    stage1: async () => {
      events.push("stage1");
      return stage1Needs();
    },
    stage2: async () => {
      events.push("stage2");
      return stage2Spec();
    },
    stage3: async () => {
      events.push("stage3");
      return stage3Review("SHOOTABLE", "SHOOTABLE");
    },
    stage4: async () => {
      events.push("stage4");
      return stage4Shots();
    },
    prepareEndpoints: prepareIt01Endpoints,
    fetchOutput: async (url) => (url.endsWith(".png") ? ePng : Buffer.from("fake-mp4")),
  });

  assert.deepEqual(events, ["stage1", "stage2", "image", "image", "stage3", "stage4", "video:01-E-A-direct", "video:02-E-X", "video:03-X-A"]);
  assert.equal(imagePrompts[0], imagePrompts[1]);
  assert.equal(imagePrompts[0], X_PROMPT);
  assert.equal((manifest.x_generation as { retry_count: number }).retry_count, 1);
  assert.deepEqual(seeds, [90, 90, 91]);
  assert.equal(manifest.stop_reason, "none");
  assert.equal(manifest.generations.length, 3);
  assert.ok(manifest.generations.every((generation) => generation.status === "succeeded"));
  assert.equal(manifest.generations[0].start_strength, 0.02);
  assert.equal(manifest.generations[1].end_strength, 0.04);
  assert.equal(manifest.generations[2].seed_submitted, 91);
  for (const generation of manifest.generations) {
    assert.equal(generation.settings.aspect_ratio, "adaptive");
    assert.equal(generation.settings.resolution, "720p");
    assert.equal(generation.settings.generate_audio, false);
    assert.equal(generation.settings.watermark, false);
    assert.equal(generation.settings.output_format, "mp4");
    assert.equal(generation.settings.duration, 6);
    assert.equal(generation.start_image.path, EA_START);
    assert.equal(generation.end_image.path, EA_END);
    assert.equal(isAllowedStrength(generation.start_strength), true);
    assert.equal(isAllowedStrength(generation.end_strength), true);
  }
  assert.equal(JSON.stringify(manifest).includes("REPLICATE_API_TOKEN"), false);
  assert.equal(JSON.stringify(manifest).includes("/B.png"), false);
  assert.equal(JSON.stringify(manifest).includes("/C.png"), false);
  assert.equal(JSON.stringify(manifest).includes("/D.png"), false);
});

test("Camotion implementation is not part of this experiment", async () => {
  const result = await execFileAsync("git", ["diff", "--stat", "--", "camotion/src", "camotion/tuning", "media/src/cinematographer"], {
    cwd: repoRoot,
  });
  assert.equal(result.stdout.trim(), "");
});
