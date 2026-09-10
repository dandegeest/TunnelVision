import type { CameraMotionPlanV1 } from "./types";

export type OverlayLayers = {
  path: boolean;
  direction: boolean;
  points: boolean;
};

export const DEFAULT_OVERLAY_LAYERS: OverlayLayers = {
  path: true,
  direction: true,
  points: true,
};

export type NormalizedPoint = readonly [number, number];

export type ContainedImageRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MotionSample = {
  origin: NormalizedPoint;
  vector: NormalizedPoint;
};

const COINCIDENT = 1e-6;
const RING_RADIUS = 0.14;
const RING_COUNT = 8;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Displayed `object-fit: contain` rectangle inside a laid-out image box. */
export function containedImageRect(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): ContainedImageRect {
  if (containerWidth <= 0 || containerHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return { x: 0, y: 0, width: Math.max(0, containerWidth), height: Math.max(0, containerHeight) };
  }
  const containerRatio = containerWidth / containerHeight;
  const imageRatio = imageWidth / imageHeight;
  if (imageRatio > containerRatio) {
    const width = containerWidth;
    const height = containerWidth / imageRatio;
    return { x: 0, y: (containerHeight - height) / 2, width, height };
  }
  const height = containerHeight;
  const width = containerHeight * imageRatio;
  return { x: (containerWidth - width) / 2, y: 0, width, height };
}

/** Hit the [0,1]x[0,1] image edge from origin along dir. */
export function rayToNormalizedEdge(origin: NormalizedPoint, dir: NormalizedPoint): NormalizedPoint {
  const [x, y] = origin;
  const [dx, dy] = dir;
  const hits: number[] = [];
  if (dx > COINCIDENT) {
    hits.push((1 - x) / dx);
  } else if (dx < -COINCIDENT) {
    hits.push((0 - x) / dx);
  }
  if (dy > COINCIDENT) {
    hits.push((1 - y) / dy);
  } else if (dy < -COINCIDENT) {
    hits.push((0 - y) / dy);
  }
  const t = hits.filter((value) => value > COINCIDENT).sort((a, b) => a - b)[0];
  if (t === undefined) {
    return [clamp01(x), clamp01(y)];
  }
  return [clamp01(x + t * dx), clamp01(y + t * dy)];
}

/**
 * Planned travel axis from stored plan points.
 * Apex is the vanishing point (camera heads into the focus of expansion).
 * Near end is the image-edge hit through destination.point, or straight down
 * when the two points coincide — the same fallback Camotion uses for its corridor.
 */
export function travelPath(plan: CameraMotionPlanV1): { apex: NormalizedPoint; near: NormalizedPoint } {
  const apex = plan.camera.vanishing_point;
  const dest = plan.destination.point;
  let dx = dest[0] - apex[0];
  let dy = dest[1] - apex[1];
  if (Math.hypot(dx, dy) < COINCIDENT) {
    dx = 0;
    dy = 1;
  }
  return { apex, near: rayToNormalizedEdge(apex, [dx, dy]) };
}

/**
 * Camotion v1 pixel motion samples: forward * (p − vanishing_point).
 * Ring around the focus of expansion plus the destination point when it is offset.
 */
export function motionSamples(plan: CameraMotionPlanV1): MotionSample[] {
  const vp = plan.camera.vanishing_point;
  const forward = plan.camera.forward;
  const dest = plan.destination.point;
  const samples: MotionSample[] = [];
  for (let i = 0; i < RING_COUNT; i += 1) {
    const angle = (i / RING_COUNT) * Math.PI * 2;
    const ox = vp[0] + Math.cos(angle) * RING_RADIUS;
    const oy = vp[1] + Math.sin(angle) * RING_RADIUS;
    if (ox < 0 || ox > 1 || oy < 0 || oy > 1) {
      continue;
    }
    samples.push({
      origin: [ox, oy],
      vector: [forward * (ox - vp[0]), forward * (oy - vp[1])],
    });
  }
  if (Math.hypot(dest[0] - vp[0], dest[1] - vp[1]) >= COINCIDENT) {
    samples.push({
      origin: dest,
      vector: [forward * (dest[0] - vp[0]), forward * (dest[1] - vp[1])],
    });
  }
  return samples;
}

export function overlayHasDrawableMotion(samples: readonly MotionSample[]): boolean {
  return samples.some((sample) => Math.hypot(sample.vector[0], sample.vector[1]) > COINCIDENT);
}
