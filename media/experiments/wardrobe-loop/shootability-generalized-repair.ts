import { parseArgs } from "node:util";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  ReplicateMediaProvider,
  ReplicateReasoningProvider,
  describeFlux11ProUltraInput,
  parseJsonObject,
  type MediaProvider,
  type ReasoningProvider,
} from "../../src/index.ts";
import { assertNoSecret } from "../../src/errors.ts";
import { isApproximately16x9, pngDimensions } from "../../src/image-file.ts";
import { loadDotEnvLocal, getOptionalEnv } from "../../src/config/environment.ts";
import { gitCommit } from "../runner.ts";
import { IMAGE_MODEL, SHARED_VISUAL_LANGUAGE } from "./story.ts";
import {
  EXPECTED_CANONICAL_SHA256,
  INTEGRATION_ROOT,
  hashRepoFile,
  type FileRef,
} from "./scene-aware-strength.ts";
import {
  CANONICAL_PATHS,
  HISTORICAL_E_A,
  parseLegReview,
  parseShootabilityDecision,
  parseXSpecification,
  type ShootabilityDecision,
  type Stage1Record,
  type Stage2Record,
  type Stage3Record,
} from "./shootability-intermediate.ts";

const execFileAsync = promisify(execFile);

export const EXPERIMENT_ID = "shootability-generalized-repair";
export const REASONING_MODEL = "google/gemini-3.1-pro";
export const X_CANONICAL_SEED = 10107;
export const PARENT_EXPERIMENT_ID = "shootability-intermediate-volume";
export const PARENT_X_SEED = 10106;

export type StopReason =
  | "direct_declared_shootable"
  | "leg_not_shootable"
  | "both_legs_shootable"
  | "incomplete";

export type Diagnosis = {
  readonly camera_position_e: string;
  readonly camera_orientation_e: string;
  readonly camera_position_a: string;
  readonly camera_orientation_a: string;
  readonly visible_geometry: string;
  readonly thresholds: string;
  readonly occlusion: string;
  readonly missing_spatial_volume: string;
  readonly spatial_strategy: string;
  readonly physical_route: string;
};

export type FollowOnStage1Record = Stage1Record & {
  readonly diagnosis: Diagnosis;
};

export type ExperimentManifest = {
  readonly experiment: string;
  readonly parent_experiment: string;
  readonly git_commit: string | null;
  readonly stop_reason: StopReason;
  readonly camotion_run: false;
  readonly video_generated: false;
  readonly stage1: FollowOnStage1Record;
  readonly stage2: Stage2Record | null;
  readonly x_generation: Record<string, unknown> | null;
  readonly stage3: Stage3Record | null;
};

export type RunOptions = {
  readonly repoRoot: string;
  readonly execute: boolean;
  readonly outputDir?: string;
  readonly reasoning?: ReasoningProvider;
  readonly imageProvider?: MediaProvider;
  readonly stage1?: () => Promise<{
    readonly decision: ShootabilityDecision;
    readonly reasoning: string;
    readonly diagnosis: Diagnosis;
    readonly x_spec: Omit<
      Stage2Record,
      "frozen_before_x_generation" | "frozen_at" | "model" | "prediction_id" | "source" | "raw_text"
    > | null;
    readonly model: string;
    readonly prediction_id: string | null;
    readonly source: "reasoning" | "injected" | "existing_file";
    readonly raw_text: string | null;
  }>;
  readonly stage3?: (xImage: FileRef) => Promise<Omit<Stage3Record, "frozen_before_video" | "frozen_at" | "x_image">>;
  readonly fetchOutput?: (url: string) => Promise<Buffer>;
  readonly now?: () => Date;
};

export const GENERALIZED_PRINCIPLES = [
  "A proposed intermediate must create a physically traversable camera route between the actual endpoint images.",
  "Prefer continuous spatial handoffs over semantic connections.",
  "The camera should be able to move through plausible intermediate positions rather than relying on scene replacement, morphing, or an unexplained camera teleport.",
  "A destination object is not enough. The shot needs traversable depth through the transition.",
].join(" ");

export const STAGE1_SYSTEM = `You are the Cinematographer for TunnelVision.

You inspect two independently generated first-person canonical stills and judge whether the requested camera move can be photographed as one continuous physical first-person traversal while preserving both endpoint states.

You do not generate images or video. Reason from the ACTUAL compositions you see.

Filmmaking principle:
${GENERALIZED_PRINCIPLES}

Diagnose camera position, camera orientation, visible geometry, thresholds, occlusion, and any missing spatial volume. If an intermediate camera position is required, propose one concrete physical place X on a continuous route. X is a CAMERA POSITION, not semantic connective tissue and not a 50/50 morph.

Return ONLY one JSON object:
{
  "decision": "SHOOTABLE" | "NEEDS_INTERMEDIATE",
  "reasoning": "<concise image-grounded reasoning>",
  "diagnosis": {
    "camera_position_e": "<where the camera is in image 1>",
    "camera_orientation_e": "<where it is looking / facing>",
    "camera_position_a": "<where the camera is in image 2>",
    "camera_orientation_a": "<where it is looking / facing>",
    "visible_geometry": "<shared or conflicting geometry>",
    "thresholds": "<openings, doors, portals, and whether they have depth>",
    "occlusion": "<what hides or fails to hide the destination world>",
    "missing_spatial_volume": "<what physical space is not evidenced>",
    "spatial_strategy": "<best physical strategy for connecting E to A>",
    "physical_route": "<how the camera would physically travel, including any E→X→A>"
  },
  "x_spec": null | {
    "camera_position": "<where the camera physically is at X>",
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
}

SHOOTABLE means E→A can plausibly be filmed as one continuous 6-second first-person move; then x_spec must be null.
NEEDS_INTERMEDIATE means the direct transition lacks a physically traversable camera route; then x_spec is required.
image_prompt must describe one physically believable first-person place, cinematic dark-fantasy realism, no people, no text, 16:9.
Do not assume the answer. Do not mention provider knobs.`;

export const STAGE3_SYSTEM = `You are the Cinematographer for TunnelVision.

You inspect the ACTUAL generated intermediate canonical X together with E and A. Do not assume X matched the request.

Judge each leg independently: E→X and X→A.

For each leg, determine whether there is a plausible continuous physical camera route. Consider camera position, camera orientation, perspective, thresholds/openings, traversable depth, structural correspondence, occlusion, whether intermediate camera positions can plausibly exist, and whether the transition requires morphing, replacement, or teleportation.

A destination object is not enough. The shot needs traversable depth through the transition. Prefer continuous spatial handoffs over semantic connections.

Return ONLY JSON:
{
  "E-X": { "decision": "SHOOTABLE" | "NOT_SHOOTABLE", "reasoning": "<image-grounded>" },
  "X-A": { "decision": "SHOOTABLE" | "NOT_SHOOTABLE", "reasoning": "<image-grounded>" }
}`;

const DIAGNOSIS_KEYS = [
  "camera_position_e",
  "camera_orientation_e",
  "camera_position_a",
  "camera_orientation_a",
  "visible_geometry",
  "thresholds",
  "occlusion",
  "missing_spatial_volume",
  "spatial_strategy",
  "physical_route",
] as const;

export function defaultOutputDir(repoRoot: string): string {
  return join(repoRoot, INTEGRATION_ROOT, "experiments", EXPERIMENT_ID);
}

export function assertExperimentContract(): void {
  if (X_CANONICAL_SEED !== PARENT_X_SEED + 1) {
    throw new Error("follow-on X seed must continue the wardrobe canonical seed sequence after 10106");
  }
  if (EXPERIMENT_ID === PARENT_EXPERIMENT_ID) {
    throw new Error("follow-on experiment id must be distinct from the parent");
  }
}

export function assertPromptsAreBlind(text: string): void {
  const forbidden = [
    /\bhouses?\b/i,
    /\bwindows?\b/i,
    /\bupstairs\b/i,
    /\bsecond[-\s]?stor(y|ies)\b/i,
    /\bexterior house\b/i,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      throw new Error(`follow-on prompts must not mention withheld solutions (${pattern})`);
    }
  }
}

export function parseDiagnosis(value: unknown): Diagnosis {
  if (!value || typeof value !== "object") {
    throw new Error("diagnosis is required");
  }
  const record = value as Record<string, unknown>;
  const diagnosis = {} as Record<(typeof DIAGNOSIS_KEYS)[number], string>;
  for (const key of DIAGNOSIS_KEYS) {
    const item = record[key];
    if (typeof item !== "string" || !item.trim()) {
      throw new Error(`diagnosis is missing ${key}`);
    }
    diagnosis[key] = item.trim();
  }
  return diagnosis;
}

export function parseFollowOnStage1(text: string): {
  readonly decision: ShootabilityDecision;
  readonly reasoning: string;
  readonly diagnosis: Diagnosis;
  readonly x_spec: Omit<
    Stage2Record,
    "frozen_before_x_generation" | "frozen_at" | "model" | "prediction_id" | "source" | "raw_text"
  > | null;
} {
  const raw = parseJsonObject(text);
  if (!raw || typeof raw !== "object") {
    throw new Error("follow-on stage 1 output was not a JSON object");
  }
  const record = raw as Record<string, unknown>;
  const { decision, reasoning } = parseShootabilityDecision(JSON.stringify({
    decision: record.decision,
    reasoning: record.reasoning,
  }));
  const diagnosis = parseDiagnosis(record.diagnosis);
  if (decision === "SHOOTABLE") {
    if (record.x_spec !== null && record.x_spec !== undefined) {
      throw new Error("SHOOTABLE stage 1 must set x_spec to null");
    }
    return { decision, reasoning, diagnosis, x_spec: null };
  }
  if (record.x_spec === null || record.x_spec === undefined) {
    throw new Error("NEEDS_INTERMEDIATE requires an x_spec");
  }
  return {
    decision,
    reasoning,
    diagnosis,
    x_spec: parseXSpecification(JSON.stringify(record.x_spec)),
  };
}

function repoPath(repoRoot: string, path: string): string {
  return relative(repoRoot, path).split("\\").join("/");
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

async function writeVisionJpeg(repoRoot: string, outputDir: string, xPath: string, visionPath: string): Promise<void> {
  const jobsPath = join(outputDir, ".vision-jobs.json");
  await writeFile(
    jobsPath,
    `${JSON.stringify({ depths: [], vision: [{ image: xPath, output: visionPath }], renders: [] }, null, 2)}\n`,
  );
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

function stage1UserPrompt(plans: unknown): string {
  return [
    "Image 1 is canonical E (start). Image 2 is canonical A (end).",
    "Requested move: first-person travel from the luminous cavern with an ordinary bedroom door to the cozy attic bedroom containing the wardrobe.",
    "Journey context: passing through that cavern door is intended to return the viewer to the original bedroom.",
    "",
    "Existing Integration Test 01 CameraMotionPlan JSON (geometry context only; do not treat it as a shootability verdict):",
    JSON.stringify(plans, null, 2),
    "",
    `Visual language to respect, not a morph recipe: ${SHARED_VISUAL_LANGUAGE}`,
    "",
    "Diagnose whether E→A is physically shootable. If not, propose one concrete intermediate CAMERA POSITION X.",
    "Return JSON only.",
  ].join("\n");
}

export async function runGeneralizedRepairExperiment(options: RunOptions): Promise<ExperimentManifest> {
  assertExperimentContract();
  assertPromptsAreBlind(`${STAGE1_SYSTEM}\n${STAGE3_SYSTEM}\n${GENERALIZED_PRINCIPLES}`);
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
  let stage1 = await readJsonFile<FollowOnStage1Record>(stage1Path);
  let parsedX:
    | Omit<Stage2Record, "frozen_before_x_generation" | "frozen_at" | "model" | "prediction_id" | "source" | "raw_text">
    | null = null;
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
          const parsed = parseFollowOnStage1(result.text);
          return {
            ...parsed,
            model: result.model,
            prediction_id: result.predictionId,
            source: "reasoning" as const,
            raw_text: result.text,
          };
        })();
    parsedX = selected.x_spec;
    stage1 = {
      frozen_before_generation: true,
      frozen_at: now().toISOString(),
      decision: selected.decision,
      reasoning: selected.reasoning,
      diagnosis: selected.diagnosis,
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

  const writeManifest = async (
    stopReason: StopReason,
    stage2: Stage2Record | null,
    xGeneration: Record<string, unknown> | null,
    stage3: Stage3Record | null,
  ): Promise<ExperimentManifest> => {
    const manifest: ExperimentManifest = {
      experiment: EXPERIMENT_ID,
      parent_experiment: PARENT_EXPERIMENT_ID,
      git_commit: commit,
      stop_reason: stopReason,
      camotion_run: false,
      video_generated: false,
      stage1,
      stage2,
      x_generation: xGeneration,
      stage3,
    };
    await writeJson(join(outputDir, "generation-manifest.json"), manifest, token);
    return manifest;
  };

  if (stage1.decision === "SHOOTABLE") {
    return writeManifest("direct_declared_shootable", null, null, null);
  }

  const stage2Path = join(outputDir, "stage2-x-spec.json");
  let stage2 = await readJsonFile<Stage2Record>(stage2Path);
  if (!stage2) {
    if (!parsedX) {
      if (!stage1.raw_text) {
        throw new Error("cannot freeze X spec without stage 1 raw_text or an injected x_spec");
      }
      parsedX = parseFollowOnStage1(stage1.raw_text).x_spec;
    }
    if (!parsedX) {
      throw new Error("NEEDS_INTERMEDIATE stage 1 did not include an x_spec");
    }
    stage2 = {
      frozen_before_x_generation: true,
      frozen_at: now().toISOString(),
      ...parsedX,
      model: stage1.model,
      prediction_id: stage1.prediction_id,
      source: stage1.source,
      raw_text: stage1.raw_text,
    };
    await writeJson(stage2Path, stage2, token);
  }

  const xPath = join(outputDir, "canonical/X.png");
  let xGeneration: Record<string, unknown> | null = await readJsonFile(join(outputDir, "canonical/X-generation.json"));
  if (!(await fileExists(xPath))) {
    if (!options.execute) {
      return writeManifest("incomplete", stage2, null, null);
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
  const visionPath = join(outputDir, "canonical/vision/X.jpg");
  if (!options.stage3 && !(await fileExists(visionPath))) {
    await writeVisionJpeg(options.repoRoot, outputDir, xPath, visionPath);
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
            "Image 1 is E. Image 2 is the ACTUAL generated X. Image 3 is A. Judge E→X and X→A independently. Return JSON only.",
            [
              { kind: "file", path: resolve(options.repoRoot, `${INTEGRATION_ROOT}/canonical/vision/E.jpg`) },
              { kind: "file", path: visionPath },
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

  const stopReason: StopReason =
    stage3.e_to_x.decision === "SHOOTABLE" && stage3.x_to_a.decision === "SHOOTABLE"
      ? "both_legs_shootable"
      : "leg_not_shootable";
  return writeManifest(stopReason, stage2, xGeneration, stage3);
}

async function writeProtocol(outputDir: string): Promise<void> {
  const path = join(outputDir, "PROTOCOL.md");
  if (await fileExists(path)) return;
  await writeFile(
    path,
    `# Generalized spatial repair reasoning (E→X→A follow-on)

Not a Camotion experiment. Camotion Phase 1 remains frozen.
Not a product-architecture change.

Parent: \`shootability-intermediate-volume\`. Reuse Integration Test 01 canonical E and A exactly.

Research question: can a filmmaking agent generalize a learned spatial-continuity principle into a viable set/camera strategy, rather than merely proposing a semantically plausible intermediate image?

Stage 1 inspects actual E and A with the generalized traversability principle and freezes any proposed X before generation.
Stage 3 inspects the actual generated X. If either E→X or X→A is NOT_SHOOTABLE, stop. If both are SHOOTABLE, stop before Camotion or video.

Do not regenerate X. Do not run Camotion. Do not generate Seedance video.
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
  assertPromptsAreBlind(`${STAGE1_SYSTEM}\n${STAGE3_SYSTEM}`);
  const outputDir = defaultOutputDir(repoRoot);
  await mkdir(outputDir, { recursive: true });
  await writeProtocol(outputDir);
  console.log(
    execute
      ? `Executing ${EXPERIMENT_ID}`
      : `Dry-run ${EXPERIMENT_ID} (reasoning freeze may still run; pass --execute for FLUX X only)`,
  );
  const manifest = await runGeneralizedRepairExperiment({ repoRoot, execute });
  console.log(`stop_reason=${manifest.stop_reason}`);
  console.log(`stage1=${manifest.stage1.decision}`);
  console.log(manifest.stage1.reasoning);
  if (manifest.stage2) {
    console.log(`X camera_position=${manifest.stage2.camera_position}`);
  }
  if (manifest.stage3) {
    console.log(`E-X=${manifest.stage3.e_to_x.decision} X-A=${manifest.stage3.x_to_a.decision}`);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  await main();
}
