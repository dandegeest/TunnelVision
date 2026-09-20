import { cameraMotionPlansFromAssessment } from "../../../media/src/cinematographer/camera-motion-plan.ts";
import {
  cameraGrammarFromUnknown,
  type CameraGrammar,
} from "../../../media/src/cinematographer/camera-grammar.ts";
import { unshotDurationSeconds } from "./shot-duration";
import {
  actualFrameForDestination,
  canAssessJourney,
  hasCurrentMotionPlan,
  hasStagedMotionPlan,
} from "./cinematographer";
import { cameraGrammarFromProject } from "./camera-grammar";
import { pullForwardReferenceEnabledFromProject } from "./destination";
import { effectiveJourneyPace } from "./journey-overrides";
import { journeyTakes, selectedTake } from "./takes";
import type { CinematographerAssessment, JourneyShot, LocomotionPace, Project, SegmentMotionPlan } from "./types";

export { hasStagedMotionPlan };

export type StageMotionPlanRequest = {
  journeyId: string;
  startMediaId: string;
  endMediaId: string;
  segmentPromptAddition: string;
  pace: SegmentMotionPlan["pace"];
  startPlan?: SegmentMotionPlan["startPlan"];
  endPlan?: SegmentMotionPlan["endPlan"];
  cameraGrammar?: CameraGrammar;
  pullForwardReferenceEnabled?: boolean;
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
  const take = selectedTake(journey);
  if (take?.startShootingFrame.imageUrl && take.endShootingFrame.imageUrl) {
    return take;
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
    {
      cameraGrammar: cameraGrammarFromProject(project),
      pace: effectiveJourneyPace(journey),
      pullForwardReferenceEnabled: pullForwardReferenceEnabledFromProject(project),
    },
  );
}

/** Staging payload from the same CM assessment already used for this A→B. */
export function motionPlanStageRequestFromAssessment(
  journeyId: string,
  startMediaId: string,
  endMediaId: string,
  assessment: CinematographerAssessment,
  options?: {
    cameraGrammar?: CameraGrammar;
    debug?: boolean;
    pace?: LocomotionPace;
    pullForwardReferenceEnabled?: boolean;
  },
): StageMotionPlanRequest {
  const assessmentForPlans = options?.pace ? { ...assessment, pace: options.pace } : assessment;
  const plans = cameraMotionPlansFromAssessment(assessmentForPlans);
  return {
    journeyId,
    startMediaId,
    endMediaId,
    segmentPromptAddition: assessment.segmentPromptAddition,
    pace: options?.pace ?? assessment.pace,
    startPlan: plans.start,
    endPlan: plans.end,
    cameraGrammar: cameraGrammarFromUnknown(options?.cameraGrammar),
    pullForwardReferenceEnabled: options?.pullForwardReferenceEnabled !== false,
    ...(options?.debug ? { debug: true } : {}),
  };
}

/**
 * Store a complete Motion Plan on one JourneyShot only.
 * Restaging leaves existing Takes in place and does not touch neighboring legs.
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
  const durationSeconds = unshotDurationSeconds(project, { cinematographer: stamped.cinematographer });
  return {
    ...project,
    journeys: project.journeys.map((item) => {
      if (item.id !== journeyId) {
        return item;
      }
      const hasTakes = journeyTakes(item).length > 0;
      return {
        ...item,
        cinematographer: stamped.cinematographer,
        cinematographerStartMediaId: stamped.startCanonicalMediaId,
        cinematographerEndMediaId: stamped.endCanonicalMediaId,
        motionPlan: stamped,
        status: item.status === "shooting" ? "shooting" : hasTakes ? "rendered" : "ready",
        durationSeconds: hasTakes ? item.durationSeconds : durationSeconds,
        shootError: undefined,
        motionPlanError: undefined,
      };
    }),
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
