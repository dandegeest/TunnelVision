import { MediaGenerationError } from "../errors.ts";
import { toReplicateFileInput, type ResolvedMedia } from "../media-input.ts";
import type { VideoGenerationRequest } from "../types.ts";
import {
  DEFAULT_KLING_V3_MODE,
  resolveKlingV3Mode,
  type KlingV3Mode,
} from "./video-models.ts";

export const KLING_V3_VIDEO_MODEL = "kwaivgi/kling-v3-video";

export function isKlingV3Video(model: string): boolean {
  return model === KLING_V3_VIDEO_MODEL || model.endsWith("/kling-v3-video");
}

/**
 * Kling 3 advertises 3–15s. Product shots for this model are 6s,
 * matching the other Quality generators.
 */
export function klingV3Duration(seconds?: number): number {
  if (seconds !== undefined && Number.isInteger(seconds) && seconds >= 3 && seconds <= 15) {
    return seconds;
  }
  return 6;
}

export type KlingV3Settings = {
  readonly mode?: KlingV3Mode;
};

export type KlingV3VideoInput = {
  readonly prompt: string;
  readonly start_image: string | Buffer;
  readonly end_image?: string | Buffer;
  readonly duration: number;
  readonly mode: KlingV3Mode;
  readonly generate_audio: false;
};

export function toKlingV3VideoInput(
  request: VideoGenerationRequest,
  resolvedStart: ResolvedMedia,
  resolvedEnd?: ResolvedMedia,
  settings?: KlingV3Settings,
): KlingV3VideoInput {
  if (!request.prompt.trim()) {
    throw new MediaGenerationError("invalid_input", "prompt is required");
  }
  return {
    prompt: request.prompt,
    start_image: toReplicateFileInput(resolvedStart),
    ...(resolvedEnd ? { end_image: toReplicateFileInput(resolvedEnd) } : {}),
    duration: klingV3Duration(request.durationSeconds),
    mode: resolveKlingV3Mode(settings?.mode ?? DEFAULT_KLING_V3_MODE),
    generate_audio: false,
  };
}
