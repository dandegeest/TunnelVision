import { CAMOTION_EXPOSURE_STRENGTH_BY_PACE } from "../../../media/src/cinematographer/camera-motion-plan.ts";
import { destinationById, type CameraMotionPlanV1, type CamotionDebug, type Destination, type Project, type ShootingFrameRef } from "./types";
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

export function camotionInspectorHeading(
  record: DestinationCamotionRecord,
  destinations: readonly Destination[],
  startDestinationId: string,
  endDestinationId: string | null,
): string {
  const start = destinations.find((item) => item.id === startDestinationId)?.label ?? startDestinationId;
  const end = endDestinationId
    ? (destinations.find((item) => item.id === endDestinationId)?.label ?? endDestinationId)
    : "?";
  return `${record.primedLabel} · ${start}→${end} ${record.role === "start" ? "START" : "END"}`;
}

export function camotionDirectionLabel(
  record: DestinationCamotionRecord,
  travelDirection?: string,
): string | undefined {
  const fromTravel = travelDirection?.trim();
  if (fromTravel) {
    return fromTravel;
  }
  if (record.plan.camera.forward > 0) {
    return "Forward";
  }
  return undefined;
}

export function camotionRetainedWorkDir(record: DestinationCamotionRecord): string | undefined {
  if (!record.camotion) {
    return undefined;
  }
  return record.role === "start" ? record.camotion.startWorkDir : record.camotion.endWorkDir;
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

/** Every stored Camotion frame for this destination, across journeys. */
export function camotionRecordsForCanonical(
  project: Pick<Project, "destinations" | "journeys">,
  destinationId: string,
): DestinationCamotionRecord[] {
  const records: DestinationCamotionRecord[] = [];
  const seen = new Set<string>();
  for (const journey of project.journeys) {
    const inbound = journey.endDestinationId === destinationId ? journey.id : null;
    const outbound = journey.startDestinationId === destinationId ? journey.id : null;
    if (!inbound && !outbound) {
      continue;
    }
    for (const record of camotionRecordsForDestination(project, destinationId, inbound, outbound)) {
      const key = camotionRecordKey(record);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      records.push(record);
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

const PACE_EXPOSURE_LABEL = {
  "slow-motion": "Slow-motion",
  slow: "Slow",
  moderate: "Moderate",
  fast: "Fast",
  hyperspeed: "Hyperspeed",
  variable: "Moderate",
} as const;

function paceExposureBands(): Array<readonly [number, string]> {
  const bands: Array<readonly [number, string]> = [];
  const seen = new Set<number>();
  for (const [pace, strength] of Object.entries(CAMOTION_EXPOSURE_STRENGTH_BY_PACE) as Array<
    [keyof typeof CAMOTION_EXPOSURE_STRENGTH_BY_PACE, number]
  >) {
    if (seen.has(strength)) {
      continue;
    }
    seen.add(strength);
    bands.push([strength, PACE_EXPOSURE_LABEL[pace]]);
  }
  return bands;
}

const EXPOSURE_BANDS: ReadonlyArray<readonly [number, string]> = [...paceExposureBands(), [0.02, "Light"]];

function formatExposureNumber(strength: number): string {
  const mapped = EXPOSURE_BANDS.find(([value]) => Math.abs(strength - value) < 1e-9);
  if (mapped && mapped[0] !== 0.02) {
    return mapped[0].toFixed(3);
  }
  return formatPlanScalar(strength);
}

export function formatExposureStrength(strength: number): string {
  const band = EXPOSURE_BANDS.find(([value]) => Math.abs(strength - value) < 1e-9)?.[1];
  const shown = formatExposureNumber(strength);
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
