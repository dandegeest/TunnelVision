import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { MediaGenerationError } from "../src/errors.ts";
import { toSeedance25Input } from "../src/replicate/seedance-2.5.ts";
import type { MediaProvider } from "../src/types.ts";
import { VIDEO_PROMPTS } from "../experiments/wardrobe-loop/story.ts";
import {
  ADAPTIVE_STRENGTHS,
  EXPERIMENT_ID,
  FIXED_STRENGTH,
  GENERATIONS,
  SHOT_PAIRS,
  assertAuthoritativePrompts,
  assertExperimentContract,
  geometryWithoutStrength,
  isAllowedStrength,
  loadAuthoritativePrompts,
  pairControlsHeld,
  parseAdaptiveSelections,
  planWithStrength,
  runSceneAwareStrength,
  seedanceSettingsForSeed,
  shotEndpointStrengthsFromCanonicals,
  type CanonicalId,
  type CanonicalSelection,
  type ExperimentShotId,
  type GenerationSpec,
  type PlanningArtifact,
} from "../experiments/wardrobe-loop/scene-aware-strength.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const INTEGRATION_PROMPTS = {
  "A-B": VIDEO_PROMPTS["A-B"],
  "B-C": VIDEO_PROMPTS["B-C"],
  "D-E": VIDEO_PROMPTS["D-E"],
} as const;

function mockVideo(predictionId: string, seed: number) {
  return {
    provider: "replicate" as const,
    model: "bytedance/seedance-2.5",
    modelVersion: "version-1",
    predictionId,
    status: "succeeded" as const,
    outputUrl: `https://example.com/${predictionId}.mp4`,
    metadata: { seed },
    startedAt: "2026-09-05T21:00:00.000Z",
    completedAt: "2026-09-05T21:03:00.000Z",
    elapsedMs: 180000,
  };
}

function mockSelections(overrides: Partial<Record<CanonicalId, number>> = {}) {
  const strengths: Record<CanonicalId, number> = {
    A: 0.04,
    B: 0.02,
    C: 0.08,
    D: 0.04,
    E: 0.08,
    ...overrides,
  };
  const selections = {} as Record<
    CanonicalId,
    Pick<CanonicalSelection, "strength" | "label" | "reasoning">
  >;
  for (const [canonical, strength] of Object.entries(strengths) as [CanonicalId, number][]) {
    const label = strength === 0.02 ? "LIGHT" : strength === 0.04 ? "MEDIUM" : "STRONG";
    selections[canonical] = {
      strength: strength as 0.02 | 0.04 | 0.08,
      label,
      reasoning: `${canonical} inspected from the actual still.`,
    };
  }
  return {
    selections,
    rawText: JSON.stringify({ canonicals: selections }),
    model: "google/gemini-3.1-pro",
    modelVersion: "test",
    predictionId: "selector-pred",
    elapsedMs: 12,
    source: "injected" as const,
  };
}

async function useIt01Endpoints(generation: GenerationSpec, planning: PlanningArtifact) {
  const pair = SHOT_PAIRS.find((entry) => entry.shot === generation.shot);
  assert.ok(pair);
  if (generation.condition === "fixed") {
    return {
      startImage: pair.startShooting,
      endImage: pair.endShooting,
      startPlan: pair.startPlan,
      endPlan: pair.endPlan,
      startStrength: FIXED_STRENGTH,
      endStrength: FIXED_STRENGTH,
    };
  }
  const endpoints = planning.shot_endpoint_strengths[generation.shot];
  return {
    startImage: pair.startShooting,
    endImage: pair.endShooting,
    startPlan: pair.startPlan,
    endPlan: pair.endPlan,
    startStrength: endpoints.start_strength,
    endStrength: endpoints.end_strength,
  };
}

test("experiment contract: three pairs, six generations, seeds 80/81/82, no C-D or E-A", () => {
  assertExperimentContract();
  assert.equal(EXPERIMENT_ID, "scene-aware-camotion-strength");
  assert.equal(SHOT_PAIRS.length, 3);
  assert.equal(GENERATIONS.length, 6);
  assert.deepEqual(
    SHOT_PAIRS.map((pair) => pair.shot),
    ["A-B", "B-C", "D-E"],
  );
  assert.deepEqual(
    SHOT_PAIRS.map((pair) => pair.seed),
    [80, 81, 82],
  );
  assert.deepEqual(
    GENERATIONS.map((generation) => generation.filename),
    [
      "01-A-B-fixed-08.mp4",
      "02-A-B-adaptive.mp4",
      "03-B-C-fixed-08.mp4",
      "04-B-C-adaptive.mp4",
      "05-D-E-fixed-08.mp4",
      "06-D-E-adaptive.mp4",
    ],
  );
  assert.ok(GENERATIONS.every((generation) => generation.shot !== "C-D"));
  assert.ok(GENERATIONS.every((generation) => generation.shot !== "E-A"));
  assert.equal(FIXED_STRENGTH, 0.08);
  assert.deepEqual(ADAPTIVE_STRENGTHS, [0.02, 0.04, 0.08]);
  for (const pair of SHOT_PAIRS) {
    const members = GENERATIONS.filter((generation) => generation.shot === pair.shot);
    assert.equal(members[0].seed, members[1].seed);
    assert.equal(members[0].seed, pair.seed);
    assert.equal(members[0].condition, "fixed");
    assert.equal(members[1].condition, "adaptive");
  }
});

test("authoritative Integration Test 01 prompts are used and COMMON_VIDEO_INTENT is not prepended", async () => {
  const prompts = await loadAuthoritativePrompts(repoRoot);
  assert.equal(prompts["A-B"], VIDEO_PROMPTS["A-B"]);
  assert.equal(prompts["B-C"], VIDEO_PROMPTS["B-C"]);
  assert.equal(prompts["D-E"], VIDEO_PROMPTS["D-E"]);
  assert.equal(prompts["A-B"].startsWith("First-person camera physically walks"), true);
  assert.equal(prompts["A-B"].includes("Keep/Redo"), false);
  const manifest = JSON.parse(
    await readFile(
      join(repoRoot, "camotion/integration/wardrobe-loop-01/generation-manifest.json"),
      "utf8",
    ),
  );
  assert.deepEqual(assertAuthoritativePrompts(manifest), INTEGRATION_PROMPTS);
});

test("Seedance mapping keeps adaptive 720p silent mp4 and per-pair seeds", () => {
  for (const seed of [80, 81, 82]) {
    const settings = seedanceSettingsForSeed(seed);
    const input = toSeedance25Input(
      {
        startImage: { kind: "url", url: "https://example.com/a.png" },
        endImage: { kind: "url", url: "https://example.com/b.png" },
        prompt: VIDEO_PROMPTS["A-B"],
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

test("planWithStrength changes only exposure.strength and adaptive values are restricted", () => {
  const plan = {
    version: 1,
    camera: { vanishing_point: [0.515, 0.48], forward: 1 },
    destination: {
      point: [0.515, 0.48],
      protect: true,
      bbox: [0.48, 0.16, 0.55, 0.8],
    },
    exposure: { strength: 0.08, samples: 16 },
  };
  const modified = planWithStrength(plan, 0.02);
  assert.equal((modified.exposure as { strength: number }).strength, 0.02);
  assert.deepEqual(geometryWithoutStrength(plan), geometryWithoutStrength(modified));
  assert.equal(isAllowedStrength(0.02), true);
  assert.equal(isAllowedStrength(0.04), true);
  assert.equal(isAllowedStrength(0.08), true);
  assert.equal(isAllowedStrength(0.06), false);
  assert.equal(isAllowedStrength(0.03), false);
  assert.throws(
    () =>
      parseAdaptiveSelections(
        JSON.stringify({
          canonicals: {
            A: { label: "LIGHT", strength: 0.06, reasoning: "nope" },
            B: { label: "MEDIUM", reasoning: "b" },
            C: { label: "STRONG", reasoning: "c" },
            D: { label: "LIGHT", reasoning: "d" },
            E: { label: "LIGHT", reasoning: "e" },
          },
        }),
      ),
    /0\.02, 0\.04, 0\.08/,
  );
});

test("canonical B is reused across A→B end and B→C start", () => {
  const parsed = parseAdaptiveSelections(
    JSON.stringify({
      canonicals: {
        A: { label: "MEDIUM", strength: 0.04, reasoning: "bedroom furniture smear risk" },
        B: { label: "LIGHT", strength: 0.02, reasoning: "strong corridor and hanging clothes" },
        C: { label: "STRONG", strength: 0.08, reasoning: "distant arch needs a cue" },
        D: { label: "MEDIUM", strength: 0.04, reasoning: "stair volume with columns" },
        E: { label: "STRONG", strength: 0.08, reasoning: "flat door destination" },
      },
    }),
  );
  const endpoints = shotEndpointStrengthsFromCanonicals(parsed);
  assert.equal(parsed.B.strength, 0.02);
  assert.equal(endpoints["A-B"].end_canonical, "B");
  assert.equal(endpoints["B-C"].start_canonical, "B");
  assert.equal(endpoints["A-B"].end_strength, endpoints["B-C"].start_strength);
  assert.equal(endpoints["A-B"].end_strength, 0.02);
  assert.equal(endpoints["A-B"].start_strength, 0.04);
  assert.equal(endpoints["B-C"].end_strength, 0.08);
});

test("harness freezes adaptive decisions before the first Seedance call", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "tv-scene-aware-"));
  const events: string[] = [];
  const seeds: number[] = [];
  const provider: MediaProvider = {
    async generateVideo(request) {
      const planning = JSON.parse(await readFile(join(outputDir, "planning.json"), "utf8"));
      assert.equal(planning.frozen_before_generation, true);
      assert.equal(planning.canonical_selections.A.strength, 0.04);
      events.push(`video:${request.prompt.slice(0, 24)}`);
      return mockVideo(`pred_${events.length}`, 80);
    },
    async generateImage() {
      throw new Error("generateImage not used");
    },
  };

  const manifest = await runSceneAwareStrength({
    repoRoot,
    execute: true,
    outputDir,
    createVideoProvider: (seed) => {
      seeds.push(seed);
      return provider;
    },
    selectCanonicals: async () => {
      events.push("select");
      return mockSelections();
    },
    prepareEndpoints: useIt01Endpoints,
    fetchOutput: async () => Buffer.from("fake-mp4"),
  });

  assert.equal(events[0], "select");
  assert.equal(events.length, 7);
  assert.ok(events.slice(1).every((event) => event.startsWith("video:")));
  assert.equal(manifest.generations.length, 6);
  assert.deepEqual(seeds, [80, 80, 81, 81, 82, 82]);
  assert.equal(manifest.planning_frozen_at <= (manifest.videos_started_at ?? ""), true);
  assert.deepEqual(
    pairControlsHeld(manifest.generations),
    [],
  );
  for (const pair of ["A-B", "B-C", "D-E"] as ExperimentShotId[]) {
    const members = manifest.generations.filter((generation) => generation.shot === pair);
    assert.equal(members[0].prompt, members[1].prompt);
    assert.equal(members[0].prompt, VIDEO_PROMPTS[pair]);
    assert.equal(members[0].start_strength, 0.08);
    assert.equal(members[0].end_strength, 0.08);
    assert.equal(isAllowedStrength(members[1].start_strength), true);
    assert.equal(isAllowedStrength(members[1].end_strength), true);
    assert.equal(members[0].settings.aspect_ratio, "adaptive");
    assert.equal(members[0].settings.seed, members[1].settings.seed);
    assert.equal(members[0].start_image.path, `camotion/integration/wardrobe-loop-01/shooting/${pair}/start.png`);
    assert.equal(members[0].end_image.path, `camotion/integration/wardrobe-loop-01/shooting/${pair}/end.png`);
  }
  assert.equal(manifest.generations[1].start_strength, 0.04);
  assert.equal(manifest.generations[1].end_strength, 0.02);
  assert.equal(JSON.stringify(manifest).includes("REPLICATE_API_TOKEN"), false);
});

test("technical failure is retried once with identical inputs, not for aesthetics", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "tv-scene-aware-retry-"));
  const calls: string[] = [];
  const provider: MediaProvider = {
    async generateVideo(request) {
      calls.push(request.prompt);
      if (calls.length === 1) {
        throw new MediaGenerationError("generation_failed", "seedance failed once", {
          predictionId: "pred_fail_01",
        });
      }
      return mockVideo(`pred_ok_${calls.length}`, 80);
    },
    async generateImage() {
      throw new Error("generateImage not used");
    },
  };

  const manifest = await runSceneAwareStrength({
    repoRoot,
    execute: true,
    outputDir,
    provider,
    selectCanonicals: async () => mockSelections(),
    prepareEndpoints: useIt01Endpoints,
    fetchOutput: async () => Buffer.from("fake-mp4"),
  });

  assert.equal(calls.length, 7);
  assert.equal(calls[0], calls[1]);
  assert.equal(manifest.generations[0].status, "succeeded");
  assert.equal(manifest.generations[0].retry_count, 1);
  assert.ok(manifest.generations.slice(1).every((generation) => generation.retry_count === 0));
});

test("dry-run freezes planning and does not call Seedance", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "tv-scene-aware-dry-"));
  await mkdir(outputDir, { recursive: true });
  let videos = 0;
  const provider: MediaProvider = {
    async generateVideo() {
      videos += 1;
      throw new Error("should not call Replicate");
    },
    async generateImage() {
      throw new Error("generateImage not used");
    },
  };
  const manifest = await runSceneAwareStrength({
    repoRoot,
    execute: false,
    outputDir,
    provider,
    selectCanonicals: async () => mockSelections({ A: 0.08, B: 0.08, C: 0.08, D: 0.08, E: 0.08 }),
    prepareEndpoints: useIt01Endpoints,
  });
  assert.equal(videos, 0);
  assert.ok(manifest.generations.every((generation) => generation.status === "dry_run"));
  assert.equal(manifest.planning.canonical_selections.A.strength, 0.08);
  assert.equal(manifest.videos_started_at, null);
  const planning = JSON.parse(await readFile(join(outputDir, "planning.json"), "utf8"));
  assert.equal(planning.frozen_before_generation, true);
});
