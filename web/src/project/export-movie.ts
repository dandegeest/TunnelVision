import { journeyIsPlayable } from "./policy";
import type { Project } from "./types";

export type MovieExportClip = {
  journeyId: string;
  startDestinationId: string;
  endDestinationId: string;
  videoUrl: string;
};

export type MovieExportMissing = {
  journeyId: string;
  startDestinationId: string;
  endDestinationId: string;
};

export type MovieExportPlan = {
  included: MovieExportClip[];
  missing: MovieExportMissing[];
};

export type MovieExportResult = {
  videoUrl: string;
  filename: string;
  complete: boolean;
  includedJourneyIds: string[];
  missingJourneyIds: string[];
};

/** Rendered JourneyShot clips in current journey order, plus legs that exist but have no take. */
export function movieExportPlan(project: Project): MovieExportPlan {
  const included: MovieExportClip[] = [];
  const missing: MovieExportMissing[] = [];
  for (const journey of project.journeys) {
    const endDestinationId = journey.endDestinationId ?? "";
    if (!endDestinationId) {
      continue;
    }
    if (journeyIsPlayable(journey) && journey.videoUrl) {
      included.push({
        journeyId: journey.id,
        startDestinationId: journey.startDestinationId,
        endDestinationId,
        videoUrl: journey.videoUrl,
      });
      continue;
    }
    missing.push({
      journeyId: journey.id,
      startDestinationId: journey.startDestinationId,
      endDestinationId,
    });
  }
  return { included, missing };
}

export function canExportMovie(project: Project): boolean {
  return movieExportPlan(project).included.length > 0;
}

export function exportMovieUnavailableReason(project: Project): string {
  if (!canExportMovie(project)) {
    return "Export Movie needs at least one rendered journey clip.";
  }
  return "";
}

export function describeMovieExport(result: MovieExportResult): string {
  if (result.complete) {
    return "Exported the rendered journey clips in storyboard order.";
  }
  const missing = result.missingJourneyIds.join(", ");
  const count = result.missingJourneyIds.length;
  const legs = count === 1 ? "leg was" : "legs were";
  return `Incomplete export: ${count} ${legs} missing (${missing}). Concatenated the takes that exist.`;
}

export async function requestExportMovie(project: Project): Promise<MovieExportResult> {
  const plan = movieExportPlan(project);
  if (plan.included.length < 1) {
    throw new Error("Export Movie needs at least one rendered journey clip.");
  }
  const response = await fetch("/api/export-movie", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      included: plan.included,
      missingJourneyIds: plan.missing.map((item) => item.journeyId),
    }),
  });
  const body = (await response.json()) as MovieExportResult | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body && body.error ? body.error : "Movie export failed");
  }
  if (!("videoUrl" in body) || !body.videoUrl) {
    throw new Error("Movie export failed");
  }
  return body;
}
