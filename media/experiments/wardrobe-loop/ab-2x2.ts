import { parseArgs } from "node:util";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  MediaGenerationError,
  ReplicateMediaProvider,
  describeSeedance25Input,
  sha256File,
  type MediaProvider,
  type VideoGenerationRequest,
} from "../../src/index.ts";
import { assertNoSecret } from "../../src/errors.ts";
import { loadDotEnvLocal, getOptionalEnv } from "../../src/config/environment.ts";
import { gitCommit } from "../runner.ts";
import { VIDEO_PROMPTS } from "./story.ts";

export const EXPERIMENT_ID = "ab-2x2-seedance";
export const SEED = 70;
export const VIDEO_DURATION_SECONDS = 6;
export const VIDEO_MODEL = "bytedance/seedance-2.5";

export const MINIMAL_PROMPT =
  "A continuous journey from a cozy attic bedroom, through the old wardrobe, and into the snowy winter world beyond.";

export const MOTION_PROMPT =
  "First-person camera physically walks steadily forward across the bedroom toward the open wardrobe. Pass completely between the wardrobe doors and between the hanging clothes. Continue physically forward through the deep dark passage beyond the wardrobe toward the snowy opening. Nearby furniture, door frames, hanging fabric and passage walls move past the camera with strong natural parallax. The camera never retreats or stops. This is one continuous forward journey through connected three-dimensional space, not a transformation between two images.";

export const SEEDANCE_SETTINGS = {
  resolution: "720p" as const,
  aspectRatio: "adaptive" as const,
  generateAudio: false,
  watermark: false,
  outputFormat: "mp4" as const,
  seed: SEED,
};

const PRISTINE_A = "camotion/integration/wardrobe-loop-01/canonical/A.png";
const PRISTINE_B = "camotion/integration/wardrobe-loop-01/canonical/B.png";
const CONDITIONED_A = "camotion/integration/wardrobe-loop-01/shooting/A-B/start.png";
const CONDITIONED_B = "camotion/integration/wardrobe-loop-01/shooting/A-B/end.png";

export const CONDITIONS = [
  {
    id: "01-pristine-minimal",
    filename: "01-pristine-minimal.mp4",
    endpoints: "pristine" as const,
    promptKind: "minimal" as const,
    startImage: PRISTINE_A,
    endImage: PRISTINE_B,
    prompt: MINIMAL_PROMPT,
  },
  {
    id: "02-pristine-motion",
    filename: "02-pristine-motion.mp4",
    endpoints: "pristine" as const,
    promptKind: "motion" as const,
    startImage: PRISTINE_A,
    endImage: PRISTINE_B,
    prompt: MOTION_PROMPT,
  },
  {
    id: "03-conditioned-minimal",
    filename: "03-conditioned-minimal.mp4",
    endpoints: "conditioned" as const,
    promptKind: "minimal" as const,
    startImage: CONDITIONED_A,
    endImage: CONDITIONED_B,
    prompt: MINIMAL_PROMPT,
  },
  {
    id: "04-conditioned-motion",
    filename: "04-conditioned-motion.mp4",
    endpoints: "conditioned" as const,
    promptKind: "motion" as const,
    startImage: CONDITIONED_A,
    endImage: CONDITIONED_B,
    prompt: MOTION_PROMPT,
  },
] as const;

export type ConditionSpec = (typeof CONDITIONS)[number];
export type EndpointKind = ConditionSpec["endpoints"];
export type PromptKind = ConditionSpec["promptKind"];

export type FileRef = {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
};

export type ConditionRecord = {
  readonly id: string;
  readonly filename: string;
  readonly endpoints: EndpointKind;
  readonly prompt_kind: PromptKind;
  readonly start_image: FileRef;
  readonly end_image: FileRef;
  readonly prompt: string;
  readonly seed_submitted: number;
  readonly seed_reported: number | null;
  readonly settings: Readonly<Record<string, unknown>>;
  readonly prediction_id: string | null;
  readonly output_url: string | null;
  readonly output_path: string | null;
  readonly status: "succeeded" | "failed" | "dry_run";
  readonly error: string | null;
  readonly error_code: string | null;
  readonly started_at: string;
  readonly completed_at: string;
  readonly elapsed_ms: number;
};

export type Ab2x2Manifest = {
  readonly experiment: string;
  readonly title: string;
  readonly source_shot: "A-B";
  readonly git_commit: string | null;
  readonly model: string;
  readonly seed: number;
  readonly shared_settings: Readonly<Record<string, unknown>>;
  readonly independent_variables: readonly ["endpoints", "prompt"];
  readonly conditions: readonly ConditionRecord[];
};

export type RunAb2x2Options = {
  readonly repoRoot: string;
  readonly execute: boolean;
  readonly outputDir?: string;
  readonly provider?: MediaProvider;
  readonly fetchOutput?: (url: string) => Promise<Buffer>;
  readonly now?: () => Date;
};

function repoPath(repoRoot: string, path: string): string {
  return relative(repoRoot, path).split("\\").join("/");
}

export function defaultOutputDir(repoRoot: string): string {
  return join(
    repoRoot,
    "camotion/integration/wardrobe-loop-01/experiments",
    EXPERIMENT_ID,
  );
}

export function assertMotionPromptMatchesIntegration(): void {
  if (MOTION_PROMPT !== VIDEO_PROMPTS["A-B"]) {
    throw new Error(
      "MOTION_PROMPT must match Integration Test 01 VIDEO_PROMPTS[A-B] exactly",
    );
  }
}

export async function hashRepoFile(
  repoRoot: string,
  relativePath: string,
): Promise<FileRef> {
  const path = resolve(repoRoot, relativePath);
  const hashed = await sha256File(path);
  const info = await stat(path);
  return {
    path: relativePath,
    sha256: hashed.sha256,
    bytes: info.size,
  };
}

function videoRequest(
  repoRoot: string,
  condition: ConditionSpec,
): VideoGenerationRequest {
  return {
    startImage: { kind: "file", path: resolve(repoRoot, condition.startImage) },
    endImage: { kind: "file", path: resolve(repoRoot, condition.endImage) },
    prompt: condition.prompt,
    durationSeconds: VIDEO_DURATION_SECONDS,
  };
}

export function submittedSettings(
  repoRoot: string,
  condition: ConditionSpec,
): Record<string, unknown> {
  return describeSeedance25Input(
    videoRequest(repoRoot, condition),
    `<local file upload: ${condition.startImage}>`,
    `<local file upload: ${condition.endImage}>`,
    SEEDANCE_SETTINGS,
  );
}

function comparableSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const { prompt, image, last_frame_image, ...rest } = settings;
  void prompt;
  void image;
  void last_frame_image;
  return rest;
}

export function settingsDifferOnlyByIndependentVariables(
  records: readonly Pick<ConditionRecord, "settings">[],
): boolean {
  if (records.length === 0) {
    return true;
  }
  const [first, ...rest] = records;
  const expected = JSON.stringify(comparableSettings(first.settings as Record<string, unknown>));
  return rest.every(
    (record) =>
      JSON.stringify(comparableSettings(record.settings as Record<string, unknown>)) ===
      expected,
  );
}

function assertSafe(payload: unknown, token: string | undefined): void {
  assertNoSecret(payload, token);
  const serialized = JSON.stringify(payload);
  if (serialized.includes("REPLICATE_API_TOKEN") || /r8_[A-Za-z0-9]{8,}/.test(serialized)) {
    throw new Error("refusing to write API token into artifacts");
  }
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to download ${url}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function reportedSeed(metadata: Readonly<Record<string, unknown>>): number | null {
  const value = metadata.seed;
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

export async function runAb2x2(options: RunAb2x2Options): Promise<Ab2x2Manifest> {
  assertMotionPromptMatchesIntegration();
  const outputDir = options.outputDir ?? defaultOutputDir(options.repoRoot);
  await mkdir(outputDir, { recursive: true });
  const token = getOptionalEnv("REPLICATE_API_TOKEN");
  const provider =
    options.provider ??
    new ReplicateMediaProvider({
      model: VIDEO_MODEL,
      seedance: SEEDANCE_SETTINGS,
    });
  const fetchOutput = options.fetchOutput ?? download;
  const now = options.now ?? (() => new Date());
  const commit = await gitCommit(options.repoRoot);
  const conditions: ConditionRecord[] = [];

  for (const condition of CONDITIONS) {
    const startImage = await hashRepoFile(options.repoRoot, condition.startImage);
    const endImage = await hashRepoFile(options.repoRoot, condition.endImage);
    const settings = submittedSettings(options.repoRoot, condition);
    const outputPath = join(outputDir, condition.filename);
    const startedAt = now();

    if (!options.execute) {
      const completedAt = now();
      conditions.push({
        id: condition.id,
        filename: condition.filename,
        endpoints: condition.endpoints,
        prompt_kind: condition.promptKind,
        start_image: startImage,
        end_image: endImage,
        prompt: condition.prompt,
        seed_submitted: SEED,
        seed_reported: null,
        settings,
        prediction_id: null,
        output_url: null,
        output_path: repoPath(options.repoRoot, outputPath),
        status: "dry_run",
        error: null,
        error_code: null,
        started_at: startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        elapsed_ms: 0,
      });
      continue;
    }

    try {
      const result = await provider.generateVideo(
        videoRequest(options.repoRoot, condition),
      );
      const bytes = await fetchOutput(result.outputUrl);
      await writeFile(outputPath, bytes);
      const completedAt = now();
      conditions.push({
        id: condition.id,
        filename: condition.filename,
        endpoints: condition.endpoints,
        prompt_kind: condition.promptKind,
        start_image: startImage,
        end_image: endImage,
        prompt: condition.prompt,
        seed_submitted: SEED,
        seed_reported: reportedSeed(result.metadata),
        settings,
        prediction_id: result.predictionId,
        output_url: result.outputUrl,
        output_path: repoPath(options.repoRoot, outputPath),
        status: "succeeded",
        error: null,
        error_code: null,
        started_at: result.startedAt || startedAt.toISOString(),
        completed_at: result.completedAt || completedAt.toISOString(),
        elapsed_ms: result.elapsedMs,
      });
    } catch (error) {
      const completedAt = now();
      const mediaError = error instanceof MediaGenerationError ? error : null;
      conditions.push({
        id: condition.id,
        filename: condition.filename,
        endpoints: condition.endpoints,
        prompt_kind: condition.promptKind,
        start_image: startImage,
        end_image: endImage,
        prompt: condition.prompt,
        seed_submitted: SEED,
        seed_reported: null,
        settings,
        prediction_id: mediaError?.predictionId ?? null,
        output_url: null,
        output_path: null,
        status: "failed",
        error: mediaError
          ? mediaError.providerMessage ?? mediaError.message
          : error instanceof Error
            ? error.message
            : String(error),
        error_code: mediaError?.code ?? "generation_failed",
        started_at: startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        elapsed_ms: completedAt.getTime() - startedAt.getTime(),
      });
    }
  }

  const manifest: Ab2x2Manifest = {
    experiment: EXPERIMENT_ID,
    title: "Wardrobe Loop A→B Seedance 2×2 (pristine/conditioned × minimal/motion)",
    source_shot: "A-B",
    git_commit: commit,
    model: VIDEO_MODEL,
    seed: SEED,
    shared_settings: {
      duration: VIDEO_DURATION_SECONDS,
      resolution: SEEDANCE_SETTINGS.resolution,
      aspect_ratio: SEEDANCE_SETTINGS.aspectRatio,
      generate_audio: SEEDANCE_SETTINGS.generateAudio,
      watermark: SEEDANCE_SETTINGS.watermark,
      output_format: SEEDANCE_SETTINGS.outputFormat,
      seed: SEEDANCE_SETTINGS.seed,
    },
    independent_variables: ["endpoints", "prompt"],
    conditions,
  };
  assertSafe(manifest, token);
  await writeFile(join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

async function main(): Promise<void> {
  const mediaDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(mediaDir, "..", "..", "..");
  const { values } = parseArgs({
    options: {
      execute: { type: "boolean", default: false },
    },
  });
  loadDotEnvLocal(repoRoot);
  const execute = Boolean(values.execute);
  if (execute && !getOptionalEnv("REPLICATE_API_TOKEN")) {
    throw new Error("REPLICATE_API_TOKEN is not set");
  }
  console.log(
    execute
      ? `Executing ${EXPERIMENT_ID} sequentially (seed ${SEED}, no retries)`
      : `Dry-run ${EXPERIMENT_ID} (pass --execute for paid Seedance calls)`,
  );
  const manifest = await runAb2x2({ repoRoot, execute });
  const outputDir = defaultOutputDir(repoRoot);
  console.log(`manifest: ${repoPath(repoRoot, join(outputDir, "manifest.json"))}`);
  for (const condition of manifest.conditions) {
    console.log(
      [
        condition.id,
        condition.status,
        `prediction=${condition.prediction_id ?? "none"}`,
        `seed_submitted=${condition.seed_submitted}`,
        `seed_reported=${condition.seed_reported ?? "none"}`,
        condition.output_path ?? "no output",
      ].join("  "),
    );
  }
  if (manifest.conditions.some((condition) => condition.status === "failed")) {
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  await main();
}
