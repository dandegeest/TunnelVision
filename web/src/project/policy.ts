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

export function productionUnavailableReason(_journey: JourneyShot | null): string {
  return "Shoot This Shot and Shoot Movie are labeled for the product, but generation is not connected in this slice.";
}
