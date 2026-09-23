import { isLocomotionPace, type LocomotionPace } from "../../../media/src/cinematographer/shooting-prompt.ts";
import { authoritativeJourneyPace } from "./adaptive-pace";
import { clampDurationSeconds, projectWithResolvedUnshotDurations } from "./shot-duration";
import type { CinematographerAssessment, JourneyShot, Project } from "./types";

export { authoritativeJourneyPace };

/** Filmmaker lock, then journey pace when Adaptive Pace is OFF, then CM / Motion Plan. */
export function effectiveJourneyPace(
  journey: Pick<JourneyShot, "filmmakerPace" | "cinematographer" | "motionPlan">,
  project?: Pick<Project, "adaptivePace" | "journeyPace" | "journeyPaceStory" | "story">,
): LocomotionPace | undefined {
  return authoritativeJourneyPace(journey, project);
}

/** Filmmaker lock wins. Otherwise CM desired duration. */
export function effectiveJourneyDurationSeconds(
  journey: Pick<JourneyShot, "filmmakerDurationSeconds" | "cinematographer">,
): number | undefined {
  if (typeof journey.filmmakerDurationSeconds === "number" && Number.isFinite(journey.filmmakerDurationSeconds)) {
    return clampDurationSeconds(journey.filmmakerDurationSeconds);
  }
  const desired = journey.cinematographer?.desiredDurationSeconds;
  if (typeof desired === "number" && Number.isFinite(desired)) {
    return clampDurationSeconds(desired);
  }
  return undefined;
}

export function assessmentWithFilmmakerLocks(
  assessment: CinematographerAssessment,
  journey: Pick<JourneyShot, "filmmakerPace" | "filmmakerDurationSeconds">,
): CinematographerAssessment {
  const pace = isLocomotionPace(journey.filmmakerPace) ? journey.filmmakerPace : assessment.pace;
  const duration = effectiveJourneyDurationSeconds({
    filmmakerDurationSeconds: journey.filmmakerDurationSeconds,
    cinematographer: assessment,
  });
  if (pace === assessment.pace && duration === assessment.desiredDurationSeconds) {
    return assessment;
  }
  return {
    ...assessment,
    pace,
    ...(duration !== undefined ? { desiredDurationSeconds: duration } : {}),
  };
}

function patchJourney(
  project: Project,
  journeyId: string,
  patch: (journey: JourneyShot) => JourneyShot,
): Project {
  if (!project.journeys.some((journey) => journey.id === journeyId)) {
    throw new Error("Unknown journey");
  }
  const journeys = project.journeys.map((journey) => (journey.id === journeyId ? patch(journey) : journey));
  return projectWithResolvedUnshotDurations({ ...project, journeys });
}

export function projectWithJourneyFilmmakerPace(project: Project, journeyId: string, pace: LocomotionPace): Project {
  if (!isLocomotionPace(pace)) {
    return project;
  }
  return patchJourney(project, journeyId, (journey) => {
    if (journey.filmmakerPace === pace && journey.cinematographer?.pace === pace) {
      return journey;
    }
    return {
      ...journey,
      filmmakerPace: pace,
      cinematographer: journey.cinematographer
        ? { ...journey.cinematographer, pace }
        : journey.cinematographer,
    };
  });
}

export function projectWithJourneyFilmmakerDuration(
  project: Project,
  journeyId: string,
  seconds: number,
): Project {
  const next = clampDurationSeconds(seconds);
  return patchJourney(project, journeyId, (journey) => {
    if (
      journey.filmmakerDurationSeconds === next &&
      journey.cinematographer?.desiredDurationSeconds === next
    ) {
      return journey;
    }
    return {
      ...journey,
      filmmakerDurationSeconds: next,
      cinematographer: journey.cinematographer
        ? { ...journey.cinematographer, desiredDurationSeconds: next }
        : journey.cinematographer,
    };
  });
}
