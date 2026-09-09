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
  "Product shoot does not pass --depth. Camotion does not estimate or write depth maps, so none are deleted.";

export const CAMOTION_CLEANUP_DEBUG =
  "Without Debug, Camotion work dirs are deleted after A′/B′ are copied into the session store. Debug keeps plan.json and shooting.png.";

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
