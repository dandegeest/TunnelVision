import { MediaGenerationError } from "../errors.ts";

export const ENHANCE_FRAME_RATE_MODEL = "enhance_frame_rate" as const;
export const DEFAULT_ENHANCE_FRAME_RATE = "120" as const;

/**
 * Official `targetFramerate` values on POST /v1/video_upscale
 * for model `enhance_frame_rate` (OpenAPI 2024-11-06, 2026-09-17).
 */
export const RUNWAY_TARGET_FRAMERATES = [
  "24",
  "25",
  "30",
  "48",
  "50",
  "60",
  "120",
  "23_98",
  "29_97",
  "59_94",
] as const;

export type RunwayTargetFramerate = (typeof RUNWAY_TARGET_FRAMERATES)[number];

const FRAMERATE_ALIASES: Readonly<Record<string, RunwayTargetFramerate>> = {
  "23.98": "23_98",
  "29.97": "29_97",
  "59.94": "59_94",
};

export type EnhanceFrameRateBody = {
  readonly model: typeof ENHANCE_FRAME_RATE_MODEL;
  readonly videoUri: string;
  readonly targetFramerate: RunwayTargetFramerate;
};

export function isRunwayTargetFramerate(value: string): value is RunwayTargetFramerate {
  return (RUNWAY_TARGET_FRAMERATES as readonly string[]).includes(value);
}

export function parseRunwayTargetFramerate(fps: number | string = DEFAULT_ENHANCE_FRAME_RATE): RunwayTargetFramerate {
  const raw = typeof fps === "number" ? String(fps) : fps.trim();
  const aliased = FRAMERATE_ALIASES[raw] ?? raw;
  if (!isRunwayTargetFramerate(aliased)) {
    throw new MediaGenerationError(
      "invalid_input",
      `Unsupported Runway targetFramerate ${raw}. Use ${RUNWAY_TARGET_FRAMERATES.join(", ")}`,
    );
  }
  return aliased;
}

export function toEnhanceFrameRateBody(
  videoUri: string,
  fps: number | string = DEFAULT_ENHANCE_FRAME_RATE,
): EnhanceFrameRateBody {
  if (!videoUri) {
    throw new MediaGenerationError("invalid_input", "videoUri is required");
  }
  return {
    model: ENHANCE_FRAME_RATE_MODEL,
    videoUri,
    targetFramerate: parseRunwayTargetFramerate(fps),
  };
}
