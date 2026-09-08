import { resolve } from "node:path";

import { getActiveRuntimeMediaRegistry } from "./runtime-media.ts";
import { isTrustedMediaIdShape, TRUSTED_MEDIA_IDS } from "./src/project/trusted-media-id.ts";
import type { MediaInput } from "../media/src/types.ts";

/**
 * Server-side catalog and optional session/dev-runtime uploads.
 * The browser sends an id from Project state; it never sends these paths.
 * Unknown ids are rejected. Runtime uploads are not durable project storage.
 *
 * `DEV_TEST_TRUSTED_MEDIA_ID` is a harness identity only. It is not product
 * starting-frame state.
 */
export const DEV_TEST_TRUSTED_MEDIA_ID = "dev-test-trusted-media";

const TRUSTED_RELATIVE_PATHS: Readonly<Record<string, string>> = {
  [TRUSTED_MEDIA_IDS.wardrobeLoopVisionA]:
    "camotion/integration/wardrobe-loop-01/canonical/vision/A.jpg",
  [TRUSTED_MEDIA_IDS.forestAtoFA]: "camotion/integration/forest-a-to-f/canonical/A.jpg",
  [TRUSTED_MEDIA_IDS.forestAtoFB]: "camotion/integration/forest-a-to-f/canonical/B.png",
  [TRUSTED_MEDIA_IDS.forestAtoFC]: "camotion/integration/forest-a-to-f/canonical/C.png",
  [TRUSTED_MEDIA_IDS.forestAtoFD]: "camotion/integration/forest-a-to-f/canonical/D.png",
  [TRUSTED_MEDIA_IDS.forestAtoFE]: "camotion/integration/forest-a-to-f/canonical/E.png",
  [TRUSTED_MEDIA_IDS.forestAtoFF]: "camotion/integration/forest-a-to-f/canonical/F.png",
  [DEV_TEST_TRUSTED_MEDIA_ID]: "web/index.html",
};

export class UntrustedMediaError extends Error {
  constructor(message = "Unknown or untrusted media identity") {
    super(message);
    this.name = "UntrustedMediaError";
  }
}

export function resolveTrustedMedia(repoRoot: string, id: unknown): MediaInput {
  if (!isTrustedMediaIdShape(id)) {
    throw new UntrustedMediaError();
  }
  const relative = TRUSTED_RELATIVE_PATHS[id];
  if (relative) {
    return { kind: "file", path: resolve(repoRoot, relative) };
  }
  const runtime = getActiveRuntimeMediaRegistry()?.get(id);
  if (runtime) {
    return { kind: "file", path: runtime.filePath };
  }
  throw new UntrustedMediaError();
}

export function directorStartFrameFromRequest(
  repoRoot: string,
  body: Record<string, unknown>,
): {
  id: string;
  intent?: string;
  image: MediaInput;
} {
  const image = resolveTrustedMedia(repoRoot, body.startMediaId);
  const id = typeof body.startFrameId === "string" ? body.startFrameId.trim() : "";
  const intent =
    typeof body.startFrameIntent === "string" ? body.startFrameIntent.trim() : "";
  return {
    id: id || "A",
    ...(intent ? { intent } : {}),
    image,
  };
}

export function directorAnchorsFromRequest(
  repoRoot: string,
  body: Record<string, unknown>,
): Array<{
  id: string;
  label: string;
  intent?: string;
  visualDescription?: string;
  image?: MediaInput;
}> | undefined {
  if (!Array.isArray(body.anchors) || body.anchors.length < 1) {
    return undefined;
  }
  return body.anchors.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new UntrustedMediaError(`Invalid Director anchors[${index}]`);
    }
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id) {
      throw new UntrustedMediaError(`Invalid Director anchors[${index}]`);
    }
    const label =
      typeof record.label === "string" && record.label.trim() ? record.label.trim() : id;
    const intent = typeof record.intent === "string" ? record.intent.trim() : "";
    const visualDescription =
      typeof record.visualDescription === "string" ? record.visualDescription.trim() : "";
    const anchor: {
      id: string;
      label: string;
      intent?: string;
      visualDescription?: string;
      image?: MediaInput;
    } = {
      id,
      label,
      ...(intent ? { intent } : {}),
      ...(visualDescription ? { visualDescription } : {}),
    };
    if (record.mediaId !== undefined && record.mediaId !== null && record.mediaId !== "") {
      anchor.image = resolveTrustedMedia(repoRoot, record.mediaId);
    }
    return anchor;
  });
}
