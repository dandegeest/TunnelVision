import { getOptionalEnv } from "../media/src/config/environment.ts";
import { productionCameraMotionPlan } from "../media/src/cinematographer/camera-motion-plan.ts";
import type { CameraMotionPlanV1 } from "../media/src/cinematographer/plan-shot.ts";
import {
  DEFAULT_LOCOMOTION_PACE,
  isLocomotionPace,
  locomotionBaseline,
  locomotionPaceList,
  composeShootingPrompt,
  type LocomotionPace,
} from "../media/src/cinematographer/shooting-prompt.ts";
import {
  DEFAULT_VIDEO_MODEL_ID,
  parseVideoModelId,
  videoModelDurationSeconds,
  videoModelSlug,
  type VideoModelId,
} from "../media/src/replicate/video-models.ts";
import type { GeneratedVideo, VideoGenerationRequest } from "../media/src/types.ts";
import type { CamotionRenderResult } from "./camotion-cli.ts";
import type { CamotionDebug } from "./src/project/types.ts";
import { getActiveRuntimeMediaRegistry } from "./runtime-media.ts";
import { resolveTrustedMedia } from "./trusted-media.ts";

export const JOURNEY_VIDEO_DURATION_SECONDS = videoModelDurationSeconds(DEFAULT_VIDEO_MODEL_ID);

export type ShootJourneyBody = {
  journeyId?: unknown;
  startMediaId?: unknown;
  endMediaId?: unknown;
  segmentPromptAddition?: unknown;
  pace?: unknown;
  videoModel?: unknown;
  debug?: unknown;
};

export type JourneyShotTakeResult = {
  journeyId: string;
  startShootingFrame: { mediaId: string; imageUrl: string };
  endShootingFrame: { mediaId: string; imageUrl: string };
  startPlan: CameraMotionPlanV1;
  endPlan: CameraMotionPlanV1;
  segmentPromptAddition: string;
  effectivePrompt: string;
  pace: LocomotionPace;
  provider: string;
  model: string;
  modelVersion: string | null;
  durationSeconds: number;
  seed?: number;
  videoUrl: string;
  providerOutputUrl: string;
  videoInputs: { startShootingFrame: true; endShootingFrame: true };
  camotion: CamotionDebug;
};

function requiredId(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

function locomotionPaceFromBody(value: unknown): LocomotionPace {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_LOCOMOTION_PACE;
  }
  if (!isLocomotionPace(value)) {
    throw new Error(`Pace must be ${locomotionPaceList()}`);
  }
  return value;
}

function optionalSeed(): number | undefined {
  const raw = getOptionalEnv("TUNNELVISION_VIDEO_SEED");
  if (!raw) {
    return undefined;
  }
  const seed = Number(raw);
  if (!Number.isInteger(seed)) {
    return undefined;
  }
  return seed;
}

function asCamotionRender(result: Buffer | CamotionRenderResult): Partial<CamotionRenderResult> & {
  bytes: Buffer;
} {
  if (Buffer.isBuffer(result)) {
    return { bytes: result };
  }
  return result;
}

/**
 * One prepared directed leg → Camotion A′/B′ → composed prompt → video.
 * Video generation receives A′ as the start image and B′ as the last frame.
 */
export async function shootPreparedJourney(input: {
  repoRoot: string;
  body: ShootJourneyBody;
  renderFrame: (
    imagePath: string,
    plan: CameraMotionPlanV1,
  ) => Promise<Buffer | CamotionRenderResult>;
  generateVideo: (request: VideoGenerationRequest) => Promise<GeneratedVideo>;
}): Promise<JourneyShotTakeResult> {
  const journeyId = requiredId(input.body.journeyId, "journeyId");
  const startMediaId = requiredId(input.body.startMediaId, "startMediaId");
  const endMediaId = requiredId(input.body.endMediaId, "endMediaId");
  if (startMediaId === endMediaId) {
    throw new Error("A journey requires two actual destinations");
  }
  const retainWorkDir = input.body.debug === true;
  const segmentPromptAddition =
    typeof input.body.segmentPromptAddition === "string" ? input.body.segmentPromptAddition : "";
  const pace = locomotionPaceFromBody(input.body.pace);
  const startImage = resolveTrustedMedia(input.repoRoot, startMediaId);
  const endImage = resolveTrustedMedia(input.repoRoot, endMediaId);
  if (startImage.kind !== "file" || endImage.kind !== "file") {
    throw new Error("Canonical stills must be trusted local media");
  }
  const plan = productionCameraMotionPlan();
  const [startRender, endRender] = await Promise.all([
    input.renderFrame(startImage.path, plan).then(asCamotionRender),
    input.renderFrame(endImage.path, plan).then(asCamotionRender),
  ]);
  const registry = getActiveRuntimeMediaRegistry();
  if (!registry) {
    throw new Error("Shoot failed.");
  }
  const startShootingFrame = registry.register(startRender.bytes, "image/png");
  const endShootingFrame = registry.register(endRender.bytes, "image/png");
  const effectivePrompt = composeShootingPrompt(
    locomotionBaseline(pace),
    segmentPromptAddition,
  );
  const seed = optionalSeed();
  const videoModelId = videoModelIdFromBody(input.body.videoModel);
  const durationSeconds = videoModelDurationSeconds(videoModelId);
  const generated = await input.generateVideo({
    startImage: { kind: "file", path: startShootingFrame.filePath },
    endImage: { kind: "file", path: endShootingFrame.filePath },
    prompt: effectivePrompt,
    durationSeconds,
    ...(seed !== undefined ? { seed } : {}),
  });
  return {
    journeyId,
    startShootingFrame: {
      mediaId: startShootingFrame.mediaId,
      imageUrl: startShootingFrame.imageUrl,
    },
    endShootingFrame: {
      mediaId: endShootingFrame.mediaId,
      imageUrl: endShootingFrame.imageUrl,
    },
    startPlan: plan,
    endPlan: plan,
    segmentPromptAddition: segmentPromptAddition.trim(),
    effectivePrompt,
    pace,
    provider: generated.provider,
    model: generated.model,
    modelVersion: generated.modelVersion,
    durationSeconds,
    ...(typeof generated.metadata.seed === "number"
      ? { seed: generated.metadata.seed }
      : seed !== undefined
        ? { seed }
        : {}),
    videoUrl: generated.outputUrl,
    providerOutputUrl: generated.outputUrl,
    videoInputs: { startShootingFrame: true, endShootingFrame: true },
    camotion: {
      ...(startRender.workDir
        ? { startWorkDir: startRender.workDir, startOutput: startRender.outputPath }
        : {}),
      ...(endRender.workDir
        ? { endWorkDir: endRender.workDir, endOutput: endRender.outputPath }
        : {}),
      depthSupplied: false,
      depthPath: null,
      workDirRetained: retainWorkDir && Boolean(startRender.workDir || endRender.workDir),
    },
  };
}

export function videoModelIdFromBody(value: unknown): VideoModelId {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_VIDEO_MODEL_ID;
  }
  const parsed = parseVideoModelId(value);
  if (!parsed) {
    throw new Error("Unknown video model");
  }
  return parsed;
}

export function configuredVideoModel(): string {
  return getOptionalEnv("TUNNELVISION_VIDEO_MODEL") ?? videoModelSlug(DEFAULT_VIDEO_MODEL_ID);
}
