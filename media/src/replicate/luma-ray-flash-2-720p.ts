import { MediaGenerationError } from "../errors.ts";
import { toReplicateFileInput, type ResolvedMedia } from "../media-input.ts";
import type { VideoGenerationRequest } from "../types.ts";

export const LUMA_RAY_FLASH_2_720P_MODEL = "luma/ray-flash-2-720p";

export function isLumaRayFlash2720p(model: string): boolean {
  return model === LUMA_RAY_FLASH_2_720P_MODEL || model.endsWith("/ray-flash-2-720p");
}

/**
 * Ray Flash 2 720p only advertises 5s and 9s. Product shots are 6s;
 * map those to the nearer 5s clip. Do not loop.
 */
export function lumaRayFlash2Duration(seconds?: number): 5 | 9 {
  if (seconds !== undefined && seconds > 6) {
    return 9;
  }
  return 5;
}

export type LumaRayFlash2Input = {
  readonly prompt: string;
  readonly start_image: string | Buffer;
  readonly end_image?: string | Buffer;
  readonly duration: 5 | 9;
  readonly aspect_ratio: "16:9";
  readonly loop: false;
};

export function toLumaRayFlash2Input(
  request: VideoGenerationRequest,
  resolvedStart: ResolvedMedia,
  resolvedEnd?: ResolvedMedia,
): LumaRayFlash2Input {
  if (!request.prompt.trim()) {
    throw new MediaGenerationError("invalid_input", "prompt is required");
  }
  return {
    prompt: request.prompt,
    start_image: toReplicateFileInput(resolvedStart),
    ...(resolvedEnd ? { end_image: toReplicateFileInput(resolvedEnd) } : {}),
    duration: lumaRayFlash2Duration(request.durationSeconds),
    aspect_ratio: "16:9",
    loop: false,
  };
}
