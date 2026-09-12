import { MediaGenerationError } from "../errors.ts";
import {
  NANO_BANANA_ASPECT_RATIOS,
  nearestExplicitAspectRatio,
  requireImageAspectRatio,
} from "../image-aspect-ratio.ts";
import { toReplicateFileInput, type ResolvedMedia } from "../media-input.ts";
import type { ImageEditRequest, ImageGenerationRequest } from "../types.ts";

export const NANO_BANANA_2_LITE_MODEL = "google/nano-banana-2-lite";
export const NANO_BANANA_2_MODEL = "google/nano-banana-2";

export type NanoBananaOutputFormat = "jpg" | "png";
export type NanoBananaResolution = "1K" | "2K" | "4K";

export type NanoBananaSettings = {
  readonly aspectRatio?: string;
  readonly outputFormat?: NanoBananaOutputFormat;
  /** Full Nano Banana 2 only. Lite is 1K and must not receive this field. */
  readonly resolution?: NanoBananaResolution;
};

export const DEFAULT_NANO_BANANA_SETTINGS = {
  aspectRatio: "16:9",
  outputFormat: "png",
} as const satisfies Required<Omit<NanoBananaSettings, "resolution">>;

export type NanoBananaInput = {
  readonly prompt: string;
  readonly aspect_ratio: string;
  readonly output_format: NanoBananaOutputFormat;
  readonly resolution?: NanoBananaResolution;
  readonly image_input?: ReadonlyArray<string | Buffer>;
};

export function isNanoBananaModel(model: string): boolean {
  return model === NANO_BANANA_2_LITE_MODEL || model === NANO_BANANA_2_MODEL;
}

export function isNanoBanana2(model: string): boolean {
  return model === NANO_BANANA_2_MODEL || model.endsWith("/nano-banana-2");
}

export function mergeNanoBananaSettings(
  settings?: NanoBananaSettings,
): NanoBananaSettings & typeof DEFAULT_NANO_BANANA_SETTINGS {
  return {
    ...DEFAULT_NANO_BANANA_SETTINGS,
    ...settings,
  };
}

function explicitAspectRatio(
  requestAspect: ImageGenerationRequest["aspectRatio"] | ImageEditRequest["aspectRatio"],
  settings?: NanoBananaSettings,
): string {
  const merged = mergeNanoBananaSettings(settings);
  if (!requestAspect) {
    return merged.aspectRatio;
  }
  return nearestExplicitAspectRatio(requireImageAspectRatio(requestAspect), NANO_BANANA_ASPECT_RATIOS);
}

export function toNanoBananaGenerateInput(
  request: ImageGenerationRequest,
  settings?: NanoBananaSettings,
): NanoBananaInput {
  if (!request.prompt.trim()) {
    throw new MediaGenerationError("invalid_input", "prompt is required");
  }
  const merged = mergeNanoBananaSettings(settings);
  return {
    prompt: request.prompt,
    aspect_ratio: explicitAspectRatio(request.aspectRatio, settings),
    output_format: merged.outputFormat,
    ...(merged.resolution ? { resolution: merged.resolution } : {}),
  };
}

export function toNanoBananaEditInput(
  request: ImageEditRequest,
  resolvedSource: ResolvedMedia,
  settings?: NanoBananaSettings,
): NanoBananaInput {
  if (!request.prompt.trim()) {
    throw new MediaGenerationError("invalid_input", "prompt is required");
  }
  if (!request.sourceImage) {
    throw new MediaGenerationError("invalid_input", "sourceImage is required");
  }
  const merged = mergeNanoBananaSettings(settings);
  return {
    prompt: request.prompt,
    aspect_ratio: explicitAspectRatio(request.aspectRatio, settings),
    output_format: merged.outputFormat,
    ...(merged.resolution ? { resolution: merged.resolution } : {}),
    image_input: [toReplicateFileInput(resolvedSource)],
  };
}

export function describeNanoBananaInput(input: NanoBananaInput): Record<string, unknown> {
  return {
    prompt: input.prompt,
    aspect_ratio: input.aspect_ratio,
    output_format: input.output_format,
    ...(input.resolution ? { resolution: input.resolution } : {}),
    ...(input.image_input
      ? {
          image_input: input.image_input.map((item) => (typeof item === "string" ? item : "[file]")),
        }
      : {}),
  };
}
