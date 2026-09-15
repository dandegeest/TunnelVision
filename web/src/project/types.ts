import type { LocomotionPace } from "../../../media/src/cinematographer/shooting-prompt.ts";
import type {
  ImageModelId,
  ImageOutputFormat,
  ImageResolution,
} from "../../../media/src/replicate/image-models.ts";
import type { VideoModelId } from "../../../media/src/replicate/video-models.ts";

export type { ImageModelId, ImageOutputFormat, ImageResolution, LocomotionPace, VideoModelId };
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
export type CinematographerTravelConfidence = "high" | "medium" | "low";

export type CinematographerTravelTarget = {
  vanishingPoint?: readonly [number, number];
  destinationPoint?: readonly [number, number];
  destinationBbox?: readonly [number, number, number, number];
  vector?: readonly [number, number];
  label: string;
};

export type CinematographerTravel = {
  start?: CinematographerTravelTarget;
  end?: CinematographerTravelTarget;
  direction?: string;
  confidence: CinematographerTravelConfidence;
};

export type CinematographerAssessment = {
  shootability: CinematographerShootability;
  /** 0–100. Same visually/spatially consistent environment. Independent of traversalConfidence. */
  setConsistency: number;
  /** 0–100. Plausible continuous camera travel as one shot, even across a surreal threshold. */
  traversalConfidence: number;
  summary: string;
  route: string;
  threshold: string;
  camera: string;
  parallax: string;
  transitionStrategy: string;
  segmentPromptAddition: string;
  /** Apparent camera speed for this shot. Fills {pace} in the locomotion baseline. */
  pace: LocomotionPace;
  concerns: string[];
  /**
   * Semantic travel geometry from the same CM assessment turn.
   * A deterministic bridge turns this into CameraMotionPlan v1.
   */
  travel?: CinematographerTravel;
  /**
   * Canonical repair action for this actual pair. Agent uses score
   * thresholds as the candidate gate, then this field to choose START /
   * END / BOTH.
   */
  repairRecommendation?: "SHOOT" | "RESHOOT_START" | "RESHOOT_END" | "RESHOOT_BOTH";
  /** Concise spatial repair instruction. Present when not SHOOT. */
  repairInstruction?: string;
};

/** CameraMotionPlan v1 JSON stored on the segment Motion Plan. Frozen Camotion contract. */
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
  /** True when at least one canonical supplied a reusable near-weight map. */
  depthSupplied: boolean;
  depthPath?: string | null;
  startDepthPath?: string | null;
  endDepthPath?: string | null;
  workDirRetained: boolean;
};

/**
 * Per-segment Motion Plan for one adjacent canonical pair (A→B, B→C, …).
 * Owned by the JourneyShot, not by either canonical. Canonicals stay pristine.
 * Cinematographer choreography stays semantic; CameraMotionPlan stays Camotion math.
 */
export type SegmentMotionPlan = {
  cinematographer: CinematographerAssessment;
  /** Actual adjacent canonical pair this plan was computed from. */
  startCanonicalMediaId: string;
  endCanonicalMediaId: string;
  startShootingFrame: ShootingFrameRef;
  endShootingFrame: ShootingFrameRef;
  startPlan: CameraMotionPlanV1;
  endPlan: CameraMotionPlanV1;
  segmentPromptAddition: string;
  effectivePrompt: string;
  pace: LocomotionPace;
  camotion?: CamotionDebug;
};

/**
 * One generated traversal of a JourneyShot. Segments keep 0..N Takes;
 * one is selected for FOOTAGE, preview, playback, and export.
 * Session/in-memory; provider URLs are allowed until Node persistence exists.
 * A′/B′ on the take are the shooting frames that were sent to video.
 * Compatibility is the stamped canonical media pair, not the segment letter
 * (`A-B`). Happy path: one pair per letter. Future: a RESHOOT of B creates
 * B2; older Takes stay bound to B1. See BACKLOG non-destructive canonical reshoots.
 */
export type JourneyShotTake = {
  /** Stable id (`A-B:take:1`). Selection identity in the current slot, not a revision id. */
  id?: string;
  /** 1-based TAKE N. */
  number?: number;
  /** Clip URL for this take. Preferred over JourneyShot.videoUrl. */
  videoUrl?: string;
  /**
   * Trusted media id of the start canonical this take was generated from.
   * Absent on legacy footage that only stored `take` / `videoUrl`.
   */
  startCanonicalMediaId?: string;
  /**
   * Trusted media id of the end canonical this take was generated from.
   * A later A→B Take and B→C Take are compatible only when this end id
   * equals the next take's start id.
   */
  endCanonicalMediaId?: string;
  startShootingFrame: ShootingFrameRef;
  endShootingFrame: ShootingFrameRef;
  startPlan: CameraMotionPlanV1;
  endPlan: CameraMotionPlanV1;
  segmentPromptAddition: string;
  effectivePrompt: string;
  pace: LocomotionPace;
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
  /** Director beat intent. Opening A fills this from the journey story when the field is empty. */
  intent?: string;
  image?: string;
  imageOrigin: StoryboardImageOrigin;
  /** Trusted server media identity. Opaque; never a filesystem path. */
  mediaId?: string;
  /**
   * Director visual description for a planned beat. Generated A stores the
   * TunnelVision opening prompt here. Uploaded A leaves this empty unless DIRECT
   * or the filmmaker supplies one.
   */
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
   * Also stored on `motionPlan.cinematographer` once Camotion A′/B′ exist.
   */
  cinematographer?: CinematographerAssessment;
  /**
   * Canonical asset IDs the current `cinematographer` assessment inspected.
   * Repair must ignore the assessment when these no longer match the pair.
   */
  cinematographerStartMediaId?: string;
  cinematographerEndMediaId?: string;
  /**
   * Staged A→B Motion Plan: CM choreography plus this shot's CameraMotionPlan,
   * Camotion parameters, and conditioned S/E frames. Present once an actual
   * adjacent canonical pair exists and planning has completed for that pair.
   */
  motionPlan?: SegmentMotionPlan;
  /** Present after automatic Motion Planning fails for this pair. Cleared on retry or success. */
  motionPlanError?: string;
  /**
   * Generated traversals for this leg. Never overwritten on NEW TAKE.
   * Absent or empty until the first take exists. Legacy `take` / `videoUrl`
   * load as Take 1 via journeyTakes().
   */
  takes?: JourneyShotTake[];
  /** Which take FOOTAGE / preview / export use. Defaults to the newest. */
  selectedTakeId?: string;
  /**
   * Mirror of the selected take for older readers. Prefer journeyTakes() /
   * selectedTake(). Absent until FOOTAGE NEW TAKE completes, except legacy
   * videoUrl-only fixtures. `videoUrl` on the journey is the selected clip.
   */
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
  /** Persistence only. CREATE JOURNEY always generates unresolved A unless A is already actual. */
  autoGenerateOpening: boolean;
  /** When true, DIRECT then generates B…N in travel order from each preceding actual frame. */
  autoGenerateAllDestinations: boolean;
  /** When true, DIRECT then blocks every actual adjacent journey after destinations exist. */
  autoBlockShots: boolean;
  /** When true, DIRECT then shoots blocked journeys, including those with CM warnings. */
  autoShoot: boolean;
  /**
   * Video generator for every SHOOT in this project.
   * Pruna is the development default; mid-tier and Seedance 2.5 are opt-in.
   */
  videoModel: VideoModelId;
  /**
   * Still generator for opening A and later B…N. Nano Banana 2 Lite is
   * the development default; the same model text-to-images A and
   * image-conditions later destinations.
   */
  imageModel: ImageModelId;
  /** PNG is the development default. Shown only when the image model offers jpg and png. */
  imageOutputFormat: ImageOutputFormat;
  /** 1K is the development default. Shown only when the image model offers more than one resolution. */
  imageResolution: ImageResolution;
  /**
   * Aspect of canonical stills used for later generation. 16:9 when TunnelVision
   * generates A; otherwise A's pixel dimensions after upload. Adapters map this
   * onto an explicit provider aspect_ratio.
   */
  canonicalAspectRatio?: { width: number; height: number };
  /** After the first successful Director plan, duration is storyboard-driven and not typed. */
  storyDurationLocked: boolean;
  storyboard: StoryboardFrame[];
  destinations: Destination[];
  journeys: JourneyShot[];
  /** Optional measured seam evidence. Display is derived; the UI does not decode videos. */
  boundaryAnalysis?: BoundaryAnalysisRecord[];
};

/** Which Shoot band is selected for a JourneyShot. UI only; not a project entity. */
export type JourneyBand = "motion" | "footage";

export type Selection =
  | { kind: "storyboard"; frameId: string }
  | { kind: "destination"; destinationId: string; occurrenceIndex: number }
  | { kind: "journey"; journeyId: string; band: JourneyBand };

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
