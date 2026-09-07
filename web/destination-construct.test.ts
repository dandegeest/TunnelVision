import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { constructDestinationImage } from "./destination-construct.ts";
import { destinationConstructionPrompt } from "./src/project/destination.ts";
import {
  createRuntimeMediaRegistry,
  setActiveRuntimeMediaRegistry,
} from "./runtime-media.ts";
import { resolveTrustedMedia, UntrustedMediaError } from "./trusted-media.ts";
import { TRUSTED_MEDIA_IDS } from "./src/project/trusted-media-id.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8ffff3f0005fe02fedccc59e70000000049454e44ae426082",
  "hex",
);

afterEach(() => {
  setActiveRuntimeMediaRegistry(undefined);
});

describe("destination construction server path", () => {
  it("edits the resolved source through ImageEditRequest and registers runtime media", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-dest-")));
    setActiveRuntimeMediaRegistry(registry);
    const uploaded = registry.register(PNG, "image/png");
    let edited: { sourcePath?: string; prompt?: string } = {};
    const result = await constructDestinationImage({
      repoRoot,
      body: {
        sourceMediaId: uploaded.mediaId,
        beatId: "B",
        intent: "Move forward into the cleft.",
        visualDescription: "A narrow stone corridor with orange light.",
      },
      editImage: async (request) => {
        edited = {
          sourcePath: request.sourceImage.kind === "file" ? request.sourceImage.path : undefined,
          prompt: request.prompt,
        };
        return {
          provider: "replicate",
          model: "black-forest-labs/flux-kontext-pro",
          modelVersion: "test",
          predictionId: "pred-b",
          status: "succeeded",
          outputUrl: "https://example.test/b.png",
          metadata: {},
          startedAt: "2026-09-07T00:00:00.000Z",
          completedAt: "2026-09-07T00:00:02.000Z",
          elapsedMs: 2000,
        };
      },
      fetchOutput: async (url) => {
        expect(url).toBe("https://example.test/b.png");
        return { bytes: PNG, contentType: "image/png" };
      },
    });
    expect(edited.sourcePath).toBe(uploaded.filePath);
    expect(edited.prompt).toBe(
      destinationConstructionPrompt({
        intent: "Move forward into the cleft.",
        visualDescription: "A narrow stone corridor with orange light.",
      }),
    );
    expect(result.mediaId).not.toBe(uploaded.mediaId);
    expect(result.mediaId).not.toBe(TRUSTED_MEDIA_IDS.wardrobeLoopVisionA);
    expect(resolveTrustedMedia(repoRoot, result.mediaId)).toEqual({
      kind: "file",
      path: registry.get(result.mediaId)?.filePath,
    });
    expect(result.evidence.outputMediaId).toBe(result.mediaId);
  });

  it("resolves catalog A, not a Wardrobe filesystem path sent by the browser", async () => {
    setActiveRuntimeMediaRegistry(
      createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-dest-catalog-"))),
    );
    let source: unknown;
    await constructDestinationImage({
      repoRoot,
      body: {
        sourceMediaId: TRUSTED_MEDIA_IDS.wardrobeLoopVisionA,
        beatId: "B",
        intent: "Step through the wardrobe.",
        visualDescription: "Snow and dark coats.",
      },
      editImage: async (request) => {
        source = request.sourceImage;
        return {
          provider: "replicate",
          model: "black-forest-labs/flux-kontext-pro",
          modelVersion: "test",
          predictionId: "pred-wardrobe-b",
          status: "succeeded",
          outputUrl: "https://example.test/wardrobe-b.png",
          metadata: {},
          startedAt: "2026-09-07T00:00:00.000Z",
          completedAt: "2026-09-07T00:00:01.000Z",
          elapsedMs: 1000,
        };
      },
      fetchOutput: async () => ({ bytes: PNG, contentType: "image/png" }),
    });
    expect(source).toEqual(resolveTrustedMedia(repoRoot, TRUSTED_MEDIA_IDS.wardrobeLoopVisionA));
    expect(source).not.toEqual({
      kind: "file",
      path: "camotion/integration/wardrobe-loop-01/canonical/vision/A.jpg",
    });
  });

  it("does not register media when editImage fails", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-dest-fail-")));
    setActiveRuntimeMediaRegistry(registry);
    const uploaded = registry.register(PNG, "image/png");
    await expect(
      constructDestinationImage({
        repoRoot,
        body: {
          sourceMediaId: uploaded.mediaId,
          beatId: "B",
          intent: "Move forward into the cleft.",
          visualDescription: "A narrow stone corridor with orange light.",
        },
        editImage: async () => {
          throw new Error("kontext failed");
        },
      }),
    ).rejects.toThrow(/kontext failed/);
    expect(registry.get(uploaded.mediaId)?.filePath).toBe(uploaded.filePath);
    expect(resolveTrustedMedia(repoRoot, uploaded.mediaId)).toEqual({
      kind: "file",
      path: uploaded.filePath,
    });
  });

  it("does not resolve a filesystem path as source identity", async () => {
    setActiveRuntimeMediaRegistry(
      createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-dest-bad-"))),
    );
    await expect(
      constructDestinationImage({
        repoRoot,
        body: {
          sourceMediaId: "camotion/integration/wardrobe-loop-01/canonical/vision/A.jpg",
          beatId: "B",
          intent: "Go forward.",
          visualDescription: "A doorway.",
        },
        editImage: async () => {
          throw new Error("editImage should not run");
        },
      }),
    ).rejects.toThrow(UntrustedMediaError);
  });

  it("rejects construction of a beat other than B", async () => {
    setActiveRuntimeMediaRegistry(
      createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-dest-c-"))),
    );
    await expect(
      constructDestinationImage({
        repoRoot,
        body: {
          sourceMediaId: "wardrobe-loop-vision-a",
          beatId: "C",
          intent: "Go forward.",
          visualDescription: "A doorway.",
        },
        editImage: async () => {
          throw new Error("editImage should not run");
        },
      }),
    ).rejects.toThrow(/only construct destination B/i);
  });
});
