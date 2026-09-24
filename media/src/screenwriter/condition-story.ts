import { MediaGenerationError } from "../errors.ts";
import { parseJsonObject } from "../reasoning/json.ts";
import type { ReasoningProvider, ReasoningResult } from "../reasoning/types.ts";
import type { CameraGrammar } from "../cinematographer/camera-grammar.ts";
import type { Gemini31ProThinkingLevel } from "../replicate/gemini-3.1-pro.ts";

/** Screenwriter-only. Other roles keep the Gemini default of high. */
export const SCREENWRITER_THINKING_LEVEL: Gemini31ProThinkingLevel = "low";

export const SCREENWRITER_SYSTEM_INSTRUCTION = `You are TunnelVision's Screenwriter. You compile a filmmaker's Story Idea into one Production Prompt. You are an intent compiler, not a verbosity engine, and not the Director or Cinematographer.

Return JSON only: {"productionPrompt":"...","title":"..."}
No markdown fences. No commentary.

productionPrompt shape:
- the conditioned journey only
- a concise journey description the Director can plan from
- include requested constraints (overall journey duration, destination count, turns, elevation, ending, motifs) in story language
- end with a concise style line

Rules:
- Make the smallest useful changes. Enrich sparse ideas. Preserve explicit human intent.
- Honor a requested destination count in the prose. Do not emit A/B/C destination objects.
- Preserve requested overall journey duration as story intent. Do not assign individual shot/traversal durations; the Director and Cinematographer handle journey structure and shot timing downstream.
- If the idea names a style (watercolor, claymation, rotoscope, documentary, stop-motion, etc.), keep that style and do not force photorealism. If the idea states no style, end with concise cinematic photorealism (photorealistic live-action, natural light, realistic materials, atmospheric depth).
- Camera grammar is already chosen and provided. Keep the story compatible with it. Do not restate internal grammar laws (no hands, unembodied camera, elastic follow distance, do not overtake).
- Do not write Camotion, exposure, A′/B′, provider, model, pace-setting, Pull Forward, or shot-evaluation instructions.
- Do not specify exact distances, angles, lenses, or frame-by-frame choreography.
- Leave local cinematography and the actual destination plan to later roles.
- title is a short project name, not a sentence. Return it only in the title field. Do not repeat it inside productionPrompt.`;

const MAX_PROMPT = 4000;

export type ScreenwriterConditionInput = {
  readonly reasoning: ReasoningProvider;
  readonly storyIdea: string;
  readonly cameraGrammar: CameraGrammar;
};

export type ScreenwriterConditionResult = {
  readonly productionPrompt: string;
  readonly title?: string;
  readonly rawText: string;
  readonly model: string;
  readonly modelVersion: string | null;
  readonly predictionId: string;
  readonly elapsedMs: number;
};

export function screenwriterUserPrompt(input: { storyIdea: string; cameraGrammar: CameraGrammar }): string {
  return [
    `Camera grammar (already selected, do not change): ${input.cameraGrammar}`,
    "",
    "Story Idea:",
    input.storyIdea.trim(),
  ].join("\n");
}

export function parseScreenwriterCondition(text: string): { productionPrompt: string; title?: string } {
  const raw = parseJsonObject(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new MediaGenerationError("generation_failed", "Screenwriter JSON must be an object");
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.productionPrompt !== "string") {
    throw new MediaGenerationError("generation_failed", "productionPrompt must be a string");
  }
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const productionPrompt = withoutLeadingTitle(record.productionPrompt.trim(), title);
  if (!productionPrompt) {
    throw new MediaGenerationError("generation_failed", "productionPrompt must not be empty");
  }
  if (productionPrompt.length > MAX_PROMPT) {
    throw new MediaGenerationError("generation_failed", "productionPrompt is too long");
  }
  return title ? { productionPrompt, title } : { productionPrompt };
}

function withoutLeadingTitle(productionPrompt: string, title: string): string {
  if (!title) {
    return productionPrompt;
  }
  const lines = productionPrompt.split(/\r?\n/);
  const first = lines[0]?.trim().replace(/[.:：]+$/, "").trim().toLowerCase();
  if (first !== title.trim().replace(/[.:：]+$/, "").trim().toLowerCase()) {
    return productionPrompt;
  }
  return lines.slice(1).join("\n").trim();
}

export async function conditionStory(input: ScreenwriterConditionInput): Promise<ScreenwriterConditionResult> {
  const storyIdea = input.storyIdea.trim();
  if (!storyIdea) {
    throw new MediaGenerationError("invalid_input", "Screenwriter requires a story idea");
  }
  const prompt = screenwriterUserPrompt({ storyIdea, cameraGrammar: input.cameraGrammar });
  const result: ReasoningResult = await input.reasoning.complete({
    systemInstruction: SCREENWRITER_SYSTEM_INSTRUCTION,
    prompt,
  });
  const parsed = parseScreenwriterCondition(result.text);
  return {
    ...parsed,
    rawText: result.text,
    model: result.model,
    modelVersion: result.modelVersion,
    predictionId: result.predictionId,
    elapsedMs: result.elapsedMs,
  };
}
