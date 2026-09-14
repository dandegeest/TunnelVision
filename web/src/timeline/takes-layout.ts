import { journeyTakes } from "../project/takes";
import type { JourneyShot, Selection } from "../project/types";

export const JOURNEY_LANE_TOP = 128;
export const MOTION_TOP = 0;
export const BAND_HEIGHT = 26;
export const FOOTAGE_TOP = 30;
export const TAKES_HEADER_TOP = 60;
export const TAKES_HEADER_HEIGHT = 16;
export const TAKES_HEADER_GAP = 4;
export const TAKE_ROW_HEIGHT = 28;
export const TAKE_ROW_GAP = 4;
export const NEW_TAKE_HEIGHT = 22;
/** Previous MOTION + FOOTAGE + compact generate control. */
export const JOURNEY_LANE_MIN_HEIGHT = 96;

export function takeRowTop(index: number): number {
  return TAKES_HEADER_TOP + TAKES_HEADER_HEIGHT + TAKES_HEADER_GAP + index * (TAKE_ROW_HEIGHT + TAKE_ROW_GAP);
}

export function newTakeTop(takeCount: number): number {
  return takeRowTop(takeCount);
}

export function journeyLaneStackHeight(takeCount: number, showNewTake: boolean): number {
  if (takeCount === 0 && !showNewTake) {
    return FOOTAGE_TOP + BAND_HEIGHT;
  }
  const rowsBottom = takeCount > 0 ? takeRowTop(takeCount) - TAKE_ROW_GAP : TAKES_HEADER_TOP + TAKES_HEADER_HEIGHT;
  if (showNewTake) {
    return newTakeTop(takeCount) + NEW_TAKE_HEIGHT;
  }
  return rowsBottom;
}

export function journeySegmentIsActive(selection: Selection, journey: JourneyShot): boolean {
  if (selection.kind === "journey") {
    return selection.journeyId === journey.id;
  }
  if (selection.kind === "destination") {
    return (
      selection.destinationId === journey.startDestinationId ||
      selection.destinationId === journey.endDestinationId
    );
  }
  return false;
}

export function showNewTakeControl(
  selection: Selection,
  journey: JourneyShot,
  shooting: boolean,
): boolean {
  return journeySegmentIsActive(selection, journey) && !shooting;
}

export function journeyLaneHeight(
  journeys: readonly JourneyShot[],
  selection: Selection,
  shootingJourneyIds: readonly string[] = [],
): number {
  let height = JOURNEY_LANE_MIN_HEIGHT;
  for (const journey of journeys) {
    const shooting = shootingJourneyIds.includes(journey.id) || journey.status === "shooting";
    height = Math.max(
      height,
      journeyLaneStackHeight(journeyTakes(journey).length, showNewTakeControl(selection, journey, shooting)),
    );
  }
  return height;
}

export function shootTrackMinHeight(laneHeight: number): number {
  return JOURNEY_LANE_TOP + laneHeight + 16;
}
