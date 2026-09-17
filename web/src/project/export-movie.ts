import { journeyIsPlayable } from "./policy";
import { selectedTakeVideoUrl } from "./takes";
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
    if (journeyIsPlayable(journey)) {
      const videoUrl = selectedTakeVideoUrl(journey);
      if (videoUrl) {
        included.push({
          journeyId: journey.id,
          startDestinationId: journey.startDestinationId,
          endDestinationId,
          videoUrl,
        });
        continue;
      }
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

export async function requestDownloadCurrentCut(
  project: Project,
  previousFilename?: string,
): Promise<MovieExportResult> {
  const plan = movieExportPlan(project);
  if (plan.included.length < 1 || plan.missing.length > 0) {
    throw new Error("DOWNLOAD needs a selected Take on every required segment.");
  }
  return requestExportMovie(project, previousFilename);
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

export const MOVIE_EXPORT_SLUG_MAX = 32;
const MOVIE_EXPORT_FILENAME = /^[A-Za-z0-9]{1,32}_v\d+\.mp4$/;

export function movieExportSlug(title: string): string {
  const compact = title.replace(/[^A-Za-z0-9]+/g, "");
  const clipped = compact.slice(0, MOVIE_EXPORT_SLUG_MAX);
  return clipped || "Untitled";
}

export function isMovieExportFilename(value: unknown): value is string {
  return typeof value === "string" && MOVIE_EXPORT_FILENAME.test(value);
}

export function nextMovieExportFilename(title: string, previousFilename?: string): string {
  const slug = movieExportSlug(title);
  const match = previousFilename?.match(/^([A-Za-z0-9]{1,32})_v(\d+)\.mp4$/);
  const nextVersion = match && match[1] === slug ? Number(match[2]) + 1 : 1;
  return `${slug}_v${nextVersion}.mp4`;
}

export async function requestExportMovie(
  project: Project,
  previousFilename?: string,
): Promise<MovieExportResult> {
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
      filename: nextMovieExportFilename(project.title, previousFilename),
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
