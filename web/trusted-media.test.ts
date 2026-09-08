import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  createRuntimeMediaRegistry,
  setActiveRuntimeMediaRegistry,
} from "./runtime-media.ts";
import {
  DEV_TEST_TRUSTED_MEDIA_ID,
  cinematographerPairFromRequest,
  directorAnchorsFromRequest,
  directorStartFrameFromRequest,
  resolveTrustedMedia,
  UntrustedMediaError,
} from "./trusted-media.ts";
import { TRUSTED_MEDIA_IDS } from "./src/project/trusted-media-id.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8ffff3f0005fe02fedccc59e70000000049454e44ae426082",
  "hex",
);

afterEach(() => {
  setActiveRuntimeMediaRegistry(undefined);
});

describe("trusted media resolution", () => {
  it("maps a known identity to the catalog MediaInput", () => {
    expect(resolveTrustedMedia(repoRoot, TRUSTED_MEDIA_IDS.wardrobeLoopVisionA)).toEqual({
      kind: "file",
      path: resolve(repoRoot, "camotion/integration/wardrobe-loop-01/canonical/vision/A.jpg"),
    });
    expect(resolveTrustedMedia(repoRoot, TRUSTED_MEDIA_IDS.forestAtoFA)).toEqual({
      kind: "file",
      path: resolve(repoRoot, "camotion/integration/forest-a-to-f/canonical/A.jpg"),
    });
  });

  it("maps Forest derived stills without treating them as filesystem ids", () => {
    expect(resolveTrustedMedia(repoRoot, TRUSTED_MEDIA_IDS.forestAtoFF)).toEqual({
      kind: "file",
      path: resolve(repoRoot, "camotion/integration/forest-a-to-f/canonical/F.png"),
    });
    expect(TRUSTED_MEDIA_IDS.forestAtoFF).not.toMatch(/[/\\]/);
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

  it("resolves Cinematographer start and end stills from trusted identities", () => {
    const pair = cinematographerPairFromRequest(repoRoot, {
      startMediaId: TRUSTED_MEDIA_IDS.forestAtoFA,
      endMediaId: TRUSTED_MEDIA_IDS.forestAtoFB,
      startDestinationId: "A",
      endDestinationId: "B",
    });
    expect(pair.start.image).toEqual(resolveTrustedMedia(repoRoot, TRUSTED_MEDIA_IDS.forestAtoFA));
    expect(pair.end.image).toEqual(resolveTrustedMedia(repoRoot, TRUSTED_MEDIA_IDS.forestAtoFB));
    expect(pair.start.id).toBe("A");
    expect(pair.end.id).toBe("B");
  });

  it("rejects a filesystem-looking Cinematographer end identity", () => {
    expect(() =>
      cinematographerPairFromRequest(repoRoot, {
        startMediaId: TRUSTED_MEDIA_IDS.forestAtoFA,
        endMediaId: "camotion/integration/forest-a-to-f/canonical/B.png",
        startDestinationId: "A",
        endDestinationId: "B",
      }),
    ).toThrow(UntrustedMediaError);
  });

  it("resolves additional Director destination stills from trusted identities", () => {
    const anchors = directorAnchorsFromRequest(repoRoot, {
      anchors: [
        {
          id: "A",
          label: "A",
          mediaId: TRUSTED_MEDIA_IDS.forestAtoFA,
        },
        {
          id: "D",
          label: "D",
          intent: "Crystal in the path.",
          mediaId: TRUSTED_MEDIA_IDS.forestAtoFD,
        },
        {
          id: "F",
          label: "F",
          mediaId: TRUSTED_MEDIA_IDS.forestAtoFF,
        },
      ],
    });
    expect(anchors?.map((anchor) => anchor.id)).toEqual(["A", "D", "F"]);
    expect(anchors?.[1]?.image).toEqual(resolveTrustedMedia(repoRoot, TRUSTED_MEDIA_IDS.forestAtoFD));
    expect(anchors?.[2]?.image).toEqual(resolveTrustedMedia(repoRoot, TRUSTED_MEDIA_IDS.forestAtoFF));
  });

  it("rejects a filesystem-looking extra destination identity", () => {
    expect(() =>
      directorAnchorsFromRequest(repoRoot, {
        anchors: [
          {
            id: "D",
            label: "D",
            mediaId: "camotion/integration/forest-a-to-f/canonical/D.png",
          },
        ],
      }),
    ).toThrow(UntrustedMediaError);
  });

  it("resolves a runtime upload through the same Director startFrame path", () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-trusted-")));
    setActiveRuntimeMediaRegistry(registry);
    const recorded = registry.register(PNG, "image/png");
    const start = directorStartFrameFromRequest(repoRoot, {
      startFrameId: "A",
      startMediaId: recorded.mediaId,
    });
    expect(start.image).toEqual({ kind: "file", path: recorded.filePath });
    expect(start.image).not.toEqual(
      resolveTrustedMedia(repoRoot, TRUSTED_MEDIA_IDS.wardrobeLoopVisionA),
    );
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
