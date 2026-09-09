import { MediaGenerationError } from "../errors.ts";
import { toReplicateFileInput, type ResolvedMedia } from "../media-input.ts";
import type { VideoGenerationRequest } from "../types.ts";

/** Official Wan 2.2 I2V Fast. last_image is the first/last-frame mapping. */
export const WAN_22_I2V_FAST_MODEL = "wan-video/wan-2.2-i2v-fast";

export function isWan22I2vFast(model: string): boolean {
  return model === WAN_22_I2V_FAST_MODEL || model.endsWith("/wan-2.2-i2v-fast");
}

export type Wan22I2vFastInput = {
  readonly prompt: string;
  readonly image: string | Buffer;
  readonly last_image?: string | Buffer;
  readonly go_fast: true;
  readonly num_frames: number;
  readonly frames_per_second: 16;
  readonly resolution: "480p";
  readonly seed?: number;
};

/** 81 frames is the documented best result; advertised range is 81–100. */
export function wan22FrameCount(durationSeconds?: number): number {
  const seconds = durationSeconds ?? 6;
  return Math.min(100, Math.max(81, Math.round(seconds * 16) + 1));
}

export function toWan22I2vFastInput(
  request: VideoGenerationRequest,
  resolvedStart: ResolvedMedia,
  resolvedEnd?: ResolvedMedia,
): Wan22I2vFastInput {
  if (!request.prompt.trim()) {
    throw new MediaGenerationError("invalid_input", "prompt is required");
  }
  return {
    prompt: request.prompt,
    image: toReplicateFileInput(resolvedStart),
    ...(resolvedEnd ? { last_image: toReplicateFileInput(resolvedEnd) } : {}),
    go_fast: true,
    num_frames: wan22FrameCount(request.durationSeconds),
    frames_per_second: 16,
    resolution: "480p",
    ...(request.seed !== undefined ? { seed: request.seed } : {}),
  };
}
