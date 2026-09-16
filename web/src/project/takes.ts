import { parseVideoModelId, videoModelDurationSeconds } from "../../../media/src/replicate/video-models.ts";
import { GENERATION_INTENT_MARK, unshotVideoModel } from "./generation-intent";
import type { JourneyShot, JourneyShotTake, Project } from "./types";

export function takeId(journeyId: string, number: number): string {
  return `${journeyId}:take:${number}`;
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
          pace: journey.cinematographer?.pace ?? "moderate",
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

export function unshotClipDurationSeconds(project: Project): number {
  return videoModelDurationSeconds(unshotVideoModel(project));
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

/** Cut / MOTION length for this segment: the selected Take, else the unshot preview. */
export function journeyClipDurationSeconds(project: Project, journey: JourneyShot): number {
  const fallback = unshotClipDurationSeconds(project);
  const selected = selectedTake(journey);
  if (selected) {
    return takeClipDurationSeconds(selected, fallback);
  }
  if (Number.isFinite(journey.durationSeconds) && journey.durationSeconds > 0) {
    return journey.durationSeconds;
  }
  return fallback;
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
  const number = existing.length + 1;
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
