import type { LocomotionPace } from "../../../media/src/cinematographer/shooting-prompt.ts";
import { cameraGrammarFromProject } from "./camera-grammar";
import { assessmentWithFilmmakerLocks, effectiveJourneyDurationSeconds, effectiveJourneyPace } from "./journey-overrides";
import { projectWithResolvedUnshotDurations } from "./shot-duration";
import { isTrustedMediaIdShape } from "./trusted-media-id";
import type {
  CameraGrammar,
  CinematographerAssessment,
  CinematographerShootability,
  JourneyShot,
  Project,
  StoryboardFrame,
} from "./types";

export type CinematographerAssessmentRequest = {
  journeyId: string;
  startDestinationId: string;
  endDestinationId: string;
  startMediaId: string;
  endMediaId: string;
  startIntent?: string;
  endIntent?: string;
  story?: string;
  cameraGrammar?: CameraGrammar;
  filmmakerPace?: LocomotionPace;
  filmmakerDurationSeconds?: number;
};

export type CinematographerAssessmentResponse = {
  assessment: CinematographerAssessment;
};

function isActualTrustedFrame(frame: StoryboardFrame | undefined): frame is StoryboardFrame & {
  mediaId: string;
} {
  if (!frame) {
    return false;
  }
  return (
    (frame.imageOrigin === "user" || frame.imageOrigin === "generated") &&
    Boolean(frame.image) &&
    isTrustedMediaIdShape(frame.mediaId)
  );
}

export function actualFrameForDestination(
  project: Project,
  destinationId: string,
): (StoryboardFrame & { mediaId: string }) | undefined {
  const frame =
    project.storyboard.find((item) => item.destinationId === destinationId) ??
    project.storyboard.find((item) => item.id === destinationId);
  return isActualTrustedFrame(frame) ? frame : undefined;
}

export function canAssessJourney(project: Project, journey: JourneyShot): boolean {
  if (!journey.endDestinationId) {
    return false;
  }
  return Boolean(
    actualFrameForDestination(project, journey.startDestinationId) &&
      actualFrameForDestination(project, journey.endDestinationId),
  );
}

export function hasStagedMotionPlan(journey: JourneyShot): boolean {
  return Boolean(journey.motionPlan?.startShootingFrame && journey.motionPlan.endShootingFrame);
}

/** Actual adjacent media IDs CM must have inspected for this pair. */
export function cinematographerPairMediaIds(
  project: Project,
  journey: JourneyShot,
): { startMediaId: string; endMediaId: string } | undefined {
  if (!journey.endDestinationId) {
    return undefined;
  }
  const start = actualFrameForDestination(project, journey.startDestinationId);
  const end = actualFrameForDestination(project, journey.endDestinationId);
  if (!start || !end) {
    return undefined;
  }
  return { startMediaId: start.mediaId, endMediaId: end.mediaId };
}

/**
 * True when this leg's CM assessment belongs to the project's current
 * canonical pair. Unstamped assessments are not current for Agent repair.
 */
export function cinematographerAssessmentIsCurrent(
  project: Project,
  journey: JourneyShot,
): boolean {
  if (!journey.cinematographer) {
    return false;
  }
  const pair = cinematographerPairMediaIds(project, journey);
  if (!pair) {
    return false;
  }
  const stampedStart = journey.cinematographerStartMediaId;
  const stampedEnd = journey.cinematographerEndMediaId;
  if (stampedStart && stampedEnd) {
    return stampedStart === pair.startMediaId && stampedEnd === pair.endMediaId;
  }
  return hasCurrentMotionPlan(project, journey);
}

/** True when staged A′/B′ exist and were computed from this segment's current canonical pair. */
export function hasCurrentMotionPlan(project: Project, journey: JourneyShot): boolean {
  if (!hasStagedMotionPlan(journey) || !journey.motionPlan || !journey.endDestinationId) {
    return false;
  }
  const start = actualFrameForDestination(project, journey.startDestinationId);
  const end = actualFrameForDestination(project, journey.endDestinationId);
  if (!start || !end) {
    return false;
  }
  const plannedStart = journey.motionPlan.startCanonicalMediaId;
  const plannedEnd = journey.motionPlan.endCanonicalMediaId;
  if (!plannedStart || !plannedEnd) {
    return true;
  }
  return plannedStart === start.mediaId && plannedEnd === end.mediaId;
}

/** Identity of the actual adjacent canonical pair this Motion Plan must match. */
export function journeyMotionPlanInputKey(project: Project, journey: JourneyShot): string | null {
  if (!canAssessJourney(project, journey) || !journey.endDestinationId) {
    return null;
  }
  const start = actualFrameForDestination(project, journey.startDestinationId);
  const end = actualFrameForDestination(project, journey.endDestinationId);
  if (!start || !end) {
    return null;
  }
  return `${journey.id}:${start.mediaId}:${end.mediaId}`;
}

/**
 * Effect key for automatic Motion Planning.
 * Includes only each actual adjacent pair and whether that pair already has a current plan.
 * Story, debug, and session UI must not appear here.
 */
export function motionPlanAutoKey(project: Project): string {
  return project.journeys
    .map((journey) => {
      const input = journeyMotionPlanInputKey(project, journey);
      if (!input) {
        return "";
      }
      return `${input}:${hasCurrentMotionPlan(project, journey) ? "planned" : "needed"}`;
    })
    .filter(Boolean)
    .join("|");
}

export function journeysReadyToBlock(project: Project): JourneyShot[] {
  return project.journeys.filter(
    (journey) => canAssessJourney(project, journey) && !hasCurrentMotionPlan(project, journey),
  );
}

export function cinematographerShootabilityLabel(
  shootability: CinematographerShootability,
): "Ready" | "Needs review" | "Not shootable" {
  switch (shootability) {
    case "shootable":
      return "Ready";
    case "needs_review":
      return "Needs review";
    case "not_shootable":
      return "Not shootable";
  }
}

/** Compact set-language shootability for the Shoot timeline tile. */
export function cinematographerShootabilityTileLabel(
  shootability: CinematographerShootability,
): "clear" | "hold" | "no go" {
  switch (shootability) {
    case "shootable":
      return "clear";
    case "needs_review":
      return "hold";
    case "not_shootable":
      return "no go";
  }
}

/** Inspector chrome. Compact fits the 26px MOTION band. Not a shoot gate. */
export function cinematographerScoreTone(score: number, compact = false): string {
  const chrome = compact
    ? "rounded-full px-1.5 py-0 text-[9px] leading-[14px] tabular-nums tracking-[0.08em]"
    : "rounded-full px-2.5 py-0.5 tabular-nums tracking-[0.14em]";
  if (score >= 70) {
    return `${chrome} border border-[#3f5a3a] ${compact ? "bg-[#0c140c]" : "bg-[#142014]"} text-[#d7e7cf]`;
  }
  if (score >= 40) {
    return `${chrome} border border-[#d4b36a] ${compact ? "bg-[#2a2214]" : "bg-[#443922]"} text-[#e4d2a4]`;
  }
  return `${chrome} border border-[#c45c38] ${compact ? "bg-[#1a0e0a]" : "bg-[#2a1610]"} text-[#f0c2a8]`;
}

export function locomotionPaceLabel(
  pace: CinematographerAssessment["pace"],
): "Slow-motion" | "Slow" | "Moderate" | "Fast" | "Hyperspeed" | "Variable" {
  switch (pace) {
    case "slow-motion":
      return "Slow-motion";
    case "slow":
      return "Slow";
    case "moderate":
      return "Moderate";
    case "fast":
      return "Fast";
    case "hyperspeed":
      return "Hyperspeed";
    case "variable":
      return "Variable";
  }
}

export function cinematographerTravelConfidenceLabel(
  confidence: NonNullable<CinematographerAssessment["travel"]>["confidence"],
): "High" | "Medium" | "Low" {
  switch (confidence) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
  }
}

/**
 * Production ladder for a journey leg: Stage, Film, Export.
 * Internal JourneyShot.status stays ready / shooting / rendered / failed.
 */
export function journeyLegStatusLabel(journey: JourneyShot): string {
  switch (journey.status) {
    case "shooting":
      return "Film";
    case "rendered":
      return "Export";
    case "failed":
      return "failed";
    default:
      return journey.cinematographer ? "Film" : "Stage";
  }
}

export function journeySegmentCaption(journey: JourneyShot): string {
  return motionBandCaption(journey);
}

export function journeySegmentAriaLabel(journey: JourneyShot): string {
  return motionBandAriaLabel(journey);
}

export function motionBandCaption(journey: JourneyShot): string {
  if (!journey.cinematographer) {
    return "Stage";
  }
  return `Film · ${cinematographerShootabilityTileLabel(journey.cinematographer.shootability)}`;
}

export function motionBandAriaLabel(journey: JourneyShot): string {
  return `Motion ${journey.id}`;
}

export function footageBandCaption(journey: JourneyShot): string {
  if (journey.status === "shooting") {
    return "Generating…";
  }
  if (journey.status === "rendered") {
    return "Take";
  }
  if (journey.status === "failed") {
    return "Failed";
  }
  return "—";
}

export function footageBandAriaLabel(journey: JourneyShot): string {
  return `Footage ${journey.id}`;
}

export function cinematographerRequestFromProject(
  project: Project,
  journeyId: string,
): CinematographerAssessmentRequest {
  const journey = project.journeys.find((item) => item.id === journeyId);
  if (!journey) {
    throw new Error("Unknown journey");
  }
  if (!journey.endDestinationId) {
    throw new Error("Cinematographer requires two actual destinations");
  }
  const start = actualFrameForDestination(project, journey.startDestinationId);
  const end = actualFrameForDestination(project, journey.endDestinationId);
  if (!start || !end) {
    throw new Error("Cinematographer requires two actual destinations");
  }
  const startIntent = start.intent?.trim() || undefined;
  const endIntent = end.intent?.trim() || undefined;
  const story = project.story.trim() || undefined;
  return {
    journeyId: journey.id,
    startDestinationId: journey.startDestinationId,
    endDestinationId: journey.endDestinationId,
    startMediaId: start.mediaId,
    endMediaId: end.mediaId,
    ...(startIntent ? { startIntent } : {}),
    ...(endIntent ? { endIntent } : {}),
    ...(story ? { story } : {}),
    cameraGrammar: cameraGrammarFromProject(project),
    ...(effectiveJourneyPace(journey) && journey.filmmakerPace
      ? { filmmakerPace: journey.filmmakerPace }
      : {}),
    ...(typeof journey.filmmakerDurationSeconds === "number"
      ? { filmmakerDurationSeconds: effectiveJourneyDurationSeconds(journey) }
      : {}),
  };
}

export function projectWithCinematographerAssessment(
  project: Project,
  journeyId: string,
  assessment: CinematographerAssessment,
  evaluatedPair?: { startCanonicalMediaId: string; endCanonicalMediaId: string },
): Project {
  const journey = project.journeys.find((item) => item.id === journeyId);
  if (!journey) {
    throw new Error("Unknown journey");
  }
  const locked = assessmentWithFilmmakerLocks(assessment, journey);
  const pair = cinematographerPairMediaIds(project, journey);
  const startCanonicalMediaId =
    evaluatedPair?.startCanonicalMediaId ?? pair?.startMediaId ?? journey.cinematographerStartMediaId;
  const endCanonicalMediaId =
    evaluatedPair?.endCanonicalMediaId ?? pair?.endMediaId ?? journey.cinematographerEndMediaId;
  return projectWithResolvedUnshotDurations({
    ...project,
    journeys: project.journeys.map((item) =>
      item.id === journeyId
        ? {
            ...item,
            cinematographer: locked,
            ...(startCanonicalMediaId ? { cinematographerStartMediaId: startCanonicalMediaId } : {}),
            ...(endCanonicalMediaId ? { cinematographerEndMediaId: endCanonicalMediaId } : {}),
          }
        : item,
    ),
  });
}

export function projectWithoutCinematographerAssessment(project: Project, journeyId: string): Project {
  if (!project.journeys.some((journey) => journey.id === journeyId)) {
    throw new Error("Unknown journey");
  }
  return {
    ...project,
    journeys: project.journeys.map((journey) => {
      if (journey.id !== journeyId) {
        return journey;
      }
      const next = { ...journey };
      delete next.cinematographer;
      delete next.cinematographerStartMediaId;
      delete next.cinematographerEndMediaId;
      return next;
    }),
  };
}

export function projectWithMotionPlanError(
  project: Project,
  journeyId: string,
  error: string | undefined,
): Project {
  if (!project.journeys.some((journey) => journey.id === journeyId)) {
    throw new Error("Unknown journey");
  }
  return {
    ...project,
    journeys: project.journeys.map((journey) =>
      journey.id === journeyId
        ? error
          ? { ...journey, motionPlanError: error }
          : { ...journey, motionPlanError: undefined }
        : journey,
    ),
  };
}

export async function requestCinematographerAssessment(
  input: CinematographerAssessmentRequest,
): Promise<CinematographerAssessmentResponse> {
  const response = await fetch("/api/cinematographer/assess", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as
    | CinematographerAssessmentResponse
    | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body && body.error ? body.error : "Cinematographer assessment failed");
  }
  if (!("assessment" in body) || !body.assessment) {
    throw new Error("Cinematographer assessment failed");
  }
  return body;
}

export type ProjectScore = {
  score: number | null;
  setConsistency: number | null;
  traversalConfidence: number | null;
  segments: number;
};

function journeyAssessment(journey: JourneyShot): CinematographerAssessment | undefined {
  return journey.motionPlan?.cinematographer ?? journey.cinematographer;
}

const EMPTY_PROJECT_SCORE: ProjectScore = {
  score: null,
  setConsistency: null,
  traversalConfidence: null,
  segments: 0,
};

/** Mean of Set Consistency and Traversal Confidence across assessed segments. 0–100. */
export function projectScoreFromProject(project: Project): ProjectScore {
  const assessments = project.journeys
    .filter((journey) => Boolean(journey.endDestinationId))
    .map(journeyAssessment)
    .filter((item): item is CinematographerAssessment => Boolean(item));
  if (assessments.length === 0) {
    return EMPTY_PROJECT_SCORE;
  }
  const setConsistency =
    assessments.reduce((sum, item) => sum + item.setConsistency, 0) / assessments.length;
  const traversalConfidence =
    assessments.reduce((sum, item) => sum + item.traversalConfidence, 0) / assessments.length;
  return {
    score: Math.round((setConsistency + traversalConfidence) / 2),
    setConsistency: Math.round(setConsistency),
    traversalConfidence: Math.round(traversalConfidence),
    segments: assessments.length,
  };
}
