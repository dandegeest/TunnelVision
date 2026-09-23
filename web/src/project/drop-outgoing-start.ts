import type { OutgoingStartDrop } from "./types";

/**
 * Gated drop of outgoing decoded frame 0.
 *
 * When the incoming take's last frame (Be) is already the same conditioned
 * boundary as the next take's first frame (Bs), Bs is a one-frame hold.
 * Drop it and flat-concat. First take is never trimmed.
 *
 * Conservative on purpose: a miss keeps the hold; a false drop can jump.
 * Thresholds come from the 2026-09-22 Kling-only drop-0 validation.
 */
export const DROP_OUTGOING_START_GATE = {
  minSsim: 0.89,
  maxMae: 5,
} as const;

export type SeamSimilarity = {
  ssim: number;
  mae: number;
};

export function shouldDropOutgoingStart(similarity: SeamSimilarity): boolean {
  return (
    Number.isFinite(similarity.ssim) &&
    Number.isFinite(similarity.mae) &&
    similarity.ssim >= DROP_OUTGOING_START_GATE.minSsim &&
    similarity.mae <= DROP_OUTGOING_START_GATE.maxMae
  );
}

export function outgoingStartDropIsCurrent(
  drop: OutgoingStartDrop | undefined,
  incomingTakeId: string | undefined,
  outgoingTakeId: string | undefined,
): boolean {
  return Boolean(
    drop &&
      incomingTakeId &&
      outgoingTakeId &&
      drop.incomingTakeId === incomingTakeId &&
      drop.outgoingTakeId === outgoingTakeId,
  );
}
