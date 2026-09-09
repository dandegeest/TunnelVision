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

/** CameraMotionPlan v1 JSON stored as take evidence. Frozen Camotion contract. */
export type CameraMotionPlanV1 = {
  version: 1;
  camera: {
    vanishing_point: readonly [number, number];
    forward: number;
  };
  destination: {
    point: readonly [number, number];
    protect: boolean;
    bbox: readonly [number, number, number, number];
  };
  exposure: {
    strength: number;
    samples: number;
  };
};

export type ShootingFrameRef = {
  mediaId: string;
  imageUrl: string;
};

/**
 * Local Camotion scratch for one take. Present after SHOOT. Work dirs exist
 * on disk only when Debug retained them; otherwise they were deleted after A′/B′
 * were copied into the session store.
 */
export type CamotionDebug = {
  startWorkDir?: string;
  endWorkDir?: string;
  startOutput?: string;
  endOutput?: string;
  /** Product shoot does not pass --depth and Camotion does not estimate depth. */
  depthSupplied: false;
  depthPath: null;
  workDirRetained: boolean;
};

/**
 * One current take for a JourneyShot. Not a parallel clip model.
 * Session/in-memory; provider URLs are allowed until Node persistence exists.
 */
export type JourneyShotTake = {
  startShootingFrame: ShootingFrameRef;
  endShootingFrame: ShootingFrameRef;
  startPlan: CameraMotionPlanV1;
  endPlan: CameraMotionPlanV1;
  segmentPromptAddition: string;
  effectivePrompt: string;
  provider: string;
  model: string;
  modelVersion: string | null;
  durationSeconds: number;
  seed?: number;
  providerOutputUrl?: string;
  /** Directed Shoot sends A′ as the start image and B′ as the last-frame condition. */
  videoInputs: { startShootingFrame: true; endShootingFrame: boolean };
  camotion?: CamotionDebug;
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
  /**
   * Generation inputs that produced the current still. Used to detect a plan
   * that changed after the image was made. Absent on uploads and unresolved FPO.
   */
  generatedFrom?: string;
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
  /** Latest successful or inspectable take. Absent until SHOOT completes. */
  take?: JourneyShotTake;
  shootError?: string;
};

/** AUTO lets the Director choose N destinations. A number is an exact storyboard length. */
export type StoryDuration = "auto" | number;

export type Project = {
  id: string;
  title: string;
  story: string;
  agency: Agency;
  construction: Construction;
  /** AUTO, or an exact destination count. After the first Director plan this follows the storyboard. */
  storyDuration: StoryDuration;
  /** When true, PLAN generates unresolved A from the story before Director planning. */
  autoGenerateOpening: boolean;
  /** When true, PLAN then generates B…N in travel order from each preceding actual frame. */
  autoGenerateAllDestinations: boolean;
  /** When true, PLAN then blocks every actual adjacent journey after destinations exist. */
  autoBlockShots: boolean;
  /** When true, PLAN then shoots blocked journeys, including those with CM warnings. */
  autoShoot: boolean;
  /** After the first successful Director plan, duration is storyboard-driven and not typed. */
  storyDurationLocked: boolean;
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

export function storyboardFrameForDestination(
  frames: StoryboardFrame[],
  destinationId: string,
): StoryboardFrame | undefined {
  return (
    frames.find((frame) => frame.destinationId === destinationId) ??
    frames.find((frame) => frame.id === destinationId)
  );
}
