import { MediaGenerationError } from "../errors.ts";
import type { ResolvedMedia } from "../media-input.ts";
import type { VideoGenerationRequest } from "../types.ts";
import { isKling25TurboPro, toKling25TurboProInput } from "./kling-v2.5-turbo-pro.ts";
import { isKlingV3Video, toKlingV3VideoInput, type KlingV3Settings } from "./kling-v3-video.ts";
import { isPVideoModel, toPVideoInput, type PVideoSettings } from "./p-video.ts";
import { isSeedance20Fast, toSeedance20FastInput } from "./seedance-2.0-fast.ts";
import { isVeo31Fast, toVeo31FastInput } from "./veo-3.1-fast.ts";
import { SEEDANCE_25_MODEL, toSeedance25Input, type Seedance25Settings } from "./seedance-2.5.ts";

export function isSeedance25(model: string): boolean {
  return model === SEEDANCE_25_MODEL || model.endsWith("/seedance-2.5");
}

export type ReplicateVideoKnobs = {
  readonly generateAudio?: boolean;
  readonly pVideo?: PVideoSettings;
  readonly seedance?: Seedance25Settings;
  readonly klingV3?: KlingV3Settings;
};

export function toReplicateVideoInput(
  model: string,
  request: VideoGenerationRequest,
  resolvedStart: ResolvedMedia,
  resolvedEnd: ResolvedMedia | undefined,
  knobs: ReplicateVideoKnobs = {},
): Record<string, unknown> {
  const generateAudio = knobs.generateAudio === true;
  if (isPVideoModel(model)) {
    return toPVideoInput(request, resolvedStart, resolvedEnd, {
      ...knobs.pVideo,
      saveAudio: knobs.pVideo?.saveAudio ?? generateAudio,
    }) as unknown as Record<string, unknown>;
  }
  if (isKling25TurboPro(model)) {
    return toKling25TurboProInput(request, resolvedStart, resolvedEnd) as unknown as Record<
      string,
      unknown
    >;
  }
  if (isKlingV3Video(model)) {
    return toKlingV3VideoInput(request, resolvedStart, resolvedEnd, {
      ...knobs.klingV3,
      generateAudio: knobs.klingV3?.generateAudio ?? generateAudio,
    }) as unknown as Record<string, unknown>;
  }
  if (isVeo31Fast(model)) {
    return toVeo31FastInput(request, resolvedStart, resolvedEnd, { generateAudio }) as unknown as Record<
      string,
      unknown
    >;
  }
  if (isSeedance20Fast(model)) {
    return toSeedance20FastInput(request, resolvedStart, resolvedEnd, {
      generateAudio: knobs.seedance?.generateAudio ?? generateAudio,
      resolution: knobs.seedance?.resolution === "1080p" ? "720p" : knobs.seedance?.resolution,
      aspectRatio: knobs.seedance?.aspectRatio,
      seed: knobs.seedance?.seed,
    }) as unknown as Record<string, unknown>;
  }
  if (isSeedance25(model)) {
    return toSeedance25Input(request, resolvedStart, resolvedEnd, {
      ...knobs.seedance,
      generateAudio: knobs.seedance?.generateAudio ?? generateAudio,
    }) as unknown as Record<string, unknown>;
  }
  throw new MediaGenerationError("invalid_input", `Unsupported video model ${model}`);
}
