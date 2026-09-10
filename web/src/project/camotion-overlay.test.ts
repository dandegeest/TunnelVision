import { describe, expect, it } from "vitest";
import type { CameraMotionPlanV1 } from "./types";
import {
  containedImageRect,
  motionSamples,
  overlayHasDrawableMotion,
  rayToNormalizedEdge,
  travelPath,
} from "./camotion-overlay";

const centered: CameraMotionPlanV1 = {
  version: 1,
  camera: { vanishing_point: [0.5, 0.5], forward: 1 },
  destination: { point: [0.5, 0.5], protect: true, bbox: [0.25, 0.2, 0.75, 0.8] },
  exposure: { strength: 0.08, samples: 16 },
};

const offset: CameraMotionPlanV1 = {
  version: 1,
  camera: { vanishing_point: [0.2, 0.2], forward: 1 },
  destination: { point: [0.4, 0.4], protect: true, bbox: [0.1, 0.1, 0.9, 0.9] },
  exposure: { strength: 0.04, samples: 16 },
};

describe("Camotion overlay geometry", () => {
  it("letterboxes and pillarboxes object-fit contain", () => {
    expect(containedImageRect(1600, 900, 1600, 900)).toEqual({ x: 0, y: 0, width: 1600, height: 900 });
    expect(containedImageRect(1600, 900, 900, 900)).toEqual({ x: 350, y: 0, width: 900, height: 900 });
    const letterbox = containedImageRect(1600, 900, 2100, 900);
    expect(letterbox.x).toBe(0);
    expect(letterbox.width).toBe(1600);
    expect(letterbox.height).toBeCloseTo((1600 * 900) / 2100);
    expect(letterbox.y).toBeCloseTo((900 - letterbox.height) / 2);
  });

  it("extends the travel axis through destination to the image edge", () => {
    expect(travelPath(centered)).toEqual({ apex: [0.5, 0.5], near: [0.5, 1] });
    expect(travelPath(offset)).toEqual({ apex: [0.2, 0.2], near: [1, 1] });
    expect(rayToNormalizedEdge([0.5, 0.2], [0, 1])).toEqual([0.5, 1]);
  });

  it("samples the stored radial field without inventing a second plan", () => {
    const ring = motionSamples(centered);
    expect(ring.length).toBe(8);
    expect(ring.every((sample) => Math.abs(Math.hypot(sample.vector[0], sample.vector[1]) - 0.14) < 1e-9)).toBe(true);
    const dest = motionSamples(offset);
    expect(dest.at(-1)).toEqual({ origin: [0.4, 0.4], vector: [0.2, 0.2] });
    const still = motionSamples({ ...centered, camera: { ...centered.camera, forward: 0 } });
    expect(overlayHasDrawableMotion(still)).toBe(false);
  });
});
