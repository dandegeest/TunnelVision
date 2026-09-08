import { MediaGenerationError } from "../errors.ts";
import { toReplicateFileInput, type ResolvedMedia } from "../media-input.ts";
import { VideoGenerationRequest } from "../types.ts";

/**
 * Cheap development video generator. Not Seedance 2.5.
 * Shoot architecture must stay model-configurable; this adapter is one
 * Replicate mapping behind MediaProvider.
 *
 * Directed legs send A′ as `image` and B′ as `last_frame_image`.
 * Do not concatenate the stills into one file.
 */
export const P_VIDEO_MODEL = "prunaai/p-video";

export type PVideoResolution = "720p" | "1080p";
export type PVideoFps = 24 | 48;

export type PVideoSettings = {
  readonly resolution?: PVideoResolution;
  readonly fps?: PVideoFps;
  readonly draft?: boolean;
  readonly promptUpsampling?: boolean;
  readonly saveAudio?: boolean;
  readonly seed?: number;
};

export const DEFAULT_P_VIDEO_SETTINGS = {
  resolution: "720p",
  fps: 24,
  draft: true,
  promptUpsampling: false,
  saveAudio: false,
} as const satisfies Required<Omit<PVideoSettings, "seed">>;

export type PVideoInput = {
  readonly prompt: string;
  readonly image: string | Buffer;
  readonly last_frame_image?: string | Buffer;
  readonly duration: number;
  readonly resolution: PVideoResolution;
  readonly fps: PVideoFps;
  readonly draft: boolean;
  readonly prompt_upsampling: boolean;
  readonly save_audio: boolean;
  readonly seed?: number;
};

export function isPVideoModel(model: string): boolean {
  return model === P_VIDEO_MODEL || model.endsWith("/p-video");
}

export function mergePVideoSettings(
  settings?: PVideoSettings,
): PVideoSettings & typeof DEFAULT_P_VIDEO_SETTINGS {
  return {
    ...DEFAULT_P_VIDEO_SETTINGS,
    ...settings,
  };
}

export function toPVideoInput(
  request: VideoGenerationRequest,
  resolvedStart: ResolvedMedia,
  resolvedEnd?: ResolvedMedia,
  settings?: PVideoSettings,
): PVideoInput {
  if (!request.prompt.trim()) {
    throw new MediaGenerationError("invalid_input", "prompt is required");
  }
  const duration = request.durationSeconds ?? 6;
  if (!Number.isInteger(duration) || duration < 1 || duration > 10) {
    throw new MediaGenerationError("invalid_input", "durationSeconds must be an integer from 1 to 10");
  }
  const merged = mergePVideoSettings(settings);
  const seed = request.seed ?? merged.seed;
  return {
    prompt: request.prompt,
    image: toReplicateFileInput(resolvedStart),
    ...(resolvedEnd ? { last_frame_image: toReplicateFileInput(resolvedEnd) } : {}),
    duration,
    resolution: merged.resolution,
    fps: merged.fps,
    draft: merged.draft,
    prompt_upsampling: merged.promptUpsampling,
    save_audio: merged.saveAudio,
    ...(seed !== undefined ? { seed } : {}),
  };
}

export function describePVideoInput(
  request: VideoGenerationRequest,
  startLabel: string,
  endLabel?: string,
  settings?: PVideoSettings,
): Record<string, unknown> {
  const merged = mergePVideoSettings(settings);
  const seed = request.seed ?? merged.seed;
  return {
    prompt: request.prompt,
    image: startLabel,
    ...(endLabel ? { last_frame_image: endLabel } : {}),
    duration: request.durationSeconds ?? 6,
    resolution: merged.resolution,
    fps: merged.fps,
    draft: merged.draft,
    prompt_upsampling: merged.promptUpsampling,
    save_audio: merged.saveAudio,
    ...(seed !== undefined ? { seed } : {}),
    endImageSent: Boolean(endLabel),
  };
}
