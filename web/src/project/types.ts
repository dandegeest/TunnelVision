export type Agency = "directed" | "autonomous";
export type Construction = "planned" | "discovery";

export type DestinationStatus =
  | "planned"
  | "generating"
  | "generated"
  | "ready"
  | "needs_attention"
  | "regenerating";

export type JourneyStatus =
  | "unplanned"
  | "planned"
  | "ready"
  | "shooting"
  | "rendered"
  | "failed"
  | "invalidated"
  | "not_shootable"
  | "needs_review";

export type Destination = {
  id: string;
  label: string;
  image: string;
  status: DestinationStatus;
};

/** How a Plan storyboard image entered the project. Stored explicitly; never inferred from assets. */
export type StoryboardImageOrigin = "user" | "generated" | "none";

/**
 * Director-level beat in Plan. Not a production Destination, Camotion input, or shooting frame.
 * Sequence is the array order on `Project.storyboard`.
 */
export type StoryboardFrame = {
  id: string;
  label: string;
  intent: string;
  image?: string;
  imageOrigin: StoryboardImageOrigin;
  /** Trusted server media identity. Opaque; never a filesystem path. */
  mediaId?: string;
  /** Director visual description for a planned beat. Absent on the filmmaker starting frame. */
  visualDescription?: string;
  destinationId?: string;
};

export type JourneyShot = {
  id: string;
  startDestinationId: string;
  endDestinationId: string | null;
  durationSeconds: number;
  status: JourneyStatus;
  videoUrl?: string;
  shootabilityNote?: string;
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
