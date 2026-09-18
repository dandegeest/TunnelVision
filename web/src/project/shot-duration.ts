import { mapDurationToVideoModel } from "../../../media/src/replicate/video-models.ts";
import { defaultTakeIntentFromProject, unshotVideoModel, videoModelForIntent, type GenerationIntent } from "./generation-intent";
import type { DurationMode, JourneyShot, Project, VideoModelId } from "./types";

export const DEFAULT_DURATION_MODE: DurationMode = "adaptive";
export const DEFAULT_FIXED_DURATION_SECONDS = 5;
export const MIN_FIXED_DURATION_SECONDS = 1;
export const MAX_FIXED_DURATION_SECONDS = 30;

function journeyHasTakes(journey: JourneyShot): boolean {
  return Boolean(journey.take || (journey.takes && journey.takes.length > 0));
}

export function isDurationMode(value: unknown): value is DurationMode {
  return value === "adaptive" || value === "fixed";
}

export function durationModeFromProject(project: Pick<Project, "durationMode">): DurationMode {
  return isDurationMode(project.durationMode) ? project.durationMode : DEFAULT_DURATION_MODE;
}

export function clampDurationSeconds(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_FIXED_DURATION_SECONDS;
  }
  return Math.min(MAX_FIXED_DURATION_SECONDS, Math.max(MIN_FIXED_DURATION_SECONDS, Math.round(value)));
}

export function fixedDurationSecondsFromProject(project: Pick<Project, "fixedDurationSeconds">): number {
  return project.fixedDurationSeconds === undefined
    ? DEFAULT_FIXED_DURATION_SECONDS
    : clampDurationSeconds(project.fixedDurationSeconds);
}

/**
 * Original cinematic/project target. Never the previously resolved clip
 * length. Adaptive uses CM desired duration when present; otherwise the
 * product base of 5s. The mapper then snaps that onto the selected generator.
 */
export function targetDurationSeconds(
  project: Pick<Project, "durationMode" | "fixedDurationSeconds">,
  journey: Pick<JourneyShot, "cinematographer"> | undefined,
  _videoModelId: VideoModelId,
): number {
  if (durationModeFromProject(project) === "fixed") {
    return fixedDurationSecondsFromProject(project);
  }
  const desired = journey?.cinematographer?.desiredDurationSeconds;
  if (typeof desired === "number" && Number.isFinite(desired)) {
    return clampDurationSeconds(desired);
  }
  return DEFAULT_FIXED_DURATION_SECONDS;
}

export function actualDurationSecondsForModel(
  project: Pick<Project, "durationMode" | "fixedDurationSeconds">,
  videoModelId: VideoModelId,
  journey?: Pick<JourneyShot, "cinematographer">,
): number {
  return mapDurationToVideoModel(videoModelId, targetDurationSeconds(project, journey, videoModelId));
}

export function unshotDurationSeconds(project: Project, journey?: Pick<JourneyShot, "cinematographer">): number {
  return actualDurationSecondsForModel(project, unshotVideoModel(project), journey);
}

/** Adaptive desired, or Fixed target. Undefined when Adaptive has no CM duration yet. */
export function intentDurationSeconds(
  project: Pick<Project, "durationMode" | "fixedDurationSeconds">,
  journey?: Pick<JourneyShot, "cinematographer">,
): number | undefined {
  if (durationModeFromProject(project) === "fixed") {
    return fixedDurationSecondsFromProject(project);
  }
  const desired = journey?.cinematographer?.desiredDurationSeconds;
  if (typeof desired === "number" && Number.isFinite(desired)) {
    return clampDurationSeconds(desired);
  }
  return undefined;
}

/** Duration that will be sent for this journey and take intent. */
export function requestedDurationSeconds(
  project: Project,
  journey?: Pick<JourneyShot, "cinematographer">,
  intent: GenerationIntent = defaultTakeIntentFromProject(project),
): number {
  return actualDurationSecondsForModel(project, videoModelForIntent(project, intent), journey);
}

export function projectWithResolvedUnshotDurations(project: Project): Project {
  let changed = false;
  const journeys = project.journeys.map((journey) => {
    if (journeyHasTakes(journey)) {
      return journey;
    }
    const durationSeconds = unshotDurationSeconds(project, journey);
    if (journey.durationSeconds === durationSeconds) {
      return journey;
    }
    changed = true;
    return { ...journey, durationSeconds };
  });
  return changed ? { ...project, journeys } : project;
}

export function projectWithDurationMode(project: Project, mode: DurationMode): Project {
  const next = isDurationMode(mode) ? mode : DEFAULT_DURATION_MODE;
  if (durationModeFromProject(project) === next && project.durationMode === next) {
    return project;
  }
  return projectWithResolvedUnshotDurations({ ...project, durationMode: next });
}

export function projectWithFixedDurationSeconds(project: Project, seconds: number): Project {
  const next = clampDurationSeconds(seconds);
  if (fixedDurationSecondsFromProject(project) === next && project.fixedDurationSeconds === next) {
    return project;
  }
  return projectWithResolvedUnshotDurations({ ...project, fixedDurationSeconds: next });
}
