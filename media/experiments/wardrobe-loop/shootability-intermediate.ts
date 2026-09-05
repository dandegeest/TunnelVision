import { parseArgs } from "node:util";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  MediaGenerationError,
  ReplicateMediaProvider,
  ReplicateReasoningProvider,
  describeFlux11ProUltraInput,
  describeSeedance25Input,
  parseJsonObject,
  sha256File,
  type MediaProvider,
  type ReasoningProvider,
  type VideoGenerationRequest,
} from "../../src/index.ts";
import { assertNoSecret } from "../../src/errors.ts";
import { isApproximately16x9, pngDimensions } from "../../src/image-file.ts";
import { loadDotEnvLocal, getOptionalEnv } from "../../src/config/environment.ts";
import { gitCommit } from "../runner.ts";
import { IMAGE_MODEL, SHARED_VISUAL_LANGUAGE, VIDEO_PROMPTS } from "./story.ts";
import {
  ADAPTIVE_STRENGTHS,
  EXPECTED_CANONICAL_SHA256,
  INTEGRATION_ROOT,
  STRENGTH_BY_LABEL,
  coerceAllowedStrength,
  hashRepoFile,
  isAllowedStrength,
  labelForStrength,
  seedanceSettingsForSeed,
  type AdaptiveStrength,
  type FileRef,
  type StrengthLabel,
} from "./scene-aware-strength.ts";

const execFileAsync = promisify(execFile);

export const EXPERIMENT_ID = "shootability-intermediate-volume";
export const VIDEO_DURATION_SECONDS = 6;
export const VIDEO_MODEL = "bytedance/seedance-2.5";
export const REASONING_MODEL = "google/gemini-3.1-pro";
export const X_CANONICAL_SEED = 10106;
export const DIRECT_SEED = 90;
export const EX_SEED = 90;
export const XA_SEED = 91;

export type RepairShotId = "E-A" | "E-X" | "X-A";
export type ShootabilityDecision = "SHOOTABLE" | "NEEDS_INTERMEDIATE";
export type LegDecision = "SHOOTABLE" | "NOT_SHOOTABLE";
export type StopReason =
  | "none"
  | "direct_declared_shootable"
  | "leg_not_shootable"
  | "incomplete";

export const VIDEO_GENERATIONS = [
  {
    id: "01-E-A-direct",
    filename: "01-E-A-direct.mp4",
    shot: "E-A" as const,
    seed: DIRECT_SEED,
  },
  {
    id: "02-E-X",
    filename: "02-E-X.mp4",
    shot: "E-X" as const,
    seed: EX_SEED,
  },
  {
    id: "03-X-A",
    filename: "03-X-A.mp4",
    shot: "X-A" as const,
    seed: XA_SEED,
  },
] as const;

export const CANONICAL_PATHS = {
  E: `${INTEGRATION_ROOT}/canonical/E.png`,
  A: `${INTEGRATION_ROOT}/canonical/A.png`,
} as const;

export const HISTORICAL_E_A = {
  startPlan: `${INTEGRATION_ROOT}/plans/E-A.json`,
  endPlan: `${INTEGRATION_ROOT}/shooting/E-A/end-plan.json`,
  reasoning: `${INTEGRATION_ROOT}/shooting/E-A/reasoning.json`,
  startShooting: `${INTEGRATION_ROOT}/shooting/E-A/start.png`,
  endShooting: `${INTEGRATION_ROOT}/shooting/E-A/end.png`,
  video: `${INTEGRATION_ROOT}/videos/E-A.mp4`,
  prompt: VIDEO_PROMPTS["E-A"],
} as const;

export type Stage1Record = {
  readonly frozen_before_generation: true;
  readonly frozen_at: string;
  readonly decision: ShootabilityDecision;
  readonly reasoning: string;
  readonly model: string;
  readonly prediction_id: string | null;
  readonly source: "reasoning" | "injected" | "existing_file";
  readonly image_e: FileRef;
  readonly image_a: FileRef;
  readonly plans_used: readonly string[];
  readonly raw_text: string | null;
};

export type Stage2Record = {
  readonly frozen_before_x_generation: true;
  readonly frozen_at: string;
  readonly camera_position: string;
  readonly threshold_crossed: string;
  readonly remains_ahead: string;
  readonly geometry_from_e: string;
  readonly geometry_from_a: string;
  readonly foreground: readonly string[];
  readonly route: string;
  readonly why_ex_shootable: string;
  readonly why_xa_shootable: string;
  readonly image_prompt: string;
  readonly model: string;
  readonly prediction_id: string | null;
  readonly source: "reasoning" | "injected" | "existing_file";
  readonly raw_text: string | null;
};

export type Stage3Record = {
  readonly frozen_before_video: true;
  readonly frozen_at: string;
  readonly x_image: FileRef;
  readonly e_to_x: { readonly decision: LegDecision; readonly reasoning: string };
  readonly x_to_a: { readonly decision: LegDecision; readonly reasoning: string };
  readonly model: string;
  readonly prediction_id: string | null;
  readonly source: "reasoning" | "injected" | "existing_file";
  readonly raw_text: string | null;
};

export type ShotCinematography = {
  readonly shot: RepairShotId;
  readonly route: string;
  readonly prompt: string;
  readonly start_canonical: "E" | "X" | "A";
  readonly end_canonical: "E" | "X" | "A";
  readonly start_strength: AdaptiveStrength;
  readonly end_strength: AdaptiveStrength;
  readonly start_label: StrengthLabel;
  readonly end_label: StrengthLabel;
  readonly start_strength_reasoning: string;
  readonly end_strength_reasoning: string;
  readonly start_plan: Record<string, unknown>;
  readonly end_plan: Record<string, unknown>;
};

export type Stage4Record = {
  readonly frozen_before_video: true;
  readonly frozen_at: string;
  readonly shots: Record<RepairShotId, ShotCinematography>;
};

export type GenerationRecord = {
  readonly id: string;
  readonly filename: string;
  readonly shot: RepairShotId;
  readonly start_strength: number;
  readonly end_strength: number;
  readonly start_image: FileRef;
  readonly end_image: FileRef;
  readonly prompt: string;
  readonly seed_submitted: number;
  readonly seed_reported: number | null;
  readonly settings: Readonly<Record<string, unknown>>;
  readonly prediction_id: string | null;
  readonly output_path: string | null;
  readonly status: "succeeded" | "failed" | "dry_run" | "skipped" | "not_attempted";
  readonly retry_count: number;
  readonly error: string | null;
};

export type ExperimentManifest = {
  readonly experiment: string;
  readonly git_commit: string | null;
  readonly stop_reason: StopReason;
  readonly stage1: Stage1Record;
  readonly stage2: Stage2Record | null;
  readonly x_generation: Record<string, unknown> | null;
  readonly stage3: Stage3Record | null;
  readonly stage4: Stage4Record | null;
  readonly generations: readonly GenerationRecord[];
  readonly assembly_path: string | null;
};

export type RunOptions = {
  readonly repoRoot: string;
  readonly execute: boolean;
  readonly outputDir?: string;
  readonly reasoning?: ReasoningProvider;
  readonly imageProvider?: MediaProvider;
  readonly provider?: MediaProvider;
  readonly createVideoProvider?: (seed: number) => MediaProvider;
  readonly stage1?: () => Promise<Pick<Stage1Record, "decision" | "reasoning" | "model" | "prediction_id" | "source" | "raw_text">>;
  readonly stage2?: () => Promise<Omit<Stage2Record, "frozen_before_x_generation" | "frozen_at">>;
  readonly stage3?: (xImage: FileRef) => Promise<Omit<Stage3Record, "frozen_before_video" | "frozen_at" | "x_image">>;
  readonly stage4?: () => Promise<Record<RepairShotId, ShotCinematography>>;
  readonly prepareEndpoints?: (
    shot: RepairShotId,
    cine: ShotCinematography,
  ) => Promise<{ startImage: string; endImage: string }>;
  readonly fetchOutput?: (url: string) => Promise<Buffer>;
  readonly now?: () => Date;
};

function repoPath(repoRoot: string, path: string): string {
  return relative(repoRoot, path).split("\\").join("/");
}

export function defaultOutputDir(repoRoot: string): string {
  return join(repoRoot, INTEGRATION_ROOT, "experiments", EXPERIMENT_ID);
}

export function assertExperimentContract(): void {
  if (VIDEO_GENERATIONS.length !== 3) {
    throw new Error("expected exactly three video generations");
  }
  if (VIDEO_GENERATIONS[0].seed !== 90 || VIDEO_GENERATIONS[1].seed !== 90 || VIDEO_GENERATIONS[2].seed !== 91) {
    throw new Error("expected seeds 90 / 90 / 91");
  }
  if (VIDEO_GENERATIONS.some((generation) => !["E-A", "E-X", "X-A"].includes(generation.shot))) {
    throw new Error("only E-A, E-X, and X-A are allowed");
  }
  if (ADAPTIVE_STRENGTHS.length !== 3) {
    throw new Error("Phase 1 strength vocabulary must remain {.02,.04,.08}");
  }
}

export function parseShootabilityDecision(text: string): {
  readonly decision: ShootabilityDecision;
  readonly reasoning: string;
} {
  const raw = parseJsonObject(text);
  if (!raw || typeof raw !== "object") {
    throw new Error("shootability output was not a JSON object");
  }
  const record = raw as Record<string, unknown>;
  const decision = record.decision;
  if (decision !== "SHOOTABLE" && decision !== "NEEDS_INTERMEDIATE") {
    throw new Error("shootability decision must be SHOOTABLE or NEEDS_INTERMEDIATE");
  }
  const reasoning = typeof record.reasoning === "string" ? record.reasoning.trim() : "";
  if (!reasoning) {
    throw new Error("shootability reasoning is required");
  }
  return { decision, reasoning };
}

export function parseXSpecification(text: string): Omit<
  Stage2Record,
  "frozen_before_x_generation" | "frozen_at" | "model" | "prediction_id" | "source" | "raw_text"
> {
  const raw = parseJsonObject(text);
  if (!raw || typeof raw !== "object") {
    throw new Error("X specification was not a JSON object");
  }
  const record = raw as Record<string, unknown>;
  const required = [
    "camera_position",
    "threshold_crossed",
    "remains_ahead",
    "geometry_from_e",
    "geometry_from_a",
    "route",
    "why_ex_shootable",
    "why_xa_shootable",
    "image_prompt",
  ] as const;
  const strings = {} as Record<(typeof required)[number], string>;
  for (const key of required) {
    const value = record[key];
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`X specification is missing ${key}`);
    }
    strings[key] = value.trim();
  }
  const foreground = Array.isArray(record.foreground)
    ? record.foreground.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  if (strings.image_prompt.length < 80) {
    throw new Error("X image_prompt is too short to freeze as a canonical prompt");
  }
  return { ...strings, foreground };
}

export function parseLegReview(text: string): {
  readonly e_to_x: { readonly decision: LegDecision; readonly reasoning: string };
  readonly x_to_a: { readonly decision: LegDecision; readonly reasoning: string };
} {
  const raw = parseJsonObject(text);
  if (!raw || typeof raw !== "object") {
    throw new Error("actual-X review was not a JSON object");
  }
  const record = raw as Record<string, unknown>;
  const parseLeg = (key: string) => {
    const value = record[key];
    if (!value || typeof value !== "object") {
      throw new Error(`actual-X review is missing ${key}`);
    }
    const row = value as Record<string, unknown>;
    if (row.decision !== "SHOOTABLE" && row.decision !== "NOT_SHOOTABLE") {
      throw new Error(`${key}.decision must be SHOOTABLE or NOT_SHOOTABLE`);
    }
    const reasoning = typeof row.reasoning === "string" ? row.reasoning.trim() : "";
    if (!reasoning) {
      throw new Error(`${key}.reasoning is required`);
    }
    return { decision: row.decision, reasoning };
  };
  return {
    e_to_x: parseLeg("E-X"),
    x_to_a: parseLeg("X-A"),
  };
}

function parseStrengthChoice(
  value: unknown,
  name: string,
): { strength: AdaptiveStrength; label: StrengthLabel; reasoning: string } {
  if (!value || typeof value !== "object") {
    throw new Error(`missing ${name}`);
  }
  const row = value as Record<string, unknown>;
  const reasoning = typeof row.reasoning === "string" ? row.reasoning.trim() : "";
  if (!reasoning) {
    throw new Error(`${name} reasoning is required`);
  }
  const labelRaw = typeof row.label === "string" ? row.label.trim().toUpperCase() : null;
  const strengthRaw = row.strength;
  let strength: AdaptiveStrength;
  if (labelRaw === "LIGHT" || labelRaw === "MEDIUM" || labelRaw === "STRONG") {
    strength = STRENGTH_BY_LABEL[labelRaw];
    if (typeof strengthRaw === "number" && isAllowedStrength(strengthRaw) && coerceAllowedStrength(strengthRaw) !== strength) {
      throw new Error(`${name} label/strength conflict`);
    }
    if (typeof strengthRaw === "number" && !isAllowedStrength(strengthRaw)) {
      throw new Error(`${name} strength is not in {0.02, 0.04, 0.08}`);
    }
  } else if (typeof strengthRaw === "number" && isAllowedStrength(strengthRaw)) {
    strength = coerceAllowedStrength(strengthRaw);
  } else {
    throw new Error(`${name} has no valid LIGHT/MEDIUM/STRONG choice`);
  }
  return { strength, label: labelForStrength(strength), reasoning };
}

function asFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a number`);
  }
  return value;
}

function inUnitInterval(value: number, name: string): number {
  if (value < 0 || value > 1) {
    throw new Error(`${name} must be in [0, 1]`);
  }
  return value;
}

function parsePoint(value: unknown, name: string): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`${name} must be [x, y]`);
  }
  return [
    inUnitInterval(asFiniteNumber(value[0], `${name}[0]`), `${name}[0]`),
    inUnitInterval(asFiniteNumber(value[1], `${name}[1]`), `${name}[1]`),
  ];
}

function parseBBox(value: unknown, name: string): [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new Error(`${name} must be [left, top, right, bottom]`);
  }
  const box = [
    inUnitInterval(asFiniteNumber(value[0], `${name}[0]`), `${name}[0]`),
    inUnitInterval(asFiniteNumber(value[1], `${name}[1]`), `${name}[1]`),
    inUnitInterval(asFiniteNumber(value[2], `${name}[2]`), `${name}[2]`),
    inUnitInterval(asFiniteNumber(value[3], `${name}[3]`), `${name}[3]`),
  ] as [number, number, number, number];
  if (!(box[0] < box[2]) || !(box[1] < box[3])) {
    throw new Error(`${name} must have left < right and top < bottom`);
  }
  return box;
}

function parsePlanSide(value: unknown, side: string): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error(`missing ${side} plan`);
  }
  const record = value as Record<string, unknown>;
  const destination = record.destination as Record<string, unknown> | undefined;
  const camera = record.camera as Record<string, unknown> | undefined;
  if (!destination || !camera) {
    throw new Error(`missing ${side} destination or camera`);
  }
  const strengthChoice = parseStrengthChoice(record.exposure ?? record.strength, `${side}.exposure`);
  return {
    version: 1,
    camera: {
      vanishing_point: parsePoint(camera.vanishing_point, `${side}.camera.vanishing_point`),
      forward: 1,
    },
    destination: {
      point: parsePoint(destination.point, `${side}.destination.point`),
      protect: destination.protect === undefined ? true : Boolean(destination.protect),
      bbox: parseBBox(destination.bbox, `${side}.destination.bbox`),
    },
    exposure: {
      strength: strengthChoice.strength,
      samples: 16,
    },
    _strength_meta: strengthChoice,
  };
}

export function parseShotCinematography(
  text: string,
  shot: RepairShotId,
  startCanonical: "E" | "X" | "A",
  endCanonical: "E" | "X" | "A",
): ShotCinematography {
  const raw = parseJsonObject(text);
  if (!raw || typeof raw !== "object") {
    throw new Error(`${shot} cinematography was not JSON`);
  }
  const record = raw as Record<string, unknown>;
  const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
  const route = typeof record.route === "string" ? record.route.trim() : "";
  if (!prompt || !route) {
    throw new Error(`${shot} is missing route or locomotion prompt`);
  }
  const start = parsePlanSide(record.start, `${shot}.start`);
  const end = parsePlanSide(record.end, `${shot}.end`);
  const startMeta = start._strength_meta as ReturnType<typeof parseStrengthChoice>;
  const endMeta = end._strength_meta as ReturnType<typeof parseStrengthChoice>;
  const { _strength_meta: _s, ...startPlan } = start;
  const { _strength_meta: _e, ...endPlan } = end;
  void _s;
  void _e;
  return {
    shot,
    route,
    prompt,
    start_canonical: startCanonical,
    end_canonical: endCanonical,
    start_strength: startMeta.strength,
    end_strength: endMeta.strength,
    start_label: startMeta.label,
    end_label: endMeta.label,
    start_strength_reasoning: startMeta.reasoning,
    end_strength_reasoning: endMeta.reasoning,
    start_plan: startPlan,
    end_plan: endPlan,
  };
}

export function assertCanGenerateX(stage1: Stage1Record): void {
  if (stage1.decision !== "NEEDS_INTERMEDIATE") {
    throw new Error("X cannot be generated unless Stage 1 decision is NEEDS_INTERMEDIATE");
  }
}

export function assertCanGenerateVideos(stage3: Stage3Record): void {
  if (stage3.e_to_x.decision !== "SHOOTABLE" || stage3.x_to_a.decision !== "SHOOTABLE") {
    throw new Error("repaired-route videos require both legs SHOOTABLE");
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
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

async function readJsonFile<T>(path: string): Promise<T | null> {
  if (!(await fileExists(path))) {
    return null;
  }
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeJson(path: string, payload: unknown, token: string | undefined): Promise<void> {
  assertSafe(payload, token);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`);
}

const STAGE1_SYSTEM = `You are the Cinematographer for TunnelVision.

You inspect two independently generated first-person canonical stills and judge whether the requested camera move can be photographed as one continuous physical first-person traversal while preserving both endpoint states.

You do not generate images or video. Reason from the ACTUAL compositions you see.

A destination object is not automatically enough. Ask whether there is traversable intermediate spatial volume — somewhere physically plausible for the camera to exist between the two sets.

Return ONLY one JSON object:
{
  "decision": "SHOOTABLE" | "NEEDS_INTERMEDIATE",
  "reasoning": "<concise image-grounded reasoning>"
}

SHOOTABLE means E→A can plausibly be filmed as one continuous 6-second first-person move.
NEEDS_INTERMEDIATE means the requested direct transition lacks enough connected traversable volume / threshold depth / implied intermediate place.

Do not assume the answer. Do not mention provider knobs.`;

function stage1UserPrompt(plans: unknown): string {
  return [
    "Image 1 is canonical E (start). Image 2 is canonical A (end).",
    "Requested move: first-person travel from the luminous cavern with an ordinary bedroom door to the cozy attic bedroom containing the wardrobe.",
    "Journey context: passing through that cavern door is intended to return the viewer to the original bedroom.",
    "",
    "Existing Integration Test 01 CameraMotionPlan JSON (geometry context only; do not treat it as a shootability verdict):",
    JSON.stringify(plans, null, 2),
    "",
    "Can E→A plausibly be photographed as one continuous physical first-person traversal while preserving these authoritative endpoint states?",
    "Return JSON only.",
  ].join("\n");
}

const STAGE2_SYSTEM = `You are the Cinematographer for TunnelVision.

The direct E→A move was judged NEEDS_INTERMEDIATE. Specify one intermediate canonical camera position X that makes E→X and X→A independently shootable.

X is a CAMERA POSITION along a continuous physical route, not a 50/50 morph or aesthetic blend.

Return ONLY JSON:
{
  "camera_position": "<where the camera physically is>",
  "threshold_crossed": "<what has already been crossed>",
  "remains_ahead": "<what remains ahead>",
  "geometry_from_e": "<what from E may still be visible>",
  "geometry_from_a": "<what from A may begin to be visible>",
  "foreground": ["<parallax object>", "..."],
  "route": "<physical route through the scene>",
  "why_ex_shootable": "<why E→X is filmable>",
  "why_xa_shootable": "<why X→A is filmable>",
  "image_prompt": "<complete first-person 16:9 canonical still prompt for X>"
}

image_prompt must describe one physically believable first-person place, cinematic dark-fantasy realism, no people, no text, 16:9. Do not ask for a surreal blend.`;

const STAGE3_SYSTEM = `You are the Cinematographer for TunnelVision.

You inspect the ACTUAL generated intermediate canonical X together with E and A. Do not assume X matched the request.

Judge each leg:
E→X and X→A

Return ONLY JSON:
{
  "E-X": { "decision": "SHOOTABLE" | "NOT_SHOOTABLE", "reasoning": "<image-grounded>" },
  "X-A": { "decision": "SHOOTABLE" | "NOT_SHOOTABLE", "reasoning": "<image-grounded>" }
}`;

const STAGE4_SYSTEM = `You are the Cinematographer for TunnelVision.

Inspect two actual first-person stills and emit shot geometry plus Camotion strength.

Coordinate convention: [0,1], (0,0) top-left.

camera.forward = 1.0
exposure.samples = 16
destination.protect = true unless the destination cannot be boxed

Camotion strength is YOUR choice from the frozen Phase 1 vocabulary only:
LIGHT 0.02 — strong natural motion evidence or high structured-content smear risk
MEDIUM 0.04 — needs a clearer motion-state cue without aggressive conditioning
STRONG 0.08 — weak natural motion evidence; strongest currently-supported cue

Use the minimum bounded conditioning needed to establish useful motion state.
Start and end strengths may differ.

Return ONLY JSON:
{
  "route": "<short forward route>",
  "prompt": "<Seedance locomotion prompt: continuous physical first-person travel, not a dissolve>",
  "start": {
    "environment": "<visible in image 1>",
    "destination": { "description": "<traversable destination>", "point": [x, y], "protect": true, "bbox": [l, t, r, b] },
    "camera": { "vanishing_point": [x, y], "forward": 1.0 },
    "exposure": { "label": "LIGHT"|"MEDIUM"|"STRONG", "strength": 0.02|0.04|0.08, "reasoning": "<why>", "samples": 16 }
  },
  "end": {
    "environment": "<visible in image 2>",
    "destination": { "description": "<traversable continuation>", "point": [x, y], "protect": true, "bbox": [l, t, r, b] },
    "camera": { "vanishing_point": [x, y], "forward": 1.0 },
    "exposure": { "label": "LIGHT"|"MEDIUM"|"STRONG", "strength": 0.02|0.04|0.08, "reasoning": "<why>", "samples": 16 }
  }
}`;

async function completeJson(
  reasoning: ReasoningProvider,
  systemInstruction: string,
  prompt: string,
  images: { kind: "file"; path: string }[],
): Promise<{ text: string; model: string; predictionId: string }> {
  try {
    const first = await reasoning.complete({ systemInstruction, prompt, images });
    return { text: first.text, model: first.model, predictionId: first.predictionId };
  } catch {
    const retry = await reasoning.complete({ systemInstruction, prompt, images });
    return { text: retry.text, model: retry.model, predictionId: retry.predictionId };
  }
}

function pythonBin(repoRoot: string): string {
  return join(repoRoot, "camotion/.venv/bin/python");
}

async function runPythonJobs(repoRoot: string, outputDir: string, jobs: unknown): Promise<void> {
  const jobsPath = join(outputDir, ".camotion-jobs.json");
  await writeFile(jobsPath, `${JSON.stringify(jobs, null, 2)}\n`);
  const result = await execFileAsync(
    pythonBin(repoRoot),
    [join(repoRoot, "camotion/integration/wardrobe_loop_render.py"), "--jobs", jobsPath],
    { cwd: repoRoot, maxBuffer: 20 * 1024 * 1024 },
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

async function withRetry<T>(operation: () => Promise<T>): Promise<{ value: T; retryCount: number }> {
  try {
    return { value: await operation(), retryCount: 0 };
  } catch {
    return { value: await operation(), retryCount: 1 };
  }
}

export async function runShootabilityExperiment(options: RunOptions): Promise<ExperimentManifest> {
  assertExperimentContract();
  const outputDir = options.outputDir ?? defaultOutputDir(options.repoRoot);
  await mkdir(outputDir, { recursive: true });
  await writeProtocol(outputDir);
  const token = getOptionalEnv("REPLICATE_API_TOKEN");
  const now = options.now ?? (() => new Date());
  const commit = await gitCommit(options.repoRoot);
  const reasoning = options.reasoning ?? new ReplicateReasoningProvider();

  const imageE = await hashRepoFile(options.repoRoot, CANONICAL_PATHS.E);
  const imageA = await hashRepoFile(options.repoRoot, CANONICAL_PATHS.A);
  if (imageE.sha256 !== EXPECTED_CANONICAL_SHA256.E || imageA.sha256 !== EXPECTED_CANONICAL_SHA256.A) {
    throw new Error("canonical E/A hashes do not match Integration Test 01");
  }

  const stage1Path = join(outputDir, "stage1-shootability.json");
  let stage1 = await readJsonFile<Stage1Record>(stage1Path);
  if (!stage1) {
    const selected = options.stage1
      ? await options.stage1()
      : await (async () => {
          const plans = {
            start: JSON.parse(await readFile(resolve(options.repoRoot, HISTORICAL_E_A.startPlan), "utf8")),
            end: JSON.parse(await readFile(resolve(options.repoRoot, HISTORICAL_E_A.endPlan), "utf8")),
          };
          const result = await completeJson(
            reasoning,
            STAGE1_SYSTEM,
            stage1UserPrompt(plans),
            [
              { kind: "file", path: resolve(options.repoRoot, `${INTEGRATION_ROOT}/canonical/vision/E.jpg`) },
              { kind: "file", path: resolve(options.repoRoot, `${INTEGRATION_ROOT}/canonical/vision/A.jpg`) },
            ],
          );
          const parsed = parseShootabilityDecision(result.text);
          return {
            decision: parsed.decision,
            reasoning: parsed.reasoning,
            model: result.model,
            prediction_id: result.predictionId,
            source: "reasoning" as const,
            raw_text: result.text,
          };
        })();
    stage1 = {
      frozen_before_generation: true,
      frozen_at: now().toISOString(),
      decision: selected.decision,
      reasoning: selected.reasoning,
      model: selected.model,
      prediction_id: selected.prediction_id,
      source: selected.source,
      image_e: imageE,
      image_a: imageA,
      plans_used: [HISTORICAL_E_A.startPlan, HISTORICAL_E_A.endPlan],
      raw_text: selected.raw_text,
    };
    await writeJson(stage1Path, stage1, token);
  }

  const emptyGenerations: GenerationRecord[] = VIDEO_GENERATIONS.map((generation) => ({
    id: generation.id,
    filename: generation.filename,
    shot: generation.shot,
    start_strength: 0,
    end_strength: 0,
    start_image: imageE,
    end_image: imageA,
    prompt: "",
    seed_submitted: generation.seed,
    seed_reported: null,
    settings: {},
    prediction_id: null,
    output_path: null,
    status: "not_attempted" as const,
    retry_count: 0,
    error: null,
  }));

  if (stage1.decision === "SHOOTABLE") {
    const manifest: ExperimentManifest = {
      experiment: EXPERIMENT_ID,
      git_commit: commit,
      stop_reason: "direct_declared_shootable",
      stage1,
      stage2: null,
      x_generation: null,
      stage3: null,
      stage4: null,
      generations: emptyGenerations,
      assembly_path: null,
    };
    await writeJson(join(outputDir, "generation-manifest.json"), manifest, token);
    return manifest;
  }

  assertCanGenerateX(stage1);
  const stage2Path = join(outputDir, "stage2-x-spec.json");
  let stage2 = await readJsonFile<Stage2Record>(stage2Path);
  if (!stage2) {
    const specified = options.stage2
      ? await options.stage2()
      : await (async () => {
          const result = await completeJson(
            reasoning,
            STAGE2_SYSTEM,
            [
              "Image 1 is E. Image 2 is A.",
              `Visual language to respect, not a morph recipe: ${SHARED_VISUAL_LANGUAGE}`,
              "Specify one intermediate CAMERA POSITION X on a continuous route from E to A.",
              "Return JSON only.",
            ].join("\n"),
            [
              { kind: "file", path: resolve(options.repoRoot, `${INTEGRATION_ROOT}/canonical/vision/E.jpg`) },
              { kind: "file", path: resolve(options.repoRoot, `${INTEGRATION_ROOT}/canonical/vision/A.jpg`) },
            ],
          );
          return {
            ...parseXSpecification(result.text),
            model: result.model,
            prediction_id: result.predictionId,
            source: "reasoning" as const,
            raw_text: result.text,
          };
        })();
    stage2 = {
      frozen_before_x_generation: true,
      frozen_at: now().toISOString(),
      ...specified,
    };
    await writeJson(stage2Path, stage2, token);
  }

  const xPath = join(outputDir, "canonical/X.png");
  let xGeneration: Record<string, unknown> | null = await readJsonFile(join(outputDir, "canonical/X-generation.json"));
  if (!(await fileExists(xPath))) {
    if (!options.execute) {
      const manifest: ExperimentManifest = {
        experiment: EXPERIMENT_ID,
        git_commit: commit,
        stop_reason: "incomplete",
        stage1,
        stage2,
        x_generation: null,
        stage3: null,
        stage4: null,
        generations: emptyGenerations,
        assembly_path: null,
      };
      await writeJson(join(outputDir, "generation-manifest.json"), manifest, token);
      return manifest;
    }
    const imageProvider =
      options.imageProvider ??
      new ReplicateMediaProvider({
        imageModel: IMAGE_MODEL,
        flux: { aspectRatio: "16:9", raw: false, outputFormat: "png", safetyTolerance: 2 },
      });
    const request = { prompt: stage2.image_prompt, seed: X_CANONICAL_SEED };
    const attempt = await withRetry(() => imageProvider.generateImage(request));
    const bytes = await (options.fetchOutput ?? download)(attempt.value.outputUrl);
    const dims = pngDimensions(bytes);
    if (!isApproximately16x9(dims.width, dims.height)) {
      throw new Error(`X is ${dims.width}x${dims.height}, not 16:9`);
    }
    await mkdir(dirname(xPath), { recursive: true });
    await writeFile(xPath, bytes);
    const hashedX = await hashRepoFile(options.repoRoot, repoPath(options.repoRoot, xPath));
    xGeneration = {
      model: attempt.value.model,
      seed: X_CANONICAL_SEED,
      prediction_id: attempt.value.predictionId,
      prompt: stage2.image_prompt,
      settings: describeFlux11ProUltraInput(request, {
        aspectRatio: "16:9",
        raw: false,
        outputFormat: "png",
        safetyTolerance: 2,
        seed: X_CANONICAL_SEED,
      }),
      output_path: hashedX.path,
      sha256: hashedX.sha256,
      bytes: hashedX.bytes,
      retry_count: attempt.retryCount,
      started_at: attempt.value.startedAt,
      completed_at: attempt.value.completedAt,
    };
    await writeJson(join(outputDir, "canonical/X-generation.json"), xGeneration, token);
  }

  const xImage = await hashRepoFile(options.repoRoot, repoPath(options.repoRoot, xPath));
  if (!options.stage3) {
    await runPythonJobs(options.repoRoot, outputDir, {
      depths: [
        {
          image: xPath,
          output: join(outputDir, "canonical/depth/X.png"),
        },
      ],
      vision: [
        {
          image: xPath,
          output: join(outputDir, "canonical/vision/X.jpg"),
        },
      ],
      renders: [],
    });
  }

  const stage3Path = join(outputDir, "stage3-actual-x-review.json");
  let stage3 = await readJsonFile<Stage3Record>(stage3Path);
  if (!stage3) {
    const reviewed = options.stage3
      ? await options.stage3(xImage)
      : await (async () => {
          const result = await completeJson(
            reasoning,
            STAGE3_SYSTEM,
            "Image 1 is E. Image 2 is the ACTUAL generated X. Image 3 is A. Judge E→X and X→A. Return JSON only.",
            [
              { kind: "file", path: resolve(options.repoRoot, `${INTEGRATION_ROOT}/canonical/vision/E.jpg`) },
              { kind: "file", path: join(outputDir, "canonical/vision/X.jpg") },
              { kind: "file", path: resolve(options.repoRoot, `${INTEGRATION_ROOT}/canonical/vision/A.jpg`) },
            ],
          );
          const parsed = parseLegReview(result.text);
          return {
            e_to_x: parsed.e_to_x,
            x_to_a: parsed.x_to_a,
            model: result.model,
            prediction_id: result.predictionId,
            source: "reasoning" as const,
            raw_text: result.text,
          };
        })();
    stage3 = {
      frozen_before_video: true,
      frozen_at: now().toISOString(),
      x_image: xImage,
      ...reviewed,
    };
    await writeJson(stage3Path, stage3, token);
  }

  if (stage3.e_to_x.decision !== "SHOOTABLE" || stage3.x_to_a.decision !== "SHOOTABLE") {
    const manifest: ExperimentManifest = {
      experiment: EXPERIMENT_ID,
      git_commit: commit,
      stop_reason: "leg_not_shootable",
      stage1,
      stage2,
      x_generation: xGeneration,
      stage3,
      stage4: null,
      generations: emptyGenerations,
      assembly_path: null,
    };
    await writeJson(join(outputDir, "generation-manifest.json"), manifest, token);
    return manifest;
  }

  assertCanGenerateVideos(stage3);
  const stage4Path = join(outputDir, "stage4-cinematography.json");
  let stage4 = await readJsonFile<Stage4Record>(stage4Path);
  if (!stage4) {
    const shots = options.stage4
      ? await options.stage4()
      : await (async () => {
          const planOne = async (
            shot: RepairShotId,
            startId: "E" | "X" | "A",
            endId: "E" | "X" | "A",
            startVision: string,
            endVision: string,
          ) => {
            const result = await completeJson(
              reasoning,
              STAGE4_SYSTEM,
              `Shot ${shot}: Image 1 is ${startId}, Image 2 is ${endId}. Emit geometry, Phase 1 Camotion strengths, and a locomotion prompt. Return JSON only.`,
              [
                { kind: "file", path: startVision },
                { kind: "file", path: endVision },
              ],
            );
            return parseShotCinematography(result.text, shot, startId, endId);
          };
          const eVision = resolve(options.repoRoot, `${INTEGRATION_ROOT}/canonical/vision/E.jpg`);
          const aVision = resolve(options.repoRoot, `${INTEGRATION_ROOT}/canonical/vision/A.jpg`);
          const xVision = join(outputDir, "canonical/vision/X.jpg");
          const ea = await planOne("E-A", "E", "A", eVision, aVision);
          const ex = await planOne("E-X", "E", "X", eVision, xVision);
          const xa = await planOne("X-A", "X", "A", xVision, aVision);
          return { "E-A": ea, "E-X": ex, "X-A": xa };
        })();
    stage4 = {
      frozen_before_video: true,
      frozen_at: now().toISOString(),
      shots,
    };
    await writeJson(stage4Path, stage4, token);
    for (const shot of Object.values(shots)) {
      await writeJson(join(outputDir, "cinematography", `${shot.shot}-start-plan.json`), shot.start_plan, token);
      await writeJson(join(outputDir, "cinematography", `${shot.shot}-end-plan.json`), shot.end_plan, token);
    }
  }

  const canonicalFile = (id: "E" | "X" | "A"): string => {
    if (id === "X") return repoPath(options.repoRoot, xPath);
    return id === "E" ? CANONICAL_PATHS.E : CANONICAL_PATHS.A;
  };
  const depthFile = (id: "E" | "X" | "A"): string => {
    if (id === "X") return join(outputDir, "canonical/depth/X.png");
    return resolve(options.repoRoot, `${INTEGRATION_ROOT}/canonical/depth/${id}.png`);
  };

  const defaultPrepare = async (shot: RepairShotId, cine: ShotCinematography) => {
    const shotDir = join(outputDir, "shooting", shot);
    const startPlanPath = join(shotDir, "start-plan.json");
    const endPlanPath = join(shotDir, "end-plan.json");
    const startOut = join(shotDir, "start.png");
    const endOut = join(shotDir, "end.png");
    await writeJson(startPlanPath, cine.start_plan, token);
    await writeJson(endPlanPath, cine.end_plan, token);
    await runPythonJobs(options.repoRoot, outputDir, {
      depths: [],
      vision: [],
      renders: [
        {
          image: resolve(options.repoRoot, canonicalFile(cine.start_canonical)),
          plan: startPlanPath,
          depth: depthFile(cine.start_canonical),
          output: startOut,
        },
        {
          image: resolve(options.repoRoot, canonicalFile(cine.end_canonical)),
          plan: endPlanPath,
          depth: depthFile(cine.end_canonical),
          output: endOut,
        },
      ],
    });
    return {
      startImage: repoPath(options.repoRoot, startOut),
      endImage: repoPath(options.repoRoot, endOut),
    };
  };

  const generations: GenerationRecord[] = [];
  for (const generation of VIDEO_GENERATIONS) {
    const cine = stage4.shots[generation.shot];
    const prepared = options.prepareEndpoints
      ? await options.prepareEndpoints(generation.shot, cine)
      : await defaultPrepare(generation.shot, cine);
    const startImage = await hashRepoFile(options.repoRoot, prepared.startImage);
    const endImage = await hashRepoFile(options.repoRoot, prepared.endImage);
    const settings = describeSeedance25Input(
      {
        startImage: { kind: "file", path: resolve(options.repoRoot, prepared.startImage) },
        endImage: { kind: "file", path: resolve(options.repoRoot, prepared.endImage) },
        prompt: cine.prompt,
        durationSeconds: VIDEO_DURATION_SECONDS,
      },
      `<local file upload: ${prepared.startImage}>`,
      `<local file upload: ${prepared.endImage}>`,
      seedanceSettingsForSeed(generation.seed),
    );
    const outputPath = join(outputDir, generation.filename);
    if (!options.execute) {
      generations.push({
        id: generation.id,
        filename: generation.filename,
        shot: generation.shot,
        start_strength: cine.start_strength,
        end_strength: cine.end_strength,
        start_image: startImage,
        end_image: endImage,
        prompt: cine.prompt,
        seed_submitted: generation.seed,
        seed_reported: null,
        settings,
        prediction_id: null,
        output_path: repoPath(options.repoRoot, outputPath),
        status: "dry_run",
        retry_count: 0,
        error: null,
      });
      continue;
    }
    if (await fileExists(outputPath)) {
      generations.push({
        id: generation.id,
        filename: generation.filename,
        shot: generation.shot,
        start_strength: cine.start_strength,
        end_strength: cine.end_strength,
        start_image: startImage,
        end_image: endImage,
        prompt: cine.prompt,
        seed_submitted: generation.seed,
        seed_reported: null,
        settings,
        prediction_id: null,
        output_path: repoPath(options.repoRoot, outputPath),
        status: "skipped",
        retry_count: 0,
        error: null,
      });
      continue;
    }
    console.log(`seedance ${generation.id} seed=${generation.seed}`);
    const provider =
      options.createVideoProvider?.(generation.seed) ??
      options.provider ??
      new ReplicateMediaProvider({
        model: VIDEO_MODEL,
        seedance: seedanceSettingsForSeed(generation.seed),
      });
    const request: VideoGenerationRequest = {
      startImage: { kind: "file", path: resolve(options.repoRoot, prepared.startImage) },
      endImage: { kind: "file", path: resolve(options.repoRoot, prepared.endImage) },
      prompt: cine.prompt,
      durationSeconds: VIDEO_DURATION_SECONDS,
    };
    try {
      const attempt = await withRetry(() => provider.generateVideo(request));
      const bytes = await (options.fetchOutput ?? download)(attempt.value.outputUrl);
      await writeFile(outputPath, bytes);
      generations.push({
        id: generation.id,
        filename: generation.filename,
        shot: generation.shot,
        start_strength: cine.start_strength,
        end_strength: cine.end_strength,
        start_image: startImage,
        end_image: endImage,
        prompt: cine.prompt,
        seed_submitted: generation.seed,
        seed_reported: reportedSeed(attempt.value.metadata),
        settings,
        prediction_id: attempt.value.predictionId,
        output_path: repoPath(options.repoRoot, outputPath),
        status: "succeeded",
        retry_count: attempt.retryCount,
        error: null,
      });
    } catch (error) {
      const mediaError = error instanceof MediaGenerationError ? error : null;
      generations.push({
        id: generation.id,
        filename: generation.filename,
        shot: generation.shot,
        start_strength: cine.start_strength,
        end_strength: cine.end_strength,
        start_image: startImage,
        end_image: endImage,
        prompt: cine.prompt,
        seed_submitted: generation.seed,
        seed_reported: null,
        settings,
        prediction_id: mediaError?.predictionId ?? null,
        output_path: null,
        status: "failed",
        retry_count: 1,
        error: mediaError?.message ?? (error instanceof Error ? error.message : String(error)),
      });
    }
  }

  let assemblyPath: string | null = null;
  const ex = generations.find((generation) => generation.id === "02-E-X");
  const xa = generations.find((generation) => generation.id === "03-X-A");
  if (options.execute && ex?.status === "succeeded" && xa?.status === "succeeded" && ex.output_path && xa.output_path) {
    const assembly = join(outputDir, "04-E-X-X-A-assembly.mp4");
    const list = join(outputDir, "assembly-list.txt");
    await writeFile(
      list,
      `file '${resolve(options.repoRoot, ex.output_path)}'\nfile '${resolve(options.repoRoot, xa.output_path)}'\n`,
    );
    try {
      await execFileAsync("ffmpeg", [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        list,
        "-c",
        "copy",
        "-an",
        "-movflags",
        "+faststart",
        assembly,
      ]);
      assemblyPath = repoPath(options.repoRoot, assembly);
    } catch (error) {
      await writeFile(
        join(outputDir, "assembly-error.txt"),
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  const manifest: ExperimentManifest = {
    experiment: EXPERIMENT_ID,
    git_commit: commit,
    stop_reason: "none",
    stage1,
    stage2,
    x_generation: xGeneration,
    stage3,
    stage4,
    generations,
    assembly_path: assemblyPath,
  };
  await writeJson(join(outputDir, "generation-manifest.json"), manifest, token);
  return manifest;
}

async function writeProtocol(outputDir: string): Promise<void> {
  const path = join(outputDir, "PROTOCOL.md");
  if (await fileExists(path)) return;
  await writeFile(
    path,
    `# Cinematographer shootability / intermediate spatial volume

Not a Camotion tuning experiment. Camotion Phase 1 remains frozen.

Research question: can the Cinematographer inspect actual E and A, recognize that direct E→A may lack traversable intermediate volume, and specify an intermediate camera position X so E→X and X→A are independently shootable?

Do not declare a winner here. Human evaluation compares direct E→A against E→X | X→A after the videos exist.
`,
  );
}

async function main(): Promise<void> {
  const mediaDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(mediaDir, "..", "..", "..");
  const { values } = parseArgs({
    options: { execute: { type: "boolean", default: false } },
  });
  loadDotEnvLocal(repoRoot);
  const execute = Boolean(values.execute);
  if (execute && !getOptionalEnv("REPLICATE_API_TOKEN")) {
    throw new Error("REPLICATE_API_TOKEN is not set");
  }
  const outputDir = defaultOutputDir(repoRoot);
  await mkdir(outputDir, { recursive: true });
  await writeProtocol(outputDir);
  console.log(
    execute
      ? `Executing ${EXPERIMENT_ID}`
      : `Dry-run ${EXPERIMENT_ID} (reasoning freeze may still run; pass --execute for FLUX/Seedance)`,
  );
  const manifest = await runShootabilityExperiment({ repoRoot, execute });
  console.log(`stop_reason=${manifest.stop_reason}`);
  console.log(`stage1=${manifest.stage1.decision}`);
  console.log(manifest.stage1.reasoning);
  if (manifest.stage2) {
    console.log(`X camera_position=${manifest.stage2.camera_position}`);
  }
  if (manifest.stage3) {
    console.log(`E-X=${manifest.stage3.e_to_x.decision} X-A=${manifest.stage3.x_to_a.decision}`);
  }
  for (const generation of manifest.generations) {
    console.log(
      [generation.id, generation.status, `seed=${generation.seed_submitted}`, `retry=${generation.retry_count}`].join(
        "  ",
      ),
    );
  }
  if (manifest.generations.some((generation) => generation.status === "failed")) {
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  await main();
}
