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
export type CinematographerTravelConfidence = "high" | "medium" | "low";

/**
 * Semantic travel target in one still. Normalized image coords: (0,0)
 * top-left, (1,1) bottom-right. Not CameraMotionPlan JSON.
 */
export type CinematographerTravelTarget = {
  readonly vanishingPoint?: readonly [number, number];
  readonly destinationPoint?: readonly [number, number];
  readonly destinationBbox?: readonly [number, number, number, number];
  /** Camera heading in this still, toward the travel target. Not unit-length. */
  readonly vector?: readonly [number, number];
  readonly label: string;
};

/**
 * Per-segment semantic route geometry from the same CM assessment turn.
 * A deterministic bridge turns this into CameraMotionPlan v1.
 */
export type CinematographerTravel = {
  readonly start?: CinematographerTravelTarget;
  readonly end?: CinematographerTravelTarget;
  readonly direction?: string;
  readonly confidence: CinematographerTravelConfidence;
};

export type CinematographerAssessment = {
  readonly shootability: CinematographerShootability;
  /** 0–100. Same continuous physical world and route, not generation quality. */
  readonly setConsistency: number;
  /** 0–100. Confidence the camera can travel start→end in continuous first-person motion. */
  readonly traversalConfidence: number;
  readonly summary: string;
  readonly route: string;
  readonly threshold: string;
  readonly camera: string;
  readonly parallax: string;
  readonly transitionStrategy: string;
  readonly segmentPromptAddition: string;
  readonly pace: LocomotionPace;
  readonly concerns: readonly string[];
  readonly travel?: CinematographerTravel;
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
const COINCIDENT = 1e-6;
const SHOOTABILITY = new Set<CinematographerShootability>([
  "shootable",
  "needs_review",
  "not_shootable",
]);
const TRAVEL_CONFIDENCE = new Set<CinematographerTravelConfidence>(["high", "medium", "low"]);

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

function asScore100(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new MediaGenerationError("generation_failed", `Cinematographer ${name} is invalid`);
  }
  return value;
}

function optionalUnitNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    return undefined;
  }
  return value;
}

function optionalUnitPoint(value: unknown): readonly [number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 2) {
    return undefined;
  }
  const x = optionalUnitNumber(value[0]);
  const y = optionalUnitNumber(value[1]);
  if (x === undefined || y === undefined) {
    return undefined;
  }
  return [x, y];
}

function optionalBBox(value: unknown): readonly [number, number, number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 4) {
    return undefined;
  }
  const left = optionalUnitNumber(value[0]);
  const top = optionalUnitNumber(value[1]);
  const right = optionalUnitNumber(value[2]);
  const bottom = optionalUnitNumber(value[3]);
  if (
    left === undefined ||
    top === undefined ||
    right === undefined ||
    bottom === undefined ||
    !(left < right) ||
    !(top < bottom)
  ) {
    return undefined;
  }
  return [left, top, right, bottom];
}

function optionalVector(value: unknown): readonly [number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 2) {
    return undefined;
  }
  const x = value[0];
  const y = value[1];
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) {
    return undefined;
  }
  if (Math.hypot(x, y) < COINCIDENT) {
    return undefined;
  }
  return [x, y];
}

function optionalLabel(value: unknown): string {
  if (typeof value !== "string") {
    return "travel target";
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_TEXT) {
    return "travel target";
  }
  return trimmed;
}

function parseTravelTarget(value: unknown): CinematographerTravelTarget | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const vanishingPoint = optionalUnitPoint(record.vanishingPoint);
  const destinationPoint = optionalUnitPoint(record.destinationPoint);
  if (!vanishingPoint && !destinationPoint) {
    return undefined;
  }
  const destinationBbox = optionalBBox(record.destinationBbox);
  const vector = optionalVector(record.vector);
  return {
    ...(vanishingPoint ? { vanishingPoint } : {}),
    ...(destinationPoint ? { destinationPoint } : {}),
    ...(destinationBbox ? { destinationBbox } : {}),
    ...(vector ? { vector } : {}),
    label: optionalLabel(record.label),
  };
}

function parseTravel(value: unknown): CinematographerTravel | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const start = parseTravelTarget(record.start);
  const end = parseTravelTarget(record.end);
  if (!start && !end) {
    return undefined;
  }
  const direction =
    typeof record.direction === "string" && record.direction.trim() && record.direction.trim().length <= MAX_TEXT
      ? record.direction.trim()
      : undefined;
  const confidence =
    typeof record.confidence === "string" && TRAVEL_CONFIDENCE.has(record.confidence as CinematographerTravelConfidence)
      ? (record.confidence as CinematographerTravelConfidence)
      : "medium";
  return {
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
    ...(direction ? { direction } : {}),
    confidence,
  };
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
  const setConsistency = asScore100(record.setConsistency, "setConsistency");
  const traversalConfidence = asScore100(record.traversalConfidence, "traversalConfidence");
  if (!Array.isArray(record.concerns)) {
    throw new MediaGenerationError("generation_failed", "Cinematographer JSON must include concerns[]");
  }
  if (record.concerns.length > MAX_CONCERNS) {
    throw new MediaGenerationError("generation_failed", "Cinematographer returned too many concerns");
  }
  const concerns = record.concerns.map((item, index) => asNonEmptyString(item, `concerns[${index}]`));
  const travel = parseTravel(record.travel);
  return {
    shootability: record.shootability as CinematographerShootability,
    setConsistency,
    traversalConfidence,
    summary: asNonEmptyString(record.summary, "summary"),
    route: asNonEmptyString(record.route, "route"),
    threshold: asNonEmptyString(record.threshold, "threshold"),
    camera: asNonEmptyString(record.camera, "camera"),
    parallax: asNonEmptyString(record.parallax, "parallax"),
    transitionStrategy: asNonEmptyString(record.transitionStrategy, "transitionStrategy"),
    segmentPromptAddition: asNonEmptyString(record.segmentPromptAddition, "segmentPromptAddition"),
    pace: asPace(record.pace),
    concerns,
    ...(travel ? { travel } : {}),
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
