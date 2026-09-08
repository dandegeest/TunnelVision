import { getOptionalEnv } from "../media/src/config/environment.ts";
import { productionCameraMotionPlan } from "../media/src/cinematographer/camera-motion-plan.ts";
import type { CameraMotionPlanV1 } from "../media/src/cinematographer/plan-shot.ts";
import {
  TUNNELVISION_LOCOMOTION_BASELINE,
  composeShootingPrompt,
} from "../media/src/cinematographer/shooting-prompt.ts";
import { P_VIDEO_MODEL } from "../media/src/replicate/p-video.ts";
import type { GeneratedVideo, VideoGenerationRequest } from "../media/src/types.ts";
import { resolveTrustedMedia } from "./trusted-media.ts";
import { getActiveRuntimeMediaRegistry } from "./runtime-media.ts";

export const JOURNEY_VIDEO_DURATION_SECONDS = 6;

export type ShootJourneyBody = {
  journeyId?: unknown;
  startMediaId?: unknown;
  endMediaId?: unknown;
  segmentPromptAddition?: unknown;
};

export type JourneyShotTakeResult = {
  journeyId: string;
  startShootingFrame: { mediaId: string; imageUrl: string };
  endShootingFrame: { mediaId: string; imageUrl: string };
  startPlan: CameraMotionPlanV1;
  endPlan: CameraMotionPlanV1;
  segmentPromptAddition: string;
  effectivePrompt: string;
  provider: string;
  model: string;
  modelVersion: string | null;
  durationSeconds: number;
  seed?: number;
  videoUrl: string;
  providerOutputUrl: string;
  videoInputs: { startShootingFrame: true; endShootingFrame: true };
};

function requiredId(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required`);
  }
  return value.trim();
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

/**
 * One prepared directed leg → Camotion A′/B′ → composed prompt → video.
 * Video generation receives A′ as the start image and B′ as the last frame.
 */
export async function shootPreparedJourney(input: {
  repoRoot: string;
  body: ShootJourneyBody;
  renderFrame: (imagePath: string, plan: CameraMotionPlanV1) => Promise<Buffer>;
  generateVideo: (request: VideoGenerationRequest) => Promise<GeneratedVideo>;
}): Promise<JourneyShotTakeResult> {
  const journeyId = requiredId(input.body.journeyId, "journeyId");
  const startMediaId = requiredId(input.body.startMediaId, "startMediaId");
  const endMediaId = requiredId(input.body.endMediaId, "endMediaId");
  if (startMediaId === endMediaId) {
    throw new Error("A journey requires two actual destinations");
  }
  const segmentPromptAddition =
    typeof input.body.segmentPromptAddition === "string" ? input.body.segmentPromptAddition : "";
  const startImage = resolveTrustedMedia(input.repoRoot, startMediaId);
  const endImage = resolveTrustedMedia(input.repoRoot, endMediaId);
  if (startImage.kind !== "file" || endImage.kind !== "file") {
    throw new Error("Canonical stills must be trusted local media");
  }
  const plan = productionCameraMotionPlan();
  const [startBytes, endBytes] = await Promise.all([
    input.renderFrame(startImage.path, plan),
    input.renderFrame(endImage.path, plan),
  ]);
  const registry = getActiveRuntimeMediaRegistry();
  if (!registry) {
    throw new Error("Shoot failed.");
  }
  const startShootingFrame = registry.register(startBytes, "image/png");
  const endShootingFrame = registry.register(endBytes, "image/png");
  const effectivePrompt = composeShootingPrompt(
    TUNNELVISION_LOCOMOTION_BASELINE,
    segmentPromptAddition,
  );
  const seed = optionalSeed();
  const generated = await input.generateVideo({
    startImage: { kind: "file", path: startShootingFrame.filePath },
    endImage: { kind: "file", path: endShootingFrame.filePath },
    prompt: effectivePrompt,
    durationSeconds: JOURNEY_VIDEO_DURATION_SECONDS,
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
    provider: generated.provider,
    model: generated.model,
    modelVersion: generated.modelVersion,
    durationSeconds: JOURNEY_VIDEO_DURATION_SECONDS,
    ...(typeof generated.metadata.seed === "number"
      ? { seed: generated.metadata.seed }
      : seed !== undefined
        ? { seed }
        : {}),
    videoUrl: generated.outputUrl,
    providerOutputUrl: generated.outputUrl,
    videoInputs: { startShootingFrame: true, endShootingFrame: true },
  };
}

export function configuredVideoModel(): string {
  return getOptionalEnv("TUNNELVISION_VIDEO_MODEL") ?? P_VIDEO_MODEL;
}
