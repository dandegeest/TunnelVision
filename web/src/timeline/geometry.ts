import type { Destination, JourneyShot } from "../project/types";

export const DEFAULT_DURATION_SECONDS = 6;
export const BASE_PX_PER_SECOND = 38;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;
export const DESTINATION_THUMB_PX = 132;
export const VIEWER_GUTTER_PX = 56;
export const TRACK_PAD_PX = DESTINATION_THUMB_PX / 2 + VIEWER_GUTTER_PX;

export type LaidOutOccurrence = {
  occurrenceIndex: number;
  destinationId: string;
  label: string;
  timeSeconds: number;
  xCenter: number;
  inboundJourneyId: string | null;
  outboundJourneyId: string | null;
  arrivalBlocked: boolean;
};

export type LaidOutJourney = {
  journeyId: string;
  startDestinationId: string;
  endDestinationId: string | null;
  startTime: number;
  endTime: number;
  left: number;
  width: number;
  status: JourneyShot["status"];
};

export type TimelineLayout = {
  occurrences: LaidOutOccurrence[];
  journeys: LaidOutJourney[];
  totalDuration: number;
  contentWidth: number;
  trackWidth: number;
  padPx: number;
};

function scale(timeSeconds: number, zoom: number, pxPerSecond: number): number {
  return timeSeconds * pxPerSecond * zoom;
}

export function layoutTimeline(
  destinations: Destination[],
  journeys: JourneyShot[],
  zoom: number,
  pxPerSecond = BASE_PX_PER_SECOND,
  padPx = TRACK_PAD_PX,
): TimelineLayout {
  const labels = new Map(destinations.map((destination) => [destination.id, destination.label]));
  const laidJourneys: LaidOutJourney[] = [];
  const occurrences: LaidOutOccurrence[] = [];

  let time = 0;
  const first = journeys[0];
  if (first) {
    occurrences.push({
      occurrenceIndex: 0,
      destinationId: first.startDestinationId,
      label: labels.get(first.startDestinationId) ?? first.startDestinationId,
      timeSeconds: 0,
      xCenter: padPx,
      inboundJourneyId: null,
      outboundJourneyId: first.id,
      arrivalBlocked: false,
    });
  }

  for (let index = 0; index < journeys.length; index += 1) {
    const journey = journeys[index];
    const startTime = time;
    const endTime = time + journey.durationSeconds;
    const left = padPx + scale(startTime, zoom, pxPerSecond);
    const width = scale(journey.durationSeconds, zoom, pxPerSecond);
    laidJourneys.push({
      journeyId: journey.id,
      startDestinationId: journey.startDestinationId,
      endDestinationId: journey.endDestinationId,
      startTime,
      endTime,
      left,
      width,
      status: journey.status,
    });

    time = endTime;
    if (journey.endDestinationId) {
      const next = journeys[index + 1];
      occurrences.push({
        occurrenceIndex: occurrences.length,
        destinationId: journey.endDestinationId,
        label: labels.get(journey.endDestinationId) ?? journey.endDestinationId,
        timeSeconds: time,
        xCenter: padPx + scale(time, zoom, pxPerSecond),
        inboundJourneyId: journey.id,
        outboundJourneyId: next?.id ?? null,
        arrivalBlocked: journey.status === "not_shootable",
      });
    }
  }

  const contentWidth = scale(time, zoom, pxPerSecond);
  return {
    occurrences,
    journeys: laidJourneys,
    totalDuration: time,
    contentWidth,
    trackWidth: contentWidth + padPx * 2,
    padPx,
  };
}

export function timeToX(
  timeSeconds: number,
  zoom: number,
  pxPerSecond = BASE_PX_PER_SECOND,
  padPx = TRACK_PAD_PX,
): number {
  return padPx + scale(timeSeconds, zoom, pxPerSecond);
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function wholeSecondMarkTimes(totalDuration: number): number[] {
  const times: number[] = [];
  const last = Math.floor(totalDuration);
  for (let time = 0; time <= last; time += 1) {
    times.push(time);
  }
  return times;
}

export function journeyBoundaryTimes(journeys: JourneyShot[]): number[] {
  const times = [0];
  let time = 0;
  for (const journey of journeys) {
    time += journey.durationSeconds;
    times.push(time);
  }
  return times;
}
