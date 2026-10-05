import { MediaGenerationError } from "../errors.ts";
import { parseJsonObject } from "../reasoning/json.ts";
import type { ReasoningProvider } from "../reasoning/types.ts";
import type { MediaInput } from "../types.ts";
import type { CameraGrammar } from "./camera-grammar.ts";
import {
  CHARACTER_CONSISTENCY_SYSTEM,
  characterConsistencyUserPrompt,
} from "./character-consistency-prompts.ts";

/**
 * Identity gate. GOOD at 60 or above proceeds to cinematographer planning.
 * 40–59 is DRIFTING and below 40 is FAILED. Both repair. The score wins over
 * any status label the model returns.
 *
 * The first gate was 75. On follow shots that treated unseen antennae, chest
 * panels, and neck rings as drift, then repairs tried to reveal them and
 * damaged the still. 60 keeps a real design change in the repair band and
 * lets a same-subject view through when a sheet detail is merely not readable.
 */
export const CHARACTER_CONSISTENCY_PASS_SCORE = 60;
export const CHARACTER_CONSISTENCY_DRIFT_SCORE = 40;

export type CharacterConsistencyStatus = "GOOD" | "DRIFTING" | "FAILED";

export type CharacterConsistency = {
  readonly score: number;
  readonly status: CharacterConsistencyStatus;
  readonly observations: readonly string[];
  readonly repairNeeded: boolean;
  readonly repairInstructions?: readonly string[];
};

export type CharacterConsistencyInput = {
  readonly description: string;
  readonly cameraGrammar?: CameraGrammar;
  readonly subjectImage: MediaInput;
  readonly candidateImage: MediaInput;
};

export type CharacterConsistencyResult = {
  readonly consistency: CharacterConsistency;
  readonly model: string;
  readonly modelVersion: string | null;
  readonly predictionId: string;
};

const MAX_NOTES = 8;
const MAX_NOTE = 400;

export function characterConsistencyFromScore(
  score: number,
  observations: readonly string[],
  repairInstructions: readonly string[],
): CharacterConsistency {
  const status: CharacterConsistencyStatus =
    score >= CHARACTER_CONSISTENCY_PASS_SCORE
      ? "GOOD"
      : score >= CHARACTER_CONSISTENCY_DRIFT_SCORE
        ? "DRIFTING"
        : "FAILED";
  const repairNeeded = score < CHARACTER_CONSISTENCY_PASS_SCORE;
  return {
    score,
    status,
    observations,
    repairNeeded,
    ...(repairNeeded && repairInstructions.length > 0 ? { repairInstructions } : {}),
  };
}

export function characterConsistencyFromModelText(text: string): CharacterConsistency {
  const parsed = parseJsonObject(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new MediaGenerationError("generation_failed", "Character consistency was not JSON");
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.score !== "number" || !Number.isInteger(record.score) || record.score < 0 || record.score > 100) {
    throw new MediaGenerationError("generation_failed", "Character consistency score is invalid");
  }
  return characterConsistencyFromScore(
    record.score,
    noteList(record.observations, "observations"),
    noteList(record.repairInstructions, "repairInstructions"),
  );
}

export async function evaluateCharacterConsistency(
  input: CharacterConsistencyInput & { readonly reasoning: ReasoningProvider },
): Promise<CharacterConsistencyResult> {
  const description = input.description.trim();
  const result = await input.reasoning.complete({
    systemInstruction: CHARACTER_CONSISTENCY_SYSTEM,
    prompt: characterConsistencyUserPrompt(description, input.cameraGrammar),
    images: [input.subjectImage, input.candidateImage],
  });
  return {
    consistency: characterConsistencyFromModelText(result.text),
    model: result.model,
    modelVersion: result.modelVersion,
    predictionId: result.predictionId,
  };
}

function noteList(value: unknown, name: string): string[] {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new MediaGenerationError("generation_failed", `Character consistency ${name} is invalid`);
  }
  return value.slice(0, MAX_NOTES).map((item) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new MediaGenerationError("generation_failed", `Character consistency ${name} is invalid`);
    }
    return item.trim().slice(0, MAX_NOTE);
  });
}
