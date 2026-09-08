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

export function journeyLegStatusLabel(journey: JourneyShot): string {
  if (journey.status === "not_shootable") {
    return "blocked";
  }
  if (journey.status === "needs_review") {
    return "needs review";
  }
  return journey.status.replaceAll("_", " ");
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
