/**
 * Experiment 04 Phase 2 only. Controlled Seedance generation.
 * Does not modify production Cinematographer, Camotion, Director, or Shot Evaluator.
 * Does not overwrite historical Forest clips or frozen Phase 1 choreography.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  MediaGenerationError,
  ReplicateMediaProvider,
  describeSeedance25Input,
  sha256File,
} from "../../src/index.ts";
import { assertNoSecret } from "../../src/errors.ts";
import { loadDotEnvLocal, getOptionalEnv } from "../../src/config/environment.ts";
import { gitCommit } from "../runner.ts";
import { FOREST_LOCOMOTION_BASELINE } from "./cinematographer-adaptive-choreography-prompt.ts";

const execFileAsync = promisify(execFile);

const EXPERIMENT_ID = "cinematographer-adaptive-choreography-04";
const VIDEO_MODEL = "bytedance/seedance-2.5";
const VIDEO_DURATION_SECONDS = 6;
const MAX_ATTEMPTS = 2;

const EXPECTED_SHOOTING_SHA256 = {
  A: "4ec3e341764888a215996d6503f263600f9a51f812dc7f0261e1391a8bb6d109",
  B: "ed30dcdf2a52e3b2fa7e4f199b184481d18fda449e957558dfd13130b9a03d8f",
  C: "a0ed546be775366aae29d8ba98780c250a9035b7ddd6d7c499a7f76e7f9a54a3",
  D: "e63078e78ec3a957c6aefb403ab86be8b8c1d2fe6a2966662ad57c665211c130",
  E: "b21c409ce02f787c53b8d52e52f706d734b27cbaafcdc2256d1d07c08d9c688c",
  F: "eaac7793e2206c4f67237ee039831d934235eb6f6b24c6d7031eef5fd718aecf",
} as const;

const FROZEN_ADDITIONS = {
  "A-B":
    "Track forward along the glowing stone path, pass between the large left root wall and the right tree trunk, and move through the misty root archway toward the dark tunnel.",
  "C-D":
    "Push straight forward down the center of the root tunnel, passing the glowing white mushrooms on the floor to approach the massive glowing crystal cluster directly ahead.",
  "D-E":
    "Approach the glowing crystal cluster and veer slightly right to pass closely alongside it. Allow the glowing facets to sweep past the lens in extreme foreground, transitioning the rough dirt environment into a smooth, dark, reflective corridor approaching a tall vertical light.",
  "E-F":
    "Move straight forward down the dark reflective corridor and pass directly through the tall, intensely bright vertical portal. Emerge into an expansive dark void, continuing forward through a field of floating rock debris toward a bright, distant central light.",
} as const;

const PAIR_SEEDS = {
  "A-B": 40104,
  "C-D": 40204,
  "D-E": 40304,
  "E-F": 40404,
} as const;

const SEEDANCE_SETTINGS = {
  resolution: "720p" as const,
  aspectRatio: "adaptive" as const,
  generateAudio: false,
  watermark: false,
  outputFormat: "mp4" as const,
};

const PAIRS = [
  { journeyId: "A-B" as const, startId: "A" as const, endId: "B" as const },
  { journeyId: "C-D" as const, startId: "C" as const, endId: "D" as const },
  { journeyId: "D-E" as const, startId: "D" as const, endId: "E" as const },
  { journeyId: "E-F" as const, startId: "E" as const, endId: "F" as const },
];

const GENERATION_ORDER: ReadonlyArray<{
  readonly journeyId: keyof typeof FROZEN_ADDITIONS;
  readonly condition: "control" | "treatment";
}> = [
  { journeyId: "A-B", condition: "control" },
  { journeyId: "A-B", condition: "treatment" },
  { journeyId: "C-D", condition: "treatment" },
  { journeyId: "C-D", condition: "control" },
  { journeyId: "D-E", condition: "control" },
  { journeyId: "D-E", condition: "treatment" },
  { journeyId: "E-F", condition: "treatment" },
  { journeyId: "E-F", condition: "control" },
];

const mediaDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(mediaDir, "../../..");
const evidenceRoot = join(
  repoRoot,
  "camotion/integration/forest-a-to-f/experiments",
  EXPERIMENT_ID,
);
const generationRoot = join(evidenceRoot, "generation");
const forestRoot = join(repoRoot, "camotion/integration/forest-a-to-f");

function repoPath(path: string): string {
  return relative(repoRoot, path).split("\\").join("/");
}

function assertSafe(payload: unknown, token: string | undefined): void {
  assertNoSecret(payload, token);
  const serialized = JSON.stringify(payload);
  if (serialized.includes("REPLICATE_API_TOKEN") || /r8_[A-Za-z0-9]{8,}/.test(serialized)) {
    throw new Error("refusing to write a secret into experiment evidence");
  }
}

async function writeJson(path: string, value: unknown, token: string | undefined): Promise<void> {
  assertSafe(value, token);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

async function download(url: string, path: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to download ${url}: ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  return bytes;
}

async function probeDurationSeconds(path: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      path,
    ]);
    const value = Number(stdout.trim());
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function isRetryableProviderFailure(error: unknown): boolean {
  if (!(error instanceof MediaGenerationError)) {
    return true;
  }
  return error.code === "provider_unavailable" || error.code === "generation_failed";
}

function reportedSeed(metadata: Readonly<Record<string, unknown>>): number | null {
  const value = metadata.seed;
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function treatmentPrompt(baseline: string, addition: string): string {
  return `${baseline}\n${addition}`;
}

async function loadFrozenAddition(journeyId: keyof typeof FROZEN_ADDITIONS): Promise<string> {
  const path = join(evidenceRoot, journeyId, "choreography.json");
  const parsed = JSON.parse(await readFile(path, "utf8")) as {
    segmentPromptAddition?: unknown;
  };
  if (typeof parsed.segmentPromptAddition !== "string") {
    throw new Error(`${journeyId} choreography.json missing segmentPromptAddition`);
  }
  const addition = parsed.segmentPromptAddition;
  const expected = FROZEN_ADDITIONS[journeyId];
  if (addition !== expected) {
    throw new Error(
      `${journeyId} frozen segmentPromptAddition does not match Phase 1 artifact`,
    );
  }
  return addition;
}

async function assertShootingFrames(): Promise<Record<string, { path: string; sha256: string; bytes: number }>> {
  const shooting: Record<string, { path: string; sha256: string; bytes: number }> = {};
  for (const id of ["A", "B", "C", "D", "E", "F"] as const) {
    const path = join(forestRoot, "shooting", `${id}.png`);
    const hashed = await sha256File(path);
    const expected = EXPECTED_SHOOTING_SHA256[id];
    if (hashed.sha256 !== expected) {
      throw new Error(
        `shooting/${id}.png sha256 ${hashed.sha256} does not match Forest evidence ${expected}`,
      );
    }
    shooting[id] = {
      path: repoPath(path),
      sha256: hashed.sha256,
      bytes: hashed.bytes,
    };
  }
  return shooting;
}

async function main(): Promise<void> {
  loadDotEnvLocal(repoRoot);
  const token = getOptionalEnv("REPLICATE_API_TOKEN");
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN is not set");
  }

  const baselineFromFile = (await readFile(join(forestRoot, "prompt.txt"), "utf8")).trim();
  if (baselineFromFile !== FOREST_LOCOMOTION_BASELINE) {
    throw new Error("prompt.txt does not match FOREST_LOCOMOTION_BASELINE");
  }

  const additions: Record<string, string> = {};
  for (const pair of PAIRS) {
    additions[pair.journeyId] = await loadFrozenAddition(pair.journeyId);
  }

  const shooting = await assertShootingFrames();
  await mkdir(generationRoot, { recursive: true });

  const runStartedAt = new Date().toISOString();
  const jobs: Array<Record<string, unknown>> = [];
  const manifestBase = {
    experiment: EXPERIMENT_ID,
    phase: 2,
    role: "controlled generation",
    question:
      "Does appending frozen CM segmentPromptAddition to the Forest locomotion baseline change generated camera movement versus baseline alone?",
    pairs: PAIRS.map((pair) => pair.journeyId),
    generationOrder: GENERATION_ORDER.map(
      (job, index) => `${index + 1}. ${job.journeyId} ${job.condition}`,
    ),
    provider: "replicate",
    model: VIDEO_MODEL,
    durationSeconds: VIDEO_DURATION_SECONDS,
    seedance: SEEDANCE_SETTINGS,
    seedProtocol: {
      schemaExposesSeed: true,
      sameSeedWithinPair: true,
      differentSeedPerPair: true,
      submitted: PAIR_SEEDS,
    },
    baselineSource: "camotion/integration/forest-a-to-f/prompt.txt",
    baseline: baselineFromFile,
    frozenAdditionsLoadedFrom: PAIRS.map(
      (pair) => `camotion/integration/forest-a-to-f/experiments/${EXPERIMENT_ID}/${pair.journeyId}/choreography.json`,
    ),
    shootingFrames: shooting,
    historicalForestVideosUntouched: true,
    productionCinematographerUnchanged: true,
    experiment03Unchanged: true,
    gitCommit: await gitCommit(repoRoot),
    startedAt: runStartedAt,
  };

  await writeJson(join(generationRoot, "manifest.json"), { ...manifestBase, jobs }, token);

  for (const [index, job] of GENERATION_ORDER.entries()) {
    const pair = PAIRS.find((item) => item.journeyId === job.journeyId);
    if (!pair) {
      throw new Error(`unknown pair ${job.journeyId}`);
    }
    const seed = PAIR_SEEDS[job.journeyId];
    const addition = additions[job.journeyId];
    const prompt =
      job.condition === "control"
        ? baselineFromFile
        : treatmentPrompt(baselineFromFile, addition);
    const startPath = join(forestRoot, "shooting", `${pair.startId}.png`);
    const endPath = join(forestRoot, "shooting", `${pair.endId}.png`);
    const destDir = join(generationRoot, job.journeyId, job.condition);
    const videoPath = join(destDir, "video.mp4");
    await mkdir(destDir, { recursive: true });
    await writeFile(join(destDir, "prompt.txt"), `${prompt}\n`);

    const seedance = { ...SEEDANCE_SETTINGS, seed };
    const request = {
      startImage: { kind: "file" as const, path: startPath },
      endImage: { kind: "file" as const, path: endPath },
      prompt,
      durationSeconds: VIDEO_DURATION_SECONDS,
    };
    const submitted = describeSeedance25Input(
      request,
      `<local file upload: ${repoPath(startPath)}>`,
      `<local file upload: ${repoPath(endPath)}>`,
      seedance,
    );

    const recordBase = {
      pair: job.journeyId,
      condition: job.condition,
      generationOrder: index + 1,
      startShooting: shooting[pair.startId],
      endShooting: shooting[pair.endId],
      prompt,
      segmentPromptAddition: job.condition === "treatment" ? addition : null,
      seedSubmitted: seed,
      settings: submitted,
      outputPath: repoPath(videoPath),
    };

    if (await fileExists(videoPath)) {
      const hashed = await sha256File(videoPath);
      const record = {
        ...recordBase,
        skipped: true,
        skipReason: "video already present; resume, not aesthetic retry",
        seedReported: null,
        durationSecondsProbed: await probeDurationSeconds(videoPath),
        ...hashed,
      };
      jobs.push(record);
      await writeJson(join(destDir, "generation.json"), record, token);
      await writeJson(
        join(generationRoot, "manifest.json"),
        { ...manifestBase, jobs },
        token,
      );
      console.log(
        `${index + 1}/8 ${job.journeyId} ${job.condition} exists, skipping generation`,
      );
      continue;
    }

    const provider = new ReplicateMediaProvider({
      model: VIDEO_MODEL,
      seedance,
    });
    const attempts: Array<Record<string, unknown>> = [];
    let generated = false;
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const startedAt = new Date().toISOString();
      try {
        const result = await provider.generateVideo(request);
        await download(result.outputUrl, videoPath);
        const hashed = await sha256File(videoPath);
        const completedAt = new Date().toISOString();
        attempts.push({
          attempt,
          status: "succeeded",
          startedAt,
          completedAt,
          predictionId: result.predictionId,
          elapsedMs: result.elapsedMs,
        });
        const record = {
          ...recordBase,
          skipped: false,
          provider: result.provider,
          model: result.model,
          modelVersion: result.modelVersion,
          predictionId: result.predictionId,
          seedReported: reportedSeed(result.metadata),
          outputUrl: result.outputUrl,
          startedAt: result.startedAt || startedAt,
          completedAt: result.completedAt || completedAt,
          elapsedMs: result.elapsedMs,
          durationSecondsRequested: VIDEO_DURATION_SECONDS,
          durationSecondsProbed: await probeDurationSeconds(videoPath),
          metadata: result.metadata,
          attempts,
          ...hashed,
        };
        jobs.push(record);
        await writeJson(join(destDir, "generation.json"), record, token);
        generated = true;
        lastError = undefined;
        console.log(
          `${index + 1}/8 ${job.journeyId} ${job.condition} ${result.predictionId} seed ${seed}→${record.seedReported}`,
        );
        break;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const predictionId =
          error && typeof error === "object" && "predictionId" in error
            ? String((error as { predictionId?: unknown }).predictionId ?? "")
            : "";
        attempts.push({
          attempt,
          status: "failed",
          startedAt,
          completedAt: new Date().toISOString(),
          error: message,
          ...(predictionId ? { predictionId } : {}),
          retry:
            attempt < MAX_ATTEMPTS &&
            (attempt === 1 ? isRetryableProviderFailure(error) : false),
        });
        console.error(
          `${index + 1}/8 ${job.journeyId} ${job.condition} attempt ${attempt} failed: ${message}`,
        );
        if (attempt === 1 && !isRetryableProviderFailure(error)) {
          break;
        }
      }
    }

    if (!generated) {
      const failure = {
        ...recordBase,
        skipped: false,
        status: "failed",
        attempts,
        error: lastError instanceof Error ? lastError.message : String(lastError),
      };
      jobs.push(failure);
      await writeJson(join(destDir, "generation.json"), failure, token);
      await writeJson(
        join(generationRoot, "manifest.json"),
        {
          ...manifestBase,
          jobs,
          completedAt: new Date().toISOString(),
          status: "failed",
        },
        token,
      );
      throw lastError instanceof Error
        ? lastError
        : new Error(`failed ${job.journeyId} ${job.condition}`);
    }

    await writeJson(join(generationRoot, "manifest.json"), { ...manifestBase, jobs }, token);
  }

  await writeJson(
    join(generationRoot, "manifest.json"),
    {
      ...manifestBase,
      jobs,
      completedAt: new Date().toISOString(),
      status: "succeeded",
    },
    token,
  );
  console.log(`wrote ${repoPath(join(generationRoot, "manifest.json"))}`);
}

await main();
