import { MediaGenerationError } from "../errors.ts";
import { parseJsonObject } from "../reasoning/json.ts";
import type { ReasoningProvider, ReasoningRequest } from "../reasoning/types.ts";
import type { MediaInput } from "../types.ts";
import {
  CINEMATOGRAPHER_ASSESSMENT_SYSTEM_INSTRUCTION,
  cinematographerAssessmentUserPrompt,
} from "./assessment-prompts.ts";
import { isLocomotionPace, type LocomotionPace } from "./shooting-prompt.ts";

export type CinematographerShootability = "shootable" | "needs_review" | "not_shootable";
export type CinematographerCamotionSuitability = "appropriate" | "poor_fit" | "uncertain";

export type CinematographerAssessment = {
  readonly shootability: CinematographerShootability;
  readonly summary: string;
  readonly route: string;
  readonly threshold: string;
  readonly camera: string;
  readonly parallax: string;
  readonly transitionStrategy: string;
  readonly segmentPromptAddition: string;
  readonly pace: LocomotionPace;
  readonly camotionSuitability: CinematographerCamotionSuitability;
  readonly concerns: readonly string[];
};

export type CinematographerAssessmentInput = {
  readonly journeyId: string;
  readonly start: {
    readonly id: string;
    readonly intent?: string;
    readonly image: MediaInput;
  };
  readonly end: {
    readonly id: string;
    readonly intent?: string;
    readonly image: MediaInput;
  };
  readonly story?: string;
};

export type CinematographerAssessmentRequestPayload = {
  readonly journeyId: string;
  readonly startId: string;
  readonly endId: string;
  readonly startIntent?: string;
  readonly endIntent?: string;
  readonly story?: string;
  readonly startImage: MediaInput;
  readonly endImage: MediaInput;
  readonly systemInstruction: string;
  readonly prompt: string;
};

export type CinematographerAssessmentResult = {
  readonly assessment: CinematographerAssessment;
  readonly request: CinematographerAssessmentRequestPayload;
  readonly rawText: string;
  readonly model: string;
  readonly modelVersion: string | null;
  readonly predictionId: string;
  readonly elapsedMs: number;
};

const MAX_TEXT = 800;
const MAX_CONCERNS = 8;
const SHOOTABILITY = new Set<CinematographerShootability>([
  "shootable",
  "needs_review",
  "not_shootable",
]);
const CAMOTION = new Set<CinematographerCamotionSuitability>([
  "appropriate",
  "poor_fit",
  "uncertain",
]);

export function buildCinematographerAssessmentRequest(
  input: CinematographerAssessmentInput,
): ReasoningRequest & { readonly payload: CinematographerAssessmentRequestPayload } {
  const journeyId = input.journeyId.trim();
  const startId = input.start.id.trim();
  const endId = input.end.id.trim();
  if (!journeyId) {
    throw new MediaGenerationError("invalid_input", "Cinematographer requires a journey id");
  }
  if (!startId || !endId) {
    throw new MediaGenerationError("invalid_input", "Cinematographer requires start and end destination ids");
  }
  const story = input.story?.trim() || undefined;
  const startIntent = input.start.intent?.trim() || undefined;
  const endIntent = input.end.intent?.trim() || undefined;
  const prompt = cinematographerAssessmentUserPrompt({
    journeyId,
    startId,
    endId,
    story,
    startIntent,
    endIntent,
  });
  const payload: CinematographerAssessmentRequestPayload = {
    journeyId,
    startId,
    endId,
    ...(startIntent ? { startIntent } : {}),
    ...(endIntent ? { endIntent } : {}),
    ...(story ? { story } : {}),
    startImage: input.start.image,
    endImage: input.end.image,
    systemInstruction: CINEMATOGRAPHER_ASSESSMENT_SYSTEM_INSTRUCTION,
    prompt,
  };
  return {
    systemInstruction: CINEMATOGRAPHER_ASSESSMENT_SYSTEM_INSTRUCTION,
    prompt,
    images: [input.start.image, input.end.image],
    payload,
  };
}

function asNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new MediaGenerationError("generation_failed", `${name} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new MediaGenerationError("generation_failed", `${name} must not be empty`);
  }
  if (trimmed.length > MAX_TEXT) {
    throw new MediaGenerationError("generation_failed", `${name} is too long`);
  }
  return trimmed;
}

function asPace(value: unknown): LocomotionPace {
  if (!isLocomotionPace(value)) {
    throw new MediaGenerationError("generation_failed", "Cinematographer pace is invalid");
  }
  return value;
}

export function parseCinematographerAssessment(text: string): CinematographerAssessment {
  const raw = parseJsonObject(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new MediaGenerationError("generation_failed", "Cinematographer JSON must be an object");
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.shootability !== "string" || !SHOOTABILITY.has(record.shootability as CinematographerShootability)) {
    throw new MediaGenerationError("generation_failed", "Cinematographer shootability is invalid");
  }
  if (
    typeof record.camotionSuitability !== "string" ||
    !CAMOTION.has(record.camotionSuitability as CinematographerCamotionSuitability)
  ) {
    throw new MediaGenerationError("generation_failed", "Cinematographer camotionSuitability is invalid");
  }
  if (!Array.isArray(record.concerns)) {
    throw new MediaGenerationError("generation_failed", "Cinematographer JSON must include concerns[]");
  }
  if (record.concerns.length > MAX_CONCERNS) {
    throw new MediaGenerationError("generation_failed", "Cinematographer returned too many concerns");
  }
  const concerns = record.concerns.map((item, index) => asNonEmptyString(item, `concerns[${index}]`));
  return {
    shootability: record.shootability as CinematographerShootability,
    summary: asNonEmptyString(record.summary, "summary"),
    route: asNonEmptyString(record.route, "route"),
    threshold: asNonEmptyString(record.threshold, "threshold"),
    camera: asNonEmptyString(record.camera, "camera"),
    parallax: asNonEmptyString(record.parallax, "parallax"),
    transitionStrategy: asNonEmptyString(record.transitionStrategy, "transitionStrategy"),
    segmentPromptAddition: asNonEmptyString(record.segmentPromptAddition, "segmentPromptAddition"),
    pace: asPace(record.pace),
    camotionSuitability: record.camotionSuitability as CinematographerCamotionSuitability,
    concerns,
  };
}

export async function assessJourney(input: {
  readonly reasoning: ReasoningProvider;
} & CinematographerAssessmentInput): Promise<CinematographerAssessmentResult> {
  const request = buildCinematographerAssessmentRequest(input);
  const result = await input.reasoning.complete({
    systemInstruction: request.systemInstruction,
    prompt: request.prompt,
    images: request.images,
  });
  return {
    assessment: parseCinematographerAssessment(result.text),
    request: request.payload,
    rawText: result.text,
    model: result.model,
    modelVersion: result.modelVersion,
    predictionId: result.predictionId,
    elapsedMs: result.elapsedMs,
  };
}
