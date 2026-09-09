import { MediaGenerationError } from "../errors.ts";
import { parseJsonObject } from "../reasoning/json.ts";
import type { ReasoningProvider, ReasoningRequest } from "../reasoning/types.ts";
import type { MediaInput } from "../types.ts";
import { DIRECTOR_STORY_SYSTEM_INSTRUCTION, directorStoryUserPrompt } from "./prompts.ts";

export type DirectorStoryInput = {
  readonly startFrame: {
    readonly id: string;
    readonly intent?: string;
    readonly image: MediaInput;
  };
};

export type DirectorStoryRequestPayload = {
  readonly startFrameId: string;
  readonly startFrameIntent?: string;
  readonly startImage: MediaInput;
  readonly systemInstruction: string;
  readonly prompt: string;
};

export type DirectorStoryResult = {
  readonly story: string;
  readonly request: DirectorStoryRequestPayload;
  readonly rawText: string;
  readonly model: string;
  readonly modelVersion: string | null;
  readonly predictionId: string;
  readonly elapsedMs: number;
};

const MAX_STORY = 1200;

export function buildDirectorStoryRequest(input: DirectorStoryInput): ReasoningRequest & {
  readonly payload: DirectorStoryRequestPayload;
} {
  const startFrameId = input.startFrame.id.trim();
  if (!startFrameId) {
    throw new MediaGenerationError("invalid_input", "Director requires a starting frame id");
  }
  const startFrameIntent = input.startFrame.intent?.trim() || undefined;
  const prompt = directorStoryUserPrompt({
    startFrameId,
    ...(startFrameIntent ? { startFrameIntent } : {}),
  });
  const payload: DirectorStoryRequestPayload = {
    startFrameId,
    ...(startFrameIntent ? { startFrameIntent } : {}),
    startImage: input.startFrame.image,
    systemInstruction: DIRECTOR_STORY_SYSTEM_INSTRUCTION,
    prompt,
  };
  return {
    systemInstruction: DIRECTOR_STORY_SYSTEM_INSTRUCTION,
    prompt,
    images: [input.startFrame.image],
    payload,
  };
}

export function parseDirectorStory(text: string): string {
  const raw = parseJsonObject(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new MediaGenerationError("generation_failed", "Director JSON must be an object");
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.story !== "string") {
    throw new MediaGenerationError("generation_failed", "story must be a string");
  }
  const story = record.story.trim();
  if (!story) {
    throw new MediaGenerationError("generation_failed", "story must not be empty");
  }
  if (story.length > MAX_STORY) {
    throw new MediaGenerationError("generation_failed", "story is too long");
  }
  return story;
}

export async function deriveStory(input: {
  readonly reasoning: ReasoningProvider;
} & DirectorStoryInput): Promise<DirectorStoryResult> {
  const request = buildDirectorStoryRequest(input);
  const result = await input.reasoning.complete({
    systemInstruction: request.systemInstruction,
    prompt: request.prompt,
    images: request.images,
  });
  const story = parseDirectorStory(result.text);
  return {
    story,
    request: request.payload,
    rawText: result.text,
    model: result.model,
    modelVersion: result.modelVersion,
    predictionId: result.predictionId,
    elapsedMs: result.elapsedMs,
  };
}
