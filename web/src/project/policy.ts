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
    return "Select a staged journey to generate.";
  }
  if (journey.status === "shooting") {
    return "Generating…";
  }
  if (!journey.cinematographer) {
    return "Stage this journey before generating.";
  }
  return "";
}

export function productionUnavailableReason(journey: JourneyShot | null): string {
  return shootActionReason(journey);
}
