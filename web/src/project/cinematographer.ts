import { isTrustedMediaIdShape } from "./trusted-media-id";
import type {
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

export function journeysReadyToBlock(project: Project): JourneyShot[] {
  return project.journeys.filter(
    (journey) => canAssessJourney(project, journey) && !hasStagedMotionPlan(journey),
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

/** Compact set-language shootability for the Shoot timeline tile. Inspector keeps the longer labels. */
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
  };
}

export function projectWithCinematographerAssessment(
  project: Project,
  journeyId: string,
  assessment: CinematographerAssessment,
): Project {
  if (!project.journeys.some((journey) => journey.id === journeyId)) {
    throw new Error("Unknown journey");
  }
  return {
    ...project,
    journeys: project.journeys.map((journey) =>
      journey.id === journeyId ? { ...journey, cinematographer: assessment } : journey,
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
