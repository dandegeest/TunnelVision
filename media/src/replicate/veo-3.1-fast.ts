import { MediaGenerationError } from "../errors.ts";
import { toReplicateFileInput, type ResolvedMedia } from "../media-input.ts";
import type { VideoGenerationRequest } from "../types.ts";

export const VEO_31_FAST_MODEL = "google/veo-3.1-fast";

export function isVeo31Fast(model: string): boolean {
  return model === VEO_31_FAST_MODEL || model.endsWith("/veo-3.1-fast");
}

export type Veo31FastDuration = 4 | 6 | 8;
export type Veo31FastResolution = "720p" | "1080p";
export type Veo31FastAspectRatio = "16:9";

/**
 * Veo 3.1 Fast advertises 4s, 6s, and 8s. Product shots for this
 * Quality generator are 6s.
 */
export function veo31FastDuration(seconds?: number): Veo31FastDuration {
  if (seconds === 4 || seconds === 8) {
    return seconds;
  }
  return 6;
}

export type Veo31FastInput = {
  readonly prompt: string;
  readonly image: string | Buffer;
  readonly last_frame?: string | Buffer;
  readonly duration: Veo31FastDuration;
  readonly resolution: Veo31FastResolution;
  readonly aspect_ratio: Veo31FastAspectRatio;
  readonly generate_audio: false;
  readonly seed?: number;
};

export function toVeo31FastInput(
  request: VideoGenerationRequest,
  resolvedStart: ResolvedMedia,
  resolvedEnd?: ResolvedMedia,
): Veo31FastInput {
  if (!request.prompt.trim()) {
    throw new MediaGenerationError("invalid_input", "prompt is required");
  }
  return {
    prompt: request.prompt,
    image: toReplicateFileInput(resolvedStart),
    ...(resolvedEnd ? { last_frame: toReplicateFileInput(resolvedEnd) } : {}),
    duration: veo31FastDuration(request.durationSeconds),
    resolution: "1080p",
    aspect_ratio: "16:9",
    generate_audio: false,
    ...(request.seed !== undefined ? { seed: request.seed } : {}),
  };
}
