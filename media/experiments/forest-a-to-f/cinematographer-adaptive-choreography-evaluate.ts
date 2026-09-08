/**
 * Experiment 04 Phase 3 only. Blind Shot Evaluator on newly generated clips.
 * Reuses Experiment 03 prompt and sampled-frame process unchanged.
 * Does not modify Experiment 03 files (parser is duplicated because that harness runs on import).
 */
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
  },
  {
    journeyId: "C-D",
    startId: "C",
    endId: "D",
    startMediaId: TRUSTED_MEDIA_IDS.forestAtoFC,
    endMediaId: TRUSTED_MEDIA_IDS.forestAtoFD,
  },
  {
    journeyId: "D-E",
    startId: "D",
    endId: "E",
    startMediaId: TRUSTED_MEDIA_IDS.forestAtoFD,
    endMediaId: TRUSTED_MEDIA_IDS.forestAtoFE,
  },
  {
    journeyId: "E-F",
    startId: "E",
    endId: "F",
    startMediaId: TRUSTED_MEDIA_IDS.forestAtoFE,
    endMediaId: TRUSTED_MEDIA_IDS.forestAtoFF,
  },
] as const;

const CONDITIONS = ["control", "treatment"] as const;
const EVALUATION_ORDER: ReadonlyArray<{
  readonly journeyId: (typeof PAIRS)[number]["journeyId"];
  readonly condition: (typeof CONDITIONS)[number];
}> = [
  { journeyId: "A-B", condition: "control" },
  { journeyId: "C-D", condition: "treatment" },
  { journeyId: "D-E", condition: "control" },
  { journeyId: "E-F", condition: "treatment" },
  { journeyId: "A-B", condition: "treatment" },
  { journeyId: "C-D", condition: "control" },
  { journeyId: "D-E", condition: "treatment" },
  { journeyId: "E-F", condition: "control" },
];

const EXPERIMENT_ID = "cinematographer-adaptive-choreography-04";
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
const generationRoot = join(evidenceRoot, "generation");
const evaluationRoot = join(evidenceRoot, "evaluations");

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

type ShotEvaluation = {
  readonly overallResult: string;
  readonly locomotion: string;
  readonly endpointArrival: string;
  readonly spatialSolidity: string;
  readonly transitionMode: string;
  readonly summary: string;
  readonly observations: readonly string[];
  readonly failureModes: readonly string[];
};

function parseShotEvaluation(text: string): ShotEvaluation {
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

async function evaluateClip(options: {
  readonly journeyId: (typeof PAIRS)[number]["journeyId"];
  readonly condition: (typeof CONDITIONS)[number];
  readonly token: string;
  readonly reasoning: ReplicateReasoningProvider;
}): Promise<ShotEvaluation> {
  const { journeyId, condition, token, reasoning } = options;
  const pair = PAIRS.find((item) => item.journeyId === journeyId);
  if (!pair) {
    throw new Error(`unknown pair ${journeyId}`);
  }
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
    throw new Error(`${journeyId} did not resolve to trusted files`);
  }
  const videoPath = join(generationRoot, journeyId, condition, "video.mp4");
  const durationSeconds = await probeDurationSeconds(videoPath);
  if (durationSeconds === null) {
    throw new Error(`${journeyId} ${condition} duration could not be probed`);
  }
  const timestamps = sampleTimestamps(durationSeconds);
  const clipDir = join(evaluationRoot, journeyId, condition);
  const samplesDir = join(clipDir, "samples");
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
    join(clipDir, "input.json"),
    {
      pair: pair.journeyId,
      condition,
      journeyId: pair.journeyId,
      startDestinationId: pair.startId,
      endDestinationId: pair.endId,
      startMediaId: pair.startMediaId,
      endMediaId: pair.endMediaId,
      startIntent,
      endIntent,
      story: FOREST_USER_PROMPT,
      blindedFromEvaluator: [
        "control versus treatment",
        "CM choreography",
        "experiment hypotheses",
        "Experiments 01-03 outcomes",
      ],
      startImage: {
        path: repoPath(resolved.start.image.path),
        sha256: await sha256File(resolved.start.image.path),
      },
      endImage: {
        path: repoPath(resolved.end.image.path),
        sha256: await sha256File(resolved.end.image.path),
      },
      video: {
        path: repoPath(videoPath),
        sha256: await sha256File(videoPath),
        durationSeconds,
      },
      representation: {
        kind: "sampled_frames",
        nativeVideoFailed:
          "Replicate google/gemini-3.1-pro videos[] rejected Buffer and File uploads (unknown mime type). Production ReasoningProvider is images-only. Did not switch models.",
        ffmpeg: "ffmpeg -y -i VIDEO -ss TIMESTAMP -frames:v 1 -q:v 2 SAMPLE.jpg",
        seek: "output seek (-ss after -i)",
        stepSeconds: SAMPLE_STEP_SECONDS,
        timestampsSeconds: timestamps,
        sampleFiles,
        imageOrder: [
          "canonical start",
          "canonical end",
          ...timestamps.map((t) => `shot t=${t.toFixed(2)}s`),
        ],
      },
    },
    token,
  );
  await writeJson(
    join(clipDir, "prompt.json"),
    {
      systemInstruction: EXPERIMENT_03_SYSTEM_INSTRUCTION,
      prompt,
    },
    token,
  );

  const attempts: Array<Record<string, unknown>> = [];
  let lastError: unknown;
  const shotImages = [
    resolved.start.image,
    resolved.end.image,
    ...sampleFiles.map((sample) => ({
      kind: "file" as const,
      path: resolve(repoRoot, sample.path),
    })),
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
        attempt,
        status: "succeeded",
        startedAt,
        completedAt,
        elapsedMs: result.elapsedMs,
        predictionId: result.predictionId,
        representation: "sampled_frames",
      });
      await writeFile(
        join(clipDir, "raw.txt"),
        result.text.endsWith("\n") ? result.text : `${result.text}\n`,
      );
      await writeJson(join(clipDir, "evaluation.json"), evaluation, token);
      await writeJson(
        join(clipDir, "meta.json"),
        {
          pair: pair.journeyId,
          condition,
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
      console.log(
        `${pair.journeyId} ${condition} ${evaluation.overallResult} ${result.predictionId}`,
      );
      return evaluation;
    } catch (error) {
      const completedAt = new Date().toISOString();
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
        completedAt,
        error: message,
        ...(predictionId ? { predictionId } : {}),
        retry: attempt < MAX_ATTEMPTS,
        representation: "sampled_frames",
      });
      console.error(
        `${pair.journeyId} ${condition} sampled-frame attempt ${attempt} failed: ${message}`,
      );
    }
  }

  await writeJson(
    join(clipDir, "meta.json"),
    {
      pair: pair.journeyId,
      condition,
      status: "failed",
      provider: "replicate",
      attempts,
      error: lastError instanceof Error ? lastError.message : String(lastError),
    },
    token,
  );
  throw lastError instanceof Error
    ? lastError
    : new Error(`evaluation failed ${journeyId} ${condition}`);
}

async function main(): Promise<void> {
  loadDotEnvLocal(repoRoot);
  const token = getOptionalEnv("REPLICATE_API_TOKEN");
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN is not set");
  }
  await mkdir(evaluationRoot, { recursive: true });
  const runStartedAt = new Date().toISOString();
  const results: Array<Record<string, unknown>> = [];
  const manifest = {
    experiment: EXPERIMENT_ID,
    phase: 3,
    role: "Shot Evaluator",
    protocol: "Experiment 03 unchanged; sampled frames; one run per clip",
    evaluatorBlindedFrom: [
      "whether a clip is control or treatment",
      "frozen CM choreography",
      "expected camera-path differences",
      "Experiments 01-03 assessments",
      "human clip judgments",
    ],
    pairs: PAIRS.map((pair) => pair.journeyId),
    evaluationOrder: EVALUATION_ORDER.map(
      (job, index) => `${index + 1}. ${job.journeyId} ${job.condition}`,
    ),
    provider: "replicate",
    model: GEMINI_31_PRO_MODEL,
    gemini: DEFAULT_GEMINI_31_PRO_SETTINGS,
    representation: {
      kind: "sampled_frames",
      nativeVideo:
        "attempted on Replicate Gemini videos[]; unknown mime type on Buffer and File uploads",
      productionReasoningProvider: "images-only",
      ffmpeg: "ffmpeg -y -i VIDEO -ss TIMESTAMP -frames:v 1 -q:v 2 SAMPLE.jpg",
      stepSeconds: SAMPLE_STEP_SECONDS,
      includesFirstAndLast: true,
    },
    gitCommit: await gitCommit(repoRoot),
    productionCinematographerUnchanged: true,
    experiment03Unchanged: true,
    startedAt: runStartedAt,
  };
  await writeJson(join(evaluationRoot, "manifest.json"), { ...manifest, results }, token);

  const reasoning = new ReplicateReasoningProvider();
  for (const job of EVALUATION_ORDER) {
    const evaluation = await evaluateClip({
      journeyId: job.journeyId,
      condition: job.condition,
      token,
      reasoning,
    });
    results.push({
      pair: job.journeyId,
      condition: job.condition,
      overallResult: evaluation.overallResult,
      locomotion: evaluation.locomotion,
      endpointArrival: evaluation.endpointArrival,
      spatialSolidity: evaluation.spatialSolidity,
      transitionMode: evaluation.transitionMode,
    });
    await writeJson(join(evaluationRoot, "manifest.json"), { ...manifest, results }, token);
  }

  await writeJson(
    join(evaluationRoot, "manifest.json"),
    {
      ...manifest,
      results,
      completedAt: new Date().toISOString(),
      status: "succeeded",
    },
    token,
  );
}

await main();
