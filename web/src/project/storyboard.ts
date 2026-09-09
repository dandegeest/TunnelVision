import type { Project, Selection, StoryboardFrame, StoryboardImageOrigin, StoryDuration } from "./types";
import { destinationById, storyboardFrameById } from "./types";
import type { DirectorPlan } from "./director";
import { projectWithSyncedProductionLegs } from "./production-legs";

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
export const MAX_STORYBOARD_DESTINATIONS = STORYBOARD_LABELS.length;
export const MIN_STORY_DURATION_COUNT = 2;

export function nextStoryboardSlot(
  frames: StoryboardFrame[],
): { id: string; label: string } | undefined {
  const used = new Set(frames.map((frame) => frame.id.trim().toUpperCase()));
  const last = frames[frames.length - 1]?.id.trim().toUpperCase();
  if (last && last.length === 1) {
    const index = STORYBOARD_LABELS.indexOf(last);
    if (index >= 0 && index < STORYBOARD_LABELS.length - 1) {
      const candidate = STORYBOARD_LABELS[index + 1]!;
      if (!used.has(candidate)) {
        return { id: candidate, label: candidate };
      }
    }
  }
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
  const storyboard = [
    ...project.storyboard,
    {
      id: next.id,
      label: next.label,
      imageOrigin: "none" as const,
    },
  ];
  return {
    ...project,
    storyboard,
    ...(project.storyDurationLocked ? {} : { storyDuration: storyboard.length }),
  };
}

/** Later beats may be removed. Opening A stays; it is the required starting frame. */
export function canRemoveStoryboardDestination(project: Project, frameId: string): boolean {
  const frame = storyboardFrameById(project.storyboard, frameId);
  if (!frame) {
    return false;
  }
  return !sameStoryboardId(frame.id, "A");
}

/**
 * Structural delete. Does not invoke the Director or relabel remaining beats.
 * Adjacent remaining actuals become the current production legs.
 */
export function projectWithRemovedDestination(project: Project, frameId: string): Project {
  if (!canRemoveStoryboardDestination(project, frameId)) {
    return project;
  }
  const storyboard = project.storyboard.filter((frame) => !sameStoryboardId(frame.id, frameId));
  const destinations = project.destinations.filter((destination) => !sameStoryboardId(destination.id, frameId));
  const journeys = project.journeys.filter(
    (journey) =>
      !sameStoryboardId(journey.startDestinationId, frameId) &&
      !(journey.endDestinationId && sameStoryboardId(journey.endDestinationId, frameId)),
  );
  const boundaryAnalysis = project.boundaryAnalysis?.filter(
    (record) =>
      !sameStoryboardId(record.sharedDestinationId, frameId) &&
      !record.previousJourneyId.split("-").includes(frameId) &&
      !record.nextJourneyId.split("-").includes(frameId),
  );
  return projectWithSyncedProductionLegs({
    ...project,
    storyboard,
    destinations,
    journeys,
    ...(project.boundaryAnalysis ? { boundaryAnalysis } : {}),
    ...(project.storyDurationLocked ? {} : { storyDuration: storyboard.length }),
  });
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

function specifiedOpeningFrame(storyboard: StoryboardFrame[]): StoryboardFrame | undefined {
  const opening = storyboardFrameByLetter(storyboard, "A");
  if (opening && isSpecifiedStoryboardDestination(opening)) {
    return opening;
  }
  return storyboard.find(isSpecifiedStoryboardDestination);
}

/**
 * Add Destination is structural only. It requires actual starting frame A,
 * then may append unresolved slots even when prior slots are still empty.
 */
export function canAddStoryboardDestination(project: Project): boolean {
  if (!project.story.trim()) {
    return false;
  }
  if (!nextStoryboardSlot(project.storyboard)) {
    return false;
  }
  const start = storyboardFrameByLetter(project.storyboard, "A");
  return Boolean(start && isSpecifiedStoryboardDestination(start));
}

export function canPlanMovie(project: Project): boolean {
  const start = storyboardFrameByLetter(project.storyboard, "A");
  if (start && isSpecifiedStoryboardDestination(start)) {
    return true;
  }
  if (!project.story.trim()) {
    return false;
  }
  return Boolean(
    project.autoGenerateOpening && start && start.imageOrigin === "none" && !start.image,
  );
}

export function parseStoryDurationInput(raw: string): { ok: true; duration: StoryDuration } | { ok: false } {
  const trimmed = raw.trim();
  if (/^auto$/i.test(trimmed)) {
    return { ok: true, duration: "auto" };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false };
  }
  const count = Number.parseInt(trimmed, 10);
  if (count < MIN_STORY_DURATION_COUNT || count > MAX_STORYBOARD_DESTINATIONS) {
    return { ok: false };
  }
  return { ok: true, duration: count };
}

export function storyDurationFieldValue(project: Project): string {
  if (project.storyDurationLocked || project.storyDuration !== "auto") {
    return String(project.storyboard.length);
  }
  return "AUTO";
}

export function projectWithAutoGenerateOpening(project: Project, enabled: boolean): Project {
  if (project.autoGenerateOpening === enabled) {
    return project;
  }
  return { ...project, autoGenerateOpening: enabled };
}

export function projectWithAutoGenerateAllDestinations(project: Project, enabled: boolean): Project {
  if (project.autoGenerateAllDestinations === enabled) {
    return project;
  }
  return { ...project, autoGenerateAllDestinations: enabled };
}

export function projectWithAutoBlockShots(project: Project, enabled: boolean): Project {
  if (project.autoBlockShots === enabled) {
    return project;
  }
  return { ...project, autoBlockShots: enabled };
}

export function projectWithAutoShoot(project: Project, enabled: boolean): Project {
  if (project.autoShoot === enabled) {
    return project;
  }
  return { ...project, autoShoot: enabled };
}

/** Updates Director plan fields on a beat. Does not invoke the Director or regenerate media. */
export function projectWithStoryboardBeatPlan(
  project: Project,
  frameId: string,
  next: { intent?: string; visualDescription?: string },
): Project {
  if (!project.storyboard.some((frame) => frame.id === frameId)) {
    return project;
  }
  return {
    ...project,
    storyboard: project.storyboard.map((frame) => {
      if (frame.id !== frameId) {
        return frame;
      }
      const updated = { ...frame };
      if (next.intent !== undefined) {
        updated.intent = next.intent;
      }
      if (next.visualDescription !== undefined) {
        updated.visualDescription = next.visualDescription;
      }
      return updated;
    }),
  };
}

export function projectWithNudgedStoryDuration(project: Project, delta: 1 | -1): Project {
  if (project.storyDurationLocked) {
    return project;
  }
  if (project.storyDuration === "auto") {
    return delta > 0 ? projectWithStoryDuration(project, MIN_STORY_DURATION_COUNT) : project;
  }
  const next = project.storyboard.length + delta;
  if (next < MIN_STORY_DURATION_COUNT) {
    return projectWithStoryDuration(project, "auto");
  }
  if (next > MAX_STORYBOARD_DESTINATIONS) {
    return project;
  }
  return projectWithStoryDuration(project, next);
}

export function projectWithStoryDuration(project: Project, duration: StoryDuration): Project {
  if (project.storyDurationLocked) {
    return project;
  }
  if (duration === "auto") {
    let next = project;
    while (next.storyboard.length > 1) {
      const last = next.storyboard[next.storyboard.length - 1]!;
      const removed = projectWithRemovedDestination(next, last.id);
      if (removed === next) {
        break;
      }
      next = removed;
    }
    return { ...next, storyDuration: "auto" };
  }
  let next: Project = { ...project, storyDuration: duration };
  while (next.storyboard.length < duration) {
    const grown = projectWithAddedDestination(next);
    if (grown.storyboard.length === next.storyboard.length) {
      break;
    }
    next = grown;
  }
  while (next.storyboard.length > duration) {
    const last = next.storyboard[next.storyboard.length - 1]!;
    if (sameStoryboardId(last.id, "A")) {
      break;
    }
    const trimmed = projectWithRemovedDestination(next, last.id);
    if (trimmed === next) {
      break;
    }
    next = trimmed;
  }
  return { ...next, storyDuration: next.storyboard.length };
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

/** Adopt Director text onto an actual still only where intent or visual is still empty. */
export function adoptDirectorBeatPlanIfEmpty(
  frame: StoryboardFrame,
  beat: DirectorPlan["beats"][number],
): StoryboardFrame {
  const intent = frame.intent?.trim() ?? "";
  const visual = frame.visualDescription?.trim() ?? "";
  if (intent && visual) {
    return { ...frame };
  }
  return {
    ...frame,
    ...(!intent && beat.intent.trim() ? { intent: beat.intent.trim() } : {}),
    ...(!visual && beat.visualDescription.trim()
      ? { visualDescription: beat.visualDescription.trim() }
      : {}),
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
 * frames and filled plan text are preserved. Empty intent/visual on an actual
 * still are adopted from the Director. Unresolved beats become planned/FPO
 * frames around them. Does not touch Shoot Destinations or Journeys.
 */
export function applyDirectorPlanToStoryboard(
  storyboard: StoryboardFrame[],
  plan: DirectorPlan,
): StoryboardFrame[] {
  const startFrame = specifiedOpeningFrame(storyboard);
  if (!startFrame) {
    throw new Error("Starting frame must remain the specified opening beat");
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
  const openingBeat = plan.beats.find((beat) => sameStoryboardId(beat.id, startFrame.id));
  const next: StoryboardFrame[] = [
    openingBeat ? adoptDirectorBeatPlanIfEmpty(startFrame, openingBeat) : { ...startFrame },
  ];

  for (const beat of subsequent) {
    const beatKey = storyboardIdKey(beat.id);
    const anchor = anchorsByKey.get(beatKey);
    if (anchor) {
      next.push(adoptDirectorBeatPlanIfEmpty(anchor, beat));
      placed.add(beatKey);
      continue;
    }
    if (placed.has(beatKey)) {
      continue;
    }
    next.push(plannedFrameFromBeat(beat));
    placed.add(beatKey);
  }
  restoreOmittedSlots(storyboard, startFrame, next, placed);
  assertNoInventedIds(storyboard, next);
  assertNoInventedTail(storyboard, next);
  return next;
}

function storyboardHasLetterGaps(storyboard: StoryboardFrame[]): boolean {
  for (let index = 0; index < storyboard.length - 1; index += 1) {
    const current = storyboard[index]!.id.trim().toUpperCase();
    const next = storyboard[index + 1]!.id.trim().toUpperCase();
    if (
      current.length === 1 &&
      next.length === 1 &&
      next.charCodeAt(0) - current.charCodeAt(0) > 1
    ) {
      return true;
    }
  }
  return false;
}

function mayInventNewDestinationIds(storyboard: StoryboardFrame[]): boolean {
  if (storyboard.length <= 1) {
    return true;
  }
  if (storyboard.some((frame) => !isSpecifiedStoryboardDestination(frame))) {
    return false;
  }
  return storyboardHasLetterGaps(storyboard);
}

function assertNoInventedIds(storyboard: StoryboardFrame[], next: StoryboardFrame[]): void {
  if (mayInventNewDestinationIds(storyboard)) {
    return;
  }
  const existing = new Set(storyboard.map((frame) => storyboardIdKey(frame.id)));
  for (const frame of next) {
    if (!existing.has(storyboardIdKey(frame.id))) {
      throw new Error("Director invented extra destinations");
    }
  }
}

function restoreOmittedSlots(
  storyboard: StoryboardFrame[],
  startFrame: StoryboardFrame,
  next: StoryboardFrame[],
  placed: Set<string>,
): void {
  for (const frame of storyboard) {
    const key = storyboardIdKey(frame.id);
    if (sameStoryboardId(frame.id, startFrame.id) || placed.has(key)) {
      continue;
    }
    const originIndex = storyboard.findIndex((item) => storyboardIdKey(item.id) === key);
    let insertAt = next.length;
    for (let later = originIndex + 1; later < storyboard.length; later += 1) {
      const laterKey = storyboardIdKey(storyboard[later]!.id);
      const found = next.findIndex((item) => storyboardIdKey(item.id) === laterKey);
      if (found >= 0) {
        insertAt = found;
        break;
      }
    }
    next.splice(insertAt, 0, { ...frame });
    placed.add(key);
  }
}

function assertNoInventedTail(storyboard: StoryboardFrame[], next: StoryboardFrame[]): void {
  if (storyboard.length <= 1) {
    return;
  }
  const existing = new Set(storyboard.map((frame) => storyboardIdKey(frame.id)));
  const lastKey = storyboardIdKey(storyboard[storyboard.length - 1]!.id);
  const lastIndex = next.findIndex((frame) => storyboardIdKey(frame.id) === lastKey);
  if (lastIndex < 0) {
    throw new Error(`Director omitted authoritative destination ${storyboard[storyboard.length - 1]!.id}`);
  }
  for (const frame of next.slice(lastIndex + 1)) {
    if (!existing.has(storyboardIdKey(frame.id))) {
      throw new Error("Director invented extra destinations");
    }
  }
}

export function projectWithDirectorPlan(project: Project, plan: DirectorPlan): Project {
  const start = specifiedOpeningFrame(project.storyboard);
  if (!start) {
    throw new Error("Project has no specified opening storyboard frame");
  }
  const storyboard = applyDirectorPlanToStoryboard(project.storyboard, plan);
  return {
    ...project,
    storyboard,
    storyDuration: storyboard.length,
    storyDurationLocked: true,
  };
}
