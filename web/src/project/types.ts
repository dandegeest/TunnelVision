export type Agency = "directed" | "autonomous";
export type Construction = "planned" | "discovery";

export type DestinationStatus =
  | "planned"
  | "generating"
  | "generated"
  | "ready"
  | "needs_attention"
  | "regenerating";

/** Production/execution state. Not Cinematographer shootability. */
export type JourneyStatus =
  | "unplanned"
  | "planned"
  | "ready"
  | "shooting"
  | "rendered"
  | "failed"
  | "invalidated";

/**
 * Advisory Cinematographer set analysis of one actual adjacent pair.
 * Shootability does not gate JourneyShot.status or video generation.
 * Not CameraMotionPlan.
 */
export type CinematographerShootability = "shootable" | "needs_review" | "not_shootable";
export type CinematographerCamotionSuitability = "appropriate" | "poor_fit" | "uncertain";

export type CinematographerAssessment = {
  shootability: CinematographerShootability;
  summary: string;
  route: string;
  threshold: string;
  camera: string;
  parallax: string;
  transitionStrategy: string;
  segmentPromptAddition: string;
  camotionSuitability: CinematographerCamotionSuitability;
  concerns: string[];
};

export type Destination = {
  id: string;
  label: string;
  image: string;
  status: DestinationStatus;
};

/** How a Plan storyboard image entered the project. Stored explicitly; never inferred from assets. */
export type StoryboardImageOrigin = "user" | "generated" | "none";

export type MediaFormat = "jpeg" | "png" | "webp";

/** Raster and container facts for an actual storyboard still. Filmmaker media remains authoritative. */
export type StoryboardMediaInfo = {
  width: number;
  height: number;
  format: MediaFormat;
};

export type VideoRaster = {
  width: number;
  height: number;
};

/**
 * Measured visual match of adjacent completed Journey clips at their shared
 * destination. Not spatial traversability, shot quality, or shootability.
 */
export type BoundaryAnalysisRecord = {
  sharedDestinationId: string;
  previousJourneyId: string;
  nextJourneyId: string;
  metricVersion: string;
  mae: number;
  ssim?: number;
  comparison: string;
  previousRaster: VideoRaster;
  nextRaster: VideoRaster;
};

/**
 * Director-level beat in Plan. Not a production Destination, Camotion input, or shooting frame.
 * Sequence is the array order on `Project.storyboard`.
 */
export type StoryboardFrame = {
  id: string;
  label: string;
  /** Director beat intent. Absent on a replaced starting frame until the filmmaker supplies one. */
  intent?: string;
  image?: string;
  imageOrigin: StoryboardImageOrigin;
  /** Trusted server media identity. Opaque; never a filesystem path. */
  mediaId?: string;
  /** Director visual description for a planned beat. Absent on the filmmaker starting frame. */
  visualDescription?: string;
  destinationId?: string;
  /** Present only when dimensions/format are known. Missing facts do not invent preflight warnings. */
  mediaInfo?: StoryboardMediaInfo;
};

export type JourneyShot = {
  id: string;
  startDestinationId: string;
  endDestinationId: string | null;
  durationSeconds: number;
  status: JourneyStatus;
  videoUrl?: string;
  shootabilityNote?: string;
  /**
   * Actual-set Cinematographer choreography for this leg. Absent until analyzed.
   * Shootability on this object is advisory and must not replace `status`.
   */
  cinematographer?: CinematographerAssessment;
};

export type Project = {
  id: string;
  title: string;
  story: string;
  agency: Agency;
  construction: Construction;
  storyboard: StoryboardFrame[];
  destinations: Destination[];
  journeys: JourneyShot[];
  /** Optional measured seam evidence. Display is derived; the UI does not decode videos. */
  boundaryAnalysis?: BoundaryAnalysisRecord[];
};

export type Selection =
  | { kind: "storyboard"; frameId: string }
  | { kind: "destination"; destinationId: string; occurrenceIndex: number }
  | { kind: "journey"; journeyId: string };

export function destinationById(
  destinations: Destination[],
  id: string,
): Destination | undefined {
  return destinations.find((destination) => destination.id === id);
}

export function storyboardFrameById(
  frames: StoryboardFrame[],
  id: string,
): StoryboardFrame | undefined {
  return frames.find((frame) => frame.id === id);
}
