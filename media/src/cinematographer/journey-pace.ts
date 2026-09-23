import { MediaGenerationError } from "../errors.ts";
import { parseJsonObject } from "../reasoning/json.ts";
import type { ReasoningProvider, ReasoningRequest } from "../reasoning/types.ts";
import { isLocomotionPace, type LocomotionPace } from "./shooting-prompt.ts";

export type CinematographerJourneyPaceRequestPayload = {
  readonly story?: string;
  readonly systemInstruction: string;
  readonly prompt: string;
};

export type CinematographerJourneyPaceResult = {
  readonly pace: LocomotionPace;
  readonly request: CinematographerJourneyPaceRequestPayload;
  readonly rawText: string;
  readonly model: string;
  readonly modelVersion: string | null;
  readonly predictionId: string;
  readonly elapsedMs: number;
};

export function cinematographerJourneyPaceSystemInstruction(): string {
  return `You are the Cinematographer for TunnelVision.

Choose ONE apparent camera speed for the entire journey from the story / overall cinematic intent. That pace will be used for every traversal.

Pace is kinetic feel, not shot length. Choose exactly one of:
- slow-motion
- slow
- moderate
- fast
- hyperspeed
- variable

Do not invent CameraMotionPlan, exposure, samples, or provider settings. Do not write a segment prompt.

Return ONLY one JSON object. No markdown fences. No commentary.

{ "pace": "fast" }`;
}

export function cinematographerJourneyPaceUserPrompt(story?: string): string {
  const text = story?.trim();
  return [
    "Choose one journey-level pace for every traversal in this project.",
    text
      ? `Journey story / overall cinematic intent:\n${text}`
      : "No journey story was supplied. Choose from overall cinematic intent.",
    "Emit the JSON object specified in the system instruction. Return JSON only.",
  ].join("\n\n");
}

export function buildCinematographerJourneyPaceRequest(story?: string): ReasoningRequest & {
  readonly payload: CinematographerJourneyPaceRequestPayload;
} {
  const trimmed = story?.trim() || undefined;
  const systemInstruction = cinematographerJourneyPaceSystemInstruction();
  const prompt = cinematographerJourneyPaceUserPrompt(trimmed);
  return {
    systemInstruction,
    prompt,
    payload: {
      ...(trimmed ? { story: trimmed } : {}),
      systemInstruction,
      prompt,
    },
  };
}

export function parseCinematographerJourneyPace(text: string): LocomotionPace {
  const raw = parseJsonObject(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new MediaGenerationError("generation_failed", "Cinematographer journey pace JSON must be an object");
  }
  const pace = (raw as Record<string, unknown>).pace;
  if (!isLocomotionPace(pace)) {
    throw new MediaGenerationError("generation_failed", "Cinematographer journey pace is invalid");
  }
  return pace;
}

export async function chooseJourneyPace(input: {
  readonly reasoning: ReasoningProvider;
  readonly story?: string;
}): Promise<CinematographerJourneyPaceResult> {
  const request = buildCinematographerJourneyPaceRequest(input.story);
  const result = await input.reasoning.complete({
    systemInstruction: request.systemInstruction,
    prompt: request.prompt,
  });
  return {
    pace: parseCinematographerJourneyPace(result.text),
    request: request.payload,
    rawText: result.text,
    model: result.model,
    modelVersion: result.modelVersion,
    predictionId: result.predictionId,
    elapsedMs: result.elapsedMs,
  };
}
