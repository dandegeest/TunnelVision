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
  const startId = frame?.destinationId ?? frame?.id;
  const outbound = startId
    ? project.journeys.find(
        (journey) => journey.startDestinationId === startId && journey.endDestinationId,
      )
    : undefined;
  if (outbound) {
    return { kind: "journey", journeyId: outbound.id };
  }
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

export function nextStoryboardSlot(
  frames: StoryboardFrame[],
): { id: string; label: string } | undefined {
  const used = new Set(frames.map((frame) => frame.id.trim().toUpperCase()));
  for (const letter of STORYBOARD_LABELS) {
    if (!used.has(letter)) {
      return { id: letter, label: letter };
    }
  }
  return undefined;
}

/** Append an empty planned destination after the last configured frame. Not a construction strategy. */
export function projectWithAddedDestination(project: Project): Project {
  const next = nextStoryboardSlot(project.storyboard);
  if (!next) {
    return project;
  }
  return {
    ...project,
    storyboard: [
      ...project.storyboard,
      {
        id: next.id,
        label: next.label,
        imageOrigin: "none",
      },
    ],
  };
}

function sameStoryboardId(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

/** Actual destination still. FPO / unresolved frames are not specified. */
export function isSpecifiedStoryboardDestination(frame: StoryboardFrame): boolean {
  return frame.imageOrigin !== "none" && Boolean(frame.image);
}

function storyboardFrameByLetter(frames: StoryboardFrame[], id: string): StoryboardFrame | undefined {
  const key = id.trim().toLowerCase();
  return frames.find((frame) => frame.id.trim().toLowerCase() === key);
}

/**
 * + ADD DESTINATION extends an existing A→B journey. It is not how B is created.
 * Requires actual canonical A and B stills, not unresolved placeholders.
 * Does not require a JourneyShot. A-only projects remain valid.
 */
export function canAddStoryboardDestination(project: Project): boolean {
  if (!nextStoryboardSlot(project.storyboard)) {
    return false;
  }
  const start = storyboardFrameByLetter(project.storyboard, "A");
  const firstEnd = storyboardFrameByLetter(project.storyboard, "B");
  return Boolean(
    start &&
      firstEnd &&
      isSpecifiedStoryboardDestination(start) &&
      isSpecifiedStoryboardDestination(firstEnd),
  );
}

function plannedFrameFromBeat(beat: DirectorPlan["beats"][number]): StoryboardFrame {
  const id = beat.id;
  const letter = id.trim();
  const upper = letter.toUpperCase();
  const label = letter.length === 1 && STORYBOARD_LABELS.includes(upper) ? upper : letter;
  return {
    id,
    label,
    intent: beat.intent,
    imageOrigin: "none",
    ...(beat.visualDescription.trim() ? { visualDescription: beat.visualDescription } : {}),
  };
}

function storyboardIdKey(id: string): string {
  return id.trim().toLowerCase();
}

function assertDirectorAnchorMarkers(
  anchors: StoryboardFrame[],
  subsequent: DirectorPlan["beats"],
): void {
  if (anchors.length < 1) {
    return;
  }
  const expectedKeys = anchors.map((frame) => storyboardIdKey(frame.id));
  const expectedByKey = new Map(expectedKeys.map((key, index) => [key, anchors[index]!.id]));
  const counts = new Map<string, number>();
  const markerOrder: string[] = [];
  for (const beat of subsequent) {
    const key = storyboardIdKey(beat.id);
    if (!expectedByKey.has(key)) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
    markerOrder.push(key);
  }
  for (const key of expectedKeys) {
    const count = counts.get(key) ?? 0;
    const id = expectedByKey.get(key) ?? key;
    if (count < 1) {
      throw new Error(`Director omitted authoritative destination ${id}`);
    }
    if (count > 1) {
      throw new Error(`Director duplicated authoritative destination ${id}`);
    }
  }
  if (markerOrder.join("\0") !== expectedKeys.join("\0")) {
    throw new Error("Director reordered authoritative destinations");
  }
}

/**
 * Keep specified destinations (actual stills) as authoritative constraints.
 * Additional anchors must appear in beats[] as ordering markers; their stored
 * frames are preserved. Unresolved beats become planned/FPO frames around them.
 * Does not touch Shoot Destinations or Journeys.
 */
export function applyDirectorPlanToStoryboard(
  storyboard: StoryboardFrame[],
  plan: DirectorPlan,
): StoryboardFrame[] {
  const startFrame =
    storyboard.find((frame) => frame.imageOrigin === "user") ?? storyboard[0];
  if (!startFrame || startFrame.imageOrigin !== "user" || !startFrame.image) {
    throw new Error("Starting frame must remain the filmmaker-supplied opening beat");
  }
  const subsequent = plan.beats.filter((beat) => !sameStoryboardId(beat.id, startFrame.id));
  if (subsequent.length < 1) {
    throw new Error("Director returned no subsequent beats after the starting frame");
  }

  const anchors = storyboard.filter(
    (frame) =>
      isSpecifiedStoryboardDestination(frame) && !sameStoryboardId(frame.id, startFrame.id),
  );
  assertDirectorAnchorMarkers(anchors, subsequent);

  const anchorsByKey = new Map(anchors.map((frame) => [storyboardIdKey(frame.id), frame]));
  const placed = new Set<string>([storyboardIdKey(startFrame.id)]);
  const next: StoryboardFrame[] = [{ ...startFrame }];

  for (const beat of subsequent) {
    const beatKey = storyboardIdKey(beat.id);
    const anchor = anchorsByKey.get(beatKey);
    if (anchor) {
      next.push({ ...anchor });
      placed.add(beatKey);
      continue;
    }
    if (placed.has(beatKey)) {
      continue;
    }
    next.push(plannedFrameFromBeat(beat));
    placed.add(beatKey);
  }
  return next;
}

export function projectWithDirectorPlan(project: Project, plan: DirectorPlan): Project {
  const start =
    project.storyboard.find((frame) => frame.imageOrigin === "user") ?? project.storyboard[0];
  if (!start) {
    throw new Error("Project has no starting storyboard frame");
  }
  return {
    ...project,
    storyboard: applyDirectorPlanToStoryboard(project.storyboard, plan),
  };
}
