import { MediaGenerationError } from "../errors.ts";
import { MediaInput } from "../types.ts";
import { ReasoningProvider } from "../reasoning/types.ts";
import { cinematographerUserPrompt, CINEMATOGRAPHER_SYSTEM_INSTRUCTION } from "./prompts.ts";

export const CAMERA_MOTION_PLAN_VERSION = 1;
export const BASELINE_FORWARD = 1.0;
export const BASELINE_EXPOSURE = {
  strength: 0.08,
  samples: 16,
} as const;

export type CameraMotionPlanV1 = {
  readonly version: 1;
  readonly camera: {
    readonly vanishing_point: readonly [number, number];
    readonly forward: number;
  };
  readonly destination: {
    readonly point: readonly [number, number];
    readonly protect: boolean;
    readonly bbox: readonly [number, number, number, number];
  };
  readonly exposure: {
    readonly strength: number;
    readonly samples: number;
  };
};

export type ShotMotionPlans = {
  readonly start: CameraMotionPlanV1;
  readonly end: CameraMotionPlanV1;
  readonly route: string;
  readonly raw: unknown;
  readonly pinned: {
    readonly forward: true;
    readonly exposure: true;
  };
};

export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new MediaGenerationError("generation_failed", "Cinematographer output was not JSON");
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new MediaGenerationError("generation_failed", "Cinematographer JSON could not be parsed");
  }
}

function asFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new MediaGenerationError("generation_failed", `${name} must be a number`);
  }
  return value;
}

function inUnitInterval(value: number, name: string): number {
  if (value < 0 || value > 1) {
    throw new MediaGenerationError("generation_failed", `${name} must be in [0, 1]`);
  }
  return value;
}

function parsePoint(value: unknown, name: string): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new MediaGenerationError("generation_failed", `${name} must be [x, y]`);
  }
  return [
    inUnitInterval(asFiniteNumber(value[0], `${name}[0]`), `${name}[0]`),
    inUnitInterval(asFiniteNumber(value[1], `${name}[1]`), `${name}[1]`),
  ];
}

function parseBBox(value: unknown, name: string): [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new MediaGenerationError("generation_failed", `${name} must be [left, top, right, bottom]`);
  }
  const left = inUnitInterval(asFiniteNumber(value[0], `${name}[0]`), `${name}[0]`);
  const top = inUnitInterval(asFiniteNumber(value[1], `${name}[1]`), `${name}[1]`);
  const right = inUnitInterval(asFiniteNumber(value[2], `${name}[2]`), `${name}[2]`);
  const bottom = inUnitInterval(asFiniteNumber(value[3], `${name}[3]`), `${name}[3]`);
  if (!(left < right) || !(top < bottom)) {
    throw new MediaGenerationError("generation_failed", `${name} must have left < right and top < bottom`);
  }
  return [left, top, right, bottom];
}

function parseSide(value: unknown, side: "start" | "end"): CameraMotionPlanV1 {
  if (!value || typeof value !== "object") {
    throw new MediaGenerationError("generation_failed", `missing ${side} plan`);
  }
  const record = value as Record<string, unknown>;
  const destination = record.destination;
  if (!destination || typeof destination !== "object") {
    throw new MediaGenerationError("generation_failed", `missing ${side}.destination`);
  }
  const dest = destination as Record<string, unknown>;
  const camera = record.camera;
  if (!camera || typeof camera !== "object") {
    throw new MediaGenerationError("generation_failed", `missing ${side}.camera`);
  }
  const cam = camera as Record<string, unknown>;
  return {
    version: CAMERA_MOTION_PLAN_VERSION,
    camera: {
      vanishing_point: parsePoint(cam.vanishing_point, `${side}.camera.vanishing_point`),
      forward: BASELINE_FORWARD,
    },
    destination: {
      point: parsePoint(dest.point, `${side}.destination.point`),
      protect: dest.protect === undefined ? true : Boolean(dest.protect),
      bbox: parseBBox(dest.bbox, `${side}.destination.bbox`),
    },
    exposure: {
      strength: BASELINE_EXPOSURE.strength,
      samples: BASELINE_EXPOSURE.samples,
    },
  };
}

export function extractShotMotionPlans(text: string): ShotMotionPlans {
  const raw = parseJsonObject(text);
  if (!raw || typeof raw !== "object") {
    throw new MediaGenerationError("generation_failed", "Cinematographer JSON must be an object");
  }
  const record = raw as Record<string, unknown>;
  return {
    start: parseSide(record.start, "start"),
    end: parseSide(record.end, "end"),
    route: typeof record.route === "string" ? record.route : "",
    raw,
    pinned: { forward: true, exposure: true },
  };
}

export async function planShotMotion(options: {
  readonly reasoning: ReasoningProvider;
  readonly shotId: string;
  readonly startId: string;
  readonly endId: string;
  readonly journey: string;
  readonly startImage: MediaInput;
  readonly endImage: MediaInput;
}): Promise<{
  readonly plans: ShotMotionPlans;
  readonly reasoningText: string;
  readonly model: string;
  readonly modelVersion: string | null;
  readonly predictionId: string;
  readonly elapsedMs: number;
}> {
  const result = await options.reasoning.complete({
    systemInstruction: CINEMATOGRAPHER_SYSTEM_INSTRUCTION,
    prompt: cinematographerUserPrompt({
      shotId: options.shotId,
      startId: options.startId,
      endId: options.endId,
      journey: options.journey,
    }),
    images: [options.startImage, options.endImage],
  });
  return {
    plans: extractShotMotionPlans(result.text),
    reasoningText: result.text,
    model: result.model,
    modelVersion: result.modelVersion,
    predictionId: result.predictionId,
    elapsedMs: result.elapsedMs,
  };
}
