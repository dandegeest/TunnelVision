import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { MediaGenerationError } from "../src/errors.ts";
import type { MediaProvider } from "../src/types.ts";
import {
  formatPaidSummary,
  frozenControlMismatch,
  parseExperimentList,
  runBenchmarkBatch,
} from "../experiments/batch.ts";
import { parseManifest } from "../experiments/manifest.ts";
import { isSuccessfulRunRecord, manualObservedCostUsd, evidenceResultFilename, evidenceRunFilename } from "../experiments/record.ts";

const prompt =
  "First person POV camera continuously moving forward through a spatially-contiguous environment";

const repoRootFromTests = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function controlManifest(overrides: Record<string, unknown> = {}) {
  return {
    experiment: "01.5",
    provider: "replicate",
    model: "bytedance/seedance-2.5",
    start_image: "camotion/tuning/control.png",
    end_image: "camotion/tuning/end.jpeg",
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

function experimentManifest(id: string, startImage: string) {
  return controlManifest({
    experiment: id,
    start_image: startImage,
  });
}

async function writeManifest(repoRoot: string, manifest: Record<string, unknown>) {
  const dir = join(repoRoot, "media/experiments/manifests");
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, `${manifest.experiment}.json`),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

async function makeFixtureRepo() {
  const repoRoot = await mkdtemp(join(tmpdir(), "tv-batch-"));
  await mkdir(join(repoRoot, "camotion/tuning"), { recursive: true });
  await writeFile(join(repoRoot, "camotion/tuning/control.png"), Buffer.from("control-a"));
  await writeFile(join(repoRoot, "camotion/tuning/a.png"), Buffer.from("start-a"));
  await writeFile(join(repoRoot, "camotion/tuning/b.png"), Buffer.from("start-b"));
  await writeFile(join(repoRoot, "camotion/tuning/c.png"), Buffer.from("start-c"));
  await writeFile(join(repoRoot, "camotion/tuning/end.jpeg"), Buffer.from("end-bytes"));
  await writeManifest(repoRoot, controlManifest());
  await writeManifest(repoRoot, experimentManifest("01.3", "camotion/tuning/a.png"));
  await writeManifest(repoRoot, experimentManifest("01.4", "camotion/tuning/b.png"));
  await writeManifest(repoRoot, experimentManifest("01.6", "camotion/tuning/c.png"));
  return repoRoot;
}

function countingProvider(): MediaProvider & { readonly calls: string[] } {
  const calls: string[] = [];
  const provider: MediaProvider & { readonly calls: string[] } = {
    calls,
    async generateVideo(request) {
      if (request.startImage.kind !== "file") {
        throw new Error("expected file input");
      }
      calls.push(request.startImage.path);
      return {
        provider: "replicate",
        model: "bytedance/seedance-2.5",
        modelVersion: "version-1",
        predictionId: `pred_${calls.length}`,
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
  return provider;
}

async function writeSuccessfulRun(
  repoRoot: string,
  experiment: string,
  cost?: {
    readonly observed_cost_usd: number;
    readonly observed_cost_source: "manual" | "provider";
  },
) {
  const outputDir = join(
    repoRoot,
    "camotion/tuning/video-runs/replicate-bytedance-seedance-2.5",
    experiment,
  );
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, evidenceResultFilename(experiment)), Buffer.from("existing-mp4"));
  await writeFile(
    join(outputDir, evidenceRunFilename(experiment)),
    `${JSON.stringify(
      {
        experiment,
        status: "succeeded",
        output: { filename: evidenceResultFilename(experiment), path: "x", source_url: null },
        ...(cost ?? {}),
      },
      null,
      2,
    )}\n`,
  );
}

test("selected experiment ordering is deterministic", () => {
  assert.deepEqual(parseExperimentList("01.8, 01.3,01.4"), ["01.8", "01.3", "01.4"]);
});

test("batch dry-run performs no provider calls", async () => {
  const repoRoot = await makeFixtureRepo();
  const provider = countingProvider();
  const report = await runBenchmarkBatch({
    repoRoot,
    experiments: ["01.3", "01.4", "01.6"],
    execute: false,
    provider,
  });
  assert.equal(provider.calls.length, 0);
  assert.deepEqual(
    report.items.map((item) => item.experiment),
    ["01.3", "01.4", "01.6"],
  );
  assert.ok(report.items.every((item) => item.status === "ready"));
  assert.equal(report.paid_generation_count, 3);
});

test("successful existing runs are skipped", async () => {
  const repoRoot = await makeFixtureRepo();
  await writeSuccessfulRun(repoRoot, "01.3");
  const provider = countingProvider();
  const report = await runBenchmarkBatch({
    repoRoot,
    experiments: ["01.3", "01.4"],
    execute: true,
    provider,
    fetchOutput: async () => Buffer.from("new-mp4"),
  });
  assert.equal(report.items[0]?.status, "skipped");
  assert.equal(report.items[1]?.status, "succeeded");
  assert.equal(provider.calls.length, 1);
  const preserved = await readFile(
    join(
      repoRoot,
      "camotion/tuning/video-runs/replicate-bytedance-seedance-2.5/01.3/01.3-result.mp4",
    ),
  );
  assert.equal(preserved.toString(), "existing-mp4");
});

test("explicit override permits rerun of a successful experiment", async () => {
  const repoRoot = await makeFixtureRepo();
  await writeSuccessfulRun(repoRoot, "01.3");
  const provider = countingProvider();
  const report = await runBenchmarkBatch({
    repoRoot,
    experiments: ["01.3"],
    execute: true,
    rerunExisting: true,
    provider,
    fetchOutput: async () => Buffer.from("rerun-mp4"),
  });
  assert.equal(report.items[0]?.status, "succeeded");
  assert.equal(provider.calls.length, 1);
  const rewritten = await readFile(
    join(
      repoRoot,
      "camotion/tuning/video-runs/replicate-bytedance-seedance-2.5/01.3/01.3-result.mp4",
    ),
  );
  assert.equal(rewritten.toString(), "rerun-mp4");
});

test("failure stops subsequent execution and leaves earlier evidence", async () => {
  const repoRoot = await makeFixtureRepo();
  const calls: string[] = [];
  const provider: MediaProvider = {
    async generateVideo(request) {
      if (request.startImage.kind !== "file") {
        throw new Error("expected file");
      }
      calls.push(request.startImage.path);
      if (request.startImage.path.endsWith("b.png")) {
        throw new MediaGenerationError("generation_failed", "boom", {
          providerMessage: "boom",
          predictionId: "pred_fail",
        });
      }
      return {
        provider: "replicate",
        model: "bytedance/seedance-2.5",
        modelVersion: "v",
        predictionId: "pred_ok",
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
  const report = await runBenchmarkBatch({
    repoRoot,
    experiments: ["01.3", "01.4", "01.6"],
    execute: true,
    provider,
    fetchOutput: async () => Buffer.from("ok-mp4"),
  });
  assert.deepEqual(
    report.items.map((item) => item.status),
    ["succeeded", "failed", "not_run"],
  );
  assert.equal(calls.length, 2);
  const first = await readFile(
    join(
      repoRoot,
      "camotion/tuning/video-runs/replicate-bytedance-seedance-2.5/01.3/01.3-result.mp4",
    ),
  );
  assert.equal(first.toString(), "ok-mp4");
  await assert.rejects(
    () =>
      readFile(
        join(
          repoRoot,
          "camotion/tuning/video-runs/replicate-bytedance-seedance-2.5/01.6/01.6-result.mp4",
        ),
      ),
  );
});

test("frozen Seedance settings match across real benchmark manifests", async () => {
  const ids = ["01.3", "01.4", "01.5", "01.6", "01.7", "01.8"];
  const control = parseManifest(
    JSON.parse(
      await readFile(
        join(repoRootFromTests, "media/experiments/manifests/01.5.json"),
        "utf8",
      ),
    ),
  );
  for (const id of ids) {
    const manifest = parseManifest(
      JSON.parse(
        await readFile(
          join(repoRootFromTests, "media/experiments/manifests", `${id}.json`),
          "utf8",
        ),
      ),
    );
    assert.equal(frozenControlMismatch(manifest, control), null, id);
    assert.equal(manifest.settings?.seed, undefined, id);
  }
});

test("batch reports do not serialize secrets", async () => {
  const repoRoot = await makeFixtureRepo();
  const report = await runBenchmarkBatch({
    repoRoot,
    experiments: ["01.3"],
    execute: false,
    provider: countingProvider(),
  });
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes("REPLICATE_API_TOKEN"), false);
  assert.equal(/r8_[A-Za-z0-9]{8,}/.test(serialized), false);
});

test("batch cost estimate uses manual 01.5 control evidence when present", async () => {
  const repoRoot = await makeFixtureRepo();
  await writeSuccessfulRun(repoRoot, "01.5", {
    observed_cost_usd: 1.4,
    observed_cost_source: "manual",
  });
  const report = await runBenchmarkBatch({
    repoRoot,
    experiments: ["01.3", "01.4", "01.6"],
    execute: false,
    provider: countingProvider(),
  });
  assert.equal(report.historical_observed_cost_usd_per_run, 1.4);
  assert.equal(report.approximate_historical_cost_usd, 4.2);
  assert.match(
    report.cost_estimate_note ?? "",
    /manually observed 01\.5 run; not guaranteed Replicate pricing/i,
  );
  const summary = formatPaidSummary(report);
  assert.match(summary, /\$1\.40/);
  assert.match(summary, /\$4\.20/);
});

test("batch omits dollar estimate when 01.5 control has no manual cost", async () => {
  const repoRoot = await makeFixtureRepo();
  const report = await runBenchmarkBatch({
    repoRoot,
    experiments: ["01.3", "01.4", "01.6"],
    execute: false,
    provider: countingProvider(),
  });
  assert.equal(report.historical_observed_cost_usd_per_run, null);
  assert.equal(report.approximate_historical_cost_usd, null);
  assert.equal(report.cost_estimate_note, null);
  const summary = formatPaidSummary(report);
  assert.equal(summary.includes("$"), false);
  assert.equal(summary.includes("historical-cost"), false);
});

test("provider-reported control cost is not used as a batch estimate", async () => {
  const repoRoot = await makeFixtureRepo();
  await writeSuccessfulRun(repoRoot, "01.5", {
    observed_cost_usd: 9.99,
    observed_cost_source: "provider",
  });
  const report = await runBenchmarkBatch({
    repoRoot,
    experiments: ["01.3"],
    execute: false,
    provider: countingProvider(),
  });
  assert.equal(report.historical_observed_cost_usd_per_run, null);
  assert.equal(report.approximate_historical_cost_usd, null);
});

test("observed_cost_usd is optional evidence metadata", () => {
  assert.equal(
    isSuccessfulRunRecord({
      status: "succeeded",
      output: { filename: "01.5-result.mp4", path: "x", source_url: null },
    }),
    true,
  );
  assert.equal(
    isSuccessfulRunRecord({
      status: "failed",
      output: { filename: "01.5-result.mp4", path: "x", source_url: null },
    }),
    false,
  );
  assert.equal(
    manualObservedCostUsd({
      observed_cost_usd: 1.4,
      observed_cost_source: "manual",
    }),
    1.4,
  );
  assert.equal(
    manualObservedCostUsd({
      observed_cost_usd: 1.4,
      observed_cost_source: "provider",
    }),
    null,
  );
  assert.equal(manualObservedCostUsd({ observed_cost_usd: 1.4 }), null);
});
