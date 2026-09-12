import { MediaGenerationError } from "../errors.ts";
import { toReplicateFileInput, type ResolvedMedia } from "../media-input.ts";
import type { VideoGenerationRequest } from "../types.ts";

export const KLING_25_TURBO_PRO_MODEL = "kwaivgi/kling-v2.5-turbo-pro";

export function isKling25TurboPro(model: string): boolean {
  return model === KLING_25_TURBO_PRO_MODEL || model.endsWith("/kling-v2.5-turbo-pro");
}

/**
 * Kling 2.5 Turbo Pro advertises 5s and 10s. Product shots for this
 * model are 5s. A 6s request still maps to 5s.
 */
export function kling25TurboProDuration(seconds?: number): 5 | 10 {
  if (seconds !== undefined && seconds > 6) {
    return 10;
  }
  return 5;
}

export type Kling25TurboProInput = {
  readonly prompt: string;
  readonly start_image: string | Buffer;
  readonly end_image?: string | Buffer;
  readonly duration: 5 | 10;
};

export function toKling25TurboProInput(
  request: VideoGenerationRequest,
  resolvedStart: ResolvedMedia,
  resolvedEnd?: ResolvedMedia,
): Kling25TurboProInput {
  if (!request.prompt.trim()) {
    throw new MediaGenerationError("invalid_input", "prompt is required");
  }
  return {
    prompt: request.prompt,
    start_image: toReplicateFileInput(resolvedStart),
    ...(resolvedEnd ? { end_image: toReplicateFileInput(resolvedEnd) } : {}),
    duration: kling25TurboProDuration(request.durationSeconds),
  };
}
