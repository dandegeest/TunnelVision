import { MediaGenerationError } from "../errors.ts";
import { toReplicateFileInput, type ResolvedMedia } from "../media-input.ts";
import { ReasoningRequest } from "../reasoning/types.ts";

export const GEMINI_31_PRO_MODEL = "google/gemini-3.1-pro";

export type Gemini31ProThinkingLevel = "low" | "medium" | "high";

/**
 * Gemini knobs for the Cinematographer reasoning adapter.
 * Model ID stays on the adapter, not on the filmmaking role.
 */
export type Gemini31ProSettings = {
  readonly thinkingLevel?: Gemini31ProThinkingLevel;
  readonly temperature?: number;
  readonly topP?: number;
};

export const DEFAULT_GEMINI_31_PRO_SETTINGS = {
  thinkingLevel: "high",
  temperature: 1,
  topP: 0.95,
} as const satisfies Required<Gemini31ProSettings>;

export type Gemini31ProInput = {
  readonly prompt: string;
  readonly images?: ReadonlyArray<string | Buffer>;
  readonly system_instruction?: string;
  readonly thinking_level: Gemini31ProThinkingLevel;
  readonly temperature: number;
  readonly top_p: number;
};

export function mergeGemini31ProSettings(
  settings?: Gemini31ProSettings,
): Gemini31ProSettings & typeof DEFAULT_GEMINI_31_PRO_SETTINGS {
  return {
    ...DEFAULT_GEMINI_31_PRO_SETTINGS,
    ...settings,
  };
}

export function toGemini31ProInput(
  request: ReasoningRequest,
  resolvedImages: readonly ResolvedMedia[],
  settings?: Gemini31ProSettings,
): Gemini31ProInput {
  if (!request.prompt.trim()) {
    throw new MediaGenerationError("invalid_input", "prompt is required");
  }

  const merged = mergeGemini31ProSettings(settings);
  const input: Gemini31ProInput = {
    prompt: request.prompt,
    thinking_level: merged.thinkingLevel,
    temperature: merged.temperature,
    top_p: merged.topP,
  };

  const withOptional: Gemini31ProInput = {
    ...input,
    ...(request.systemInstruction
      ? { system_instruction: request.systemInstruction }
      : {}),
    ...(resolvedImages.length > 0
      ? { images: resolvedImages.map((image) => toReplicateFileInput(image)) }
      : {}),
  };
  return withOptional;
}
