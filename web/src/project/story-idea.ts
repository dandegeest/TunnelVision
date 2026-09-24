import type { CameraGrammar } from "../../../media/src/cinematographer/camera-grammar.ts";
import { requestScreenwriterCondition, type ScreenwriterConditionResponse } from "./screenwriter";

const LEADING_GRAMMAR = /^(pov|fpov|follow|lead|mounted|mount)\b/i;

export type ParsedStoryIdea = {
  cameraGrammar: CameraGrammar;
  /** Creative brief with a leading grammar token removed. */
  brief: string;
};

/**
 * Grammar is a leading control token only. Words later in the brief
 * ("follow the lights", "mounted cavalry") stay POV.
 */
export function parseLeadingCameraGrammar(storyIdea: string): ParsedStoryIdea {
  const trimmed = storyIdea.trimStart();
  const match = trimmed.match(LEADING_GRAMMAR);
  if (!match) {
    return { cameraGrammar: "pov", brief: storyIdea.trim() };
  }
  const token = match[1]!.toLowerCase();
  const cameraGrammar: CameraGrammar =
    token === "follow" ? "follow" : token === "lead" ? "lead" : token === "mount" || token === "mounted" ? "mounted" : "pov";
  const brief = trimmed
    .slice(match[0].length)
    .replace(/^[\s:–—-]+/, "")
    .trim();
  return { cameraGrammar, brief };
}

export type CompiledStoryIdea = ParsedStoryIdea & {
  storyIdea: string;
  productionPrompt: string;
  title?: string;
};

export async function compileStoryIdea(
  storyIdea: string,
  condition: (input: {
    storyIdea: string;
    cameraGrammar: CameraGrammar;
  }) => Promise<ScreenwriterConditionResponse> = requestScreenwriterCondition,
): Promise<CompiledStoryIdea> {
  const parsed = parseLeadingCameraGrammar(storyIdea);
  if (!parsed.brief.trim()) {
    throw new Error("Enter a story idea.");
  }
  const conditioned = await condition({
    storyIdea: parsed.brief,
    cameraGrammar: parsed.cameraGrammar,
  });
  const productionPrompt = conditioned.productionPrompt.trim();
  if (!productionPrompt) {
    throw new Error("Screenwriter returned an empty production prompt.");
  }
  return {
    storyIdea: storyIdea.trim(),
    brief: parsed.brief,
    cameraGrammar: parsed.cameraGrammar,
    productionPrompt,
    ...(conditioned.title ? { title: conditioned.title } : {}),
  };
}
