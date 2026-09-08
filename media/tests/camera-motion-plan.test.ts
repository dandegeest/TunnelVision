import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PRODUCTION_CAMOTION_EXPOSURE,
  PRODUCTION_CAMOTION_FORWARD,
  productionCameraMotionPlan,
} from "../src/cinematographer/camera-motion-plan.ts";

test("production CameraMotionPlan is frozen centered radial-forward v1", () => {
  const plan = productionCameraMotionPlan();
  assert.equal(plan.version, 1);
  assert.equal(plan.camera.forward, PRODUCTION_CAMOTION_FORWARD);
  assert.deepEqual(plan.camera.vanishing_point, [0.5, 0.5]);
  assert.deepEqual(plan.destination.point, [0.5, 0.5]);
  assert.equal(plan.destination.protect, true);
  assert.equal(plan.exposure.strength, 0.08);
  assert.equal(plan.exposure.samples, 16);
  assert.equal(plan.exposure.strength, PRODUCTION_CAMOTION_EXPOSURE.strength);
  assert.equal("vanishing_point" in plan.camera, true);
  const again = productionCameraMotionPlan();
  assert.deepEqual(plan, again);
});
