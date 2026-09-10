import { videoModelDurationSeconds } from "../../../media/src/replicate/video-models.ts";
import { isProductionEndpoint, productionDestinationId } from "../project/production-legs";
import { nextStoryboardSlot } from "../project/storyboard";
import type { Project } from "../project/types";
import {
  BASE_PX_PER_SECOND,
  layoutTimeline,
  TRACK_PAD_PX,
  type LaidOutOccurrence,
  type TimelineLayout,
} from "./geometry";

export type ShootTimelineSlot = {
  id: string;
  label: string;
  fpo: boolean;
  image?: string;
};

/** Unresolved beats after the last actual canonical. */
export function trailingFpoSlots(project: Project): ShootTimelineSlot[] {
  const frames = project.storyboard;
  let lastActualIndex = -1;
  for (let index = 0; index < frames.length; index += 1) {
    if (isProductionEndpoint(frames[index])) {
      lastActualIndex = index;
    }
  }
  if (lastActualIndex < 0) {
    return [];
  }
  return frames
    .slice(lastActualIndex + 1)
    .filter((frame) => !isProductionEndpoint(frame))
    .map((frame) => ({ id: frame.id, label: frame.label, fpo: true }));
}

/** Storyboard from the opening actual, plus B when only A exists. */
export function shootTimelineSlots(project: Project): ShootTimelineSlot[] {
  const frames = project.storyboard;
  const firstActual = frames.findIndex((frame) => isProductionEndpoint(frame));
  if (firstActual < 0) {
    return [];
  }
  const slots: ShootTimelineSlot[] = frames.slice(firstActual).map((frame) => ({
    id: isProductionEndpoint(frame) ? productionDestinationId(frame) : frame.id,
    label: frame.label,
    fpo: !isProductionEndpoint(frame),
    ...(isProductionEndpoint(frame) && frame.image ? { image: frame.image } : {}),
  }));
  if (slots.length === 1 && !slots[0]?.fpo) {
    const next = nextStoryboardSlot(frames);
    if (next) {
      slots.push({ id: next.id, label: next.label, fpo: true });
    }
  }
  return slots;
}

function occurrenceFromSlot(
  slot: ShootTimelineSlot,
  occurrenceIndex: number,
  timeSeconds: number,
  zoom: number,
  pxPerSecond: number,
  padPx: number,
  inboundJourneyId: string | null,
  outboundJourneyId: string | null,
): LaidOutOccurrence {
  return {
    occurrenceIndex,
    destinationId: slot.id,
    label: slot.label,
    timeSeconds,
    xCenter: padPx + timeSeconds * pxPerSecond * zoom,
    inboundJourneyId,
    outboundJourneyId,
    arrivalBlocked: false,
    ...(slot.fpo ? { fpo: true } : {}),
    ...(slot.image ? { image: slot.image } : {}),
  };
}

function layoutFromSlots(
  slots: ShootTimelineSlot[],
  durationSeconds: number,
  zoom: number,
  pxPerSecond = BASE_PX_PER_SECOND,
  padPx = TRACK_PAD_PX,
): TimelineLayout {
  const occurrences = slots.map((slot, index) =>
    occurrenceFromSlot(
      slot,
      index,
      index * durationSeconds,
      zoom,
      pxPerSecond,
      padPx,
      null,
      null,
    ),
  );
  const time = Math.max(0, (slots.length - 1) * durationSeconds);
  const contentWidth = time * pxPerSecond * zoom;
  return {
    occurrences,
    journeys: [],
    totalDuration: time,
    contentWidth,
    trackWidth: contentWidth + padPx * 2,
    padPx,
  };
}

function appendFpoOccurrences(
  layout: TimelineLayout,
  extras: ShootTimelineSlot[],
  durationSeconds: number,
  zoom: number,
  pxPerSecond = BASE_PX_PER_SECOND,
): TimelineLayout {
  if (extras.length === 0) {
    return layout;
  }
  const last = layout.occurrences.at(-1);
  let time = last?.timeSeconds ?? 0;
  const occurrences = [...layout.occurrences];
  for (const slot of extras) {
    time += durationSeconds;
    occurrences.push(
      occurrenceFromSlot(slot, occurrences.length, time, zoom, pxPerSecond, layout.padPx, null, null),
    );
  }
  const contentWidth = time * pxPerSecond * zoom;
  return {
    ...layout,
    occurrences,
    totalDuration: time,
    contentWidth,
    trackWidth: contentWidth + layout.padPx * 2,
  };
}

/** Production legs plus unresolved storyboard beats so Shoot is populated before B is actual. */
export function layoutShootTimeline(project: Project, zoom: number): TimelineLayout {
  const durationSeconds = videoModelDurationSeconds(project.videoModel);
  if (project.journeys.length === 0) {
    const slots = shootTimelineSlots(project);
    if (slots.length === 0) {
      return layoutTimeline([], [], zoom);
    }
    return layoutFromSlots(slots, durationSeconds, zoom);
  }
  return appendFpoOccurrences(
    layoutTimeline(project.destinations, project.journeys, zoom),
    trailingFpoSlots(project),
    durationSeconds,
    zoom,
  );
}
