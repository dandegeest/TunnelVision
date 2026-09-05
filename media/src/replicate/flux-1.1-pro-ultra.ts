import { MediaGenerationError } from "../errors.ts";
import { ImageGenerationRequest } from "../types.ts";

export const FLUX_11_PRO_ULTRA_MODEL = "black-forest-labs/flux-1.1-pro-ultra";

export type Flux11ProUltraOutputFormat = "png" | "jpg" | "webp";

/**
 * FLUX 1.1 Pro Ultra knobs. These stay below the MediaProvider boundary.
 * Do not pass image_prompt / Redux reference images from this adapter.
 */
export type Flux11ProUltraSettings = {
  readonly aspectRatio?: string;
  readonly raw?: boolean;
  readonly outputFormat?: Flux11ProUltraOutputFormat;
  readonly safetyTolerance?: number;
  readonly seed?: number;
};

export const DEFAULT_FLUX_11_PRO_ULTRA_SETTINGS = {
  aspectRatio: "16:9",
  raw: false,
  outputFormat: "png",
  safetyTolerance: 2,
} as const satisfies Required<Omit<Flux11ProUltraSettings, "seed">>;

export type Flux11ProUltraInput = {
  readonly prompt: string;
  readonly aspect_ratio: string;
  readonly raw: boolean;
  readonly output_format: Flux11ProUltraOutputFormat;
  readonly safety_tolerance: number;
  readonly seed?: number;
};

export function mergeFlux11ProUltraSettings(
  settings?: Flux11ProUltraSettings,
): Flux11ProUltraSettings & typeof DEFAULT_FLUX_11_PRO_ULTRA_SETTINGS {
  return {
    ...DEFAULT_FLUX_11_PRO_ULTRA_SETTINGS,
    ...settings,
  };
}

export function toFlux11ProUltraInput(
  request: ImageGenerationRequest,
  settings?: Flux11ProUltraSettings,
): Flux11ProUltraInput {
  if (!request.prompt.trim()) {
    throw new MediaGenerationError("invalid_input", "prompt is required");
  }

  const merged = mergeFlux11ProUltraSettings(settings);
  const seed = request.seed ?? merged.seed;
  const input: Flux11ProUltraInput = {
    prompt: request.prompt,
    aspect_ratio: merged.aspectRatio,
    raw: merged.raw,
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

export function describeFlux11ProUltraInput(
  request: ImageGenerationRequest,
  settings?: Flux11ProUltraSettings,
): Record<string, unknown> {
  const input = toFlux11ProUltraInput(request, settings);
  return { ...input };
}
