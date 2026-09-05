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
  CONDITIONS,
  MINIMAL_PROMPT,
  MOTION_PROMPT,
  SEED,
  SEEDANCE_SETTINGS,
  submittedSettings,
  settingsDifferOnlyByIndependentVariables,
  runAb2x2,
} from "../experiments/wardrobe-loop/ab-2x2.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function mockVideo(
  predictionId: string,
  metadata: Record<string, unknown> = {},
) {
  return {
    provider: "replicate" as const,
    model: "bytedance/seedance-2.5",
    modelVersion: "version-1",
    predictionId,
    status: "succeeded" as const,
    outputUrl: `https://example.com/${predictionId}.mp4`,
    metadata,
    startedAt: "2026-09-05T19:00:00.000Z",
    completedAt: "2026-09-05T19:03:00.000Z",
    elapsedMs: 180000,
  };
}

test("2×2 matrix uses exact Integration Test 01 A→B assets, prompts, seed 70, and adaptive aspect", () => {
  assert.equal(CONDITIONS.length, 4);
  assert.equal(SEED, 70);
  assert.equal(SEEDANCE_SETTINGS.aspectRatio, "adaptive");
  assert.equal(SEEDANCE_SETTINGS.generateAudio, false);
  assert.equal(SEEDANCE_SETTINGS.watermark, false);
  assert.equal(SEEDANCE_SETTINGS.outputFormat, "mp4");
  assert.equal(SEEDANCE_SETTINGS.seed, 70);
  assert.equal(MOTION_PROMPT, VIDEO_PROMPTS["A-B"]);
  assert.equal(
    MINIMAL_PROMPT,
    "A continuous journey from a cozy attic bedroom, through the old wardrobe, and into the snowy winter world beyond.",
  );
  assert.equal(CONDITIONS[0].id, "01-pristine-minimal");
  assert.equal(CONDITIONS[1].id, "02-pristine-motion");
  assert.equal(CONDITIONS[2].id, "03-conditioned-minimal");
  assert.equal(CONDITIONS[3].id, "04-conditioned-motion");
  assert.ok(CONDITIONS.every((condition) => !condition.id.includes("nomotion")));
  assert.equal(CONDITIONS[0].startImage, "camotion/integration/wardrobe-loop-01/canonical/A.png");
  assert.equal(CONDITIONS[0].endImage, "camotion/integration/wardrobe-loop-01/canonical/B.png");
  assert.equal(CONDITIONS[1].startImage, CONDITIONS[0].startImage);
  assert.equal(CONDITIONS[1].endImage, CONDITIONS[0].endImage);
  assert.equal(
    CONDITIONS[2].startImage,
    "camotion/integration/wardrobe-loop-01/shooting/A-B/start.png",
  );
  assert.equal(
    CONDITIONS[2].endImage,
    "camotion/integration/wardrobe-loop-01/shooting/A-B/end.png",
  );
  assert.equal(CONDITIONS[3].startImage, CONDITIONS[2].startImage);
  assert.equal(CONDITIONS[3].endImage, CONDITIONS[2].endImage);
  assert.equal(CONDITIONS[0].prompt, MINIMAL_PROMPT);
  assert.equal(CONDITIONS[1].prompt, MOTION_PROMPT);
  assert.equal(CONDITIONS[2].prompt, MINIMAL_PROMPT);
  assert.equal(CONDITIONS[3].prompt, MOTION_PROMPT);
});

test("Seedance mapping sends seed 70 and rejects 16:9 first/last-frame aspect ratio", () => {
  const input = toSeedance25Input(
    {
      startImage: { kind: "url", url: "https://example.com/a.png" },
      endImage: { kind: "url", url: "https://example.com/b.png" },
      prompt: MINIMAL_PROMPT,
      durationSeconds: 6,
    },
    { kind: "url", url: "https://example.com/a.png" },
    { kind: "url", url: "https://example.com/b.png" },
    SEEDANCE_SETTINGS,
  );
  assert.equal(input.seed, 70);
  assert.equal(input.aspect_ratio, "adaptive");
  assert.equal(input.generate_audio, false);
  assert.equal(input.duration, 6);
  assert.throws(
    () =>
      toSeedance25Input(
        {
          startImage: { kind: "url", url: "https://example.com/a.png" },
          endImage: { kind: "url", url: "https://example.com/b.png" },
          prompt: MINIMAL_PROMPT,
        },
        { kind: "url", url: "https://example.com/a.png" },
        { kind: "url", url: "https://example.com/b.png" },
        { ...SEEDANCE_SETTINGS, aspectRatio: "16:9" },
      ),
    /adaptive/,
  );
});

test("shared Seedance knobs are identical across the 2×2 except endpoints and prompt", () => {
  const records = CONDITIONS.map((condition) => ({
    settings: submittedSettings(repoRoot, condition),
  }));
  assert.equal(settingsDifferOnlyByIndependentVariables(records), true);
  assert.equal(records[0].settings.prompt, MINIMAL_PROMPT);
  assert.equal(records[1].settings.prompt, MOTION_PROMPT);
  assert.equal(
    records[0].settings.image,
    "<local file upload: camotion/integration/wardrobe-loop-01/canonical/A.png>",
  );
  assert.equal(
    records[2].settings.image,
    "<local file upload: camotion/integration/wardrobe-loop-01/shooting/A-B/start.png>",
  );
  for (const record of records) {
    assert.equal(record.settings.seed, 70);
    assert.equal(record.settings.aspect_ratio, "adaptive");
    assert.equal(record.settings.duration, 6);
    assert.equal(record.settings.generate_audio, false);
  }
});

test("harness runs four sequential MediaProvider calls and does not retry a failure", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "tv-ab-2x2-"));
  const calls: string[] = [];
  const provider: MediaProvider = {
    async generateVideo(request) {
      calls.push(request.prompt);
      if (calls.length === 2) {
        throw new MediaGenerationError("generation_failed", "seedance failed once", {
          predictionId: "pred_fail_02",
        });
      }
      return mockVideo(`pred_ok_${calls.length}`, { seed: 70 });
    },
    async generateImage() {
      throw new Error("generateImage not used");
    },
  };

  const manifest = await runAb2x2({
    repoRoot,
    execute: true,
    outputDir,
    provider,
    fetchOutput: async () => Buffer.from("fake-mp4"),
  });

  assert.deepEqual(
    calls,
    [MINIMAL_PROMPT, MOTION_PROMPT, MINIMAL_PROMPT, MOTION_PROMPT],
  );
  assert.equal(manifest.conditions.length, 4);
  assert.equal(manifest.seed, 70);
  assert.equal(manifest.conditions[0].status, "succeeded");
  assert.equal(manifest.conditions[1].status, "failed");
  assert.equal(manifest.conditions[1].prediction_id, "pred_fail_02");
  assert.equal(manifest.conditions[1].output_path, null);
  assert.equal(manifest.conditions[2].status, "succeeded");
  assert.equal(manifest.conditions[3].status, "succeeded");
  assert.equal(manifest.conditions[0].seed_reported, 70);
  assert.equal(manifest.conditions[3].filename, "04-conditioned-motion.mp4");
  assert.equal(settingsDifferOnlyByIndependentVariables(manifest.conditions), true);

  const written = JSON.parse(await readFile(join(outputDir, "manifest.json"), "utf8"));
  assert.equal(JSON.stringify(written).includes("REPLICATE_API_TOKEN"), false);
  assert.equal(/r8_[A-Za-z0-9]{8,}/.test(JSON.stringify(written)), false);
});

test("dry-run writes a manifest and does not call the provider", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "tv-ab-2x2-dry-"));
  await mkdir(outputDir, { recursive: true });
  let called = 0;
  const provider: MediaProvider = {
    async generateVideo() {
      called += 1;
      throw new Error("should not call Replicate");
    },
    async generateImage() {
      throw new Error("generateImage not used");
    },
  };
  const manifest = await runAb2x2({
    repoRoot,
    execute: false,
    outputDir,
    provider,
  });
  assert.equal(called, 0);
  assert.ok(manifest.conditions.every((condition) => condition.status === "dry_run"));
  assert.ok(manifest.conditions.every((condition) => condition.prediction_id === null));
});
