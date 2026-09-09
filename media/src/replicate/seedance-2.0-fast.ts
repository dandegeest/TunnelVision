import { MediaGenerationError } from "../errors.ts";
import { toReplicateFileInput, type ResolvedMedia } from "../media-input.ts";
import type { VideoGenerationRequest } from "../types.ts";

export const SEEDANCE_20_FAST_MODEL = "bytedance/seedance-2.0-fast";

export function isSeedance20Fast(model: string): boolean {
  return model === SEEDANCE_20_FAST_MODEL || model.endsWith("/seedance-2.0-fast");
}

export type Seedance20FastResolution = "480p" | "720p";
export type Seedance20FastAspectRatio =
  | "adaptive"
  | "16:9"
  | "9:16"
  | "1:1"
  | "4:3"
  | "3:4"
  | "21:9";

export type Seedance20FastSettings = {
  readonly resolution?: Seedance20FastResolution;
  readonly aspectRatio?: Seedance20FastAspectRatio;
  readonly generateAudio?: boolean;
  readonly seed?: number;
};

export const DEFAULT_SEEDANCE_20_FAST_SETTINGS = {
  resolution: "720p",
  aspectRatio: "adaptive",
  generateAudio: false,
} as const satisfies Required<Omit<Seedance20FastSettings, "seed">>;

export type Seedance20FastInput = {
  readonly prompt: string;
  readonly image: string | Buffer;
  readonly last_frame_image?: string | Buffer;
  readonly duration?: number;
  readonly resolution: Seedance20FastResolution;
  readonly aspect_ratio: Seedance20FastAspectRatio;
  readonly generate_audio: boolean;
  readonly seed?: number;
};

export function mergeSeedance20FastSettings(
  settings?: Seedance20FastSettings,
): Seedance20FastSettings & typeof DEFAULT_SEEDANCE_20_FAST_SETTINGS {
  return {
    ...DEFAULT_SEEDANCE_20_FAST_SETTINGS,
    ...settings,
  };
}

export function toSeedance20FastInput(
  request: VideoGenerationRequest,
  resolvedStart: ResolvedMedia,
  resolvedEnd?: ResolvedMedia,
  settings?: Seedance20FastSettings,
): Seedance20FastInput {
  if (!request.prompt.trim()) {
    throw new MediaGenerationError("invalid_input", "prompt is required");
  }
  const merged = mergeSeedance20FastSettings(settings);
  const seed = request.seed ?? merged.seed;
  return {
    prompt: request.prompt,
    image: toReplicateFileInput(resolvedStart),
    ...(resolvedEnd ? { last_frame_image: toReplicateFileInput(resolvedEnd) } : {}),
    ...(request.durationSeconds !== undefined ? { duration: request.durationSeconds } : {}),
    resolution: merged.resolution,
    aspect_ratio: merged.aspectRatio,
    generate_audio: merged.generateAudio,
    ...(seed !== undefined ? { seed } : {}),
  };
}
