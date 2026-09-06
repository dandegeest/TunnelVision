import { resolve } from "node:path";

import { isTrustedMediaIdShape, TRUSTED_MEDIA_IDS } from "./src/project/trusted-media-id.ts";
import type { MediaInput } from "../media/src/types.ts";

/**
 * Server-side catalog only. The browser sends an id from Project state;
 * it never sends these paths. Unknown ids are rejected.
 *
 * `DEV_TEST_TRUSTED_MEDIA_ID` is a harness identity only. It is not product
 * starting-frame state.
 */
export const DEV_TEST_TRUSTED_MEDIA_ID = "dev-test-trusted-media";

const TRUSTED_RELATIVE_PATHS: Readonly<Record<string, string>> = {
  [TRUSTED_MEDIA_IDS.wardrobeLoopVisionA]:
    "camotion/integration/wardrobe-loop-01/canonical/vision/A.jpg",
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
  if (!relative) {
    throw new UntrustedMediaError();
  }
  return { kind: "file", path: resolve(repoRoot, relative) };
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
  const intent = typeof body.startFrameIntent === "string" ? body.startFrameIntent : undefined;
  return {
    id: id || "A",
    ...(intent ? { intent } : {}),
    image,
  };
}
