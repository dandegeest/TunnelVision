import { isTrustedMediaIdShape } from "./trusted-media-id";
import type { Destination, JourneyShot, Project, StoryboardFrame } from "./types";
import { DEFAULT_DURATION_SECONDS } from "../timeline/geometry";

export type ProductionEndpoint = StoryboardFrame & { image: string; mediaId: string };

export type ProductionPair = {
  start: ProductionEndpoint;
  end: ProductionEndpoint;
};

/** Actual trusted canonical still that can anchor a directed production leg. */
export function isProductionEndpoint(frame: StoryboardFrame | undefined): frame is ProductionEndpoint {
  return Boolean(
    frame &&
      (frame.imageOrigin === "user" || frame.imageOrigin === "generated") &&
      frame.image &&
      isTrustedMediaIdShape(frame.mediaId),
  );
}

export function productionDestinationId(frame: StoryboardFrame): string {
  return frame.destinationId ?? frame.id;
}

/**
 * Consecutive storyboard neighbors that are both actual canonicals.
 * Does not skip an unresolved beat. A-only and A→unresolved-B produce no pairs.
 */
export function consecutiveProductionPairs(project: Project): ProductionPair[] {
  const pairs: ProductionPair[] = [];
  for (let index = 0; index < project.storyboard.length - 1; index += 1) {
    const start = project.storyboard[index];
    const end = project.storyboard[index + 1];
    if (isProductionEndpoint(start) && isProductionEndpoint(end)) {
      pairs.push({ start, end });
    }
  }
  return pairs;
}

function upsertDestination(existing: Destination | undefined, frame: ProductionEndpoint): Destination {
  return {
    id: productionDestinationId(frame),
    label: frame.label,
    image: frame.image,
    status: existing?.status ?? "ready",
  };
}

function freshProductionJourney(
  startDestinationId: string,
  endDestinationId: string | null,
  durationSeconds: number,
): JourneyShot {
  return {
    id: endDestinationId ? `${startDestinationId}-${endDestinationId}` : startDestinationId,
    startDestinationId,
    endDestinationId,
    durationSeconds,
    status: "ready",
  };
}

function destinationImageChanged(
  previous: Map<string, Destination>,
  next: Map<string, Destination>,
  id: string | null,
): boolean {
  if (!id) {
    return false;
  }
  const before = previous.get(id);
  const after = next.get(id);
  return Boolean(before && after && before.image !== after.image);
}

function journeyCanonicalsChanged(
  journey: Pick<JourneyShot, "startDestinationId" | "endDestinationId">,
  previous: Map<string, Destination>,
  next: Map<string, Destination>,
): boolean {
  return (
    destinationImageChanged(previous, next, journey.startDestinationId) ||
    destinationImageChanged(previous, next, journey.endDestinationId)
  );
}

function upsertJourney(
  existing: JourneyShot | undefined,
  pair: ProductionPair,
  stale: boolean,
): JourneyShot {
  const startDestinationId = productionDestinationId(pair.start);
  const endDestinationId = productionDestinationId(pair.end);
  if (existing && !stale) {
    return {
      ...existing,
      id: `${startDestinationId}-${endDestinationId}`,
      startDestinationId,
      endDestinationId,
    };
  }
  return freshProductionJourney(
    startDestinationId,
    endDestinationId,
    existing?.durationSeconds ?? DEFAULT_DURATION_SECONDS,
  );
}

/**
 * Project Shoot is the current Project's actual adjacent canonicals.
 * Merge into existing destinations/journeys. Do not wipe fixture extras.
 * A-only and unresolved-next remain valid projects with no directed legs.
 * Changing either canonical still returns that leg to not prepared and not shot.
 */
export function projectWithSyncedProductionLegs(project: Project): Project {
  const pairs = consecutiveProductionPairs(project);
  if (pairs.length === 0) {
    return project;
  }

  const destinationsById = new Map(project.destinations.map((destination) => [destination.id, destination]));
  const journeysById = new Map(project.journeys.map((journey) => [journey.id, journey]));
  const endpointOrder: ProductionEndpoint[] = [];
  const seenEndpoints = new Set<string>();

  for (const pair of pairs) {
    for (const frame of [pair.start, pair.end]) {
      const id = productionDestinationId(frame);
      if (seenEndpoints.has(id)) {
        continue;
      }
      seenEndpoints.add(id);
      endpointOrder.push(frame);
    }
  }

  const destinations: Destination[] = endpointOrder.map((frame) =>
    upsertDestination(destinationsById.get(productionDestinationId(frame)), frame),
  );
  for (const destination of project.destinations) {
    if (!seenEndpoints.has(destination.id)) {
      destinations.push(destination);
    }
  }

  const nextDestinationsById = new Map(destinations.map((destination) => [destination.id, destination]));
  const pairIds: string[] = [];
  const journeys: JourneyShot[] = pairs.map((pair) => {
    const startDestinationId = productionDestinationId(pair.start);
    const endDestinationId = productionDestinationId(pair.end);
    const id = `${startDestinationId}-${endDestinationId}`;
    pairIds.push(id);
    const stale =
      destinationImageChanged(destinationsById, nextDestinationsById, startDestinationId) ||
      destinationImageChanged(destinationsById, nextDestinationsById, endDestinationId);
    return upsertJourney(journeysById.get(id), pair, stale);
  });
  for (const journey of project.journeys) {
    if (pairIds.includes(journey.id)) {
      continue;
    }
    if (journeyCanonicalsChanged(journey, destinationsById, nextDestinationsById)) {
      journeys.push(
        freshProductionJourney(
          journey.startDestinationId,
          journey.endDestinationId,
          journey.durationSeconds,
        ),
      );
      continue;
    }
    journeys.push(journey);
  }

  const storyboard = project.storyboard.map((frame) => {
    if (!isProductionEndpoint(frame) || frame.destinationId) {
      return frame;
    }
    return { ...frame, destinationId: frame.id };
  });

  return {
    ...project,
    storyboard,
    destinations,
    journeys,
  };
}
