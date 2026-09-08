import canonicalA from "../../../camotion/integration/forest-a-to-f/canonical/A.jpg";
import canonicalB from "../../../camotion/integration/forest-a-to-f/canonical/B.png";
import canonicalC from "../../../camotion/integration/forest-a-to-f/canonical/C.png";
import canonicalD from "../../../camotion/integration/forest-a-to-f/canonical/D.png";
import canonicalE from "../../../camotion/integration/forest-a-to-f/canonical/E.png";
import canonicalF from "../../../camotion/integration/forest-a-to-f/canonical/F.png";
import videoAB from "../../../camotion/integration/forest-a-to-f/videos/A-B.mp4";
import videoBC from "../../../camotion/integration/forest-a-to-f/videos/B-C.mp4";
import videoCD from "../../../camotion/integration/forest-a-to-f/videos/C-D.mp4";
import videoDE from "../../../camotion/integration/forest-a-to-f/videos/D-E.mp4";
import videoEF from "../../../camotion/integration/forest-a-to-f/videos/E-F.mp4";
import type { BoundaryAnalysisRecord, Project, StoryboardMediaInfo } from "../project/types";
import { TRUSTED_MEDIA_IDS } from "../project/trusted-media-id";
import { DEFAULT_DURATION_SECONDS } from "../timeline/geometry";

/** Fixture initialization only. Not runtime Director authority. */
export const FOREST_USER_PROMPT =
  "Travel forward through this night forest and keep going. The journey should stay physically continuous, passing through openings and tunnels, and become stranger the deeper it goes.";

export const FOREST_STORYBOARD_INTENTS = {
  A: "Night forest path toward the tree-trunk / root gateway in mist.",
  B: "Root-tunnel mouth. The dark opening is slightly right of center.",
  C: "Centered circular root tunnel.",
  D: "Root tunnel with a large glowing crystal cluster occupying the path.",
  E: "Dark reflective corridor toward a tall vertical portal.",
  F: "Open void / debris field around a central light.",
} as const;

const MEDIA_A: StoryboardMediaInfo = { width: 1000, height: 558, format: "jpeg" };
const MEDIA_DERIVED: StoryboardMediaInfo = { width: 1392, height: 752, format: "png" };

const RASTER_AB = { width: 1284, height: 716 };
const RASTER_LATER = { width: 1306, height: 706 };

/**
 * Measured Forest A→F adjacent-clip seams from committed boundary-analysis.
 * Visual MAE/SSIM only. Not traversal or shootability.
 */
export const FOREST_BOUNDARY_ANALYSIS: readonly BoundaryAnalysisRecord[] = [
  {
    sharedDestinationId: "B",
    previousJourneyId: "A-B",
    nextJourneyId: "B-C",
    metricVersion: "forest-a-to-f-boundary-analysis-v1",
    mae: 1.843159,
    ssim: 0.956575,
    comparison: "previous-final stretch-fitted to next-first",
    previousRaster: RASTER_AB,
    nextRaster: RASTER_LATER,
  },
  {
    sharedDestinationId: "C",
    previousJourneyId: "B-C",
    nextJourneyId: "C-D",
    metricVersion: "forest-a-to-f-boundary-analysis-v1",
    mae: 2.585173,
    ssim: 0.945198,
    comparison: "previous-final vs next-first",
    previousRaster: RASTER_LATER,
    nextRaster: RASTER_LATER,
  },
  {
    sharedDestinationId: "D",
    previousJourneyId: "C-D",
    nextJourneyId: "D-E",
    metricVersion: "forest-a-to-f-boundary-analysis-v1",
    mae: 2.094997,
    ssim: 0.957974,
    comparison: "previous-final vs next-first",
    previousRaster: RASTER_LATER,
    nextRaster: RASTER_LATER,
  },
  {
    sharedDestinationId: "E",
    previousJourneyId: "D-E",
    nextJourneyId: "E-F",
    metricVersion: "forest-a-to-f-boundary-analysis-v1",
    mae: 1.220785,
    ssim: 0.97685,
    comparison: "previous-final vs next-first",
    previousRaster: RASTER_LATER,
    nextRaster: RASTER_LATER,
  },
];

export function createForestProject(): Project {
  return {
    id: "forest-a-to-f",
    title: "FOREST A→F",
    story: FOREST_USER_PROMPT,
    agency: "directed",
    construction: "planned",
    storyboard: [
      {
        id: "A",
        label: "A",
        intent: FOREST_STORYBOARD_INTENTS.A,
        image: canonicalA,
        imageOrigin: "user",
        mediaId: TRUSTED_MEDIA_IDS.forestAtoFA,
        destinationId: "A",
        mediaInfo: MEDIA_A,
      },
      {
        id: "B",
        label: "B",
        intent: FOREST_STORYBOARD_INTENTS.B,
        image: canonicalB,
        imageOrigin: "generated",
        mediaId: TRUSTED_MEDIA_IDS.forestAtoFB,
        destinationId: "B",
        mediaInfo: MEDIA_DERIVED,
      },
      {
        id: "C",
        label: "C",
        intent: FOREST_STORYBOARD_INTENTS.C,
        image: canonicalC,
        imageOrigin: "generated",
        mediaId: TRUSTED_MEDIA_IDS.forestAtoFC,
        destinationId: "C",
        mediaInfo: MEDIA_DERIVED,
      },
      {
        id: "D",
        label: "D",
        intent: FOREST_STORYBOARD_INTENTS.D,
        image: canonicalD,
        imageOrigin: "generated",
        mediaId: TRUSTED_MEDIA_IDS.forestAtoFD,
        destinationId: "D",
        mediaInfo: MEDIA_DERIVED,
      },
      {
        id: "E",
        label: "E",
        intent: FOREST_STORYBOARD_INTENTS.E,
        image: canonicalE,
        imageOrigin: "generated",
        mediaId: TRUSTED_MEDIA_IDS.forestAtoFE,
        destinationId: "E",
        mediaInfo: MEDIA_DERIVED,
      },
      {
        id: "F",
        label: "F",
        intent: FOREST_STORYBOARD_INTENTS.F,
        image: canonicalF,
        imageOrigin: "generated",
        mediaId: TRUSTED_MEDIA_IDS.forestAtoFF,
        destinationId: "F",
        mediaInfo: MEDIA_DERIVED,
      },
    ],
    destinations: [
      { id: "A", label: "A", image: canonicalA, status: "ready" },
      { id: "B", label: "B", image: canonicalB, status: "ready" },
      { id: "C", label: "C", image: canonicalC, status: "ready" },
      { id: "D", label: "D", image: canonicalD, status: "ready" },
      { id: "E", label: "E", image: canonicalE, status: "ready" },
      { id: "F", label: "F", image: canonicalF, status: "ready" },
    ],
    journeys: [
      {
        id: "A-B",
        startDestinationId: "A",
        endDestinationId: "B",
        durationSeconds: DEFAULT_DURATION_SECONDS,
        status: "rendered",
        videoUrl: videoAB,
      },
      {
        id: "B-C",
        startDestinationId: "B",
        endDestinationId: "C",
        durationSeconds: DEFAULT_DURATION_SECONDS,
        status: "rendered",
        videoUrl: videoBC,
      },
      {
        id: "C-D",
        startDestinationId: "C",
        endDestinationId: "D",
        durationSeconds: DEFAULT_DURATION_SECONDS,
        status: "rendered",
        videoUrl: videoCD,
      },
      {
        id: "D-E",
        startDestinationId: "D",
        endDestinationId: "E",
        durationSeconds: DEFAULT_DURATION_SECONDS,
        status: "rendered",
        videoUrl: videoDE,
      },
      {
        id: "E-F",
        startDestinationId: "E",
        endDestinationId: "F",
        durationSeconds: DEFAULT_DURATION_SECONDS,
        status: "rendered",
        videoUrl: videoEF,
      },
    ],
    boundaryAnalysis: [...FOREST_BOUNDARY_ANALYSIS],
  };
}
