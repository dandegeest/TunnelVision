import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CAMOTION_EXPOSURE_STRENGTH_BY_PACE,
  PRODUCTION_CAMOTION_BBOX_HALF_EXTENT,
  PRODUCTION_CAMOTION_EXPOSURE,
  PRODUCTION_CAMOTION_FORWARD,
  cameraMotionPlanFromTravelTarget,
  cameraMotionPlansFromAssessment,
  camotionExposureStrengthFromPace,
  productionCameraMotionPlan,
  protectBboxAround,
} from "../src/cinematographer/camera-motion-plan.ts";
import { LOCOMOTION_PACES } from "../src/cinematographer/shooting-prompt.ts";

test("production CameraMotionPlan is frozen centered radial-forward v1", () => {
  const plan = productionCameraMotionPlan();
  assert.equal(plan.version, 1);
  assert.equal(plan.camera.forward, PRODUCTION_CAMOTION_FORWARD);
  assert.deepEqual(plan.camera.vanishing_point, [0.5, 0.5]);
  assert.deepEqual(plan.destination.point, [0.5, 0.5]);
  assert.equal(plan.destination.protect, true);
  assert.equal(plan.exposure.strength, CAMOTION_EXPOSURE_STRENGTH_BY_PACE.fast);
  assert.equal(plan.exposure.samples, 16);
  assert.equal(plan.exposure.samples, PRODUCTION_CAMOTION_EXPOSURE.samples);
  assert.equal("vanishing_point" in plan.camera, true);
  const again = productionCameraMotionPlan();
  assert.deepEqual(plan, again);
});

test("missing CM travel falls back to the centered production plan per side", () => {
  const plans = cameraMotionPlansFromAssessment({});
  assert.deepEqual(plans.start, productionCameraMotionPlan());
  assert.deepEqual(plans.end, productionCameraMotionPlan());
});

test("eye close-up targets the pupil rather than a reflected box", () => {
  const plan = cameraMotionPlanFromTravelTarget({
    vanishingPoint: [0.54, 0.47],
    destinationPoint: [0.54, 0.47],
    vector: [0.02, -0.4],
    label: "pupil, not the reflected window",
  });
  assert.deepEqual(plan.camera.vanishing_point, [0.54, 0.47]);
  assert.deepEqual(plan.destination.point, [0.54, 0.47]);
  assert.equal(plan.camera.forward, PRODUCTION_CAMOTION_FORWARD);
  assert.equal(plan.exposure.strength, CAMOTION_EXPOSURE_STRENGTH_BY_PACE.fast);
  assert.deepEqual(plan.destination.bbox, protectBboxAround([0.54, 0.47]));
});

test("winding-road start and end vanishing points can differ substantially", () => {
  const plans = cameraMotionPlansFromAssessment({
    travel: {
      start: {
        vanishingPoint: [0.78, 0.36],
        destinationPoint: [0.74, 0.42],
        label: "road vanishing on the right bend",
      },
      end: {
        vanishingPoint: [0.22, 0.4],
        destinationPoint: [0.26, 0.46],
        label: "road vanishing after the left sweep",
      },
    },
  });
  assert.deepEqual(plans.start.camera.vanishing_point, [0.78, 0.36]);
  assert.deepEqual(plans.end.camera.vanishing_point, [0.22, 0.4]);
  assert.notDeepEqual(plans.start.camera.vanishing_point, plans.end.camera.vanishing_point);
  assert.notDeepEqual(plans.start.camera.vanishing_point, [0.5, 0.5]);
  assert.equal(plans.start.camera.forward, PRODUCTION_CAMOTION_FORWARD);
  assert.equal(plans.end.exposure.samples, 16);
});

test("tunnel and portal targets use the traversable opening", () => {
  const tunnel = cameraMotionPlanFromTravelTarget({
    vanishingPoint: [0.48, 0.52],
    destinationPoint: [0.48, 0.58],
    destinationBbox: [0.4, 0.45, 0.56, 0.72],
    label: "dark tunnel threshold",
  });
  assert.deepEqual(tunnel.destination.bbox, [0.4, 0.45, 0.56, 0.72]);
  const portal = cameraMotionPlanFromTravelTarget({
    vanishingPoint: [0.67, 0.31],
    destinationPoint: [0.67, 0.31],
    label: "fantasy portal, not the surrounding wall",
  });
  assert.deepEqual(portal.camera.vanishing_point, [0.67, 0.31]);
});

test("a travel vector encodes heading only when destinationPoint is omitted", () => {
  const withDest = cameraMotionPlanFromTravelTarget({
    vanishingPoint: [0.54, 0.47],
    destinationPoint: [0.54, 0.47],
    vector: [0, -1],
    label: "pupil",
  });
  assert.deepEqual(withDest.destination.point, [0.54, 0.47]);
  const headingOnly = cameraMotionPlanFromTravelTarget({
    vanishingPoint: [0.72, 0.3],
    vector: [0.3, -0.5],
    label: "road vanishing",
  });
  assert.deepEqual(headingOnly.camera.vanishing_point, [0.72, 0.3]);
  assert.notDeepEqual(headingOnly.destination.point, headingOnly.camera.vanishing_point);
});

test("default protect bbox is a clipped 0.10 half-extent square", () => {
  assert.equal(PRODUCTION_CAMOTION_BBOX_HALF_EXTENT, 0.1);
  assert.deepEqual(protectBboxAround([0.5, 0.5]), [0.4, 0.4, 0.6, 0.6]);
  assert.deepEqual(protectBboxAround([0.04, 0.5]), [0, 0.4, 0.14, 0.6]);
});

test("CM pace maps to Camotion exposure strength on both plans", () => {
  const expected = {
    "slow-motion": 0.015,
    slow: 0.025,
    moderate: 0.04,
    fast: 0.06,
    hyperspeed: 0.08,
    variable: 0.04,
  } as const;
  assert.deepEqual({ ...CAMOTION_EXPOSURE_STRENGTH_BY_PACE }, expected);
  for (const pace of LOCOMOTION_PACES) {
    const strength = expected[pace];
    assert.equal(camotionExposureStrengthFromPace(pace), strength);
    const centered = productionCameraMotionPlan(pace);
    assert.equal(centered.exposure.strength, strength);
    assert.equal(centered.exposure.samples, 16);
    assert.equal(centered.camera.forward, PRODUCTION_CAMOTION_FORWARD);
    const plans = cameraMotionPlansFromAssessment({
      pace,
      travel: {
        start: {
          vanishingPoint: [0.62, 0.41],
          destinationPoint: [0.62, 0.41],
          label: "corridor mouth",
        },
        end: {
          vanishingPoint: [0.71, 0.36],
          destinationPoint: [0.71, 0.36],
          label: "corridor after the bend",
        },
      },
    });
    assert.equal(plans.start.exposure.strength, strength);
    assert.equal(plans.end.exposure.strength, strength);
    assert.equal(plans.start.exposure.samples, 16);
    assert.equal(plans.end.exposure.samples, 16);
    assert.deepEqual(plans.start.camera.vanishing_point, [0.62, 0.41]);
    assert.deepEqual(plans.end.camera.vanishing_point, [0.71, 0.36]);
    assert.equal(plans.start.camera.forward, PRODUCTION_CAMOTION_FORWARD);
  }
});

test("one missing side falls back without discarding the other", () => {
  const plans = cameraMotionPlansFromAssessment({
    travel: {
      end: {
        vanishingPoint: [0.33, 0.48],
        destinationPoint: [0.33, 0.48],
        label: "door threshold",
      },
    },
  });
  assert.deepEqual(plans.start, productionCameraMotionPlan());
  assert.deepEqual(plans.end.camera.vanishing_point, [0.33, 0.48]);
});
