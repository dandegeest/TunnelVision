import { MediaGenerationError } from "../errors.ts";
import {
  FLUX_KONTEXT_PRO_EXPLICIT_ASPECT_RATIOS,
  nearestExplicitAspectRatio,
  requireImageAspectRatio,
} from "../image-aspect-ratio.ts";
import { toReplicateFileInput, type ResolvedMedia } from "../media-input.ts";
import { ImageEditRequest } from "../types.ts";

export const FLUX_KONTEXT_PRO_MODEL = "black-forest-labs/flux-kontext-pro";

export type FluxKontextProAspectRatio =
  | "match_input_image"
  | "1:1"
  | "16:9"
  | "9:16"
  | "4:3"
  | "3:4"
  | "3:2"
  | "2:3"
  | "4:5"
  | "5:4"
  | "21:9"
  | "9:21"
  | "2:1"
  | "1:2";

export type FluxKontextProOutputFormat = "png" | "jpg" | "webp";

/**
 * FLUX Kontext Pro knobs. These stay below the ImageEditProvider boundary.
 * Replicate caps safety_tolerance at 2 when input_image is present.
 */
export type FluxKontextProSettings = {
  readonly aspectRatio?: FluxKontextProAspectRatio;
  readonly outputFormat?: FluxKontextProOutputFormat;
  readonly safetyTolerance?: number;
  readonly promptUpsampling?: boolean;
  readonly seed?: number;
};

export const DEFAULT_FLUX_KONTEXT_PRO_SETTINGS = {
  aspectRatio: "match_input_image",
  outputFormat: "png",
  safetyTolerance: 2,
  promptUpsampling: false,
} as const satisfies Required<Omit<FluxKontextProSettings, "seed">>;

export type FluxKontextProInput = {
  readonly prompt: string;
  readonly input_image: string | Buffer;
  readonly aspect_ratio: FluxKontextProAspectRatio;
  readonly prompt_upsampling: boolean;
  readonly output_format: FluxKontextProOutputFormat;
  readonly safety_tolerance: number;
  readonly seed?: number;
};

export function mergeFluxKontextProSettings(
  settings?: FluxKontextProSettings,
): FluxKontextProSettings & typeof DEFAULT_FLUX_KONTEXT_PRO_SETTINGS {
  return {
    ...DEFAULT_FLUX_KONTEXT_PRO_SETTINGS,
    ...settings,
  };
}

export function toFluxKontextProInput(
  request: ImageEditRequest,
  resolvedSource: ResolvedMedia,
  settings?: FluxKontextProSettings,
): FluxKontextProInput {
  if (!request.prompt.trim()) {
    throw new MediaGenerationError("invalid_input", "prompt is required");
  }
  if (!request.sourceImage) {
    throw new MediaGenerationError("invalid_input", "sourceImage is required");
  }

  const merged = mergeFluxKontextProSettings(settings);
  if (!Number.isInteger(merged.safetyTolerance) || merged.safetyTolerance < 0) {
    throw new MediaGenerationError("invalid_input", "safety_tolerance must be a non-negative integer");
  }
  if (merged.safetyTolerance > 2) {
    throw new MediaGenerationError(
      "invalid_input",
      "FLUX Kontext Pro safety_tolerance may be at most 2 when an input image is used",
    );
  }

  const seed = request.seed ?? merged.seed;
  const aspectRatio = request.aspectRatio
    ? nearestExplicitAspectRatio(
        requireImageAspectRatio(request.aspectRatio),
        FLUX_KONTEXT_PRO_EXPLICIT_ASPECT_RATIOS,
      )
    : merged.aspectRatio;
  const input: FluxKontextProInput = {
    prompt: request.prompt,
    input_image: toReplicateFileInput(resolvedSource),
    aspect_ratio: aspectRatio,
    prompt_upsampling: merged.promptUpsampling,
    output_format: merged.outputFormat,
    safety_tolerance: merged.safetyTolerance,
  };

  if (seed === undefined) {
    return input;
  }
  if (!Number.isInteger(seed)) {
    throw new MediaGenerationError("invalid_input", "seed must be an integer");
  }
  return { ...input, seed };
}

export function describeFluxKontextProInput(
  request: ImageEditRequest,
  resolvedSource: ResolvedMedia,
  settings?: FluxKontextProSettings,
): Record<string, unknown> {
  const input = toFluxKontextProInput(request, resolvedSource, settings);
  return {
    prompt: input.prompt,
    input_image:
      typeof input.input_image === "string" ? input.input_image : { kind: "file" },
    aspect_ratio: input.aspect_ratio,
    prompt_upsampling: input.prompt_upsampling,
    output_format: input.output_format,
    safety_tolerance: input.safety_tolerance,
    ...(input.seed !== undefined ? { seed: input.seed } : {}),
  };
}
