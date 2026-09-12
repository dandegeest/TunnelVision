import { MediaGenerationError } from "./errors.ts";
import type { ImageAspectRatio } from "./types.ts";

/** TunnelVision-generated opening A is always requested as 16:9. */
export const GENERATED_OPENING_ASPECT_RATIO: ImageAspectRatio = {
  width: 16,
  height: 9,
};

export const FLUX_11_PRO_ULTRA_ASPECT_RATIOS = [
  "1:1",
  "16:9",
  "21:9",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "3:4",
  "4:3",
  "9:16",
  "9:21",
] as const;

export const NANO_BANANA_ASPECT_RATIOS = [
  "1:1",
  "1:4",
  "1:8",
  "2:3",
  "3:2",
  "3:4",
  "4:1",
  "4:3",
  "4:5",
  "5:4",
  "8:1",
  "9:16",
  "16:9",
  "21:9",
] as const;

export const FLUX_KONTEXT_PRO_EXPLICIT_ASPECT_RATIOS = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "21:9",
  "9:21",
  "2:1",
  "1:2",
] as const;

export function isImageAspectRatio(value: unknown): value is ImageAspectRatio {
  if (!value || typeof value !== "object") {
    return false;
  }
  const width = "width" in value ? value.width : undefined;
  const height = "height" in value ? value.height : undefined;
  return (
    typeof width === "number" &&
    typeof height === "number" &&
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0
  );
}

export function parseImageAspectRatio(value: unknown): ImageAspectRatio | undefined {
  return isImageAspectRatio(value) ? { width: value.width, height: value.height } : undefined;
}

export function requireImageAspectRatio(value: unknown, label = "aspectRatio"): ImageAspectRatio {
  const parsed = parseImageAspectRatio(value);
  if (!parsed) {
    throw new MediaGenerationError("invalid_input", `${label} must be a positive integer width and height`);
  }
  return parsed;
}

function namedAspectValue(label: string): number | undefined {
  const parts = label.split(":");
  if (parts.length !== 2) {
    return undefined;
  }
  const width = Number(parts[0]);
  const height = Number(parts[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }
  return width / height;
}

/**
 * Map a project aspect onto the closest explicit provider enum value.
 * Never returns match_input_image or other implicit modes.
 */
export function nearestExplicitAspectRatio<T extends string>(
  aspect: ImageAspectRatio,
  supported: readonly T[],
): T {
  if (supported.length === 0) {
    throw new MediaGenerationError("invalid_input", "image provider has no explicit aspect ratios");
  }
  const actual = aspect.width / aspect.height;
  let best = supported[0]!;
  let bestError = Number.POSITIVE_INFINITY;
  for (const label of supported) {
    const value = namedAspectValue(label);
    if (value === undefined) {
      continue;
    }
    const mean = (Math.abs(actual) + Math.abs(value)) / 2;
    const error = mean === 0 ? Math.abs(actual - value) : Math.abs(actual - value) / mean;
    if (error < bestError) {
      best = label;
      bestError = error;
    }
  }
  return best;
}
