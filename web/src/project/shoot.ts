import { actualFrameForDestination, canAssessJourney } from "./cinematographer";
import type { JourneyShot, JourneyShotTake, LocomotionPace, Project, VideoModelId } from "./types";

export type ShootJourneyRequest = {
  journeyId: string;
  startMediaId: string;
  endMediaId: string;
  segmentPromptAddition: string;
  pace: LocomotionPace;
  videoModel: VideoModelId;
  /** When true, Camotion work dirs are kept on disk after A′/B′ are copied. */
  debug?: boolean;
};

export type ShootJourneyResponse = {
  take: JourneyShotTake;
  videoUrl: string;
};

export function canShootJourney(project: Project, journey: JourneyShot): boolean {
  if (!journey.cinematographer) {
    return false;
  }
  if (journey.status === "shooting") {
    return false;
  }
  return canAssessJourney(project, journey);
}

export function journeysReadyToAutoShoot(project: Project): JourneyShot[] {
  return project.journeys.filter((journey) => {
    if (journey.status === "rendered" || journey.status === "shooting") {
      return false;
    }
    return canShootJourney(project, journey);
  });
}

export function shootRequestFromProject(project: Project, journeyId: string): ShootJourneyRequest {
  const journey = project.journeys.find((item) => item.id === journeyId);
  if (!journey) {
    throw new Error("Unknown journey");
  }
  if (!journey.cinematographer) {
    throw new Error("Block this journey before shooting");
  }
  if (!journey.endDestinationId) {
    throw new Error("A journey requires two actual destinations");
  }
  const start = actualFrameForDestination(project, journey.startDestinationId);
  const end = actualFrameForDestination(project, journey.endDestinationId);
  if (!start || !end) {
    throw new Error("A journey requires two actual destinations");
  }
  return {
    journeyId: journey.id,
    startMediaId: start.mediaId,
    endMediaId: end.mediaId,
    segmentPromptAddition: journey.cinematographer.segmentPromptAddition,
    pace: journey.cinematographer.pace,
    videoModel: project.videoModel,
  };
}

export function projectWithJourneyShooting(project: Project, journeyId: string): Project {
  if (!project.journeys.some((journey) => journey.id === journeyId)) {
    throw new Error("Unknown journey");
  }
  return {
    ...project,
    journeys: project.journeys.map((journey) =>
      journey.id === journeyId
        ? { ...journey, status: "shooting", shootError: undefined }
        : journey,
    ),
  };
}

export function projectWithJourneyShotTake(
  project: Project,
  journeyId: string,
  next: { take: JourneyShotTake; videoUrl: string },
): Project {
  if (!project.journeys.some((journey) => journey.id === journeyId)) {
    throw new Error("Unknown journey");
  }
  return {
    ...project,
    journeys: project.journeys.map((journey) =>
      journey.id === journeyId
        ? {
            ...journey,
            status: "rendered",
            videoUrl: next.videoUrl,
            take: next.take,
            durationSeconds: next.take.durationSeconds,
            shootError: undefined,
          }
        : journey,
    ),
  };
}

export function projectWithJourneyShotFailed(
  project: Project,
  journeyId: string,
  error: string,
): Project {
  if (!project.journeys.some((journey) => journey.id === journeyId)) {
    throw new Error("Unknown journey");
  }
  return {
    ...project,
    journeys: project.journeys.map((journey) =>
      journey.id === journeyId ? { ...journey, status: "failed", shootError: error } : journey,
    ),
  };
}

export async function requestShootJourney(input: ShootJourneyRequest): Promise<ShootJourneyResponse> {
  const response = await fetch("/api/journey/shoot", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as ShootJourneyResponse | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body && body.error ? body.error : "Shoot failed");
  }
  if (!("take" in body) || !body.take || !body.videoUrl) {
    throw new Error("Shoot failed");
  }
  return body;
}
