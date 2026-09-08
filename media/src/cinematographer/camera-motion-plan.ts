import { BASELINE_EXPOSURE, BASELINE_FORWARD, type CameraMotionPlanV1 } from "./plan-shot.ts";

/**
 * Narrowest production-safe CameraMotionPlan v1 for Shoot.
 *
 * Production Cinematographer assessment is semantic choreography
 * (route, camera, segmentPromptAddition). It does not emit vanishing
 * points, bboxes, or Camotion strength numbers. The Integration Test 01
 * vision pair planner is research evidence, not this product path.
 *
 * Assumption for this PR: centered radial-forward v1 with pinned
 * `forward=1.0` and 01.8 STRONG exposure (`0.08` / 16 samples). The
 * same plan is used for A′ and B′. Strength is not yet chosen from the
 * LIGHT/MEDIUM/STRONG vocabulary here because the production assessment
 * does not carry a numeric strength. Do not treat this as CV measurement
 * or as CM prompt tuning.
 */
export const PRODUCTION_CAMOTION_FORWARD = BASELINE_FORWARD;
export const PRODUCTION_CAMOTION_EXPOSURE = BASELINE_EXPOSURE;
export const PRODUCTION_CAMOTION_CENTER = [0.5, 0.5] as const;
export const PRODUCTION_CAMOTION_BBOX = [0.25, 0.2, 0.75, 0.8] as const;

export function productionCameraMotionPlan(): CameraMotionPlanV1 {
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
    exposure: {
      strength: PRODUCTION_CAMOTION_EXPOSURE.strength,
      samples: PRODUCTION_CAMOTION_EXPOSURE.samples,
    },
  };
}
