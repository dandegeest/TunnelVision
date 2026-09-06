import type { Project, Selection, StoryboardFrame, StoryboardImageOrigin } from "./types";
import { destinationById, storyboardFrameById } from "./types";
import type { DirectorPlan } from "./director";

export type WorkspaceView = "plan" | "shoot";

export function nextStoryboardFrame(
  frames: StoryboardFrame[],
  frameId: string,
): StoryboardFrame | undefined {
  const index = frames.findIndex((frame) => frame.id === frameId);
  if (index < 0 || index >= frames.length - 1) {
    return undefined;
  }
  return frames[index + 1];
}

export function storyboardOriginNote(origin: StoryboardImageOrigin): string {
  switch (origin) {
    case "user":
      return "Filmmaker's frame";
    case "generated":
      return "Provisional drawing";
    case "none":
      return "No drawing yet";
  }
}

/** Provenance is a stored field. Image paths/URLs must not be used to decide origin. */
export function provenanceIsStoredNotInferred(frame: StoryboardFrame): boolean {
  if (frame.imageOrigin === "none") {
    return frame.image === undefined;
  }
  if (frame.imageOrigin === "user") {
    return Boolean(frame.image);
  }
  return frame.imageOrigin === "generated";
}

export function generatedStoryboardReusesProductionCanonical(
  project: Project,
  frame: StoryboardFrame,
): boolean {
  if (frame.imageOrigin === "user" || !frame.image || !frame.destinationId) {
    return false;
  }
  const destination = destinationById(project.destinations, frame.destinationId);
  return destination?.image === frame.image;
}

export function selectionForWorkspaceView(
  view: WorkspaceView,
  selection: Selection,
  project: Project,
): Selection {
  if (view === "plan") {
    if (selection.kind === "storyboard") {
      return selection;
    }
    const destinationId =
      selection.kind === "destination"
        ? selection.destinationId
        : project.journeys.find((journey) => journey.id === selection.journeyId)?.startDestinationId;
    const frame =
      project.storyboard.find((item) => item.destinationId === destinationId) ?? project.storyboard[0];
    if (!frame) {
      return selection;
    }
    return { kind: "storyboard", frameId: frame.id };
  }

  if (selection.kind !== "storyboard") {
    return selection;
  }
  const frame = storyboardFrameById(project.storyboard, selection.frameId);
  const destinationId = frame?.destinationId ?? project.destinations[0]?.id;
  if (!destinationId) {
    return selection;
  }
  const occurrenceIndex = Math.max(
    0,
    project.destinations.findIndex((destination) => destination.id === destinationId),
  );
  return { kind: "destination", destinationId, occurrenceIndex };
}

const STORYBOARD_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Keep the filmmaker-supplied opening frame. Map Director subsequent beats to
 * planned/FPO storyboard frames. Does not touch Shoot Destinations or Journeys.
 */
export function applyDirectorPlanToStoryboard(
  startFrame: StoryboardFrame,
  plan: DirectorPlan,
): StoryboardFrame[] {
  if (startFrame.imageOrigin !== "user" || !startFrame.image) {
    throw new Error("Starting frame must remain the filmmaker-supplied opening beat");
  }
  const subsequent = plan.beats.filter(
    (beat) => beat.id.trim().toLowerCase() !== startFrame.id.trim().toLowerCase(),
  );
  if (subsequent.length < 1) {
    throw new Error("Director returned no subsequent beats after the starting frame");
  }
  const planned: StoryboardFrame[] = subsequent.map((beat, index) => {
    const label = STORYBOARD_LABELS[index + 1] ?? `+${index + 1}`;
    return {
      id: beat.id,
      label,
      intent: beat.intent,
      imageOrigin: "none",
      ...(beat.visualDescription.trim() ? { visualDescription: beat.visualDescription } : {}),
    };
  });
  return [{ ...startFrame }, ...planned];
}

export function projectWithDirectorPlan(project: Project, plan: DirectorPlan): Project {
  const start =
    project.storyboard.find((frame) => frame.imageOrigin === "user") ?? project.storyboard[0];
  if (!start) {
    throw new Error("Project has no starting storyboard frame");
  }
  return {
    ...project,
    storyboard: applyDirectorPlanToStoryboard(start, plan),
  };
}
