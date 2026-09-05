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
  describeSeedance25Input,
  parseJsonObject,
  sha256File,
  type MediaProvider,
  type ReasoningProvider,
  type VideoGenerationRequest,
} from "../../src/index.ts";
import { assertNoSecret } from "../../src/errors.ts";
import { loadDotEnvLocal, getOptionalEnv } from "../../src/config/environment.ts";
import { gitCommit } from "../runner.ts";
import { VIDEO_PROMPTS, type ShotId } from "./story.ts";

const execFileAsync = promisify(execFile);

export const EXPERIMENT_ID = "scene-aware-camotion-strength";
export const VIDEO_DURATION_SECONDS = 6;
export const VIDEO_MODEL = "bytedance/seedance-2.5";
export const REASONING_MODEL = "google/gemini-3.1-pro";
export const FIXED_STRENGTH = 0.08;
export const LIGHT_STRENGTH = 0.02;
export const MEDIUM_STRENGTH = 0.04;
export const STRONG_STRENGTH = 0.08;
export const ADAPTIVE_STRENGTHS = [
  LIGHT_STRENGTH,
  MEDIUM_STRENGTH,
  STRONG_STRENGTH,
] as const;
export type AdaptiveStrength = (typeof ADAPTIVE_STRENGTHS)[number];

export const INTEGRATION_ROOT = "camotion/integration/wardrobe-loop-01";
export const INTEGRATION_MANIFEST = `${INTEGRATION_ROOT}/generation-manifest.json`;

export const EXPECTED_CANONICAL_SHA256 = {
  A: "d71319696162eab7e9c2dbe3c2f7037fd21bcb2aea877a98d8a223ce1e7b6820",
  B: "26cfa5ba61c7ff154666f1a2387c7007e32083cb8c8d732dc9538410589e93c9",
  C: "9767bfa9c82f61c3d2e3f1e74b0dd6ecafa27416435003be62046c0dd3f79b08",
  D: "cf60b53ea5a1965ff266abad157ccd154cd41f0f0313188b99f770be5333492a",
  E: "49154292cb2534ab333c2fb1ec6329ca8fa82855b8baca2b7078a4356e9357ff",
} as const;

export const EXPECTED_FIXED_SHOOTING_SHA256 = {
  "A-B": {
    start: "0cdddd5cc8b74c59f18b1171e4776b52c7cb824ce84a0403d68ff16db17dc9ea",
    end: "ccdec02a4d03785b8a737cbdab11c4b4f7e5a2bd614d3ea91aa10b02c4974a93",
  },
  "B-C": {
    start: "98ed935216d1b3c189aadcb23df4509ce23790eb0ecf2ff5189f724a02197724",
    end: "83f6bab9237002442bed0701b778c6bf0bb2d72e682acced94adb1d575920eb7",
  },
  "D-E": {
    start: "ada75adeb9254ffd426cfb8544f2ec95b375628728fad8e330867d0b94a8d288",
    end: "5608978a2a93622819b1e9e5edb234e7a3f8bfd355f4d94243b5f4ac9d45ee03",
  },
} as const;

export type ExperimentShotId = "A-B" | "B-C" | "D-E";
export type CanonicalId = "A" | "B" | "C" | "D" | "E";
export type StrengthLabel = "LIGHT" | "MEDIUM" | "STRONG";

export const SHOT_PAIRS = [
  {
    shot: "A-B" as const,
    startCanonical: "A" as const,
    endCanonical: "B" as const,
    seed: 80,
    startPlan: `${INTEGRATION_ROOT}/plans/A-B.json`,
    endPlan: `${INTEGRATION_ROOT}/shooting/A-B/end-plan.json`,
    startShooting: `${INTEGRATION_ROOT}/shooting/A-B/start.png`,
    endShooting: `${INTEGRATION_ROOT}/shooting/A-B/end.png`,
  },
  {
    shot: "B-C" as const,
    startCanonical: "B" as const,
    endCanonical: "C" as const,
    seed: 81,
    startPlan: `${INTEGRATION_ROOT}/plans/B-C.json`,
    endPlan: `${INTEGRATION_ROOT}/shooting/B-C/end-plan.json`,
    startShooting: `${INTEGRATION_ROOT}/shooting/B-C/start.png`,
    endShooting: `${INTEGRATION_ROOT}/shooting/B-C/end.png`,
  },
  {
    shot: "D-E" as const,
    startCanonical: "D" as const,
    endCanonical: "E" as const,
    seed: 82,
    startPlan: `${INTEGRATION_ROOT}/plans/D-E.json`,
    endPlan: `${INTEGRATION_ROOT}/shooting/D-E/end-plan.json`,
    startShooting: `${INTEGRATION_ROOT}/shooting/D-E/start.png`,
    endShooting: `${INTEGRATION_ROOT}/shooting/D-E/end.png`,
  },
] as const;

export type ShotPairSpec = (typeof SHOT_PAIRS)[number];

export const GENERATIONS = [
  {
    id: "01-A-B-fixed-08",
    filename: "01-A-B-fixed-08.mp4",
    shot: "A-B" as const,
    condition: "fixed" as const,
    seed: 80,
  },
  {
    id: "02-A-B-adaptive",
    filename: "02-A-B-adaptive.mp4",
    shot: "A-B" as const,
    condition: "adaptive" as const,
    seed: 80,
  },
  {
    id: "03-B-C-fixed-08",
    filename: "03-B-C-fixed-08.mp4",
    shot: "B-C" as const,
    condition: "fixed" as const,
    seed: 81,
  },
  {
    id: "04-B-C-adaptive",
    filename: "04-B-C-adaptive.mp4",
    shot: "B-C" as const,
    condition: "adaptive" as const,
    seed: 81,
  },
  {
    id: "05-D-E-fixed-08",
    filename: "05-D-E-fixed-08.mp4",
    shot: "D-E" as const,
    condition: "fixed" as const,
    seed: 82,
  },
  {
    id: "06-D-E-adaptive",
    filename: "06-D-E-adaptive.mp4",
    shot: "D-E" as const,
    condition: "adaptive" as const,
    seed: 82,
  },
] as const;

export type GenerationSpec = (typeof GENERATIONS)[number];
export type ConditionKind = GenerationSpec["condition"];

export const CANONICAL_ORDER: readonly CanonicalId[] = ["A", "B", "C", "D", "E"];

export const STRENGTH_BY_LABEL: Record<StrengthLabel, AdaptiveStrength> = {
  LIGHT: LIGHT_STRENGTH,
  MEDIUM: MEDIUM_STRENGTH,
  STRONG: STRONG_STRENGTH,
};

export const LABEL_BY_STRENGTH: Record<AdaptiveStrength, StrengthLabel> = {
  [LIGHT_STRENGTH]: "LIGHT",
  [MEDIUM_STRENGTH]: "MEDIUM",
  [STRONG_STRENGTH]: "STRONG",
};

const SEEDANCE_SHARED = {
  resolution: "720p" as const,
  aspectRatio: "adaptive" as const,
  generateAudio: false,
  watermark: false,
  outputFormat: "mp4" as const,
};

export type FileRef = {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
};

export type CanonicalSelection = {
  readonly canonical: CanonicalId;
  readonly strength: AdaptiveStrength;
  readonly label: StrengthLabel;
  readonly reasoning: string;
  readonly image: FileRef;
  readonly vision_input: FileRef;
  readonly plans: readonly FileRef[];
};

export type ShotEndpointStrengths = {
  readonly shot: ExperimentShotId;
  readonly start_canonical: CanonicalId;
  readonly end_canonical: CanonicalId;
  readonly start_strength: AdaptiveStrength;
  readonly end_strength: AdaptiveStrength;
  readonly start_reused_from_canonical: boolean;
  readonly end_reused_from_canonical: boolean;
};

export type PlanningArtifact = {
  readonly experiment: string;
  readonly title: string;
  readonly frozen_before_generation: true;
  readonly frozen_at: string;
  readonly git_commit: string | null;
  readonly selector: {
    readonly model: string;
    readonly model_version: string | null;
    readonly prediction_id: string | null;
    readonly elapsed_ms: number | null;
    readonly source: "reasoning" | "injected" | "existing_file";
  };
  readonly reuse: {
    readonly B: readonly ["A-B end", "B-C start"];
  };
  readonly excluded_shots: readonly ["C-D", "E-A"];
  readonly allowed_strengths: readonly AdaptiveStrength[];
  readonly canonical_selections: Record<CanonicalId, CanonicalSelection>;
  readonly shot_endpoint_strengths: Record<ExperimentShotId, ShotEndpointStrengths>;
  readonly raw_selector_text: string | null;
};

export type GenerationRecord = {
  readonly id: string;
  readonly filename: string;
  readonly shot: ExperimentShotId;
  readonly condition: ConditionKind;
  readonly start_canonical: CanonicalId;
  readonly end_canonical: CanonicalId;
  readonly start_strength: number;
  readonly end_strength: number;
  readonly start_image: FileRef;
  readonly end_image: FileRef;
  readonly start_plan: FileRef;
  readonly end_plan: FileRef;
  readonly prompt: string;
  readonly seed_submitted: number;
  readonly seed_reported: number | null;
  readonly settings: Readonly<Record<string, unknown>>;
  readonly prediction_id: string | null;
  readonly output_url: string | null;
  readonly output_path: string | null;
  readonly status: "succeeded" | "failed" | "dry_run" | "skipped";
  readonly error: string | null;
  readonly error_code: string | null;
  readonly retry_count: number;
  readonly started_at: string;
  readonly completed_at: string;
  readonly elapsed_ms: number;
};

export type ExperimentManifest = {
  readonly experiment: string;
  readonly title: string;
  readonly git_commit: string | null;
  readonly model: string;
  readonly planning_path: string;
  readonly planning_frozen_at: string;
  readonly videos_started_at: string | null;
  readonly independent_variable: "camotion_endpoint_strength_policy";
  readonly excluded_shots: readonly ["C-D", "E-A"];
  readonly shared_settings: Readonly<Record<string, unknown>>;
  readonly planning: PlanningArtifact;
  readonly generations: readonly GenerationRecord[];
};

export type PreparedEndpoints = {
  readonly startImage: string;
  readonly endImage: string;
  readonly startPlan: string;
  readonly endPlan: string;
  readonly startStrength: number;
  readonly endStrength: number;
};

export type RunExperimentOptions = {
  readonly repoRoot: string;
  readonly execute: boolean;
  readonly outputDir?: string;
  readonly provider?: MediaProvider;
  readonly createVideoProvider?: (seed: number) => MediaProvider;
  readonly reasoning?: ReasoningProvider;
  readonly selectCanonicals?: () => Promise<{
    readonly selections: Record<CanonicalId, Pick<CanonicalSelection, "strength" | "label" | "reasoning">>;
    readonly rawText: string | null;
    readonly model: string;
    readonly modelVersion: string | null;
    readonly predictionId: string | null;
    readonly elapsedMs: number | null;
    readonly source: PlanningArtifact["selector"]["source"];
  }>;
  readonly prepareEndpoints?: (
    generation: GenerationSpec,
    planning: PlanningArtifact,
  ) => Promise<PreparedEndpoints>;
  readonly fetchOutput?: (url: string) => Promise<Buffer>;
  readonly now?: () => Date;
};

function repoPath(repoRoot: string, path: string): string {
  return relative(repoRoot, path).split("\\").join("/");
}

export function defaultOutputDir(repoRoot: string): string {
  return join(repoRoot, INTEGRATION_ROOT, "experiments", EXPERIMENT_ID);
}

export function planningPath(outputDir: string): string {
  return join(outputDir, "planning.json");
}

export function isAllowedStrength(value: number): value is AdaptiveStrength {
  return ADAPTIVE_STRENGTHS.some(
    (allowed) => Object.is(allowed, value) || Math.abs(allowed - value) < 1e-12,
  );
}

export function coerceAllowedStrength(value: number): AdaptiveStrength {
  const match = ADAPTIVE_STRENGTHS.find(
    (allowed) => Object.is(allowed, value) || Math.abs(allowed - value) < 1e-12,
  );
  if (match === undefined) {
    throw new Error(`strength ${value} is not in {0.02, 0.04, 0.08}`);
  }
  return match;
}

export function labelForStrength(strength: AdaptiveStrength): StrengthLabel {
  return LABEL_BY_STRENGTH[strength];
}

export function shotPair(shot: ExperimentShotId): ShotPairSpec {
  const pair = SHOT_PAIRS.find((entry) => entry.shot === shot);
  if (!pair) {
    throw new Error(`unknown shot ${shot}`);
  }
  return pair;
}

export function planWithStrength(
  plan: Record<string, unknown>,
  strength: AdaptiveStrength,
): Record<string, unknown> {
  const exposure = plan.exposure;
  if (!exposure || typeof exposure !== "object" || Array.isArray(exposure)) {
    throw new Error("CameraMotionPlan is missing exposure");
  }
  return {
    ...plan,
    exposure: {
      ...(exposure as Record<string, unknown>),
      strength,
    },
  };
}

export function geometryWithoutStrength(plan: Record<string, unknown>): unknown {
  const exposure = plan.exposure;
  if (!exposure || typeof exposure !== "object" || Array.isArray(exposure)) {
    return plan;
  }
  const { strength: _strength, ...restExposure } = exposure as Record<string, unknown>;
  void _strength;
  return {
    ...plan,
    exposure: restExposure,
  };
}

export function loadIntegrationVideoPrompt(
  manifest: Record<string, unknown>,
  shot: ExperimentShotId,
): string {
  const shots = manifest.shots;
  if (!shots || typeof shots !== "object") {
    throw new Error("Integration Test 01 generation-manifest.json is missing shots");
  }
  const record = (shots as Record<string, unknown>)[shot];
  if (!record || typeof record !== "object") {
    throw new Error(`Integration Test 01 manifest is missing shot ${shot}`);
  }
  const video = (record as Record<string, unknown>).video;
  if (!video || typeof video !== "object") {
    throw new Error(`Integration Test 01 manifest is missing ${shot}.video`);
  }
  const prompt = (video as Record<string, unknown>).prompt;
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error(`Integration Test 01 manifest is missing ${shot}.video.prompt`);
  }
  return prompt;
}

export function assertAuthoritativePrompts(manifest: Record<string, unknown>): Record<
  ExperimentShotId,
  string
> {
  const prompts = {
    "A-B": loadIntegrationVideoPrompt(manifest, "A-B"),
    "B-C": loadIntegrationVideoPrompt(manifest, "B-C"),
    "D-E": loadIntegrationVideoPrompt(manifest, "D-E"),
  };
  for (const shot of Object.keys(prompts) as ExperimentShotId[]) {
    if (prompts[shot] !== VIDEO_PROMPTS[shot as ShotId]) {
      throw new Error(
        `Integration Test 01 prompt for ${shot} does not match VIDEO_PROMPTS[${shot}]`,
      );
    }
  }
  if ("C-D" in GENERATIONS || "E-A" in GENERATIONS) {
    throw new Error("C-D or E-A leaked into GENERATIONS");
  }
  return prompts;
}

export function assertExperimentContract(): void {
  if (SHOT_PAIRS.length !== 3) {
    throw new Error("expected exactly three shot pairs");
  }
  if (GENERATIONS.length !== 6) {
    throw new Error("expected exactly six generations");
  }
  const shots = SHOT_PAIRS.map((pair) => pair.shot);
  if (shots.includes("C-D" as ExperimentShotId) || shots.includes("E-A" as ExperimentShotId)) {
    throw new Error("C-D and E-A must not be included");
  }
  if (GENERATIONS.some((generation) => generation.shot === "C-D" || generation.shot === "E-A")) {
    throw new Error("C-D and E-A must not be generated");
  }
  if (SHOT_PAIRS[0].seed !== 80 || SHOT_PAIRS[1].seed !== 81 || SHOT_PAIRS[2].seed !== 82) {
    throw new Error("expected seeds 80/81/82");
  }
  for (const pair of SHOT_PAIRS) {
    const members = GENERATIONS.filter((generation) => generation.shot === pair.shot);
    if (members.length !== 2) {
      throw new Error(`shot ${pair.shot} must have exactly two generations`);
    }
    if (members[0].condition !== "fixed" || members[1].condition !== "adaptive") {
      throw new Error(`shot ${pair.shot} must be fixed then adaptive`);
    }
    if (members.some((generation) => generation.seed !== pair.seed)) {
      throw new Error(`shot ${pair.shot} members must share seed ${pair.seed}`);
    }
  }
  if (FIXED_STRENGTH !== 0.08) {
    throw new Error("fixed condition must use 0.08");
  }
}

export function parseAdaptiveSelections(text: string): Record<
  CanonicalId,
  Pick<CanonicalSelection, "strength" | "label" | "reasoning">
> {
  const raw = parseJsonObject(text);
  if (!raw || typeof raw !== "object") {
    throw new Error("selector output was not a JSON object");
  }
  const record = raw as Record<string, unknown>;
  const canonicals = record.canonicals;
  if (!canonicals || typeof canonicals !== "object") {
    throw new Error("selector output is missing canonicals");
  }
  const source = canonicals as Record<string, unknown>;
  const parsed = {} as Record<
    CanonicalId,
    Pick<CanonicalSelection, "strength" | "label" | "reasoning">
  >;
  for (const canonical of CANONICAL_ORDER) {
    const entry = source[canonical];
    if (!entry || typeof entry !== "object") {
      throw new Error(`selector output is missing canonical ${canonical}`);
    }
    const row = entry as Record<string, unknown>;
    const reasoning = typeof row.reasoning === "string" ? row.reasoning.trim() : "";
    if (!reasoning) {
      throw new Error(`selector output is missing reasoning for ${canonical}`);
    }
    const labelRaw = typeof row.label === "string" ? row.label.trim().toUpperCase() : null;
    const strengthRaw = row.strength;
    let strength: AdaptiveStrength;
    if (labelRaw === "LIGHT" || labelRaw === "MEDIUM" || labelRaw === "STRONG") {
      strength = STRENGTH_BY_LABEL[labelRaw];
      if (typeof strengthRaw === "number" && !isAllowedStrength(strengthRaw)) {
        throw new Error(`selector strength for ${canonical} is not in {0.02, 0.04, 0.08}`);
      }
      if (typeof strengthRaw === "number" && coerceAllowedStrength(strengthRaw) !== strength) {
        throw new Error(
          `selector label/strength conflict for ${canonical}: ${labelRaw} vs ${strengthRaw}`,
        );
      }
    } else if (typeof strengthRaw === "number" && isAllowedStrength(strengthRaw)) {
      strength = coerceAllowedStrength(strengthRaw);
    } else {
      throw new Error(`selector output for ${canonical} has no valid LIGHT/MEDIUM/STRONG choice`);
    }
    parsed[canonical] = {
      strength,
      label: labelForStrength(strength),
      reasoning,
    };
  }
  return parsed;
}

export function shotEndpointStrengthsFromCanonicals(
  selections: Record<CanonicalId, Pick<CanonicalSelection, "strength">>,
): Record<ExperimentShotId, ShotEndpointStrengths> {
  const result = {} as Record<ExperimentShotId, ShotEndpointStrengths>;
  for (const pair of SHOT_PAIRS) {
    result[pair.shot] = {
      shot: pair.shot,
      start_canonical: pair.startCanonical,
      end_canonical: pair.endCanonical,
      start_strength: selections[pair.startCanonical].strength,
      end_strength: selections[pair.endCanonical].strength,
      start_reused_from_canonical: true,
      end_reused_from_canonical: true,
    };
  }
  return result;
}

export function seedanceSettingsForSeed(seed: number) {
  return {
    ...SEEDANCE_SHARED,
    seed,
  };
}

function comparablePairSettings(settings: Record<string, unknown>): string {
  const { image, last_frame_image, ...rest } = settings;
  void image;
  void last_frame_image;
  return JSON.stringify(rest);
}

export function pairControlsHeld(records: readonly GenerationRecord[]): string[] {
  const issues: string[] = [];
  for (const pair of SHOT_PAIRS) {
    const members = records.filter((record) => record.shot === pair.shot);
    if (members.length !== 2) {
      issues.push(`${pair.shot} does not have two generations`);
      continue;
    }
    const [fixed, adaptive] = members;
    if (fixed.condition !== "fixed" || adaptive.condition !== "adaptive") {
      issues.push(`${pair.shot} is not ordered fixed then adaptive`);
    }
    if (fixed.seed_submitted !== pair.seed || adaptive.seed_submitted !== pair.seed) {
      issues.push(`${pair.shot} seeds are not ${pair.seed}`);
    }
    if (fixed.prompt !== adaptive.prompt) {
      issues.push(`${pair.shot} prompts differ within the pair`);
    }
    if (fixed.prompt !== VIDEO_PROMPTS[pair.shot]) {
      issues.push(`${pair.shot} prompt is not the Integration Test 01 prompt`);
    }
    if (fixed.start_strength !== FIXED_STRENGTH || fixed.end_strength !== FIXED_STRENGTH) {
      issues.push(`${pair.shot} fixed condition is not 0.08/0.08`);
    }
    if (!isAllowedStrength(adaptive.start_strength) || !isAllowedStrength(adaptive.end_strength)) {
      issues.push(`${pair.shot} adaptive strengths are outside {0.02, 0.04, 0.08}`);
    }
    if (comparablePairSettings(fixed.settings) !== comparablePairSettings(adaptive.settings)) {
      issues.push(`${pair.shot} Seedance settings differ within the pair`);
    }
  }
  if (records.some((record) => record.shot === "C-D" || record.shot === "E-A")) {
    issues.push("C-D or E-A is present");
  }
  return issues;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

export async function hashRepoFile(repoRoot: string, relativePath: string): Promise<FileRef> {
  const path = resolve(repoRoot, relativePath);
  const hashed = await sha256File(path);
  const info = await stat(path);
  return {
    path: relativePath,
    sha256: hashed.sha256,
    bytes: info.size,
  };
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

function videoRequest(
  repoRoot: string,
  startImage: string,
  endImage: string,
  prompt: string,
): VideoGenerationRequest {
  return {
    startImage: { kind: "file", path: resolve(repoRoot, startImage) },
    endImage: { kind: "file", path: resolve(repoRoot, endImage) },
    prompt,
    durationSeconds: VIDEO_DURATION_SECONDS,
  };
}

function submittedSettings(
  repoRoot: string,
  startImage: string,
  endImage: string,
  prompt: string,
  seed: number,
): Record<string, unknown> {
  return describeSeedance25Input(
    videoRequest(repoRoot, startImage, endImage, prompt),
    `<local file upload: ${startImage}>`,
    `<local file upload: ${endImage}>`,
    seedanceSettingsForSeed(seed),
  );
}

const SELECTOR_SYSTEM_INSTRUCTION = `You are the Cinematographer for a bounded TunnelVision Camotion experiment.

You inspect five independently generated first-person canonical stills (A, B, C, D, E) and choose a Camotion exposure strength for each still from a frozen three-value vocabulary.

This is NOT a test of whether Camotion works. Do not invent new strengths. Do not interpolate. Do not propose 0.06 or any value other than 0.02, 0.04, or 0.08.

CameraMotionPlan geometry is already frozen from Integration Test 01. Do not change vanishing points, destinations, destination protection, samples, route preservation, depth, or the operator. Choose only exposure.strength.

Existing CameraMotionPlan JSON included in the user prompt still shows strength 0.08 because that was the pinned Integration Test 01 baseline. That is NOT an instruction to copy 0.08. Choose independently from the images.

Conceptual guidance, not a schema:

LIGHT 0.02: the scene already provides strong natural motion/parallax evidence, or it contains high structured-content smear/duplication risk (rails, trunks, furniture, door frames, hanging clothes, fine repeating detail).

MEDIUM 0.04: the scene benefits from a clearer motion-state cue but does not justify aggressive conditioning.

STRONG 0.08: the scene provides weak natural motion evidence and appears to need the strongest currently-supported cue.

You MAY select 0.08. Do not force a difference from the baseline.

The same canonical may appear in more than one shot. Choose once per canonical still. Canonical B will be reused as A→B end and B→C start.

Camotion is applied independently to start and end frames of a shot, so A and B may receive different strengths.

Return ONLY one JSON object. No markdown fences. No commentary.

{
  "canonicals": {
    "A": { "label": "LIGHT" | "MEDIUM" | "STRONG", "strength": 0.02 | 0.04 | 0.08, "reasoning": "<concise>" },
    "B": { "label": "LIGHT" | "MEDIUM" | "STRONG", "strength": 0.02 | 0.04 | 0.08, "reasoning": "<concise>" },
    "C": { "label": "LIGHT" | "MEDIUM" | "STRONG", "strength": 0.02 | 0.04 | 0.08, "reasoning": "<concise>" },
    "D": { "label": "LIGHT" | "MEDIUM" | "STRONG", "strength": 0.02 | 0.04 | 0.08, "reasoning": "<concise>" },
    "E": { "label": "LIGHT" | "MEDIUM" | "STRONG", "strength": 0.02 | 0.04 | 0.08, "reasoning": "<concise>" }
  }
}

label and strength must agree.`;

function selectorUserPrompt(plans: Record<string, unknown>): string {
  return [
    "Images 1–5 are the actual pristine canonical stills A, B, C, D, E, in that order.",
    "These are Integration Test 01 canonicals. Reason from the compositions you see.",
    "",
    "Shot context (do not shoot C→D or E→A in this experiment):",
    "A is A→B start. Frozen plan: plans/A-B.json",
    "B is A→B end (shooting/A-B/end-plan.json) AND B→C start (plans/B-C.json). Choose one strength for canonical B; it will be reused in both roles with those two existing plans.",
    "C is B→C end. Frozen plan: shooting/B-C/end-plan.json",
    "D is D→E start. Frozen plan: plans/D-E.json",
    "E is D→E end. Frozen plan: shooting/D-E/end-plan.json",
    "",
    "Existing CameraMotionPlan JSON (geometry frozen; ignore the pinned 0.08 unless the image independently warrants STRONG):",
    JSON.stringify(plans, null, 2),
    "",
    "Choose LIGHT/MEDIUM/STRONG for A, B, C, D, and E. Return JSON only.",
  ].join("\n");
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}

export async function loadAuthoritativePrompts(
  repoRoot: string,
): Promise<Record<ExperimentShotId, string>> {
  const manifest = await readJson(resolve(repoRoot, INTEGRATION_MANIFEST));
  return assertAuthoritativePrompts(manifest);
}

async function assertCanonicalHashes(repoRoot: string): Promise<Record<CanonicalId, FileRef>> {
  const refs = {} as Record<CanonicalId, FileRef>;
  for (const canonical of CANONICAL_ORDER) {
    const ref = await hashRepoFile(repoRoot, `${INTEGRATION_ROOT}/canonical/${canonical}.png`);
    if (ref.sha256 !== EXPECTED_CANONICAL_SHA256[canonical]) {
      throw new Error(
        `canonical ${canonical} hash mismatch: expected ${EXPECTED_CANONICAL_SHA256[canonical]}, got ${ref.sha256}`,
      );
    }
    refs[canonical] = ref;
  }
  return refs;
}

async function assertFixedShootingHashes(repoRoot: string): Promise<void> {
  for (const pair of SHOT_PAIRS) {
    const expected = EXPECTED_FIXED_SHOOTING_SHA256[pair.shot];
    const start = await hashRepoFile(repoRoot, pair.startShooting);
    const end = await hashRepoFile(repoRoot, pair.endShooting);
    if (start.sha256 !== expected.start || end.sha256 !== expected.end) {
      throw new Error(`IT01 0.08 shooting frames for ${pair.shot} do not match Integration Test 01 hashes`);
    }
    const startPlan = await readJson(resolve(repoRoot, pair.startPlan));
    const endPlan = await readJson(resolve(repoRoot, pair.endPlan));
    const startExposure = startPlan.exposure as { strength?: unknown; samples?: unknown };
    const endExposure = endPlan.exposure as { strength?: unknown; samples?: unknown };
    if (startExposure.strength !== FIXED_STRENGTH || endExposure.strength !== FIXED_STRENGTH) {
      throw new Error(`IT01 plan for ${pair.shot} is not strength 0.08`);
    }
    if (startExposure.samples !== 16 || endExposure.samples !== 16) {
      throw new Error(`IT01 plan for ${pair.shot} is not samples 16`);
    }
  }
}

function pythonBin(repoRoot: string): string {
  return join(repoRoot, "camotion/.venv/bin/python");
}

function renderHelper(repoRoot: string): string {
  return join(repoRoot, "camotion/integration/wardrobe_loop_render.py");
}

async function validatePlanWithPython(repoRoot: string, path: string): Promise<void> {
  await execFileAsync(
    pythonBin(repoRoot),
    [
      "-c",
      "from camotion.plan import load_plan; import sys; load_plan(sys.argv[1]); print('ok')",
      path,
    ],
    { cwd: join(repoRoot, "camotion") },
  );
}

async function runPythonJobs(repoRoot: string, outputDir: string, jobs: unknown): Promise<void> {
  const jobsPath = join(outputDir, ".camotion-jobs.json");
  await writeFile(jobsPath, `${JSON.stringify(jobs, null, 2)}\n`);
  const result = await execFileAsync(pythonBin(repoRoot), [renderHelper(repoRoot), "--jobs", jobsPath], {
    cwd: repoRoot,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

async function writeAdaptivePlan(
  repoRoot: string,
  sourcePlan: string,
  destPlan: string,
  strength: AdaptiveStrength,
): Promise<void> {
  const original = await readJson(resolve(repoRoot, sourcePlan));
  const modified = planWithStrength(original, strength);
  if (
    JSON.stringify(geometryWithoutStrength(original)) !==
    JSON.stringify(geometryWithoutStrength(modified))
  ) {
    throw new Error(`plan rewrite changed geometry: ${sourcePlan}`);
  }
  await mkdir(dirname(destPlan), { recursive: true });
  await writeFile(destPlan, `${JSON.stringify(modified, null, 2)}\n`);
  await validatePlanWithPython(repoRoot, destPlan);
}

async function resolveEndpointFrame(options: {
  readonly repoRoot: string;
  readonly outputDir: string;
  readonly shot: ExperimentShotId;
  readonly role: "start" | "end";
  readonly strength: number;
  readonly it01Shooting: string;
  readonly it01Plan: string;
  readonly canonical: CanonicalId;
}): Promise<{ image: string; plan: string; rendered: boolean }> {
  const it01PlanAbs = resolve(options.repoRoot, options.it01Plan);
  if (options.strength === FIXED_STRENGTH) {
    return {
      image: options.it01Shooting,
      plan: options.it01Plan,
      rendered: false,
    };
  }
  const strength = coerceAllowedStrength(options.strength);
  const adaptiveDir = join(options.outputDir, "shooting", options.shot, "adaptive");
  const planPath = join(adaptiveDir, `${options.role}-plan.json`);
  const imagePath = join(adaptiveDir, `${options.role}.png`);
  await writeAdaptivePlan(options.repoRoot, options.it01Plan, planPath, strength);
  if (!(await fileExists(imagePath))) {
    await runPythonJobs(options.repoRoot, options.outputDir, {
      depths: [],
      vision: [],
      renders: [
        {
          image: resolve(options.repoRoot, `${INTEGRATION_ROOT}/canonical/${options.canonical}.png`),
          plan: planPath,
          depth: resolve(
            options.repoRoot,
            `${INTEGRATION_ROOT}/canonical/depth/${options.canonical}.png`,
          ),
          output: imagePath,
        },
      ],
    });
  }
  void it01PlanAbs;
  return {
    image: repoPath(options.repoRoot, imagePath),
    plan: repoPath(options.repoRoot, planPath),
    rendered: true,
  };
}

export async function defaultPrepareEndpoints(
  repoRoot: string,
  outputDir: string,
  generation: GenerationSpec,
  planning: PlanningArtifact,
): Promise<PreparedEndpoints> {
  const pair = shotPair(generation.shot);
  if (generation.condition === "fixed") {
    return {
      startImage: pair.startShooting,
      endImage: pair.endShooting,
      startPlan: pair.startPlan,
      endPlan: pair.endPlan,
      startStrength: FIXED_STRENGTH,
      endStrength: FIXED_STRENGTH,
    };
  }
  const endpoints = planning.shot_endpoint_strengths[generation.shot];
  const start = await resolveEndpointFrame({
    repoRoot,
    outputDir,
    shot: generation.shot,
    role: "start",
    strength: endpoints.start_strength,
    it01Shooting: pair.startShooting,
    it01Plan: pair.startPlan,
    canonical: pair.startCanonical,
  });
  const end = await resolveEndpointFrame({
    repoRoot,
    outputDir,
    shot: generation.shot,
    role: "end",
    strength: endpoints.end_strength,
    it01Shooting: pair.endShooting,
    it01Plan: pair.endPlan,
    canonical: pair.endCanonical,
  });
  return {
    startImage: start.image,
    endImage: end.image,
    startPlan: start.plan,
    endPlan: end.plan,
    startStrength: endpoints.start_strength,
    endStrength: endpoints.end_strength,
  };
}

async function selectWithReasoning(
  repoRoot: string,
  reasoning: ReasoningProvider,
): Promise<{
  readonly selections: Record<CanonicalId, Pick<CanonicalSelection, "strength" | "label" | "reasoning">>;
  readonly rawText: string;
  readonly model: string;
  readonly modelVersion: string | null;
  readonly predictionId: string;
  readonly elapsedMs: number;
}> {
  const plans: Record<string, unknown> = {};
  for (const pair of SHOT_PAIRS) {
    plans[`${pair.shot} start (${pair.startCanonical})`] = await readJson(
      resolve(repoRoot, pair.startPlan),
    );
    plans[`${pair.shot} end (${pair.endCanonical})`] = await readJson(
      resolve(repoRoot, pair.endPlan),
    );
  }
  const images = CANONICAL_ORDER.map((canonical) => ({
    kind: "file" as const,
    path: resolve(repoRoot, `${INTEGRATION_ROOT}/canonical/vision/${canonical}.jpg`),
  }));
  const result = await reasoning.complete({
    systemInstruction: SELECTOR_SYSTEM_INSTRUCTION,
    prompt: selectorUserPrompt(plans),
    images,
  });
  return {
    selections: parseAdaptiveSelections(result.text),
    rawText: result.text,
    model: result.model,
    modelVersion: result.modelVersion,
    predictionId: result.predictionId,
    elapsedMs: result.elapsedMs,
  };
}

function isPlanningArtifact(value: unknown): value is PlanningArtifact {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as PlanningArtifact;
  return (
    record.experiment === EXPERIMENT_ID &&
    record.frozen_before_generation === true &&
    Boolean(record.canonical_selections?.A) &&
    Boolean(record.shot_endpoint_strengths?.["A-B"])
  );
}

async function loadExistingPlanning(path: string): Promise<PlanningArtifact | null> {
  if (!(await fileExists(path))) {
    return null;
  }
  const parsed = JSON.parse(await readFile(path, "utf8"));
  if (!isPlanningArtifact(parsed)) {
    throw new Error(`${path} exists but is not a valid frozen planning artifact`);
  }
  for (const canonical of CANONICAL_ORDER) {
    const selection = parsed.canonical_selections[canonical];
    if (!isAllowedStrength(selection.strength)) {
      throw new Error(`frozen planning has illegal strength for ${canonical}`);
    }
  }
  return parsed;
}

type SelectedCanonicals = {
  readonly selections: Record<
    CanonicalId,
    Pick<CanonicalSelection, "strength" | "label" | "reasoning">
  >;
  readonly rawText: string | null;
  readonly model: string;
  readonly modelVersion: string | null;
  readonly predictionId: string | null;
  readonly elapsedMs: number | null;
  readonly source: PlanningArtifact["selector"]["source"];
};

async function buildPlanning(options: {
  readonly repoRoot: string;
  readonly now: Date;
  readonly commit: string | null;
  readonly canonicalImages: Record<CanonicalId, FileRef>;
  readonly selected: SelectedCanonicals;
}): Promise<PlanningArtifact> {
  const vision: Record<CanonicalId, FileRef> = {
    A: await hashRepoFile(options.repoRoot, `${INTEGRATION_ROOT}/canonical/vision/A.jpg`),
    B: await hashRepoFile(options.repoRoot, `${INTEGRATION_ROOT}/canonical/vision/B.jpg`),
    C: await hashRepoFile(options.repoRoot, `${INTEGRATION_ROOT}/canonical/vision/C.jpg`),
    D: await hashRepoFile(options.repoRoot, `${INTEGRATION_ROOT}/canonical/vision/D.jpg`),
    E: await hashRepoFile(options.repoRoot, `${INTEGRATION_ROOT}/canonical/vision/E.jpg`),
  };
  const planRefsByCanonical: Record<CanonicalId, FileRef[]> = {
    A: [await hashRepoFile(options.repoRoot, `${INTEGRATION_ROOT}/plans/A-B.json`)],
    B: [
      await hashRepoFile(options.repoRoot, `${INTEGRATION_ROOT}/shooting/A-B/end-plan.json`),
      await hashRepoFile(options.repoRoot, `${INTEGRATION_ROOT}/plans/B-C.json`),
    ],
    C: [await hashRepoFile(options.repoRoot, `${INTEGRATION_ROOT}/shooting/B-C/end-plan.json`)],
    D: [await hashRepoFile(options.repoRoot, `${INTEGRATION_ROOT}/plans/D-E.json`)],
    E: [await hashRepoFile(options.repoRoot, `${INTEGRATION_ROOT}/shooting/D-E/end-plan.json`)],
  };
  const canonicalSelections = {} as Record<CanonicalId, CanonicalSelection>;
  for (const canonical of CANONICAL_ORDER) {
    const choice = options.selected.selections[canonical];
    canonicalSelections[canonical] = {
      canonical,
      strength: choice.strength,
      label: choice.label,
      reasoning: choice.reasoning,
      image: options.canonicalImages[canonical],
      vision_input: vision[canonical],
      plans: planRefsByCanonical[canonical],
    };
  }
  return {
    experiment: EXPERIMENT_ID,
    title: "Wardrobe Loop scene-aware Camotion strength (fixed 0.08 vs adaptive {0.02, 0.04, 0.08})",
    frozen_before_generation: true,
    frozen_at: options.now.toISOString(),
    git_commit: options.commit,
    selector: {
      model: options.selected.model,
      model_version: options.selected.modelVersion,
      prediction_id: options.selected.predictionId,
      elapsed_ms: options.selected.elapsedMs,
      source: options.selected.source,
    },
    reuse: { B: ["A-B end", "B-C start"] },
    excluded_shots: ["C-D", "E-A"],
    allowed_strengths: ADAPTIVE_STRENGTHS,
    canonical_selections: canonicalSelections,
    shot_endpoint_strengths: shotEndpointStrengthsFromCanonicals(options.selected.selections),
    raw_selector_text: options.selected.rawText,
  };
}

async function generateWithRetry(
  provider: MediaProvider,
  request: VideoGenerationRequest,
): Promise<{
  result?: Awaited<ReturnType<MediaProvider["generateVideo"]>>;
  error?: unknown;
  retryCount: number;
}> {
  try {
    return { result: await provider.generateVideo(request), retryCount: 0 };
  } catch (first) {
    try {
      return { result: await provider.generateVideo(request), retryCount: 1 };
    } catch (second) {
      return { error: second, retryCount: 1 };
    }
  }
}

function failureFields(error: unknown): {
  error: string;
  error_code: string;
  prediction_id: string | null;
} {
  const mediaError = error instanceof MediaGenerationError ? error : null;
  return {
    error: mediaError
      ? mediaError.providerMessage ?? mediaError.message
      : error instanceof Error
        ? error.message
        : String(error),
    error_code: mediaError?.code ?? "generation_failed",
    prediction_id: mediaError?.predictionId ?? null,
  };
}

export async function runSceneAwareStrength(
  options: RunExperimentOptions,
): Promise<ExperimentManifest> {
  assertExperimentContract();
  const prompts = await loadAuthoritativePrompts(options.repoRoot);
  const canonicalImages = await assertCanonicalHashes(options.repoRoot);
  await assertFixedShootingHashes(options.repoRoot);
  const outputDir = options.outputDir ?? defaultOutputDir(options.repoRoot);
  await mkdir(outputDir, { recursive: true });
  const token = getOptionalEnv("REPLICATE_API_TOKEN");
  const now = options.now ?? (() => new Date());
  const commit = await gitCommit(options.repoRoot);
  const frozenPath = planningPath(outputDir);

  let planning = await loadExistingPlanning(frozenPath);
  if (!planning) {
    const selected = options.selectCanonicals
      ? await options.selectCanonicals()
      : await (async () => {
          const reasoning = options.reasoning ?? new ReplicateReasoningProvider();
          try {
            const first = await selectWithReasoning(options.repoRoot, reasoning);
            return { ...first, source: "reasoning" as const };
          } catch (error) {
            const retry = await selectWithReasoning(options.repoRoot, reasoning);
            void error;
            return { ...retry, source: "reasoning" as const };
          }
        })();
    planning = await buildPlanning({
      repoRoot: options.repoRoot,
      now: now(),
      commit,
      canonicalImages,
      selected,
    });
    assertSafe(planning, token);
    await writeFile(frozenPath, `${JSON.stringify(planning, null, 2)}\n`);
  }

  if (!(await fileExists(frozenPath))) {
    throw new Error("adaptive selections were not frozen before generation");
  }

  const generations: GenerationRecord[] = [];
  let videosStartedAt: string | null = null;

  for (const generation of GENERATIONS) {
    const pair = shotPair(generation.shot);
    const prepared = options.prepareEndpoints
      ? await options.prepareEndpoints(generation, planning)
      : await defaultPrepareEndpoints(options.repoRoot, outputDir, generation, planning);
    const startImage = await hashRepoFile(options.repoRoot, prepared.startImage);
    const endImage = await hashRepoFile(options.repoRoot, prepared.endImage);
    const startPlan = await hashRepoFile(options.repoRoot, prepared.startPlan);
    const endPlan = await hashRepoFile(options.repoRoot, prepared.endPlan);
    const prompt = prompts[generation.shot];
    const settings = submittedSettings(
      options.repoRoot,
      prepared.startImage,
      prepared.endImage,
      prompt,
      generation.seed,
    );
    const outputPath = join(outputDir, generation.filename);
    const startedAt = now();

    if (!options.execute) {
      const completedAt = now();
      generations.push({
        id: generation.id,
        filename: generation.filename,
        shot: generation.shot,
        condition: generation.condition,
        start_canonical: pair.startCanonical,
        end_canonical: pair.endCanonical,
        start_strength: prepared.startStrength,
        end_strength: prepared.endStrength,
        start_image: startImage,
        end_image: endImage,
        start_plan: startPlan,
        end_plan: endPlan,
        prompt,
        seed_submitted: generation.seed,
        seed_reported: null,
        settings,
        prediction_id: null,
        output_url: null,
        output_path: repoPath(options.repoRoot, outputPath),
        status: "dry_run",
        error: null,
        error_code: null,
        retry_count: 0,
        started_at: startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        elapsed_ms: 0,
      });
      continue;
    }

    if (await fileExists(outputPath)) {
      const completedAt = now();
      generations.push({
        id: generation.id,
        filename: generation.filename,
        shot: generation.shot,
        condition: generation.condition,
        start_canonical: pair.startCanonical,
        end_canonical: pair.endCanonical,
        start_strength: prepared.startStrength,
        end_strength: prepared.endStrength,
        start_image: startImage,
        end_image: endImage,
        start_plan: startPlan,
        end_plan: endPlan,
        prompt,
        seed_submitted: generation.seed,
        seed_reported: null,
        settings,
        prediction_id: null,
        output_url: null,
        output_path: repoPath(options.repoRoot, outputPath),
        status: "skipped",
        error: null,
        error_code: null,
        retry_count: 0,
        started_at: startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        elapsed_ms: 0,
      });
      continue;
    }

    if (!(await fileExists(frozenPath))) {
      throw new Error("planning.json disappeared before Seedance generation");
    }
    videosStartedAt ??= now().toISOString();
    console.log(
      `seedance ${generation.id} seed=${generation.seed} strengths=${prepared.startStrength}/${prepared.endStrength}`,
    );

    const provider =
      options.createVideoProvider?.(generation.seed) ??
      options.provider ??
      new ReplicateMediaProvider({
        model: VIDEO_MODEL,
        seedance: seedanceSettingsForSeed(generation.seed),
      });

    const attempt = await generateWithRetry(
      provider,
      videoRequest(options.repoRoot, prepared.startImage, prepared.endImage, prompt),
    );
    const completedAt = now();
    if (attempt.result) {
      const bytes = await (options.fetchOutput ?? download)(attempt.result.outputUrl);
      await writeFile(outputPath, bytes);
      generations.push({
        id: generation.id,
        filename: generation.filename,
        shot: generation.shot,
        condition: generation.condition,
        start_canonical: pair.startCanonical,
        end_canonical: pair.endCanonical,
        start_strength: prepared.startStrength,
        end_strength: prepared.endStrength,
        start_image: startImage,
        end_image: endImage,
        start_plan: startPlan,
        end_plan: endPlan,
        prompt,
        seed_submitted: generation.seed,
        seed_reported: reportedSeed(attempt.result.metadata),
        settings,
        prediction_id: attempt.result.predictionId,
        output_url: attempt.result.outputUrl,
        output_path: repoPath(options.repoRoot, outputPath),
        status: "succeeded",
        error: null,
        error_code: null,
        retry_count: attempt.retryCount,
        started_at: attempt.result.startedAt || startedAt.toISOString(),
        completed_at: attempt.result.completedAt || completedAt.toISOString(),
        elapsed_ms: attempt.result.elapsedMs,
      });
    } else {
      const failed = failureFields(attempt.error);
      generations.push({
        id: generation.id,
        filename: generation.filename,
        shot: generation.shot,
        condition: generation.condition,
        start_canonical: pair.startCanonical,
        end_canonical: pair.endCanonical,
        start_strength: prepared.startStrength,
        end_strength: prepared.endStrength,
        start_image: startImage,
        end_image: endImage,
        start_plan: startPlan,
        end_plan: endPlan,
        prompt,
        seed_submitted: generation.seed,
        seed_reported: null,
        settings,
        prediction_id: failed.prediction_id,
        output_url: null,
        output_path: null,
        status: "failed",
        error: failed.error,
        error_code: failed.error_code,
        retry_count: attempt.retryCount,
        started_at: startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        elapsed_ms: completedAt.getTime() - startedAt.getTime(),
      });
    }
  }

  const controlIssues = pairControlsHeld(generations);
  if (controlIssues.length > 0) {
    throw new Error(`paired controls were not held: ${controlIssues.join("; ")}`);
  }

  const manifest: ExperimentManifest = {
    experiment: EXPERIMENT_ID,
    title: "Wardrobe Loop scene-aware Camotion strength",
    git_commit: commit,
    model: VIDEO_MODEL,
    planning_path: repoPath(options.repoRoot, frozenPath),
    planning_frozen_at: planning.frozen_at,
    videos_started_at: videosStartedAt,
    independent_variable: "camotion_endpoint_strength_policy",
    excluded_shots: ["C-D", "E-A"],
    shared_settings: {
      duration: VIDEO_DURATION_SECONDS,
      resolution: SEEDANCE_SHARED.resolution,
      aspect_ratio: SEEDANCE_SHARED.aspectRatio,
      generate_audio: SEEDANCE_SHARED.generateAudio,
      watermark: SEEDANCE_SHARED.watermark,
      output_format: SEEDANCE_SHARED.outputFormat,
    },
    planning,
    generations,
  };
  assertSafe(manifest, token);
  await writeFile(join(outputDir, "generation-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

async function writeProtocol(outputDir: string): Promise<void> {
  const path = join(outputDir, "PROTOCOL.md");
  if (await fileExists(path)) {
    return;
  }
  const text = `# Scene-aware Camotion strength

Not Camotion 01.13. The 01.8 operator is unchanged. 01.12 is not reopened.

Research question: can scene-aware selection from \`{0.02, 0.04, 0.08}\` improve video behavior across already-shootable Wardrobe Loop shots compared with fixed \`0.08\`?

Shots: A→B (seed 80), B→C (seed 81), D→E (seed 82). Not C→D. Not E→A.

Control uses Integration Test 01 01.8 route-preserved shooting frames at strength 0.08.
Adaptive uses the same 01.8 renderer; only \`CameraMotionPlan.exposure.strength\` may differ, chosen before any Seedance call.

Prompts are the authoritative Integration Test 01 Seedance prompts, identical within each pair. \`COMMON_VIDEO_INTENT\` is not prepended.

Do not declare a winner in this directory. Human evaluation comes first.
`;
  await writeFile(path, text);
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
  const outputDir = defaultOutputDir(repoRoot);
  await mkdir(outputDir, { recursive: true });
  await writeProtocol(outputDir);
  console.log(
    execute
      ? `Executing ${EXPERIMENT_ID} sequentially after freezing adaptive selections`
      : `Dry-run ${EXPERIMENT_ID} (pass --execute for paid Seedance calls)`,
  );
  const manifest = await runSceneAwareStrength({ repoRoot, execute });
  console.log(`planning: ${manifest.planning_path}`);
  console.log(`frozen_at: ${manifest.planning_frozen_at}`);
  console.log(`videos_started_at: ${manifest.videos_started_at ?? "none"}`);
  for (const canonical of CANONICAL_ORDER) {
    const selection = manifest.planning.canonical_selections[canonical];
    console.log(
      `canonical ${canonical}: ${selection.label} ${selection.strength} — ${selection.reasoning}`,
    );
  }
  for (const generation of manifest.generations) {
    console.log(
      [
        generation.id,
        generation.status,
        `strengths=${generation.start_strength}/${generation.end_strength}`,
        `seed=${generation.seed_submitted}`,
        `retry=${generation.retry_count}`,
        `prediction=${generation.prediction_id ?? "none"}`,
        generation.output_path ?? "no output",
      ].join("  "),
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
