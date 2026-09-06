import type { Agency, JourneyShot } from "./types";

export function showApprovalChrome(agency: Agency, blocked: boolean): boolean {
  return agency === "directed" || blocked;
}

export function journeyIsBlocked(journey: JourneyShot): boolean {
  return journey.status === "not_shootable";
}

export function journeyIsPlayable(journey: JourneyShot): boolean {
  if (!journey.videoUrl) {
    return false;
  }
  return journey.status === "rendered" || journey.status === "needs_review";
}

export function productionUnavailableReason(journey: JourneyShot | null): string {
  if (journey && journey.status === "not_shootable") {
    return "This journey is not shootable. Generation is not connected in this slice.";
  }
  return "Shoot This Shot and Shoot Movie are labeled for the product, but generation is not connected in this slice.";
}
