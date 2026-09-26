import { journeyTakes } from "../project/takes";
import type { JourneyShot, Selection } from "../project/types";

export const JOURNEY_LANE_TOP = 128;
export const MOTION_TOP = 0;
export const BAND_HEIGHT = 26;
export const TAKES_STACK_TOP = 30;
export const TAKES_HEADER_HEIGHT = 16;
export const TAKES_HEADER_GAP = 4;
export const TAKE_ROW_HEIGHT = 28;
export const TAKE_ROW_GAP = 4;
export const NEW_TAKE_HEIGHT = 22;
/** MOTION plus room for a compact generate control. */
export const JOURNEY_LANE_MIN_HEIGHT = 64;

/** @deprecated Use TAKES_STACK_TOP. Kept so older layout math still compiles during the FOOTAGE removal. */
export const FOOTAGE_TOP = TAKES_STACK_TOP;
export const TAKES_HEADER_TOP = TAKES_STACK_TOP;

export function takeRowTop(index: number): number {
  return TAKES_STACK_TOP + TAKES_HEADER_HEIGHT + TAKES_HEADER_GAP + index * (TAKE_ROW_HEIGHT + TAKE_ROW_GAP);
}

/**
 * Top of the NEW TAKE control. `pendingRow` is a generating or failed bar
 * that occupies the next take row — NEW TAKE sits below it.
 */
export function newTakeTop(takeCount: number, pendingRow = false): number {
  const rows = takeCount + (pendingRow ? 1 : 0);
  if (rows === 0) {
    return TAKES_STACK_TOP;
  }
  return takeRowTop(rows);
}

export function pendingTakeCount(takeCount: number, pendingRow: boolean): number {
  return takeCount + (pendingRow ? 1 : 0);
}

export function showTakesGutter(takeCount: number, pendingRow: boolean): boolean {
  return takeCount > 0 || pendingRow;
}

export function journeyLaneStackHeight(takeCount: number, showNewTake: boolean, pendingRow = false): number {
  const stackTakes = pendingTakeCount(takeCount, pendingRow);
  if (stackTakes === 0 && !showNewTake) {
    return BAND_HEIGHT;
  }
  if (stackTakes === 0) {
    return TAKES_STACK_TOP + NEW_TAKE_HEIGHT;
  }
  if (showNewTake) {
    return newTakeTop(takeCount, pendingRow) + NEW_TAKE_HEIGHT;
  }
  return takeRowTop(stackTakes) - TAKE_ROW_GAP;
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
    const pending = shooting || Boolean(journey.shootError);
    height = Math.max(
      height,
      journeyLaneStackHeight(journeyTakes(journey).length, showNewTakeControl(selection, journey, shooting), pending),
    );
  }
  return height;
}

export function shootTrackMinHeight(laneHeight: number): number {
  return JOURNEY_LANE_TOP + laneHeight + 16;
}
