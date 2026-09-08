import { journeyIsPlayable } from "./policy";
import type { BoundaryAnalysisRecord, Project, VideoRaster } from "./types";

/**
 * Heuristic MAE bands for filmmaker-readable labels.
 * Informed by Forest A→F forensic measurements; not a validated quality scale.
 */
export const BOUNDARY_MAE_HEURISTIC = {
  strongMax: 2,
  goodMax: 4,
  reviewMax: 8,
} as const;

export type BoundaryContinuityClassification = "strong" | "good" | "review" | "mismatch";

export type BoundaryContinuity = BoundaryAnalysisRecord & {
  classification: BoundaryContinuityClassification;
  rasterMismatch: boolean;
};

export function rastersMatch(a: VideoRaster, b: VideoRaster): boolean {
  return a.width === b.width && a.height === b.height;
}

export function classifyBoundaryMae(mae: number): BoundaryContinuityClassification {
  if (mae <= BOUNDARY_MAE_HEURISTIC.strongMax) {
    return "strong";
  }
  if (mae <= BOUNDARY_MAE_HEURISTIC.goodMax) {
    return "good";
  }
  if (mae <= BOUNDARY_MAE_HEURISTIC.reviewMax) {
    return "review";
  }
  return "mismatch";
}

export function boundaryContinuityLabel(classification: BoundaryContinuityClassification): string {
  switch (classification) {
    case "strong":
      return "Strong";
    case "good":
      return "Good";
    case "review":
      return "Review";
    case "mismatch":
      return "Mismatch";
  }
}

export function formatRaster(raster: VideoRaster): string {
  return `${raster.width}×${raster.height}`;
}

export function boundaryContinuityFromRecord(record: BoundaryAnalysisRecord): BoundaryContinuity {
  return {
    ...record,
    classification: classifyBoundaryMae(record.mae),
    rasterMismatch: !rastersMatch(record.previousRaster, record.nextRaster),
  };
}

export function boundaryContinuitiesForProject(project: Project): BoundaryContinuity[] {
  const records = project.boundaryAnalysis ?? [];
  return records.flatMap((record) => {
    const previous = project.journeys.find((journey) => journey.id === record.previousJourneyId);
    const next = project.journeys.find((journey) => journey.id === record.nextJourneyId);
    if (!previous || !next) {
      return [];
    }
    if (!journeyIsPlayable(previous) || !journeyIsPlayable(next)) {
      return [];
    }
    if (previous.endDestinationId !== record.sharedDestinationId) {
      return [];
    }
    if (next.startDestinationId !== record.sharedDestinationId) {
      return [];
    }
    return [boundaryContinuityFromRecord(record)];
  });
}

export function boundaryContinuityAtSeam(
  continuities: readonly BoundaryContinuity[],
  sharedDestinationId: string,
  previousJourneyId: string | null,
  nextJourneyId: string | null,
): BoundaryContinuity | undefined {
  if (!previousJourneyId || !nextJourneyId) {
    return undefined;
  }
  return continuities.find(
    (continuity) =>
      continuity.sharedDestinationId === sharedDestinationId &&
      continuity.previousJourneyId === previousJourneyId &&
      continuity.nextJourneyId === nextJourneyId,
  );
}
