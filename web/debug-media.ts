import { getActiveRuntimeMediaRegistry } from "./runtime-media.ts";

export type DebugMediaRecord = {
  mediaId: string;
  filePath: string;
  mimeType: string;
};

export type DebugMediaSnapshot = {
  storeDirectory: string | null;
  records: DebugMediaRecord[];
  camotion: {
    workDirPrefix: string;
    depth: string;
    cleanup: string;
  };
};

export const CAMOTION_DEPTH_DEBUG =
  "Product shoot estimates a reusable near-weight depth map per unchanged canonical and passes it to Camotion. Missing depth falls back to destination/VP weights only. Debug keeps depth.png, destination-protection.png, vp-protection.png, motion-weight.png, plan.json, and shooting.png.";

export const CAMOTION_CLEANUP_DEBUG =
  "Without Debug, Camotion work dirs are deleted after A′/B′ are copied into the session store. Debug keeps plan.json, shooting.png, and adaptive weight previews.";

export function debugMediaSnapshot(): DebugMediaSnapshot {
  const registry = getActiveRuntimeMediaRegistry();
  return {
    storeDirectory: registry?.directory ?? null,
    records: registry?.list().map((record) => ({
      mediaId: record.mediaId,
      filePath: record.filePath,
      mimeType: record.mimeType,
    })) ?? [],
    camotion: {
      workDirPrefix: "tunnelvision-camotion-",
      depth: CAMOTION_DEPTH_DEBUG,
      cleanup: CAMOTION_CLEANUP_DEBUG,
    },
  };
}
