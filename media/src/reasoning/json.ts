import { MediaGenerationError } from "../errors.ts";

/** Pull a JSON object from model text, including optional markdown fences. */
export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new MediaGenerationError("generation_failed", "Model output was not JSON");
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new MediaGenerationError("generation_failed", "Model JSON could not be parsed");
  }
}