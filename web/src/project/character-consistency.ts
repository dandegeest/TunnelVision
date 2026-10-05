export type { CharacterConsistencyStatus } from "../../../media/src/cinematographer/character-consistency.ts";
import type { CharacterConsistencyStatus } from "../../../media/src/cinematographer/character-consistency.ts";

/** Identity check returned to the journey agent. The score gate is applied on the server. */
export type CharacterConsistencyEvaluation = {
  score: number;
  status: CharacterConsistencyStatus;
  observations: string[];
  repairNeeded: boolean;
  repairInstructions: string[];
  subjectMediaId: string;
  candidateMediaId: string;
  subjectDescription: string;
  model: string;
};

export type CharacterConsistencyResponse = {
  consistency: {
    score: number;
    status: CharacterConsistencyStatus;
    observations: string[];
    repairNeeded: boolean;
    repairInstructions?: string[];
  };
  model: string;
};

export async function requestCharacterConsistency(input: {
  subjectMediaId: string;
  candidateMediaId: string;
  description: string;
  cameraGrammar?: string;
}): Promise<CharacterConsistencyResponse> {
  const response = await fetch("/api/cinematographer/character-consistency", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as CharacterConsistencyResponse | { error?: string };
  if (!response.ok || !("consistency" in body) || !body.consistency) {
    throw new Error("error" in body && body.error ? body.error : "Character consistency failed");
  }
  return body;
}
