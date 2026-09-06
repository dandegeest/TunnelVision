import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEV_TEST_TRUSTED_MEDIA_ID,
  directorStartFrameFromRequest,
  resolveTrustedMedia,
  UntrustedMediaError,
} from "./trusted-media.ts";
import { TRUSTED_MEDIA_IDS } from "./src/project/trusted-media-id.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("trusted media resolution", () => {
  it("maps a known identity to the catalog MediaInput", () => {
    expect(resolveTrustedMedia(repoRoot, TRUSTED_MEDIA_IDS.wardrobeLoopVisionA)).toEqual({
      kind: "file",
      path: resolve(repoRoot, "camotion/integration/wardrobe-loop-01/canonical/vision/A.jpg"),
    });
  });

  it("maps a second catalog identity without changing resolver logic", () => {
    expect(resolveTrustedMedia(repoRoot, DEV_TEST_TRUSTED_MEDIA_ID)).toEqual({
      kind: "file",
      path: resolve(repoRoot, "web/index.html"),
    });
  });

  it("builds Director startFrame from the request identity, not an endpoint default image", () => {
    const fromA = directorStartFrameFromRequest(repoRoot, {
      startFrameId: "A",
      startFrameIntent: "Inside the attic bedroom.",
      startMediaId: TRUSTED_MEDIA_IDS.wardrobeLoopVisionA,
    });
    expect(fromA.image).toEqual(
      resolveTrustedMedia(repoRoot, TRUSTED_MEDIA_IDS.wardrobeLoopVisionA),
    );

    const fromOther = directorStartFrameFromRequest(repoRoot, {
      startFrameId: "A",
      startMediaId: DEV_TEST_TRUSTED_MEDIA_ID,
    });
    expect(fromOther.image).toEqual(resolveTrustedMedia(repoRoot, DEV_TEST_TRUSTED_MEDIA_ID));
    expect(fromOther.image).not.toEqual(fromA.image);
  });

  it("rejects an unknown identity", () => {
    expect(() => resolveTrustedMedia(repoRoot, "not-a-catalog-asset")).toThrow(UntrustedMediaError);
  });

  it("rejects filesystem-looking input instead of concatenating a path", () => {
    const attacks = [
      "camotion/integration/wardrobe-loop-01/canonical/vision/A.jpg",
      "/etc/passwd",
      "../camotion/integration/wardrobe-loop-01/canonical/vision/A.jpg",
      "wardrobe-loop-vision-a/../../../etc/passwd",
      "wardrobe-loop-vision-a\\..\\A.jpg",
      resolve(repoRoot, "camotion/integration/wardrobe-loop-01/canonical/vision/A.jpg"),
    ];
    for (const id of attacks) {
      expect(() => resolveTrustedMedia(repoRoot, id)).toThrow(UntrustedMediaError);
      expect(() => directorStartFrameFromRequest(repoRoot, { startMediaId: id })).toThrow(
        UntrustedMediaError,
      );
    }
  });
});
