import { cameraMotionPlansFromAssessment } from "../../../media/src/cinematographer/camera-motion-plan.ts";
import { videoModelDurationSeconds } from "../../../media/src/replicate/video-models.ts";
import {
  actualFrameForDestination,
  canAssessJourney,
  hasCurrentMotionPlan,
  hasStagedMotionPlan,
} from "./cinematographer";
import type { CinematographerAssessment, JourneyShot, Project, SegmentMotionPlan } from "./types";

export { hasStagedMotionPlan };

export type StageMotionPlanRequest = {
  journeyId: string;
  startMediaId: string;
  endMediaId: string;
  segmentPromptAddition: string;
  pace: SegmentMotionPlan["pace"];
  startPlan?: SegmentMotionPlan["startPlan"];
  endPlan?: SegmentMotionPlan["endPlan"];
  debug?: boolean;
};

export type StageMotionPlanResponse = {
  startShootingFrame: SegmentMotionPlan["startShootingFrame"];
  endShootingFrame: SegmentMotionPlan["endShootingFrame"];
  startPlan: SegmentMotionPlan["startPlan"];
  endPlan: SegmentMotionPlan["endPlan"];
  segmentPromptAddition: string;
  effectivePrompt: string;
  pace: SegmentMotionPlan["pace"];
  camotion?: SegmentMotionPlan["camotion"];
};

/**
 * Camotion-conditioned frames and plans for this segment.
 * Prefers the staged Motion Plan; falls back to take evidence.
 */
export function segmentCamotionSource(
  journey: JourneyShot,
): Pick<
  SegmentMotionPlan,
  "startShootingFrame" | "endShootingFrame" | "startPlan" | "endPlan" | "camotion"
> | undefined {
  if (hasStagedMotionPlan(journey) && journey.motionPlan) {
    return journey.motionPlan;
  }
  if (journey.take?.startShootingFrame && journey.take.endShootingFrame) {
    return journey.take;
  }
  return undefined;
}

export function motionPlanRequestFromProject(
  project: Project,
  journeyId: string,
): StageMotionPlanRequest {
  const journey = project.journeys.find((item) => item.id === journeyId);
  if (!journey) {
    throw new Error("Unknown journey");
  }
  if (!journey.cinematographer) {
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
  return motionPlanStageRequestFromAssessment(
    journey.id,
    start.mediaId,
    end.mediaId,
    journey.cinematographer,
  );
}

/** Staging payload from the same CM assessment already used for this A→B. */
export function motionPlanStageRequestFromAssessment(
  journeyId: string,
  startMediaId: string,
  endMediaId: string,
  assessment: CinematographerAssessment,
  debug?: boolean,
): StageMotionPlanRequest {
  const plans = cameraMotionPlansFromAssessment(assessment);
  return {
    journeyId,
    startMediaId,
    endMediaId,
    segmentPromptAddition: assessment.segmentPromptAddition,
    pace: assessment.pace,
    startPlan: plans.start,
    endPlan: plans.end,
    ...(debug ? { debug: true } : {}),
  };
}

/**
 * Store a complete Motion Plan on one JourneyShot only.
 * Restaging clears that segment's footage and leaves neighboring legs untouched.
 */
export function projectWithMotionPlan(
  project: Project,
  journeyId: string,
  motionPlan: SegmentMotionPlan,
): Project {
  const journey = project.journeys.find((item) => item.id === journeyId);
  if (!journey || !journey.endDestinationId) {
    throw new Error(journey ? "A journey requires two actual destinations" : "Unknown journey");
  }
  const start = actualFrameForDestination(project, journey.startDestinationId);
  const end = actualFrameForDestination(project, journey.endDestinationId);
  const stamped: SegmentMotionPlan = {
    ...motionPlan,
    startCanonicalMediaId: start?.mediaId ?? motionPlan.startCanonicalMediaId,
    endCanonicalMediaId: end?.mediaId ?? motionPlan.endCanonicalMediaId,
  };
  const durationSeconds = videoModelDurationSeconds(project.videoModel);
  return {
    ...project,
    journeys: project.journeys.map((item) =>
      item.id === journeyId
        ? {
            ...item,
            cinematographer: stamped.cinematographer,
            motionPlan: stamped,
            status: item.status === "shooting" ? "shooting" : "ready",
            durationSeconds,
            take: undefined,
            videoUrl: undefined,
            shootError: undefined,
            motionPlanError: undefined,
          }
        : item,
    ),
  };
}

export function journeysReadyToStageMotionPlan(project: Project): JourneyShot[] {
  return project.journeys.filter(
    (journey) => canAssessJourney(project, journey) && !hasCurrentMotionPlan(project, journey),
  );
}

export async function requestMotionPlan(input: StageMotionPlanRequest): Promise<StageMotionPlanResponse> {
  const response = await fetch("/api/journey/motion-plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as StageMotionPlanResponse | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body && body.error ? body.error : "Motion Plan failed");
  }
  if (!("startShootingFrame" in body) || !body.startShootingFrame || !body.endShootingFrame) {
    throw new Error("Motion Plan failed");
  }
  return body;
}
