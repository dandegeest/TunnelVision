import { isLocomotionPace, type LocomotionPace } from "../../../media/src/cinematographer/shooting-prompt.ts";
import type { JourneyShot, Project } from "./types";

export const DEFAULT_ADAPTIVE_PACE = true;

export function storyFingerprint(story: string | undefined): string {
  return story?.trim() ?? "";
}

export function adaptivePaceFromProject(project: Pick<Project, "adaptivePace">): boolean {
  return project.adaptivePace !== false;
}

export function journeyPaceFromProject(
  project: Pick<Project, "adaptivePace" | "journeyPace">,
): LocomotionPace | undefined {
  if (adaptivePaceFromProject(project) || !isLocomotionPace(project.journeyPace)) {
    return undefined;
  }
  return project.journeyPace;
}

/** True when Adaptive Pace is OFF and the stored journey pace still matches this story. */
export function journeyPaceIsCurrent(
  project: Pick<Project, "adaptivePace" | "journeyPace" | "journeyPaceStory" | "story">,
): boolean {
  return (
    !adaptivePaceFromProject(project) &&
    isLocomotionPace(project.journeyPace) &&
    (project.journeyPaceStory ?? "") === storyFingerprint(project.story)
  );
}

export function projectWithInvalidatedStalePaceMotionPlans(project: Project): Project {
  let changed = false;
  const journeys = project.journeys.map((journey) => {
    if (!journey.motionPlan) {
      return journey;
    }
    const pace = authoritativeJourneyPace(journey, project);
    if (!pace || journey.motionPlan.pace === pace) {
      return journey;
    }
    changed = true;
    const next = { ...journey };
    delete next.motionPlan;
    return next;
  });
  return changed ? { ...project, journeys } : project;
}

function clearJourneyPace(project: Project): Project {
  if (project.journeyPace === undefined && project.journeyPaceStory === undefined) {
    return project;
  }
  return {
    ...project,
    journeyPace: undefined,
    journeyPaceStory: undefined,
  };
}

export function projectWithAdaptivePace(project: Project, enabled: boolean): Project {
  const nextEnabled = enabled !== false;
  if (adaptivePaceFromProject(project) === nextEnabled && project.adaptivePace === nextEnabled) {
    return project;
  }
  if (nextEnabled) {
    return projectWithInvalidatedStalePaceMotionPlans(
      clearJourneyPace({
        ...project,
        adaptivePace: true,
      }),
    );
  }
  return clearJourneyPace({
    ...project,
    adaptivePace: false,
  });
}

export function projectWithJourneyPace(project: Project, pace: LocomotionPace): Project {
  if (!isLocomotionPace(pace)) {
    return project;
  }
  const next: Project = {
    ...project,
    adaptivePace: false,
    journeyPace: pace,
    journeyPaceStory: storyFingerprint(project.story),
  };
  if (
    project.adaptivePace === false &&
    project.journeyPace === pace &&
    project.journeyPaceStory === next.journeyPaceStory
  ) {
    return project;
  }
  return projectWithInvalidatedStalePaceMotionPlans(next);
}

/** Story edit. Clears a stale journey pace while Adaptive Pace is OFF. */
export function projectWithStory(project: Project, story: string): Project {
  if (project.story === story) {
    return project;
  }
  const next = { ...project, story };
  if (adaptivePaceFromProject(next) || !next.journeyPace) {
    return next;
  }
  if (storyFingerprint(next.story) === (next.journeyPaceStory ?? "")) {
    return next;
  }
  return projectWithInvalidatedStalePaceMotionPlans(clearJourneyPace(next));
}

/**
 * Filmmaker lock, then current journey pace when Adaptive Pace is OFF,
 * then the stored CM / Motion Plan pace.
 */
export function authoritativeJourneyPace(
  journey: Pick<JourneyShot, "filmmakerPace" | "cinematographer" | "motionPlan">,
  project?: Pick<Project, "adaptivePace" | "journeyPace" | "journeyPaceStory" | "story">,
): LocomotionPace | undefined {
  if (isLocomotionPace(journey.filmmakerPace)) {
    return journey.filmmakerPace;
  }
  if (project && journeyPaceIsCurrent(project) && isLocomotionPace(project.journeyPace)) {
    return project.journeyPace;
  }
  if (journey.cinematographer && isLocomotionPace(journey.cinematographer.pace)) {
    return journey.cinematographer.pace;
  }
  if (journey.motionPlan && isLocomotionPace(journey.motionPlan.pace)) {
    return journey.motionPlan.pace;
  }
  return undefined;
}
