import type { CameraGrammar } from "../../../media/src/cinematographer/camera-grammar.ts";

export type ScreenwriterConditionResponse = {
  productionPrompt: string;
  title?: string;
};

export async function requestScreenwriterCondition(input: {
  storyIdea: string;
  cameraGrammar: CameraGrammar;
}): Promise<ScreenwriterConditionResponse> {
  const response = await fetch("/api/screenwriter/condition", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      storyIdea: input.storyIdea,
      cameraGrammar: input.cameraGrammar,
    }),
  });
  const body = (await response.json()) as ScreenwriterConditionResponse | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body && body.error ? body.error : "Screenwriter failed");
  }
  if (!("productionPrompt" in body) || typeof body.productionPrompt !== "string" || !body.productionPrompt.trim()) {
    throw new Error("Screenwriter failed");
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  return title ? { productionPrompt: body.productionPrompt.trim(), title } : { productionPrompt: body.productionPrompt.trim() };
}
