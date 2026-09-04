import { access, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { sha256Bytes, type MediaProvider } from "../src/index.ts";
import { parseManifest, type ExperimentManifest } from "./manifest.ts";
import {
  isSuccessfulRunRecord,
  manualObservedCostUsd,
  evidenceRunFilename,
  type ExperimentRunRecord,
} from "./record.ts";
import {
  outputDirFor,
  prepareExperiment,
  runExperiment,
  type PreparedExperiment,
} from "./runner.ts";

export const CONTROL_EXPERIMENT = "01.5";
export const COST_ESTIMATE_NOTE =
  "Approximate historical-cost reference based on the manually observed 01.5 run; not guaranteed Replicate pricing.";

export type BatchItemStatus =
  | "ready"
  | "blocked"
  | "skipped"
  | "succeeded"
  | "failed"
  | "not_run";

export type BatchItem = {
  readonly experiment: string;
  readonly status: BatchItemStatus;
  readonly reason: string | null;
  readonly start_image: PreparedExperiment["startHash"] & { readonly path: string } | null;
  readonly end_image: PreparedExperiment["startHash"] & { readonly path: string } | null;
  readonly duration_seconds: number | null;
  readonly resolution: string | null;
  readonly output_dir: string | null;
  readonly paid: boolean;
};

export type BatchReport = {
  readonly execute: boolean;
  readonly experiments: readonly string[];
  readonly model: string;
  readonly duration_seconds: number;
  readonly resolution: string;
  readonly prompt: string;
  readonly prompt_sha256: string;
  readonly submitted_settings: Readonly<Record<string, unknown>>;
  readonly historical_observed_cost_usd_per_run: number | null;
  readonly paid_generation_count: number;
  readonly approximate_historical_cost_usd: number | null;
  readonly cost_estimate_note: string | null;
  readonly items: readonly BatchItem[];
};

export type RunBenchmarkBatchOptions = {
  readonly repoRoot: string;
  readonly experiments: readonly string[];
  readonly execute: boolean;
  readonly rerunExisting?: boolean;
  readonly controlExperiment?: string;
  readonly provider?: MediaProvider;
  readonly fetchOutput?: (url: string) => Promise<Buffer>;
};

export function parseExperimentList(value: string): string[] {
  const ids = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (ids.length === 0) {
    throw new Error("at least one experiment id is required");
  }
  return ids;
}

export function manifestPathFor(repoRoot: string, experiment: string): string {
  return join(repoRoot, "media", "experiments", "manifests", `${experiment}.json`);
}

export function frozenControlMismatch(
  manifest: ExperimentManifest,
  control: ExperimentManifest,
): string | null {
  if (manifest.provider !== control.provider) {
    return `provider differs from ${control.experiment} frozen control`;
  }
  if (manifest.model !== control.model) {
    return `model differs from ${control.experiment} frozen control`;
  }
  if (manifest.prompt !== control.prompt) {
    return `prompt differs from ${control.experiment} frozen control`;
  }
  if (manifest.duration_seconds !== control.duration_seconds) {
    return `duration differs from ${control.experiment} frozen control`;
  }
  if (manifest.end_image !== control.end_image) {
    return `end_image / B' differs from ${control.experiment} frozen control`;
  }
  if (JSON.stringify(manifest.settings ?? {}) !== JSON.stringify(control.settings ?? {})) {
    return `settings differ from ${control.experiment} frozen control`;
  }
  if (manifest.settings?.seed !== undefined) {
    return "seed must be omitted to match the frozen 01.5 control";
  }
  return null;
}

export async function findExistingSuccessfulRun(
  outputDir: string,
  experiment: string,
): Promise<ExperimentRunRecord | null> {
  try {
    const raw = JSON.parse(
      await readFile(join(outputDir, evidenceRunFilename(experiment)), "utf8"),
    );
    if (!isSuccessfulRunRecord(raw)) {
      return null;
    }
    const filename = raw.output?.filename;
    if (typeof filename !== "string" || filename.length === 0) {
      return null;
    }
    await access(join(outputDir, filename));
    return raw as ExperimentRunRecord;
  } catch {
    return null;
  }
}

export function formatPaidSummary(report: BatchReport): string {
  const lines = [
    `Experiments: ${report.paid_generation_count}`,
    `Model: ${report.model}`,
    `Duration each: ${report.duration_seconds}s`,
    `Resolution: ${report.resolution}`,
  ];
  if (
    report.historical_observed_cost_usd_per_run !== null &&
    report.approximate_historical_cost_usd !== null
  ) {
    lines.push(
      `Previously observed cost/run: $${report.historical_observed_cost_usd_per_run.toFixed(2)}`,
      `Approximate historical-cost reference: $${report.approximate_historical_cost_usd.toFixed(2)}`,
      "",
      report.cost_estimate_note ?? COST_ESTIMATE_NOTE,
    );
  }
  return lines.join("\n");
}

export async function runBenchmarkBatch(
  options: RunBenchmarkBatchOptions,
): Promise<BatchReport> {
  const experiments = [...options.experiments];
  const controlId = options.controlExperiment ?? CONTROL_EXPERIMENT;
  const control = await loadManifest(options.repoRoot, controlId);
  const items: BatchItem[] = [];
  let stop = false;

  for (const experiment of experiments) {
    if (stop) {
      items.push(emptyItem(experiment, "not_run", "stopped after prior failure"));
      continue;
    }

    const item = await runOne(options, experiment, control);
    items.push(item);
    if (options.execute && (item.status === "failed" || item.status === "blocked")) {
      stop = true;
    }
  }

  const paidGenerationCount = items.filter((item) => item.paid).length;
  const sampleSettings = items.find((item) => item.resolution)?.resolution
    ?? control.settings?.resolution
    ?? "720p";
  const observedCostUsd = await readControlManualCost(
    options.repoRoot,
    control,
  );
  const approximateCost =
    observedCostUsd === null
      ? null
      : Number((paidGenerationCount * observedCostUsd).toFixed(2));

  const report: BatchReport = {
    execute: options.execute,
    experiments,
    model: control.model,
    duration_seconds: control.duration_seconds ?? 6,
    resolution: typeof sampleSettings === "string" ? sampleSettings : "720p",
    prompt: control.prompt,
    prompt_sha256: sha256Bytes(Buffer.from(control.prompt, "utf8")),
    submitted_settings: {
      duration: control.duration_seconds ?? 6,
      resolution: control.settings?.resolution ?? "720p",
      aspect_ratio: control.settings?.aspect_ratio ?? "adaptive",
      generate_audio: control.settings?.generate_audio ?? false,
      watermark: control.settings?.watermark ?? false,
      output_format: control.settings?.output_format ?? "mp4",
    },
    historical_observed_cost_usd_per_run: observedCostUsd,
    paid_generation_count: paidGenerationCount,
    approximate_historical_cost_usd: approximateCost,
    cost_estimate_note: observedCostUsd === null ? null : COST_ESTIMATE_NOTE,
    items,
  };
  assertReportSafe(report);
  return report;
}

async function runOne(
  options: RunBenchmarkBatchOptions,
  experiment: string,
  control: ExperimentManifest,
): Promise<BatchItem> {
  const manifestPath = manifestPathFor(options.repoRoot, experiment);
  let manifest: ExperimentManifest;
  try {
    manifest = await loadManifest(options.repoRoot, experiment);
  } catch (error) {
    return emptyItem(
      experiment,
      "blocked",
      error instanceof Error ? error.message : String(error),
    );
  }

  const mismatch = frozenControlMismatch(manifest, control);
  if (mismatch) {
    return emptyItem(experiment, "blocked", mismatch);
  }

  let prepared: PreparedExperiment;
  try {
    prepared = await prepareExperiment({
      repoRoot: options.repoRoot,
      manifestPath,
      execute: false,
    });
  } catch (error) {
    return emptyItem(
      experiment,
      "blocked",
      error instanceof Error ? error.message : String(error),
    );
  }

  const existing = await findExistingSuccessfulRun(
    prepared.outputDir,
    experiment,
  );
  if (existing && !options.rerunExisting) {
    return itemFromPrepared(
      options.repoRoot,
      prepared,
      "skipped",
      "successful run already exists",
      false,
    );
  }

  if (!options.execute) {
    return itemFromPrepared(options.repoRoot, prepared, "ready", null, true);
  }

  try {
    await runExperiment({
      repoRoot: options.repoRoot,
      manifestPath,
      execute: true,
      ...(options.provider ? { provider: options.provider } : {}),
      ...(options.fetchOutput ? { fetchOutput: options.fetchOutput } : {}),
    });
    return itemFromPrepared(options.repoRoot, prepared, "succeeded", null, true);
  } catch (error) {
    return itemFromPrepared(
      options.repoRoot,
      prepared,
      "failed",
      error instanceof Error ? error.message : String(error),
      true,
    );
  }
}

async function readControlManualCost(
  repoRoot: string,
  control: ExperimentManifest,
): Promise<number | null> {
  const existing = await findExistingSuccessfulRun(
    outputDirFor(repoRoot, control),
    control.experiment,
  );
  return manualObservedCostUsd(existing);
}

/** Manual 01.5 control cost only. Returns null when that evidence has no operator-recorded price. */
export async function historicalObservedCostUsd(
  repoRoot: string,
  controlExperiment: string = CONTROL_EXPERIMENT,
): Promise<number | null> {
  const control = await loadManifest(repoRoot, controlExperiment);
  return readControlManualCost(repoRoot, control);
}

async function loadManifest(
  repoRoot: string,
  experiment: string,
): Promise<ExperimentManifest> {
  const path = manifestPathFor(repoRoot, experiment);
  try {
    const raw = JSON.parse(await readFile(path, "utf8"));
    const manifest = parseManifest(raw);
    if (manifest.experiment !== experiment) {
      throw new Error(
        `manifest.experiment is ${manifest.experiment}, expected ${experiment}`,
      );
    }
    return manifest;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(`manifest not found: media/experiments/manifests/${experiment}.json`);
    }
    throw error;
  }
}

function itemFromPrepared(
  repoRoot: string,
  prepared: PreparedExperiment,
  status: BatchItemStatus,
  reason: string | null,
  paid: boolean,
): BatchItem {
  return {
    experiment: prepared.manifest.experiment,
    status,
    reason,
    start_image: {
      path: prepared.manifest.start_image,
      sha256: prepared.startHash.sha256,
      bytes: prepared.startHash.bytes,
    },
    end_image: prepared.endImagePath && prepared.endHash
      ? {
          path: prepared.manifest.end_image ?? prepared.endImagePath,
          sha256: prepared.endHash.sha256,
          bytes: prepared.endHash.bytes,
        }
      : null,
    duration_seconds: prepared.manifest.duration_seconds ?? null,
    resolution: prepared.manifest.settings?.resolution ?? null,
    output_dir: relative(repoRoot, prepared.outputDir).split("\\").join("/"),
    paid,
  };
}

function emptyItem(
  experiment: string,
  status: BatchItemStatus,
  reason: string,
): BatchItem {
  return {
    experiment,
    status,
    reason,
    start_image: null,
    end_image: null,
    duration_seconds: null,
    resolution: null,
    output_dir: null,
    paid: false,
  };
}

function assertReportSafe(report: BatchReport): void {
  const serialized = JSON.stringify(report);
  if (serialized.includes("REPLICATE_API_TOKEN") || /r8_[A-Za-z0-9]{8,}/.test(serialized)) {
    throw new Error("batch report must not include secrets");
  }
}
