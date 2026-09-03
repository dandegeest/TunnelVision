import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  describeSeedance25Input,
  MediaGenerationError,
  MediaProvider,
  ReplicateMediaProvider,
  Seedance25Settings,
  sha256Bytes,
  sha256File,
} from "../src/index.ts";
import { getOptionalEnv } from "../src/config/environment.ts";
import { parseManifest, type ExperimentManifest } from "./manifest.ts";
import { assertRecordIsSafe, type ExperimentRunRecord } from "./record.ts";

const execFileAsync = promisify(execFile);

export type RunExperimentOptions = {
  readonly repoRoot: string;
  readonly manifestPath: string;
  readonly execute: boolean;
  readonly provider?: MediaProvider;
  readonly now?: () => Date;
  readonly fetchOutput?: (url: string) => Promise<Buffer>;
};

export type PreparedExperiment = {
  readonly manifest: ExperimentManifest;
  readonly manifestSha256: string;
  readonly startImagePath: string;
  readonly endImagePath: string | null;
  readonly startHash: { readonly sha256: string; readonly bytes: number };
  readonly endHash: { readonly sha256: string; readonly bytes: number } | null;
  readonly request: {
    readonly startImage: { readonly kind: "file"; readonly path: string };
    readonly endImage?: { readonly kind: "file"; readonly path: string };
    readonly prompt: string;
    readonly durationSeconds?: number;
  };
  readonly seedanceInput: Record<string, unknown>;
  readonly outputDir: string;
  readonly tokenPresent: boolean;
};

export function outputDirFor(repoRoot: string, manifest: ExperimentManifest): string {
  const modelSlug = manifest.model.replaceAll("/", "-");
  return join(
    repoRoot,
    "camotion",
    "tuning",
    "video-runs",
    `${manifest.provider}-${modelSlug}`,
    manifest.experiment,
  );
}

export async function prepareExperiment(
  options: RunExperimentOptions,
): Promise<PreparedExperiment> {
  const raw = JSON.parse(await readFile(options.manifestPath, "utf8"));
  const manifest = parseManifest(raw);
  const manifestSha256 = sha256Bytes(Buffer.from(JSON.stringify(raw)));
  const startImagePath = resolveRepoPath(options.repoRoot, manifest.start_image);
  const endImagePath = manifest.end_image
    ? resolveRepoPath(options.repoRoot, manifest.end_image)
    : null;
  const startHash = await hashRequiredImage("start_image", startImagePath);
  const endHash = endImagePath
    ? await hashRequiredImage("end_image", endImagePath)
    : null;
  const request = {
    startImage: { kind: "file" as const, path: startImagePath },
    ...(endImagePath
      ? { endImage: { kind: "file" as const, path: endImagePath } }
      : {}),
    prompt: manifest.prompt,
    ...(manifest.duration_seconds !== undefined
      ? { durationSeconds: manifest.duration_seconds }
      : {}),
  };
  const seedanceInput = describeSeedance25Input(
    request,
    localUploadLabel(options.repoRoot, startImagePath),
    endImagePath ? localUploadLabel(options.repoRoot, endImagePath) : undefined,
    settingsFromManifest(manifest),
  );
  return {
    manifest,
    manifestSha256,
    startImagePath,
    endImagePath,
    startHash,
    endHash,
    request,
    seedanceInput,
    outputDir: outputDirFor(options.repoRoot, manifest),
    tokenPresent: getOptionalEnv("REPLICATE_API_TOKEN") !== undefined,
  };
}

export async function runExperiment(
  options: RunExperimentOptions,
): Promise<ExperimentRunRecord> {
  const prepared = await prepareExperiment(options);
  if (!options.execute) {
    return dryRunRecord(prepared, options);
  }

  const provider =
    options.provider ??
    new ReplicateMediaProvider({
      model: prepared.manifest.model,
      seedance: settingsFromManifest(prepared.manifest),
    });

  const startedAt = (options.now ?? (() => new Date()))();
  try {
    const result = await provider.generateVideo(prepared.request);
    const completedAt = (options.now ?? (() => new Date()))();
    await mkdir(prepared.outputDir, { recursive: true });
    const filename = "result.mp4";
    const outputPath = join(prepared.outputDir, filename);
    const bytes = await (options.fetchOutput ?? defaultFetch)(result.outputUrl);
    await writeFile(outputPath, bytes);
    const record: ExperimentRunRecord = {
      experiment: prepared.manifest.experiment,
      provider: "replicate",
      requested_model: prepared.manifest.model,
      resolved_model: result.model,
      resolved_model_version: result.modelVersion,
      prediction_id: result.predictionId,
      start_image: fileRef(options.repoRoot, prepared.startImagePath, prepared.startHash),
      end_image: prepared.endImagePath && prepared.endHash
        ? fileRef(options.repoRoot, prepared.endImagePath, prepared.endHash)
        : null,
      prompt: prepared.manifest.prompt,
      submitted_settings: prepared.seedanceInput,
      manifest_sha256: prepared.manifestSha256,
      git_commit: await gitCommit(options.repoRoot),
      started_at: result.startedAt || startedAt.toISOString(),
      completed_at: result.completedAt || completedAt.toISOString(),
      elapsed_ms: result.elapsedMs,
      status: result.status,
      provider_error: null,
      error_code: null,
      output: {
        filename,
        path: repoRelative(options.repoRoot, outputPath),
        source_url: result.outputUrl,
      },
    };
    assertRecordIsSafe(record, process.env.REPLICATE_API_TOKEN);
    await persist(prepared, record, options.manifestPath);
    return record;
  } catch (error) {
    const completedAt = (options.now ?? (() => new Date()))();
    const mediaError = error instanceof MediaGenerationError ? error : null;
    const record: ExperimentRunRecord = {
      experiment: prepared.manifest.experiment,
      provider: "replicate",
      requested_model: prepared.manifest.model,
      resolved_model: null,
      resolved_model_version: null,
      prediction_id: mediaError?.predictionId ?? null,
      start_image: fileRef(options.repoRoot, prepared.startImagePath, prepared.startHash),
      end_image: prepared.endImagePath && prepared.endHash
        ? fileRef(options.repoRoot, prepared.endImagePath, prepared.endHash)
        : null,
      prompt: prepared.manifest.prompt,
      submitted_settings: prepared.seedanceInput,
      manifest_sha256: prepared.manifestSha256,
      git_commit: await gitCommit(options.repoRoot),
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
      elapsed_ms: completedAt.getTime() - startedAt.getTime(),
      status: "failed",
      provider_error: mediaError
        ? mediaError.providerMessage ?? mediaError.message
        : error instanceof Error
          ? error.message
          : String(error),
      error_code: mediaError?.code ?? "generation_failed",
      output: null,
    };
    assertRecordIsSafe(record, process.env.REPLICATE_API_TOKEN);
    await mkdir(prepared.outputDir, { recursive: true });
    await persist(prepared, record, options.manifestPath);
    throw error;
  }
}

async function dryRunRecord(
  prepared: PreparedExperiment,
  options: RunExperimentOptions,
): Promise<ExperimentRunRecord> {
  const now = (options.now ?? (() => new Date()))();
  const record: ExperimentRunRecord = {
    experiment: prepared.manifest.experiment,
    provider: "replicate",
    requested_model: prepared.manifest.model,
    resolved_model: null,
    resolved_model_version: null,
    prediction_id: null,
    start_image: fileRef(options.repoRoot, prepared.startImagePath, prepared.startHash),
    end_image: prepared.endImagePath && prepared.endHash
      ? fileRef(options.repoRoot, prepared.endImagePath, prepared.endHash)
      : null,
    prompt: prepared.manifest.prompt,
    submitted_settings: prepared.seedanceInput,
    manifest_sha256: prepared.manifestSha256,
    git_commit: await gitCommit(options.repoRoot),
    started_at: now.toISOString(),
    completed_at: now.toISOString(),
    elapsed_ms: 0,
    status: "dry_run",
    provider_error: null,
    error_code: null,
    output: {
      filename: "result.mp4",
      path: repoRelative(options.repoRoot, join(prepared.outputDir, "result.mp4")),
      source_url: null,
    },
  };
  assertRecordIsSafe(record, process.env.REPLICATE_API_TOKEN);
  return record;
}

function settingsFromManifest(manifest: ExperimentManifest): Seedance25Settings {
  const settings = manifest.settings;
  if (!settings) {
    return {};
  }
  return {
    ...(settings.resolution ? { resolution: settings.resolution } : {}),
    ...(settings.aspect_ratio ? { aspectRatio: settings.aspect_ratio } : {}),
    ...(settings.generate_audio !== undefined
      ? { generateAudio: settings.generate_audio }
      : {}),
    ...(settings.watermark !== undefined ? { watermark: settings.watermark } : {}),
    ...(settings.output_format ? { outputFormat: settings.output_format } : {}),
    ...(settings.seed !== undefined ? { seed: settings.seed } : {}),
  };
}

function resolveRepoPath(repoRoot: string, value: string): string {
  if (isAbsolute(value)) {
    throw new Error(`manifest paths must be repository-relative: ${value}`);
  }
  if (value.includes("://") || value.includes("..")) {
    throw new Error(`unsafe manifest path: ${value}`);
  }
  return resolve(repoRoot, value);
}

async function hashRequiredImage(
  field: string,
  path: string,
): Promise<{ readonly sha256: string; readonly bytes: number }> {
  try {
    return await sha256File(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(`${field} not found: ${path}`);
    }
    throw error;
  }
}

function repoRelative(repoRoot: string, path: string): string {
  return relative(repoRoot, path).split("\\").join("/");
}

function localUploadLabel(repoRoot: string, path: string): string {
  return `<local file upload: ${repoRelative(repoRoot, path)}>`;
}

function fileRef(
  repoRoot: string,
  path: string,
  hash: { readonly sha256: string; readonly bytes: number },
) {
  return {
    path: repoRelative(repoRoot, path),
    sha256: hash.sha256,
    bytes: hash.bytes,
  };
}

async function persist(
  prepared: PreparedExperiment,
  record: ExperimentRunRecord,
  manifestPath: string,
): Promise<void> {
  await mkdir(prepared.outputDir, { recursive: true });
  await writeFile(
    join(prepared.outputDir, "manifest.json"),
    await readFile(manifestPath),
  );
  await writeFile(
    join(prepared.outputDir, "run.json"),
    `${JSON.stringify(record, null, 2)}\n`,
  );
}

async function gitCommit(repoRoot: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

async function defaultFetch(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to download output: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
