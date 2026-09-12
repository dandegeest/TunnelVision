import { MediaGenerationError } from "../errors.ts";
import type { ResolvedMedia } from "../media-input.ts";
import type { VideoGenerationRequest } from "../types.ts";
import { isKling25TurboPro, toKling25TurboProInput } from "./kling-v2.5-turbo-pro.ts";
import { isPVideoModel, toPVideoInput, type PVideoSettings } from "./p-video.ts";
import { isSeedance20Fast, toSeedance20FastInput } from "./seedance-2.0-fast.ts";
import { isWan22I2vFast, toWan22I2vFastInput } from "./wan-2.2-i2v-fast.ts";
import { SEEDANCE_25_MODEL, toSeedance25Input, type Seedance25Settings } from "./seedance-2.5.ts";

export function isSeedance25(model: string): boolean {
  return model === SEEDANCE_25_MODEL || model.endsWith("/seedance-2.5");
}

export type ReplicateVideoKnobs = {
  readonly pVideo?: PVideoSettings;
  readonly seedance?: Seedance25Settings;
};

export function toReplicateVideoInput(
  model: string,
  request: VideoGenerationRequest,
  resolvedStart: ResolvedMedia,
  resolvedEnd: ResolvedMedia | undefined,
  knobs: ReplicateVideoKnobs = {},
): Record<string, unknown> {
  if (isPVideoModel(model)) {
    return toPVideoInput(request, resolvedStart, resolvedEnd, knobs.pVideo) as unknown as Record<
      string,
      unknown
    >;
  }
  if (isKling25TurboPro(model)) {
    return toKling25TurboProInput(request, resolvedStart, resolvedEnd) as unknown as Record<
      string,
      unknown
    >;
  }
  if (isWan22I2vFast(model)) {
    return toWan22I2vFastInput(request, resolvedStart, resolvedEnd) as unknown as Record<
      string,
      unknown
    >;
  }
  if (isSeedance20Fast(model)) {
    return toSeedance20FastInput(request, resolvedStart, resolvedEnd, {
      generateAudio: knobs.seedance?.generateAudio,
      resolution: knobs.seedance?.resolution === "1080p" ? "720p" : knobs.seedance?.resolution,
      aspectRatio: knobs.seedance?.aspectRatio,
      seed: knobs.seedance?.seed,
    }) as unknown as Record<string, unknown>;
  }
  if (isSeedance25(model)) {
    return toSeedance25Input(request, resolvedStart, resolvedEnd, knobs.seedance) as unknown as Record<
      string,
      unknown
    >;
  }
  throw new MediaGenerationError("invalid_input", `Unsupported video model ${model}`);
}
