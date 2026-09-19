import { parseVideoModelId, videoModelDurationSeconds } from "../../../media/src/replicate/video-models.ts";
import { effectiveJourneyPace } from "./journey-overrides";
import { unshotDurationSeconds } from "./shot-duration";
import { GENERATION_INTENT_MARK } from "./generation-intent";
import type { JourneyShot, JourneyShotTake, Project } from "./types";

export function takeId(journeyId: string, number: number): string {
  return `${journeyId}:take:${number}`;
}

/** Next TAKE N. Numbers are identity and are not reused after a delete. */
export function nextTakeNumber(takes: readonly Pick<JourneyShotTake, "number">[]): number {
  return takes.reduce((max, take) => Math.max(max, take.number ?? 0), 0) + 1;
}

export function takeDisplayLabel(
  take: Pick<JourneyShotTake, "number" | "generationIntent"> | { number: number; generationIntent?: JourneyShotTake["generationIntent"] },
): string {
  const base = `TAKE ${take.number}`;
  const mark = take.generationIntent ? GENERATION_INTENT_MARK[take.generationIntent] : undefined;
  return mark ? `${base} · ${mark}` : base;
}

export const TAKE_PREVIOUS_CANONICALS_COPY = "Not shot from the current START/END";

export function currentJourneyCanonicalPair(
  project: Project,
  journey: JourneyShot,
): { startCanonicalMediaId: string; endCanonicalMediaId: string } | undefined {
  if (!journey.endDestinationId) {
    return undefined;
  }
  const start = storyboardMediaId(project, journey.startDestinationId);
  const end = storyboardMediaId(project, journey.endDestinationId);
  if (!start || !end) {
    return undefined;
  }
  return { startCanonicalMediaId: start, endCanonicalMediaId: end };
}

/** `false` when this Take was shot against a previous canonical pair. */
export function takeMatchesCurrentCanonicals(
  project: Project,
  journey: JourneyShot,
  take: Pick<JourneyShotTake, "startCanonicalMediaId" | "endCanonicalMediaId">,
): boolean | undefined {
  const pair = takeCanonicalPair(take);
  const current = currentJourneyCanonicalPair(project, journey);
  if (!pair || !current) {
    return undefined;
  }
  return (
    pair.startCanonicalMediaId === current.startCanonicalMediaId &&
    pair.endCanonicalMediaId === current.endCanonicalMediaId
  );
}

export function journeyHasStaleTakes(project: Project, journey: JourneyShot): boolean {
  return journeyTakes(journey).some((take) => takeMatchesCurrentCanonicals(project, journey, take) === false);
}

function storyboardMediaId(project: Project, destinationId: string): string | undefined {
  const frame =
    project.storyboard.find((item) => item.destinationId === destinationId) ??
    project.storyboard.find((item) => item.id === destinationId);
  return frame?.mediaId;
}

function withIdentity(
  journeyId: string,
  take: JourneyShotTake,
  number: number,
  videoUrl: string,
): JourneyShotTake {
  return {
    ...take,
    id: take.id ?? takeId(journeyId, number),
    number: take.number ?? number,
    videoUrl: take.videoUrl || videoUrl,
  };
}

/** Canonical pair this take was shot against. Undefined until stamped. */
export function takeCanonicalPair(
  take: Pick<JourneyShotTake, "startCanonicalMediaId" | "endCanonicalMediaId">,
): { startCanonicalMediaId: string; endCanonicalMediaId: string } | undefined {
  if (!take.startCanonicalMediaId || !take.endCanonicalMediaId) {
    return undefined;
  }
  return {
    startCanonicalMediaId: take.startCanonicalMediaId,
    endCanonicalMediaId: take.endCanonicalMediaId,
  };
}

/**
 * Whether inbound A→B and outbound B→C Takes share the same B media identity.
 * `undefined` when either Take has no recorded pair (legacy footage).
 * Not enforced in the current UI.
 */
export function takesShareHandoffCanonical(
  inbound: Pick<JourneyShotTake, "endCanonicalMediaId">,
  outbound: Pick<JourneyShotTake, "startCanonicalMediaId">,
): boolean | undefined {
  if (!inbound.endCanonicalMediaId || !outbound.startCanonicalMediaId) {
    return undefined;
  }
  return inbound.endCanonicalMediaId === outbound.startCanonicalMediaId;
}

function withCanonicalPair(
  project: Project,
  journey: JourneyShot,
  take: JourneyShotTake,
): JourneyShotTake {
  if (take.startCanonicalMediaId && take.endCanonicalMediaId) {
    return take;
  }
  const start =
    take.startCanonicalMediaId ??
    journey.motionPlan?.startCanonicalMediaId ??
    storyboardMediaId(project, journey.startDestinationId);
  const end =
    take.endCanonicalMediaId ??
    journey.motionPlan?.endCanonicalMediaId ??
    (journey.endDestinationId ? storyboardMediaId(project, journey.endDestinationId) : undefined);
  if (!start && !end) {
    return take;
  }
  return {
    ...take,
    ...(start ? { startCanonicalMediaId: start } : {}),
    ...(end ? { endCanonicalMediaId: end } : {}),
  };
}

/**
 * Legacy JourneyShot footage → Take 1. Does not invent shooting frames
 * when the project only stored `videoUrl`.
 */
export function journeyTakes(journey: JourneyShot): JourneyShotTake[] {
  if (journey.takes && journey.takes.length > 0) {
    return journey.takes.map((take, index) =>
      withIdentity(journey.id, take, index + 1, take.videoUrl || journey.videoUrl || ""),
    );
  }
  if (journey.take) {
    return [
      withIdentity(journey.id, journey.take, 1, journey.take.videoUrl || journey.videoUrl || ""),
    ];
  }
  if (journey.videoUrl) {
    return [
      withIdentity(
        journey.id,
        {
          startShootingFrame: { mediaId: "legacy-footage", imageUrl: "" },
          endShootingFrame: { mediaId: "legacy-footage", imageUrl: "" },
          startPlan: {
            version: 1,
            camera: { vanishing_point: [0.5, 0.5], forward: 1 },
            destination: { point: [0.5, 0.5], protect: true, bbox: [0, 0, 1, 1] },
            exposure: { strength: 0, samples: 1 },
          },
          endPlan: {
            version: 1,
            camera: { vanishing_point: [0.5, 0.5], forward: 1 },
            destination: { point: [0.5, 0.5], protect: true, bbox: [0, 0, 1, 1] },
            exposure: { strength: 0, samples: 1 },
          },
          segmentPromptAddition: "",
          effectivePrompt: "",
          pace: effectiveJourneyPace(journey) ?? "moderate",
          provider: "replicate",
          model: "",
          modelVersion: null,
          durationSeconds: journey.durationSeconds,
          videoInputs: { startShootingFrame: true, endShootingFrame: false },
        },
        1,
        journey.videoUrl,
      ),
    ];
  }
  return [];
}

export function selectedTake(journey: JourneyShot): JourneyShotTake | undefined {
  const takes = journeyTakes(journey);
  if (takes.length === 0) {
    return undefined;
  }
  return takes.find((take) => take.id === journey.selectedTakeId) ?? takes[takes.length - 1];
}

export function selectedTakeVideoUrl(journey: JourneyShot): string | undefined {
  const take = selectedTake(journey);
  return take?.videoUrl || journey.videoUrl || undefined;
}

export function unshotClipDurationSeconds(
  project: Project,
  journey?: Pick<JourneyShot, "cinematographer">,
): number {
  return unshotDurationSeconds(project, journey);
}

/** Clip length for a Take: stored duration, else that generator's catalog length. */
export function takeClipDurationSeconds(
  take: Pick<JourneyShotTake, "durationSeconds" | "model"> | undefined,
  fallbackSeconds: number,
): number {
  if (take && Number.isFinite(take.durationSeconds) && take.durationSeconds > 0) {
    return take.durationSeconds;
  }
  const modelId = take?.model ? parseVideoModelId(take.model) : undefined;
  if (modelId) {
    return videoModelDurationSeconds(modelId);
  }
  return fallbackSeconds;
}

/** Cut / MOTION length for this segment: the selected Take, else the live mapped request. */
export function journeyClipDurationSeconds(project: Project, journey: JourneyShot): number {
  const resolved = unshotClipDurationSeconds(project, journey);
  const selected = selectedTake(journey);
  if (selected) {
    return takeClipDurationSeconds(selected, resolved);
  }
  return resolved;
}

export function journeysWithClipDurations(project: Project): JourneyShot[] {
  return project.journeys.map((journey) => ({
    ...journey,
    durationSeconds: journeyClipDurationSeconds(project, journey),
  }));
}

export function takeHasShootingFrames(take: JourneyShotTake | undefined): boolean {
  return Boolean(take?.startShootingFrame.imageUrl && take.endShootingFrame.imageUrl);
}

export function journeyHasTakes(journey: JourneyShot): boolean {
  return journeyTakes(journey).length > 0;
}

function mirrorSelectedTake(journey: JourneyShot, takes: JourneyShotTake[], selected: JourneyShotTake): JourneyShot {
  return {
    ...journey,
    takes,
    selectedTakeId: selected.id,
    take: selected,
    videoUrl: selected.videoUrl,
    durationSeconds: takeClipDurationSeconds(selected, journey.durationSeconds),
  };
}

/**
 * Copy any newer Takes from `incoming` onto `base`.
 * A destination write that started before footage finished must not drop that clip.
 * Journey ids are A-B in every project, so this must not run across projects.
 */
export function projectWithLatestJourneyTakes(base: Project, incoming: Project): Project {
  return {
    ...base,
    journeys: base.journeys.map((journey) => {
      const filmed = incoming.journeys.find((item) => item.id === journey.id);
      if (!filmed || journeyTakes(filmed).length <= journeyTakes(journey).length) {
        return journey;
      }
      const takes = journeyTakes(filmed);
      const selected =
        (filmed.selectedTakeId
          ? takes.find((take) => take.id === filmed.selectedTakeId)
          : undefined) ??
        filmed.take ??
        takes[takes.length - 1]!;
      return {
        ...mirrorSelectedTake(journey, takes, selected),
        status: "rendered",
        shootError: undefined,
      };
    }),
  };
}

/**
 * Same-project concurrent footage only. A foreign `next` is ignored so A-B
 * from another movie cannot replace the workspace.
 * New/Open must call replace, not this merge.
 */
export function mergeProjectUpdate(next: Project, current: Project): Project {
  if (next.id !== current.id) {
    return current;
  }
  return projectWithLatestJourneyTakes(next, current);
}

/** False when this journey is gone or was shot against a different START/END. */
export function filmedTakeFitsCurrentJourney(
  project: Project,
  journeyId: string,
  shotAgainst: { startCanonicalMediaId: string; endCanonicalMediaId: string } | undefined,
): boolean {
  const journey = project.journeys.find((item) => item.id === journeyId);
  if (!journey) {
    return false;
  }
  if (!shotAgainst) {
    return true;
  }
  return takeMatchesCurrentCanonicals(project, journey, shotAgainst) !== false;
}

/** Persist takes[] + selectedTakeId. Newest take is the cut; workspace selection is unchanged. */
export function projectWithAppendedTake(
  project: Project,
  journeyId: string,
  next: { take: JourneyShotTake; videoUrl: string },
): Project {
  const journey = project.journeys.find((item) => item.id === journeyId);
  if (!journey) {
    throw new Error("Unknown journey");
  }
  const existing = journeyTakes(journey);
  const number = nextTakeNumber(existing);
  const stored = withIdentity(
    journeyId,
    withCanonicalPair(project, journey, next.take),
    number,
    next.videoUrl,
  );
  const takes = [...existing, stored];
  return {
    ...project,
    journeys: project.journeys.map((item) =>
      item.id === journeyId
        ? {
            ...mirrorSelectedTake(item, takes, stored),
            status: "rendered",
            shootError: undefined,
          }
        : item,
    ),
  };
}

function journeyWithoutTakes(project: Project, journey: JourneyShot): JourneyShot {
  return {
    ...journey,
    takes: [],
    selectedTakeId: undefined,
    take: undefined,
    videoUrl: undefined,
    durationSeconds: unshotDurationSeconds(project, journey),
    status: journey.status === "shooting" ? "shooting" : journey.motionPlan ? "ready" : "planned",
  };
}

/**
 * Remove one Take. Remaining Takes keep their numbers and ids so TAKE 3
 * stays TAKE 3. Deleting a non-selected Take leaves the current selection
 * alone. Deleting the selected Take moves the cut to the following Take,
 * or the previous if that was the last. An empty stack returns the
 * segment to Ready and keeps the Motion Plan.
 */
export function projectWithDeletedTake(project: Project, journeyId: string, takeIdToDelete: string): Project {
  const journey = project.journeys.find((item) => item.id === journeyId);
  if (!journey) {
    throw new Error("Unknown journey");
  }
  const takes = journeyTakes(journey);
  const index = takes.findIndex((take) => take.id === takeIdToDelete);
  if (index < 0) {
    throw new Error("Unknown take");
  }
  const remaining = takes.filter((take) => take.id !== takeIdToDelete);
  if (remaining.length === 0) {
    const cleared = journeyWithoutTakes(project, journey);
    return {
      ...project,
      journeys: project.journeys.map((item) => (item.id === journeyId ? cleared : item)),
    };
  }
  const current = selectedTake(journey);
  const keep =
    current && current.id !== takeIdToDelete
      ? remaining.find((take) => take.id === current.id)
      : undefined;
  const selected = keep ?? remaining[index] ?? remaining[index - 1]!;
  return {
    ...project,
    journeys: project.journeys.map((item) =>
      item.id === journeyId ? mirrorSelectedTake(item, remaining, selected) : item,
    ),
  };
}

export function projectWithSelectedTake(project: Project, journeyId: string, takeId: string): Project {
  const journey = project.journeys.find((item) => item.id === journeyId);
  if (!journey) {
    throw new Error("Unknown journey");
  }
  const takes = journeyTakes(journey);
  const selected = takes.find((take) => take.id === takeId);
  if (!selected) {
    throw new Error("Unknown take");
  }
  return {
    ...project,
    journeys: project.journeys.map((item) =>
      item.id === journeyId ? mirrorSelectedTake(item, takes, selected) : item,
    ),
  };
}

/** Select the Take at `rowIndex` on every journey that has one. Playhead stays put. */
export function projectWithSelectedTakeRow(project: Project, rowIndex: number): Project {
  let next = project;
  for (const journey of project.journeys) {
    const take = journeyTakes(journey)[rowIndex];
    if (take?.id) {
      next = projectWithSelectedTake(next, journey.id, take.id);
    }
  }
  return next;
}

export function takesInRow(
  project: Project,
  rowIndex: number,
): { journeyId: string; takeId: string }[] {
  return project.journeys.flatMap((journey) => {
    const take = journeyTakes(journey)[rowIndex];
    return take?.id ? [{ journeyId: journey.id, takeId: take.id }] : [];
  });
}

/** Delete the Take at `rowIndex` on every journey that has one. */
export function projectWithDeletedTakeRow(project: Project, rowIndex: number): Project {
  let next = project;
  for (const { journeyId, takeId } of takesInRow(project, rowIndex)) {
    next = projectWithDeletedTake(next, journeyId, takeId);
  }
  return next;
}

export function patchSelectedTake(
  journey: JourneyShot,
  patch: Partial<JourneyShotTake>,
): JourneyShot {
  const takes = journeyTakes(journey);
  const current = selectedTake(journey);
  if (!current) {
    return journey;
  }
  const nextTakes = takes.map((take) => (take.id === current.id ? { ...take, ...patch } : take));
  const selected = nextTakes.find((take) => take.id === current.id);
  if (!selected) {
    return journey;
  }
  return mirrorSelectedTake(journey, nextTakes, selected);
}
