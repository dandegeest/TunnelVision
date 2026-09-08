import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  DEFAULT_GEMINI_31_PRO_SETTINGS,
  GEMINI_31_PRO_MODEL,
  MediaGenerationError,
  sha256File,
} from "../../src/index.ts";
import { assertNoSecret } from "../../src/errors.ts";
import { loadDotEnvLocal, getOptionalEnv } from "../../src/config/environment.ts";
import { parseJsonObject } from "../../src/reasoning/json.ts";
import { ReplicateReasoningProvider } from "../../src/replicate/reasoning.ts";
import { gitCommit } from "../runner.ts";
import { cinematographerPairFromRequest } from "../../../web/trusted-media.ts";
import { TRUSTED_MEDIA_IDS } from "../../../web/src/project/trusted-media-id.ts";
import {
  EXPERIMENT_03_SYSTEM_INSTRUCTION,
  experiment03UserPrompt,
} from "./cinematographer-shot-evaluation-prompt.ts";

const execFileAsync = promisify(execFile);

const FOREST_USER_PROMPT =
  "Travel forward through this night forest and keep going. The journey should stay physically continuous, passing through openings and tunnels, and become stranger the deeper it goes.";

const FOREST_STORYBOARD_INTENTS = {
  A: "Night forest path toward the tree-trunk / root gateway in mist.",
  B: "Root-tunnel mouth. The dark opening is slightly right of center.",
  C: "Centered circular root tunnel.",
  D: "Root tunnel with a large glowing crystal cluster occupying the path.",
  E: "Dark reflective corridor toward a tall vertical portal.",
  F: "Open void / debris field around a central light.",
} as const;

const PAIRS = [
  {
    journeyId: "A-B",
    startId: "A",
    endId: "B",
    startMediaId: TRUSTED_MEDIA_IDS.forestAtoFA,
    endMediaId: TRUSTED_MEDIA_IDS.forestAtoFB,
    videoRelative: "camotion/integration/forest-a-to-f/videos/A-B.mp4",
  },
  {
    journeyId: "C-D",
    startId: "C",
    endId: "D",
    startMediaId: TRUSTED_MEDIA_IDS.forestAtoFC,
    endMediaId: TRUSTED_MEDIA_IDS.forestAtoFD,
    videoRelative: "camotion/integration/forest-a-to-f/videos/C-D.mp4",
  },
  {
    journeyId: "D-E",
    startId: "D",
    endId: "E",
    startMediaId: TRUSTED_MEDIA_IDS.forestAtoFD,
    endMediaId: TRUSTED_MEDIA_IDS.forestAtoFE,
    videoRelative: "camotion/integration/forest-a-to-f/videos/D-E.mp4",
  },
  {
    journeyId: "E-F",
    startId: "E",
    endId: "F",
    startMediaId: TRUSTED_MEDIA_IDS.forestAtoFE,
    endMediaId: TRUSTED_MEDIA_IDS.forestAtoFF,
    videoRelative: "camotion/integration/forest-a-to-f/videos/E-F.mp4",
  },
] as const;

const EXPERIMENT_ID = "cinematographer-shot-evaluation-03";
const MAX_ATTEMPTS = 2;
const MAX_TEXT = 800;
const MAX_LIST = 8;
const SAMPLE_STEP_SECONDS = 1;

const OVERALL = new Set(["successful_traversal", "partial_traversal", "failed_traversal"]);
const LOCOMOTION = new Set(["strong", "ambiguous", "absent"]);
const ARRIVAL = new Set(["strong", "approximate", "failed"]);
const SOLIDITY = new Set(["preserved", "compromised", "broken"]);
const TRANSITION = new Set([
  "traversal",
  "traversal_with_transformation",
  "morph",
  "dissolve",
  "replacement",
  "discontinuity",
  "other",
]);

const mediaDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(mediaDir, "../../..");
const evidenceRoot = join(
  repoRoot,
  "camotion/integration/forest-a-to-f/experiments",
  EXPERIMENT_ID,
);

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

function asNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new MediaGenerationError("generation_failed", `${name} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new MediaGenerationError("generation_failed", `${name} must not be empty`);
  }
  if (trimmed.length > MAX_TEXT) {
    throw new MediaGenerationError("generation_failed", `${name} is too long`);
  }
  return trimmed;
}

function asStringList(value: unknown, name: string, min: number): string[] {
  if (!Array.isArray(value)) {
    throw new MediaGenerationError("generation_failed", `${name} must be an array`);
  }
  if (value.length > MAX_LIST) {
    throw new MediaGenerationError("generation_failed", `${name} has too many items`);
  }
  if (value.length < min) {
    throw new MediaGenerationError("generation_failed", `${name} is too short`);
  }
  return value.map((item, index) => asNonEmptyString(item, `${name}[${index}]`));
}

export type ShotEvaluation = {
  readonly overallResult: string;
  readonly locomotion: string;
  readonly endpointArrival: string;
  readonly spatialSolidity: string;
  readonly transitionMode: string;
  readonly summary: string;
  readonly observations: readonly string[];
  readonly failureModes: readonly string[];
};

export function parseShotEvaluation(text: string): ShotEvaluation {
  const raw = parseJsonObject(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new MediaGenerationError("generation_failed", "Shot Evaluator JSON must be an object");
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.overallResult !== "string" || !OVERALL.has(record.overallResult)) {
    throw new MediaGenerationError("generation_failed", "overallResult is invalid");
  }
  if (typeof record.locomotion !== "string" || !LOCOMOTION.has(record.locomotion)) {
    throw new MediaGenerationError("generation_failed", "locomotion is invalid");
  }
  if (typeof record.endpointArrival !== "string" || !ARRIVAL.has(record.endpointArrival)) {
    throw new MediaGenerationError("generation_failed", "endpointArrival is invalid");
  }
  if (typeof record.spatialSolidity !== "string" || !SOLIDITY.has(record.spatialSolidity)) {
    throw new MediaGenerationError("generation_failed", "spatialSolidity is invalid");
  }
  if (typeof record.transitionMode !== "string" || !TRANSITION.has(record.transitionMode)) {
    throw new MediaGenerationError("generation_failed", "transitionMode is invalid");
  }
  return {
    overallResult: record.overallResult,
    locomotion: record.locomotion,
    endpointArrival: record.endpointArrival,
    spatialSolidity: record.spatialSolidity,
    transitionMode: record.transitionMode,
    summary: asNonEmptyString(record.summary, "summary"),
    observations: asStringList(record.observations, "observations", 1),
    failureModes: asStringList(record.failureModes, "failureModes", 0),
  };
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

function sampleTimestamps(durationSeconds: number): number[] {
  const times: number[] = [];
  for (let t = 0; t + 0.05 < durationSeconds; t += SAMPLE_STEP_SECONDS) {
    times.push(Number(t.toFixed(3)));
  }
  const last = Number(Math.max(0, durationSeconds - 0.05).toFixed(3));
  const previous = times[times.length - 1];
  if (previous === undefined || last - previous > 0.2) {
    times.push(last);
  }
  return times.slice(0, 8);
}

async function extractFrame(videoPath: string, seconds: number, dest: string): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    videoPath,
    "-ss",
    String(seconds),
    "-frames:v",
    "1",
    "-q:v",
    "2",
    dest,
  ]);
}

type Pair = (typeof PAIRS)[number];

async function evaluatePair(options: {
  readonly pair: Pair;
  readonly token: string;
  readonly reasoning: ReplicateReasoningProvider;
}): Promise<void> {
  const { pair, token, reasoning } = options;
  const startIntent = FOREST_STORYBOARD_INTENTS[pair.startId];
  const endIntent = FOREST_STORYBOARD_INTENTS[pair.endId];
  const resolved = cinematographerPairFromRequest(repoRoot, {
    startMediaId: pair.startMediaId,
    endMediaId: pair.endMediaId,
    startDestinationId: pair.startId,
    endDestinationId: pair.endId,
    startIntent,
    endIntent,
  });
  if (resolved.start.image.kind !== "file" || resolved.end.image.kind !== "file") {
    throw new Error(`${pair.journeyId} did not resolve to trusted files`);
  }
  const videoPath = resolve(repoRoot, pair.videoRelative);
  const durationSeconds = await probeDurationSeconds(videoPath);
  if (durationSeconds === null) {
    throw new Error(`${pair.journeyId} duration could not be probed`);
  }
  const timestamps = sampleTimestamps(durationSeconds);
  const pairDir = join(evidenceRoot, pair.journeyId);
  const samplesDir = join(pairDir, "samples");
  await mkdir(samplesDir, { recursive: true });
  const sampleFiles: Array<{ timestampSeconds: number; path: string; sha256: unknown }> = [];
  for (const [index, timestamp] of timestamps.entries()) {
    const filename = `frame-${String(index).padStart(2, "0")}-t${timestamp.toFixed(2).replace(".", "p")}.jpg`;
    const dest = join(samplesDir, filename);
    await extractFrame(videoPath, timestamp, dest);
    sampleFiles.push({
      timestampSeconds: timestamp,
      path: repoPath(dest),
      sha256: await sha256File(dest),
    });
  }
  const prompt = experiment03UserPrompt({
    journeyId: pair.journeyId,
    startId: pair.startId,
    endId: pair.endId,
    story: FOREST_USER_PROMPT,
    startIntent,
    endIntent,
    sampleTimestampsSeconds: timestamps,
  });
  await writeJson(
    join(pairDir, "input.json"),
    {
      pair: pair.journeyId,
      journeyId: pair.journeyId,
      startDestinationId: pair.startId,
      endDestinationId: pair.endId,
      startMediaId: pair.startMediaId,
      endMediaId: pair.endMediaId,
      startIntent,
      endIntent,
      story: FOREST_USER_PROMPT,
      startImage: {
        path: repoPath(resolved.start.image.path),
        sha256: await sha256File(resolved.start.image.path),
      },
      endImage: {
        path: repoPath(resolved.end.image.path),
        sha256: await sha256File(resolved.end.image.path),
      },
      video: {
        path: pair.videoRelative,
        sha256: await sha256File(videoPath),
        durationSeconds,
      },
      representation: {
        kind: "sampled_frames",
        nativeVideoFailed: "Replicate google/gemini-3.1-pro videos[] rejected Buffer and File uploads (unknown mime type). Production ReasoningProvider is images-only. Did not switch models.",
        ffmpeg: "ffmpeg -y -i VIDEO -ss TIMESTAMP -frames:v 1 -q:v 2 SAMPLE.jpg",
        seek: "output seek (-ss after -i)",
        stepSeconds: SAMPLE_STEP_SECONDS,
        timestampsSeconds: timestamps,
        sampleFiles,
        imageOrder: ["canonical start", "canonical end", ...timestamps.map((t) => `shot t=${t.toFixed(2)}s`)],
      },
    },
    token,
  );
  await writeJson(
    join(pairDir, "prompt.json"),
    {
      systemInstruction: EXPERIMENT_03_SYSTEM_INSTRUCTION,
      prompt,
    },
    token,
  );

  let priorAttempts: Array<Record<string, unknown>> = [];
  try {
    const previous = JSON.parse(await readFile(join(pairDir, "meta.json"), "utf8")) as {
      attempts?: Array<Record<string, unknown>>;
    };
    if (Array.isArray(previous.attempts)) {
      priorAttempts = previous.attempts;
    }
  } catch {
    priorAttempts = [];
  }
  const attempts: Array<Record<string, unknown>> = [...priorAttempts];
  let lastError: unknown;
  const shotImages = [
    resolved.start.image,
    resolved.end.image,
    ...sampleFiles.map((sample) => ({ kind: "file" as const, path: resolve(repoRoot, sample.path) })),
  ];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const startedAt = new Date().toISOString();
    try {
      const result = await reasoning.complete({
        systemInstruction: EXPERIMENT_03_SYSTEM_INSTRUCTION,
        prompt,
        images: shotImages,
      });
      const evaluation = parseShotEvaluation(result.text);
      const completedAt = new Date().toISOString();
      attempts.push({
        attempt: priorAttempts.length + attempt,
        status: "succeeded",
        startedAt,
        completedAt,
        elapsedMs: result.elapsedMs,
        predictionId: result.predictionId,
        representation: "sampled_frames",
      });
      await writeFile(join(pairDir, "raw.txt"), result.text.endsWith("\n") ? result.text : `${result.text}\n`);
      await writeJson(join(pairDir, "evaluation.json"), evaluation, token);
      await writeJson(
        join(pairDir, "meta.json"),
        {
          pair: pair.journeyId,
          status: "succeeded",
          provider: "replicate",
          model: result.model,
          modelVersion: result.modelVersion,
          predictionId: result.predictionId,
          elapsedMs: result.elapsedMs,
          startedAt,
          completedAt,
          representation: "sampled_frames",
          timestampsSeconds: timestamps,
          attempts,
        },
        token,
      );
      console.log(`${pair.journeyId} ${evaluation.overallResult} ${result.predictionId}`);
      return;
    } catch (error) {
      const completedAt = new Date().toISOString();
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const predictionId =
        error && typeof error === "object" && "predictionId" in error
          ? String((error as { predictionId?: unknown }).predictionId ?? "")
          : "";
      attempts.push({
        attempt: priorAttempts.length + attempt,
        status: "failed",
        startedAt,
        completedAt,
        error: message,
        ...(predictionId ? { predictionId } : {}),
        retry: attempt < MAX_ATTEMPTS,
        representation: "sampled_frames",
      });
      console.error(`${pair.journeyId} sampled-frame attempt ${attempt} failed: ${message}`);
    }
  }

  await writeJson(
    join(pairDir, "meta.json"),
    {
      pair: pair.journeyId,
      status: "failed",
      provider: "replicate",
      attempts,
      error: lastError instanceof Error ? lastError.message : String(lastError),
    },
    token,
  );
}

async function main(): Promise<void> {
  loadDotEnvLocal(repoRoot);
  const token = getOptionalEnv("REPLICATE_API_TOKEN");
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN is not set");
  }
  await mkdir(evidenceRoot, { recursive: true });
  const runStartedAt = new Date().toISOString();
  const manifest = {
    experiment: EXPERIMENT_ID,
    role: "Shot Evaluator",
    question:
      "Given generated Forest footage, can multimodal reasoning distinguish genuine camera travel from transformation, morph, dissolve, discontinuity, threshold traversal, and destination arrival?",
    pairs: PAIRS.map((pair) => pair.journeyId),
    provider: "replicate",
    model: GEMINI_31_PRO_MODEL,
    gemini: DEFAULT_GEMINI_31_PRO_SETTINGS,
    representation: {
      kind: "sampled_frames",
      nativeVideo: "attempted on Replicate Gemini videos[]; unknown mime type on Buffer and File uploads",
      productionReasoningProvider: "images-only",
      ffmpeg: "ffmpeg -y -i VIDEO -ss TIMESTAMP -frames:v 1 -q:v 2 SAMPLE.jpg",
      stepSeconds: SAMPLE_STEP_SECONDS,
      includesFirstAndLast: true,
    },
    gitCommit: await gitCommit(repoRoot),
    productionCinematographerUnchanged: true,
    experiment01Unchanged: true,
    experiment02Unchanged: true,
    startedAt: runStartedAt,
  };
  await writeJson(join(evidenceRoot, "manifest.json"), manifest, token);

  const reasoning = new ReplicateReasoningProvider();
  for (const pair of PAIRS) {
    await evaluatePair({ pair, token, reasoning });
  }

  await writeJson(
    join(evidenceRoot, "manifest.json"),
    {
      ...manifest,
      completedAt: new Date().toISOString(),
    },
    token,
  );
}

await main();
