import type { CinematographerTravelTarget } from "./assess-journey.ts";
import { BASELINE_EXPOSURE, BASELINE_FORWARD, type CameraMotionPlanV1 } from "./plan-shot.ts";
import { DEFAULT_LOCOMOTION_PACE, isLocomotionPace, type LocomotionPace } from "./shooting-prompt.ts";

/**
 * Production CameraMotionPlan v1 for Shoot.
 *
 * Cinematographer assessment is semantic choreography, including optional
 * per-still travel geometry (VP / semantic target / heading). It does not
 * emit CameraMotionPlan JSON, `forward`, or Camotion strength. A
 * deterministic bridge (`cameraMotionPlansFromAssessment`) pins
 * `forward=1.0` and 16 samples, maps CM `pace` to exposure strength, and
 * fills vanishing_point / destination from that travel object.
 *
 * `productionCameraMotionPlan` remains the centered fallback when CM
 * cannot determine a better target for that still. The Integration Test
 * 01 vision pair planner is research evidence, not this product path.
 */
export const PRODUCTION_CAMOTION_FORWARD = BASELINE_FORWARD;
export const PRODUCTION_CAMOTION_EXPOSURE = BASELINE_EXPOSURE;
export const CAMOTION_EXPOSURE_STRENGTH_BY_PACE = {
  "slow-motion": 0.015,
  slow: 0.025,
  moderate: 0.04,
  fast: 0.06,
  hyperspeed: 0.08,
  variable: 0.04,
} as const satisfies Record<LocomotionPace, number>;
export const PRODUCTION_CAMOTION_CENTER = [0.5, 0.5] as const;
export const PRODUCTION_CAMOTION_BBOX = [0.25, 0.2, 0.75, 0.8] as const;
/** DATA_MODEL default protect square half-extent around destination.point. */
export const PRODUCTION_CAMOTION_BBOX_HALF_EXTENT = 0.1;
const COINCIDENT = 1e-6;
const VECTOR_NEAR_OFFSET = 0.12;

/** Deterministic CM pace → Camotion exposure.strength. Samples stay 01.8. */
export function camotionExposureStrengthFromPace(pace: LocomotionPace): number {
  return CAMOTION_EXPOSURE_STRENGTH_BY_PACE[pace];
}

function locomotionPaceFrom(value: unknown): LocomotionPace {
  return isLocomotionPace(value) ? value : DEFAULT_LOCOMOTION_PACE;
}

function exposureFromPace(pace: LocomotionPace) {
  return {
    strength: camotionExposureStrengthFromPace(pace),
    samples: PRODUCTION_CAMOTION_EXPOSURE.samples,
  };
}

export function productionCameraMotionPlan(pace: LocomotionPace = DEFAULT_LOCOMOTION_PACE): CameraMotionPlanV1 {
  const exposure = exposureFromPace(pace);
  return {
    version: 1,
    camera: {
      vanishing_point: PRODUCTION_CAMOTION_CENTER,
      forward: PRODUCTION_CAMOTION_FORWARD,
    },
    destination: {
      point: PRODUCTION_CAMOTION_CENTER,
      protect: true,
      bbox: PRODUCTION_CAMOTION_BBOX,
    },
    exposure,
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function protectBboxAround(point: readonly [number, number]): readonly [number, number, number, number] {
  const half = PRODUCTION_CAMOTION_BBOX_HALF_EXTENT;
  let left = clamp01(point[0] - half);
  let top = clamp01(point[1] - half);
  let right = clamp01(point[0] + half);
  let bottom = clamp01(point[1] + half);
  if (!(left < right)) {
    right = Math.min(1, left + 1e-3);
    left = Math.max(0, right - 1e-3);
  }
  if (!(top < bottom)) {
    bottom = Math.min(1, top + 1e-3);
    top = Math.max(0, bottom - 1e-3);
  }
  return [left, top, right, bottom];
}

function nearPointAlongHeading(
  vanishingPoint: readonly [number, number],
  vector: readonly [number, number],
): readonly [number, number] {
  const length = Math.hypot(vector[0], vector[1]);
  if (length < COINCIDENT) {
    return vanishingPoint;
  }
  return [
    clamp01(vanishingPoint[0] - (vector[0] / length) * VECTOR_NEAR_OFFSET),
    clamp01(vanishingPoint[1] - (vector[1] / length) * VECTOR_NEAR_OFFSET),
  ];
}

export function cameraMotionPlanFromTravelTarget(
  target: CinematographerTravelTarget | undefined,
  pace: LocomotionPace = DEFAULT_LOCOMOTION_PACE,
): CameraMotionPlanV1 {
  if (!target) {
    return productionCameraMotionPlan(pace);
  }
  const vanishingPoint = target.vanishingPoint ?? target.destinationPoint ?? PRODUCTION_CAMOTION_CENTER;
  let destinationPoint = target.destinationPoint ?? target.vanishingPoint ?? PRODUCTION_CAMOTION_CENTER;
  if (
    !target.destinationPoint &&
    target.vector &&
    Math.hypot(destinationPoint[0] - vanishingPoint[0], destinationPoint[1] - vanishingPoint[1]) < COINCIDENT
  ) {
    destinationPoint = nearPointAlongHeading(vanishingPoint, target.vector);
  }
  return {
    version: 1,
    camera: {
      vanishing_point: vanishingPoint,
      forward: PRODUCTION_CAMOTION_FORWARD,
    },
    destination: {
      point: destinationPoint,
      protect: true,
      bbox: target.destinationBbox ?? protectBboxAround(destinationPoint),
    },
    exposure: exposureFromPace(pace),
  };
}

export function cameraMotionPlansFromAssessment(assessment: {
  readonly pace?: LocomotionPace;
  readonly travel?: {
    readonly start?: CinematographerTravelTarget;
    readonly end?: CinematographerTravelTarget;
  };
}): { readonly start: CameraMotionPlanV1; readonly end: CameraMotionPlanV1 } {
  const pace = locomotionPaceFrom(assessment.pace);
  return {
    start: cameraMotionPlanFromTravelTarget(assessment.travel?.start, pace),
    end: cameraMotionPlanFromTravelTarget(assessment.travel?.end, pace),
  };
}
