import type { Agency, JourneyShot } from "./types";

export const ARRIVAL_BLOCKED_COPY =
  "The camera can’t reach this view continuously from the previous destination.";

export function showApprovalChrome(agency: Agency, blocked: boolean): boolean {
  return agency === "directed" || blocked;
}

export function journeyIsPlayable(journey: JourneyShot): boolean {
  if (!journey.videoUrl) {
    return false;
  }
  return journey.status === "rendered";
}

export function shootActionReason(journey: JourneyShot | null): string {
  if (!journey) {
    return "Select a blocked journey to shoot.";
  }
  if (journey.status === "shooting") {
    return "Shooting…";
  }
  if (!journey.cinematographer) {
    return "Block this journey before shooting.";
  }
  return "";
}

export function productionUnavailableReason(journey: JourneyShot | null): string {
  return shootActionReason(journey);
}
