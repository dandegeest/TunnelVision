import { actualFrameForDestination, hasCurrentMotionPlan } from "./cinematographer";
import { journeyHasTakes, journeyTakes } from "./takes";
import type { CinematographerAssessment, JourneyShot, Project, StoryboardFrame } from "./types";

/** Experimental Pass 2 gates. Not a permanent filmmaking policy. */
export const JOURNEY_AGENT_REPAIR_THRESHOLDS = {
  traversalConfidenceBelow: 30,
  maxAttemptsPerSegment: 2,
} as const;

/**
 * Character-consistency repairs allowed for one acceptance of a canonical.
 * The budget starts over after a spatial RESHOOT replaces that canonical.
 * A character repair in that later acceptance keeps the traversal instruction,
 * so it changes the character and the route together instead of undoing the route.
 * Spatial repair still stops after maxAttemptsPerSegment, so a segment can
 * run at most 1 + maxAttemptsPerSegment acceptance cycles.
 */
export const CHARACTER_CONSISTENCY_MAX_REPAIRS = 2;

export type CanonicalRepairRecommendation = "RESHOOT_START" | "RESHOOT_END" | "RESHOOT_BOTH";

export type CanonicalRepairPlan = {
  recommendation: CanonicalRepairRecommendation;
  instruction: string;
  destinationIds: string[];
  setConsistency: number;
  traversalConfidence: number;
};

export function journeyCinematographerAssessment(
  journey: JourneyShot | undefined,
): CinematographerAssessment | undefined {
  return journey?.motionPlan?.cinematographer ?? journey?.cinematographer;
}

export function canonicalPairNeedsRepair(
  assessment: Pick<CinematographerAssessment, "setConsistency" | "traversalConfidence" | "repairRecommendation">,
  thresholds = JOURNEY_AGENT_REPAIR_THRESHOLDS,
): boolean {
  return (
    assessment.traversalConfidence < thresholds.traversalConfidenceBelow ||
    assessment.repairRecommendation === "RESHOOT_START" ||
    assessment.repairRecommendation === "RESHOOT_END"
  );
}

export function humanRepairRecommendation(recommendation: CanonicalRepairRecommendation): string {
  switch (recommendation) {
    case "RESHOOT_START":
      return "RESHOOT START";
    case "RESHOOT_END":
      return "RESHOOT END";
    case "RESHOOT_BOTH":
      return "RESHOOT BOTH";
  }
}

export function repairDestinationIds(
  journey: Pick<JourneyShot, "endDestinationId">,
): string[] {
  return journey.endDestinationId ? [journey.endDestinationId] : [];
}

function generatedUnprotectedFrame(
  project: Project,
  destinationId: string,
): (StoryboardFrame & { mediaId: string }) | undefined {
  const frame = actualFrameForDestination(project, destinationId);
  if (!frame || frame.imageOrigin !== "generated") {
    return undefined;
  }
  if (destinationHasDependentTakes(project, destinationId)) {
    return undefined;
  }
  return frame;
}

/** A later hop must not rewrite a start that an earlier hop has already staged or shot. */
function startAnchorsEarlierJourney(project: Project, journey: JourneyShot): boolean {
  return project.journeys.some(
    (other) =>
      other.id !== journey.id &&
      other.endDestinationId === journey.startDestinationId &&
      (journeyHasTakes(other) || other.status === "shooting" || hasCurrentMotionPlan(project, other)),
  );
}

export function canonicalRepairPlanFromAssessment(
  project: Project,
  journey: JourneyShot,
  assessment: CinematographerAssessment,
): CanonicalRepairPlan | undefined {
  const endId = journey.endDestinationId;
  if (!canonicalPairNeedsRepair(assessment) || !endId) {
    return undefined;
  }
  const confidenceRepair =
    assessment.traversalConfidence < JOURNEY_AGENT_REPAIR_THRESHOLDS.traversalConfidenceBelow;
  const recommendation = assessment.repairRecommendation;
  const startId =
    recommendation === "RESHOOT_START" &&
    !startAnchorsEarlierJourney(project, journey) &&
    generatedUnprotectedFrame(project, journey.startDestinationId)
      ? journey.startDestinationId
      : undefined;
  const repairEnd =
    recommendation === "RESHOOT_END" ||
    recommendation === "RESHOOT_START" ||
    confidenceRepair;
  const targetId =
    startId ?? (repairEnd && generatedUnprotectedFrame(project, endId) ? endId : undefined);
  if (!targetId) {
    return undefined;
  }
  const instruction =
    assessment.repairInstruction?.trim() ||
    assessment.summary.trim() ||
    "The pair needs a stronger continuously shootable spatial connection.";
  return {
    recommendation: targetId === journey.startDestinationId ? "RESHOOT_START" : "RESHOOT_END",
    instruction,
    destinationIds: [targetId],
    setConsistency: assessment.setConsistency,
    traversalConfidence: assessment.traversalConfidence,
  };
}

export function destinationHasDependentTakes(project: Project, destinationId: string): boolean {
  const frame = actualFrameForDestination(project, destinationId);
  if (!frame?.mediaId) {
    return false;
  }
  return project.journeys.some((journey) =>
    journeyTakes(journey).some(
      (take) => take.startCanonicalMediaId === frame.mediaId || take.endCanonicalMediaId === frame.mediaId,
    ),
  );
}

export function canonicalRepairBlockReason(
  project: Project,
  destinationId: string,
): string | undefined {
  const frame = actualFrameForDestination(project, destinationId);
  if (!frame) {
    return `Cannot reshoot ${destinationId}: destination is not an actual canonical.`;
  }
  if (frame.imageOrigin === "user") {
    return `Cannot reshoot ${destinationId}: filmmaker-supplied canonical.`;
  }
  if (frame.imageOrigin !== "generated") {
    return `Cannot reshoot ${destinationId}: canonical is not Agent-generated.`;
  }
  if (destinationHasDependentTakes(project, destinationId)) {
    return `Cannot reshoot ${destinationId}: existing Takes depend on it.`;
  }
  return undefined;
}

export function assertCanonicalRepairAllowed(project: Project, destinationIds: string[]): void {
  for (const destinationId of destinationIds) {
    const reason = canonicalRepairBlockReason(project, destinationId);
    if (reason) {
      throw new Error(reason);
    }
  }
}

export function oppositeCanonicalMediaId(
  project: Project,
  journey: JourneyShot,
  destinationId: string,
): string | undefined {
  if (destinationId === journey.startDestinationId && journey.endDestinationId) {
    return actualFrameForDestination(project, journey.endDestinationId)?.mediaId;
  }
  if (destinationId === journey.endDestinationId) {
    return actualFrameForDestination(project, journey.startDestinationId)?.mediaId;
  }
  return undefined;
}

export function canonicalRepairRole(
  journey: Pick<JourneyShot, "startDestinationId" | "endDestinationId">,
  destinationId: string,
): "start" | "end" {
  return destinationId === journey.endDestinationId ? "end" : "start";
}

export function formatCanonicalRepairActivity(input: {
  destinationIds: string[];
  journeyId: string;
  setConsistency: number;
  traversalConfidence: number;
  instruction: string;
}): string {
  const letters = input.destinationIds.join(" & ");
  const segment = input.journeyId.includes("·")
    ? input.journeyId
    : input.journeyId.replaceAll("-", "→");
  return [
    `RESHOOT TRAVERSAL · ${letters}`,
    `${segment} needs a stronger spatial connection.`,
    `Set Consistency ${input.setConsistency} · Traversal Confidence ${input.traversalConfidence}`,
    `Brief reason: ${input.instruction}`,
  ].join(" ");
}

export function formatCanonicalRepairCompleteActivity(input: {
  destinationIds: string[];
  beforeSetConsistency: number;
  beforeTraversalConfidence: number;
  afterSetConsistency: number;
  afterTraversalConfidence: number;
}): string {
  const letters = input.destinationIds.join(" & ");
  return [
    `RESHOOT COMPLETE · ${letters}`,
    `Set Consistency ${input.beforeSetConsistency} → ${input.afterSetConsistency}`,
    `Traversal Confidence ${input.beforeTraversalConfidence} → ${input.afterTraversalConfidence}`,
  ].join(" ");
}

export type CanonicalRepairCandidate = CanonicalRepairPlan & {
  journeyId: string;
  startDestinationId: string;
  endDestinationId: string;
};

export function repairCandidateFromJourney(
  project: Project,
  journey: JourneyShot,
): CanonicalRepairCandidate | undefined {
  if (!journey.endDestinationId || journeyHasTakes(journey)) {
    return undefined;
  }
  const assessment = journeyCinematographerAssessment(journey);
  if (!assessment || !canonicalPairNeedsRepair(assessment)) {
    return undefined;
  }
  const plan = canonicalRepairPlanFromAssessment(project, journey, assessment);
  if (!plan) {
    return undefined;
  }
  return {
    ...plan,
    journeyId: journey.id,
    startDestinationId: journey.startDestinationId,
    endDestinationId: journey.endDestinationId,
  };
}

export function inboundJourneyForDestination(
  project: Project,
  destinationId: string,
): JourneyShot | undefined {
  return project.journeys.find((journey) => journey.endDestinationId === destinationId);
}
