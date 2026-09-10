import { destinationById, type CameraMotionPlanV1, type CamotionDebug, type Project, type ShootingFrameRef } from "./types";
import { segmentCamotionSource } from "./motion-plan";

export type DestinationCamotionRole = "start" | "end";

/** One Camotion-conditioned frame already stored on this segment's Motion Plan (or take). */
export type DestinationCamotionRecord = {
  destinationId: string;
  destinationLabel: string;
  primedLabel: string;
  journeyId: string;
  role: DestinationCamotionRole;
  shootingFrame: ShootingFrameRef;
  plan: CameraMotionPlanV1;
  camotion?: CamotionDebug;
};

export const NO_CAMOTION_DATA = "No Camotion data for this destination";

export function camotionRecordKey(record: DestinationCamotionRecord): string {
  return `${record.journeyId}:${record.role}`;
}

export function camotionSourceLabel(record: DestinationCamotionRecord): string {
  return record.role === "start" ? `${record.journeyId} start′` : `${record.journeyId} end′`;
}

export function preferredCamotionRecord(
  records: readonly DestinationCamotionRecord[],
): DestinationCamotionRecord | undefined {
  return records.find((record) => record.role === "start") ?? records[0];
}

/**
 * Camotion output for one Shoot destination occurrence.
 * Reads the segment Motion Plan, then take evidence. Does not invent plans or conditioned stills.
 */
export function camotionRecordsForDestination(
  project: Pick<Project, "destinations" | "journeys">,
  destinationId: string,
  inboundJourneyId: string | null,
  outboundJourneyId: string | null,
): DestinationCamotionRecord[] {
  const label = destinationById(project.destinations, destinationId)?.label ?? destinationId;
  const primedLabel = `${label}′`;
  const records: DestinationCamotionRecord[] = [];
  for (const journeyId of [inboundJourneyId, outboundJourneyId]) {
    if (!journeyId) {
      continue;
    }
    const journey = project.journeys.find((item) => item.id === journeyId);
    const source = segmentCamotionSource(journey);
    if (!journey || !source) {
      continue;
    }
    if (journey.startDestinationId === destinationId) {
      records.push({
        destinationId,
        destinationLabel: label,
        primedLabel,
        journeyId,
        role: "start",
        shootingFrame: source.startShootingFrame,
        plan: source.startPlan,
        camotion: source.camotion,
      });
    }
    if (journey.endDestinationId === destinationId) {
      records.push({
        destinationId,
        destinationLabel: label,
        primedLabel,
        journeyId,
        role: "end",
        shootingFrame: source.endShootingFrame,
        plan: source.endPlan,
        camotion: source.camotion,
      });
    }
  }
  return records;
}

export function camotionRecordsForJourney(
  project: Pick<Project, "destinations" | "journeys">,
  journeyId: string,
): DestinationCamotionRecord[] {
  const journey = project.journeys.find((item) => item.id === journeyId);
  if (!journey) {
    return [];
  }
  return [
    ...camotionRecordsForDestination(project, journey.startDestinationId, null, journey.id),
    ...(journey.endDestinationId
      ? camotionRecordsForDestination(project, journey.endDestinationId, journey.id, null)
      : []),
  ];
}

export function formatPlanPoint(point: readonly [number, number]): string {
  return `${formatPlanScalar(point[0])}, ${formatPlanScalar(point[1])}`;
}

export function formatPlanBox(box: readonly [number, number, number, number]): string {
  return box.map((value) => formatPlanScalar(value)).join(", ");
}

export function formatPlanScalar(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2);
}

export function formatExposureStrength(strength: number): string {
  const band = strength === 0.02 ? "Light" : strength === 0.04 ? "Medium" : strength === 0.08 ? "Strong" : null;
  const shown = formatPlanScalar(strength);
  return band ? `${shown} · ${band}` : shown;
}

export function camotionGeneratedPath(record: DestinationCamotionRecord): string | undefined {
  if (!record.camotion) {
    return undefined;
  }
  return record.role === "start" ? record.camotion.startOutput : record.camotion.endOutput;
}

export function camotionWorkPath(record: DestinationCamotionRecord): string | undefined {
  if (!record.camotion) {
    return undefined;
  }
  const path = record.role === "start" ? record.camotion.startWorkDir : record.camotion.endWorkDir;
  if (path) {
    return path;
  }
  if (!record.camotion.workDirRetained) {
    return "Deleted after copy (Debug was off)";
  }
  return undefined;
}
