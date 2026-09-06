import { MediaGenerationError } from "../errors.ts";
import { parseJsonObject } from "../reasoning/json.ts";
import type { ReasoningProvider, ReasoningRequest } from "../reasoning/types.ts";
import type { MediaInput } from "../types.ts";
import { DIRECTOR_SYSTEM_INSTRUCTION, directorUserPrompt } from "./prompts.ts";

export type DirectorAgency = "directed" | "autonomous";

export type DirectorBeat = {
  readonly id: string;
  readonly intent: string;
  readonly visualDescription: string;
};

export type DirectorPlan = {
  readonly summary?: string;
  readonly beats: readonly DirectorBeat[];
};

export type DirectorPlanInput = {
  readonly story: string;
  readonly startFrame: {
    readonly id: string;
    readonly intent?: string;
    readonly image: MediaInput;
  };
  readonly agency: DirectorAgency;
};

export type DirectorRequestPayload = {
  readonly story: string;
  readonly agency: DirectorAgency;
  readonly startFrameId: string;
  readonly startFrameIntent?: string;
  readonly startImage: MediaInput;
  readonly systemInstruction: string;
  readonly prompt: string;
};

export type DirectorPlanResult = {
  readonly plan: DirectorPlan;
  readonly request: DirectorRequestPayload;
  readonly rawText: string;
  readonly model: string;
  readonly modelVersion: string | null;
  readonly predictionId: string;
  readonly elapsedMs: number;
};

const MAX_BEATS = 12;
const MAX_TEXT = 800;

export function buildDirectorRequest(input: DirectorPlanInput): ReasoningRequest & {
  readonly payload: DirectorRequestPayload;
} {
  const story = input.story.trim();
  const startFrameId = input.startFrame.id.trim();
  if (!story) {
    throw new MediaGenerationError("invalid_input", "Director requires a filmmaker story");
  }
  if (!startFrameId) {
    throw new MediaGenerationError("invalid_input", "Director requires a starting frame id");
  }
  if (input.agency !== "directed" && input.agency !== "autonomous") {
    throw new MediaGenerationError("invalid_input", "Director agency must be directed or autonomous");
  }

  const startFrameIntent = input.startFrame.intent?.trim() || undefined;
  const prompt = directorUserPrompt({
    story,
    startFrameId,
    startFrameIntent,
    agency: input.agency,
  });
  const payload: DirectorRequestPayload = {
    story,
    agency: input.agency,
    startFrameId,
    ...(startFrameIntent ? { startFrameIntent } : {}),
    startImage: input.startFrame.image,
    systemInstruction: DIRECTOR_SYSTEM_INSTRUCTION,
    prompt,
  };
  return {
    systemInstruction: DIRECTOR_SYSTEM_INSTRUCTION,
    prompt,
    images: [input.startFrame.image],
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

export function parseDirectorPlan(text: string): DirectorPlan {
  const raw = parseJsonObject(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new MediaGenerationError("generation_failed", "Director JSON must be an object");
  }
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.beats)) {
    throw new MediaGenerationError("generation_failed", "Director JSON must include beats[]");
  }
  if (record.beats.length < 1) {
    throw new MediaGenerationError("generation_failed", "Director returned no planned beats");
  }
  if (record.beats.length > MAX_BEATS) {
    throw new MediaGenerationError("generation_failed", "Director returned too many beats");
  }

  const beats: DirectorBeat[] = record.beats.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new MediaGenerationError("generation_failed", `beats[${index}] must be an object`);
    }
    const beat = item as Record<string, unknown>;
    return {
      id: asNonEmptyString(beat.id, `beats[${index}].id`),
      intent: asNonEmptyString(beat.intent, `beats[${index}].intent`),
      visualDescription: asNonEmptyString(
        beat.visualDescription,
        `beats[${index}].visualDescription`,
      ),
    };
  });

  const summary =
    record.summary === undefined || record.summary === null
      ? undefined
      : asNonEmptyString(record.summary, "summary");

  return summary ? { summary, beats } : { beats };
}

/** Subsequent planned beats only. The opening frame is applied by the product, not replaced here. */
export function subsequentDirectorBeats(
  plan: DirectorPlan,
  startFrameId: string,
): readonly DirectorBeat[] {
  const subsequent = plan.beats.filter(
    (beat) => beat.id.trim().toLowerCase() !== startFrameId.trim().toLowerCase(),
  );
  if (subsequent.length < 1) {
    throw new MediaGenerationError(
      "generation_failed",
      "Director returned no subsequent beats after the starting frame",
    );
  }
  return subsequent;
}

export async function plan(input: {
  readonly reasoning: ReasoningProvider;
} & DirectorPlanInput): Promise<DirectorPlanResult> {
  const request = buildDirectorRequest(input);
  const result = await input.reasoning.complete({
    systemInstruction: request.systemInstruction,
    prompt: request.prompt,
    images: request.images,
  });
  const parsed = parseDirectorPlan(result.text);
  const beats = subsequentDirectorBeats(parsed, input.startFrame.id);
  const plan: DirectorPlan = parsed.summary
    ? { summary: parsed.summary, beats }
    : { beats };
  return {
    plan,
    request: request.payload,
    rawText: result.text,
    model: result.model,
    modelVersion: result.modelVersion,
    predictionId: result.predictionId,
    elapsedMs: result.elapsedMs,
  };
}