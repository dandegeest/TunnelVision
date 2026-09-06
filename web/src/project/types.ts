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
  destinations: Destination[];
  journeys: JourneyShot[];
};

export type Selection =
  | { kind: "destination"; destinationId: string; occurrenceIndex: number }
  | { kind: "journey"; journeyId: string };

export function destinationById(
  destinations: Destination[],
  id: string,
): Destination | undefined {
  return destinations.find((destination) => destination.id === id);
}
