import { actualFrameForDestination, canAssessJourney, hasCurrentMotionPlan } from "./cinematographer";
import {
  resolveKlingV3Mode,
  type KlingV3Mode,
  type VideoModelId,
  videoModelDurationSeconds,
} from "../../../media/src/replicate/video-models.ts";
import {
  defaultTakeIntentFromProject,
  unshotVideoModel,
  videoModelForIntent,
  videoModelsByIntentFromProject,
  type GenerationIntent,
} from "./generation-intent";
import {
  journeyTakes,
  patchSelectedTake,
  projectWithAppendedTake,
  selectedTake,
} from "./takes";
import type { CameraMotionPlanV1, JourneyShot, JourneyShotTake, LocomotionPace, Project } from "./types";

export type ShootJourneyRequest = {
  journeyId: string;
  startMediaId: string;
  endMediaId: string;
  segmentPromptAddition: string;
  pace: LocomotionPace;
  videoModel: VideoModelId;
  generationIntent?: GenerationIntent;
  klingV3Mode?: KlingV3Mode;
  startShootingMediaId?: string;
  endShootingMediaId?: string;
  startPlan?: CameraMotionPlanV1;
  endPlan?: CameraMotionPlanV1;
  effectivePrompt?: string;
  /** When true, Camotion work dirs are kept on disk after A′/B′ are copied. */
  debug?: boolean;
};

export type ShootJourneyResponse = {
  take: JourneyShotTake;
  videoUrl: string;
};

export function canShootJourney(project: Project, journey: JourneyShot): boolean {
  if (!hasCurrentMotionPlan(project, journey)) {
    return false;
  }
  if (journey.status === "shooting") {
    return false;
  }
  return canAssessJourney(project, journey);
}

export function journeysReadyToAutoShoot(project: Project): JourneyShot[] {
  return project.journeys.filter((journey) => {
    if (journey.status === "shooting" || journeyTakes(journey).length > 0) {
      return false;
    }
    return canShootJourney(project, journey);
  });
}

/** Filmmaker NEW TAKE ALL: every staged segment, including those that already have Takes. */
export function journeysReadyToTakeAll(project: Project): JourneyShot[] {
  return project.journeys.filter((journey) => canShootJourney(project, journey));
}

function withUnshotDurations(project: Project, durationSeconds: number): Project["journeys"] {
  return project.journeys.map((journey) =>
    journeyTakes(journey).length > 0 ? journey : { ...journey, durationSeconds },
  );
}

/** Switch the Fast mapping. Unshot legs preview the default Take intent's clip length. */
export function projectWithVideoModel(project: Project, videoModel: VideoModelId): Project {
  return projectWithVideoModelForIntent(project, "fast", videoModel);
}

export function projectWithVideoModelForIntent(
  project: Project,
  intent: GenerationIntent,
  videoModel: VideoModelId,
): Project {
  const mapped = videoModelsByIntentFromProject(project);
  const alreadyMapped =
    mapped[intent] === videoModel &&
    (intent !== "fast" || project.videoModel === videoModel) &&
    project.videoModelsByIntent?.fast === mapped.fast &&
    project.videoModelsByIntent?.balanced === mapped.balanced &&
    project.videoModelsByIntent?.quality === mapped.quality;
  if (alreadyMapped) {
    return project;
  }
  const videoModelsByIntent = { ...mapped, [intent]: videoModel };
  const nextVideoModel = intent === "fast" ? videoModel : project.videoModel;
  const next: Project = {
    ...project,
    videoModel: nextVideoModel,
    videoModelsByIntent,
  };
  const prevDuration = videoModelDurationSeconds(unshotVideoModel(project));
  const nextDuration = videoModelDurationSeconds(unshotVideoModel(next));
  if (prevDuration === nextDuration) {
    return next;
  }
  return { ...next, journeys: withUnshotDurations(next, nextDuration) };
}

export function klingV3ModeFromProject(project: Pick<Project, "klingV3Mode">): KlingV3Mode {
  return resolveKlingV3Mode(project.klingV3Mode);
}

export function projectWithKlingV3Mode(project: Project, mode: KlingV3Mode): Project {
  const next = resolveKlingV3Mode(mode);
  if (klingV3ModeFromProject(project) === next && project.klingV3Mode === next) {
    return project;
  }
  return { ...project, klingV3Mode: next };
}

export function projectWithDefaultTakeIntent(project: Project, intent: GenerationIntent): Project {
  if (defaultTakeIntentFromProject(project) === intent && project.defaultTakeIntent === intent) {
    return project;
  }
  const next: Project = { ...project, defaultTakeIntent: intent };
  const prevDuration = videoModelDurationSeconds(unshotVideoModel(project));
  const nextDuration = videoModelDurationSeconds(unshotVideoModel(next));
  if (prevDuration === nextDuration) {
    return next;
  }
  return { ...next, journeys: withUnshotDurations(next, nextDuration) };
}

export function shootRequestFromProject(
  project: Project,
  journeyId: string,
  intent: GenerationIntent = defaultTakeIntentFromProject(project),
): ShootJourneyRequest {
  const journey = project.journeys.find((item) => item.id === journeyId);
  if (!journey) {
    throw new Error("Unknown journey");
  }
  if (!hasCurrentMotionPlan(project, journey) || !journey.motionPlan) {
    throw new Error("Stage this journey before generating");
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
    segmentPromptAddition: journey.motionPlan.segmentPromptAddition,
    pace: journey.motionPlan.pace,
    videoModel: videoModelForIntent(project, intent),
    generationIntent: intent,
    ...(videoModelForIntent(project, intent) === "kling-v3-video"
      ? { klingV3Mode: resolveKlingV3Mode(project.klingV3Mode) }
      : {}),
    startShootingMediaId: journey.motionPlan.startShootingFrame.mediaId,
    endShootingMediaId: journey.motionPlan.endShootingFrame.mediaId,
    startPlan: journey.motionPlan.startPlan,
    endPlan: journey.motionPlan.endPlan,
    effectivePrompt: journey.motionPlan.effectivePrompt,
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

export function projectWithJourneysShooting(project: Project, journeyIds: readonly string[]): Project {
  return journeyIds.reduce((next, journeyId) => projectWithJourneyShooting(next, journeyId), project);
}

export function projectWithJourneyShotTake(
  project: Project,
  journeyId: string,
  next: { take: JourneyShotTake; videoUrl: string },
): Project {
  return projectWithAppendedTake(project, journeyId, next);
}

/** Timeline follows the actual clip. Ignore empty or non-finite probes. */
export function projectWithJourneyClipDuration(
  project: Project,
  journeyId: string,
  durationSeconds: number,
): Project {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return project;
  }
  const seconds = Math.max(1, Math.round(durationSeconds));
  const journey = project.journeys.find((item) => item.id === journeyId);
  if (!journey) {
    throw new Error("Unknown journey");
  }
  const current = selectedTake(journey);
  if (journey.durationSeconds === seconds && current?.durationSeconds === seconds) {
    return project;
  }
  return {
    ...project,
    journeys: project.journeys.map((item) =>
      item.id === journeyId
        ? patchSelectedTake(
            { ...item, durationSeconds: seconds },
            { durationSeconds: seconds },
          )
        : item,
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
    journeys: project.journeys.map((journey) => {
      if (journey.id !== journeyId) {
        return journey;
      }
      if (journeyTakes(journey).length > 0) {
        return { ...journey, status: "rendered", shootError: error };
      }
      return { ...journey, status: "failed", shootError: error };
    }),
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
