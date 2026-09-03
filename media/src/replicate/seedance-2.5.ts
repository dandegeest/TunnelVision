import { MediaGenerationError } from "../errors.ts";
import { toReplicateFileInput, type ResolvedMedia } from "../media-input.ts";
import { VideoGenerationRequest } from "../types.ts";

export const SEEDANCE_25_MODEL = "bytedance/seedance-2.5";

export type Seedance25Resolution = "480p" | "720p" | "1080p";
export type Seedance25AspectRatio =
  | "adaptive"
  | "16:9"
  | "9:16"
  | "1:1"
  | "4:3"
  | "3:4"
  | "21:9";
export type Seedance25OutputFormat = "mp4" | "mov";

/**
 * Seedance 2.5 knobs. These stay below the MediaProvider boundary.
 * First/last-frame mode requires aspect_ratio "adaptive" per current schema.
 */
export type Seedance25Settings = {
  readonly resolution?: Seedance25Resolution;
  readonly aspectRatio?: Seedance25AspectRatio;
  readonly generateAudio?: boolean;
  readonly watermark?: boolean;
  readonly outputFormat?: Seedance25OutputFormat;
  readonly seed?: number;
};

export const DEFAULT_SEEDANCE_25_SETTINGS = {
  resolution: "720p",
  aspectRatio: "adaptive",
  generateAudio: false,
  watermark: false,
  outputFormat: "mp4",
} as const satisfies Required<
  Omit<Seedance25Settings, "seed">
>;

export type Seedance25Input = {
  readonly prompt: string;
  readonly image: string | Buffer;
  readonly last_frame_image?: string | Buffer;
  readonly duration?: number;
  readonly resolution: Seedance25Resolution;
  readonly aspect_ratio: Seedance25AspectRatio;
  readonly generate_audio: boolean;
  readonly watermark: boolean;
  readonly output_format: Seedance25OutputFormat;
  readonly seed?: number;
};

export function mergeSeedance25Settings(
  settings?: Seedance25Settings,
): Seedance25Settings & typeof DEFAULT_SEEDANCE_25_SETTINGS {
  return {
    ...DEFAULT_SEEDANCE_25_SETTINGS,
    ...settings,
  };
}

export function toSeedance25Input(
  request: VideoGenerationRequest,
  resolvedStart: ResolvedMedia,
  resolvedEnd: ResolvedMedia | undefined,
  settings?: Seedance25Settings,
): Seedance25Input {
  if (!request.prompt.trim()) {
    throw new MediaGenerationError("invalid_input", "prompt is required");
  }

  const merged = mergeSeedance25Settings(settings);

  if (resolvedEnd && merged.aspectRatio !== "adaptive") {
    throw new MediaGenerationError(
      "invalid_input",
      "Seedance 2.5 first/last-frame generation requires aspect_ratio adaptive",
    );
  }

  if (
    request.durationSeconds !== undefined &&
    !(
      request.durationSeconds === -1 ||
      (Number.isInteger(request.durationSeconds) &&
        request.durationSeconds >= 4 &&
        request.durationSeconds <= 30)
    )
  ) {
    throw new MediaGenerationError(
      "invalid_input",
      "durationSeconds must be -1 or an integer from 4 to 30",
    );
  }

  const input: Seedance25Input = {
    prompt: request.prompt,
    image: toReplicateFileInput(resolvedStart),
    resolution: merged.resolution,
    aspect_ratio: merged.aspectRatio,
    generate_audio: merged.generateAudio,
    watermark: merged.watermark,
    output_format: merged.outputFormat,
  };

  const withOptional: Seedance25Input = {
    ...input,
    ...(resolvedEnd
      ? { last_frame_image: toReplicateFileInput(resolvedEnd) }
      : {}),
    ...(request.durationSeconds !== undefined
      ? { duration: request.durationSeconds }
      : {}),
    ...(merged.seed !== undefined ? { seed: merged.seed } : {}),
  };

  return withOptional;
}

export function describeSeedance25Input(
  request: VideoGenerationRequest,
  startLabel: string,
  endLabel: string | undefined,
  settings?: Seedance25Settings,
): Record<string, unknown> {
  const merged = mergeSeedance25Settings(settings);
  return {
    prompt: request.prompt,
    image: startLabel,
    ...(endLabel ? { last_frame_image: endLabel } : {}),
    ...(request.durationSeconds !== undefined
      ? { duration: request.durationSeconds }
      : {}),
    resolution: merged.resolution,
    aspect_ratio: merged.aspectRatio,
    generate_audio: merged.generateAudio,
    watermark: merged.watermark,
    output_format: merged.outputFormat,
    ...(merged.seed !== undefined ? { seed: merged.seed } : {}),
  };
}
