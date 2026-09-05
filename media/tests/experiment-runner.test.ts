import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { MediaGenerationError } from "../src/errors.ts";
import { sha256Bytes } from "../src/hash.ts";
import type { MediaProvider } from "../src/types.ts";
import { parseManifest } from "../experiments/manifest.ts";
import { assertRecordIsSafe } from "../experiments/record.ts";
import { outputDirFor, runExperiment } from "../experiments/runner.ts";

const prompt = "never stop moving";

function validManifest(overrides: Record<string, unknown> = {}) {
  return {
    experiment: "01.5",
    provider: "replicate",
    model: "bytedance/seedance-2.5",
    start_image: "fixtures/start.png",
    end_image: "fixtures/end.png",
    prompt,
    duration_seconds: 6,
    settings: {
      resolution: "720p",
      aspect_ratio: "adaptive",
      generate_audio: false,
      watermark: false,
      output_format: "mp4",
    },
    ...overrides,
  };
}

test("manifest parsing rejects secrets and absolute paths later used by the runner", () => {
  const manifest = parseManifest(validManifest());
  assert.equal(manifest.experiment, "01.5");
  assert.throws(
    () =>
      parseManifest(
        validManifest({ prompt: "use REPLICATE_API_TOKEN=r8_abcdefghijk" }),
      ),
    /secret|token/i,
  );
});

test("run record serialization excludes secrets", () => {
  const record = {
    experiment: "01.5",
    provider: "replicate" as const,
    requested_model: "bytedance/seedance-2.5",
    resolved_model: "bytedance/seedance-2.5",
    resolved_model_version: "abc",
    prediction_id: "pred_1",
    start_image: { path: "a.png", sha256: "aa", bytes: 1 },
    end_image: { path: "b.png", sha256: "bb", bytes: 1 },
    prompt,
    submitted_settings: { duration: 6 },
    manifest_sha256: "cc",
    git_commit: "deadbeef",
    started_at: "2026-09-03T00:00:00.000Z",
    completed_at: "2026-09-03T00:00:01.000Z",
    elapsed_ms: 1000,
    status: "succeeded",
    provider_error: null,
    error_code: null,
    output: {
      filename: "01.5-result.mp4",
      path: "camotion/tuning/video-runs/replicate-bytedance-seedance-2.5/01.5/01.5-result.mp4",
      source_url: "https://replicate.delivery/x.mp4",
    },
  };
  assertRecordIsSafe(record, "r8_supersecret");
  assert.equal("observed_cost_usd" in record, false);
  assertRecordIsSafe(
    { ...record, observed_cost_usd: 1.4, observed_cost_source: "manual" },
    "r8_supersecret",
  );
  assert.throws(
    () =>
      assertRecordIsSafe(
        {
          ...record,
          prompt: "r8_supersecret leaked",
        },
        "r8_supersecret",
      ),
    /token/,
  );
});

test("output path is provider-and-experiment specific", () => {
  const dir = outputDirFor("/repo", parseManifest(validManifest()));
  assert.equal(
    dir,
    join(
      "/repo",
      "camotion",
      "tuning",
      "video-runs",
      "replicate-bytedance-seedance-2.5",
      "01.5",
    ),
  );
});

test("prompt-control evidence_family is outside the 01.x Camotion series", () => {
  const dir = outputDirFor(
    "/repo",
    parseManifest(
      validManifest({
        experiment: "seedance-slow",
        evidence_family: "prompt-control/camera-speed",
      }),
    ),
  );
  assert.equal(
    dir,
    join(
      "/repo",
      "camotion",
      "tuning",
      "video-runs",
      "prompt-control",
      "camera-speed",
      "replicate-bytedance-seedance-2.5",
      "seedance-slow",
    ),
  );
});

test("evidence_family parent segments are rejected", () => {
  assert.throws(
    () =>
      parseManifest(
        validManifest({ evidence_family: "prompt-control/../camera-speed" }),
      ),
    /parent segment/i,
  );
});

test("research runner calls MediaProvider rather than Replicate directly", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "tv-exp-"));
  await mkdir(join(repoRoot, "fixtures"));
  const start = Buffer.from("start-bytes");
  const end = Buffer.from("end-bytes");
  await writeFile(join(repoRoot, "fixtures/start.png"), start);
  await writeFile(join(repoRoot, "fixtures/end.png"), end);
  const manifestPath = join(repoRoot, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(validManifest(), null, 2));

  let called = 0;
  const provider: MediaProvider = {
    async generateVideo(request) {
      called += 1;
      assert.equal(request.prompt, prompt);
      assert.equal(request.durationSeconds, 6);
      assert.equal(request.startImage.kind, "file");
      assert.equal(request.endImage?.kind, "file");
      return {
        provider: "replicate",
        model: "bytedance/seedance-2.5",
        modelVersion: "version-1",
        predictionId: "pred_exp",
        status: "succeeded",
        outputUrl: "https://example.com/out.mp4",
        metadata: {},
        startedAt: "2026-09-03T18:00:00.000Z",
        completedAt: "2026-09-03T18:00:08.000Z",
        elapsedMs: 8000,
      };
    },
    async generateImage() {
      throw new Error("generateImage not used");
    },
  };

  const record = await runExperiment({
    repoRoot,
    manifestPath,
    execute: true,
    provider,
    fetchOutput: async () => Buffer.from("mp4-bytes"),
  });

  assert.equal(called, 1);
  assert.equal(record.prediction_id, "pred_exp");
  assert.equal(record.start_image.sha256, sha256Bytes(start));
  assert.equal(record.end_image?.sha256, sha256Bytes(end));
  assert.equal(
    record.output?.path,
    "camotion/tuning/video-runs/replicate-bytedance-seedance-2.5/01.5/01.5-result.mp4",
  );
  const saved = JSON.parse(
    await readFile(
      join(
        repoRoot,
        "camotion/tuning/video-runs/replicate-bytedance-seedance-2.5/01.5/01.5-run.json",
      ),
      "utf8",
    ),
  );
  assert.equal(saved.prediction_id, "pred_exp");
  assert.equal(JSON.stringify(saved).includes("r8_"), false);
});

test("runner records the provider error Replicate actually reports", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "tv-exp-fail-"));
  await mkdir(join(repoRoot, "fixtures"));
  await writeFile(join(repoRoot, "fixtures/start.png"), Buffer.from("a"));
  await writeFile(join(repoRoot, "fixtures/end.png"), Buffer.from("b"));
  const manifestPath = join(repoRoot, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(validManifest(), null, 2));
  const provider: MediaProvider = {
    async generateVideo() {
      throw new MediaGenerationError("generation_failed", "prediction failed", {
        providerMessage: "prediction failed",
        predictionId: "pred_fail",
      });
    },
    async generateImage() {
      throw new Error("generateImage not used");
    },
  };
  await assert.rejects(
    () =>
      runExperiment({
        repoRoot,
        manifestPath,
        execute: true,
        provider,
      }),
    MediaGenerationError,
  );
  const saved = JSON.parse(
    await readFile(
      join(
        repoRoot,
        "camotion/tuning/video-runs/replicate-bytedance-seedance-2.5/01.5/01.5-run.json",
      ),
      "utf8",
    ),
  );
  assert.equal(saved.status, "failed");
  assert.equal(saved.provider_error, "prediction failed");
  assert.equal(saved.prediction_id, "pred_fail");
  assert.equal(saved.error_code, "generation_failed");
});
