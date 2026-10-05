export type { CharacterConsistencyStatus } from "../../../media/src/cinematographer/character-consistency.ts";
import type { CharacterConsistencyStatus } from "../../../media/src/cinematographer/character-consistency.ts";
import type { ConversationEntry } from "./conversation";
import type { CanonicalCharacterCheck, CanonicalTake } from "./types";

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

/** Prefer the check stored on the take. Otherwise use the latest scored log for that still. */
export function characterCheckForTake(
  take: Pick<CanonicalTake, "mediaId" | "characterConsistency">,
  conversation?: readonly ConversationEntry[],
): CanonicalCharacterCheck | undefined {
  if (take.characterConsistency) {
    return take.characterConsistency;
  }
  if (!conversation || !take.mediaId) {
    return undefined;
  }
  for (let index = conversation.length - 1; index >= 0; index -= 1) {
    const entry = conversation[index];
    if (!entry || entry.kind !== "character") {
      continue;
    }
    if (entry.status !== "pass" && entry.status !== "drift") {
      continue;
    }
    if (entry.candidateMediaId !== take.mediaId) {
      continue;
    }
    if (typeof entry.score !== "number" || !entry.consistencyStatus) {
      continue;
    }
    return {
      score: entry.score,
      status: entry.consistencyStatus,
      observations: entry.observations ?? [],
      repairInstructions: entry.repairInstructions ?? [],
      repairNeeded: entry.status === "drift",
    };
  }
  return undefined;
}

export function characterSuggestionText(check: {
  repairInstructions?: readonly string[];
  observations?: readonly string[];
  repairNeeded?: boolean;
}): string {
  const instructions = (check.repairInstructions ?? []).map((line) => line.trim()).filter(Boolean);
  if (instructions.length > 0) {
    return instructions.join("\n");
  }
  if (!check.repairNeeded) {
    return "";
  }
  return (check.observations ?? []).map((line) => line.trim()).filter(Boolean).join("\n");
}

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
