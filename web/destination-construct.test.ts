import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { constructDestinationImage, generateOpeningFrameImage } from "./destination-construct.ts";
import { canonicalRepairPrompt, destinationConstructionPrompt, openingFrameGenerationPrompt } from "./src/project/destination.ts";
import type { GeneratedImage } from "../media/src/types.ts";
import {
  createRuntimeMediaRegistry,
  setActiveRuntimeMediaRegistry,
} from "./runtime-media.ts";
import { resolveTrustedMedia, UntrustedMediaError } from "./trusted-media.ts";
import { TRUSTED_MEDIA_IDS } from "./src/project/trusted-media-id.ts";

function fakeGenerated(outputUrl: string): GeneratedImage {
  return {
    provider: "replicate",
    model: "google/nano-banana-2-lite",
    modelVersion: "test",
    predictionId: "pred-pf",
    status: "succeeded",
    outputUrl,
    metadata: {},
    startedAt: "2026-09-07T00:00:00.000Z",
    completedAt: "2026-09-07T00:00:02.000Z",
    elapsedMs: 2000,
  };
}

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
    let edited: { sourcePath?: string; prompt?: string; aspectRatio?: { width: number; height: number } } = {};
    const result = await constructDestinationImage({
      repoRoot,
      body: {
        sourceMediaId: uploaded.mediaId,
        beatId: "B",
        intent: "Move forward into the cleft.",
        visualDescription: "A narrow stone corridor with orange light.",
        aspectRatio: { width: 1000, height: 558 },
      },
      editImage: async (request) => {
        edited = {
          sourcePath: request.sourceImage.kind === "file" ? request.sourceImage.path : undefined,
          prompt: request.prompt,
          aspectRatio: request.aspectRatio,
        };
        return {
          provider: "replicate",
          model: "google/nano-banana-2-lite",
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
    expect(edited.aspectRatio).toEqual({ width: 1000, height: 558 });
    expect(result.evidence.request.aspectRatio).toEqual({ width: 1000, height: 558 });
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

  it("forwards following-destination look-ahead into the edit prompt", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-dest-next-")));
    setActiveRuntimeMediaRegistry(registry);
    const uploaded = registry.register(PNG, "image/png");
    let prompt = "";
    await constructDestinationImage({
      repoRoot,
      body: {
        sourceMediaId: uploaded.mediaId,
        beatId: "C",
        intent: "Track forward through the lantern alley.",
        visualDescription: "A dark cobblestone alley with warm lanterns.",
        nextDestination: {
          intent: "Cross the threshold into the desert.",
          visualDescription: "A bright sunlit desert with iron gates.",
        },
      },
      editImage: async (request) => {
        prompt = request.prompt;
        return {
          provider: "replicate",
          model: "google/nano-banana-2-lite",
          modelVersion: "test",
          predictionId: "pred-next",
          status: "succeeded",
          outputUrl: "https://example.test/c-next.png",
          metadata: {},
          startedAt: "2026-09-07T00:00:00.000Z",
          completedAt: "2026-09-07T00:00:02.000Z",
          elapsedMs: 2000,
        };
      },
      fetchOutput: async () => ({ bytes: PNG, contentType: "image/png" }),
    });
    expect(prompt).toBe(
      destinationConstructionPrompt({
        intent: "Track forward through the lantern alley.",
        visualDescription: "A dark cobblestone alley with warm lanterns.",
        nextDestination: {
          intent: "Cross the threshold into the desert.",
          visualDescription: "A bright sunlit desert with iron gates.",
        },
      }),
    );
    expect(prompt).toMatch(/iron gates/);
  });

  it("uses the canonical repair prompt and opposite still as an extra image input", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-dest-repair-")));
    setActiveRuntimeMediaRegistry(registry);
    const start = registry.register(PNG, "image/png");
    const end = registry.register(PNG, "image/png");
    let edited: { prompt?: string; referenceCount?: number } = {};
    await constructDestinationImage({
      repoRoot,
      body: {
        sourceMediaId: start.mediaId,
        beatId: "B",
        intent: "Enter the next volume.",
        visualDescription: "A continuing corridor.",
        repairRole: "end",
        repairInstruction: "The corridor beyond A does not connect to B.",
        referenceMediaId: end.mediaId,
      },
      editImage: async (request) => {
        edited = {
          prompt: request.prompt,
          referenceCount: request.referenceImages?.length ?? 0,
        };
        return {
          provider: "replicate",
          model: "google/nano-banana-2-lite",
          modelVersion: "test",
          predictionId: "pred-repair",
          status: "succeeded",
          outputUrl: "https://example.test/b-repair.png",
          metadata: {},
          startedAt: "2026-09-07T00:00:00.000Z",
          completedAt: "2026-09-07T00:00:02.000Z",
          elapsedMs: 2000,
        };
      },
      fetchOutput: async () => ({ bytes: PNG, contentType: "image/png" }),
    });
    expect(edited.prompt).toBe(
      canonicalRepairPrompt({
        role: "end",
        intent: "Enter the next volume.",
        visualDescription: "A continuing corridor.",
        instruction: "The corridor beyond A does not connect to B.",
      }),
    );
    expect(edited.referenceCount).toBe(1);
  });

  it("defaults to pulling the previous canonical into ImageEditRequest", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-dest-pf-on-")));
    setActiveRuntimeMediaRegistry(registry);
    const uploaded = registry.register(PNG, "image/png");
    let edited: { usedSource?: boolean; referenceCount?: number; prompt?: string } = {};
    let generated = false;
    await constructDestinationImage({
      repoRoot,
      body: {
        sourceMediaId: uploaded.mediaId,
        beatId: "B",
        intent: "Move forward into the cleft.",
        visualDescription: "A narrow stone corridor with orange light.",
      },
      editImage: async (request) => {
        edited = {
          usedSource: request.sourceImage.kind === "file" && request.sourceImage.path === uploaded.filePath,
          referenceCount: request.referenceImages?.length ?? 0,
          prompt: request.prompt,
        };
        return fakeGenerated("https://example.test/pf-on.png");
      },
      generateImage: async () => {
        generated = true;
        throw new Error("generateImage should not run when pull-forward is on");
      },
      fetchOutput: async () => ({ bytes: PNG, contentType: "image/png" }),
    });
    expect(edited.usedSource).toBe(true);
    expect(edited.referenceCount).toBe(0);
    expect(edited.prompt).toMatch(/Preserve the same physical world/);
    expect(generated).toBe(false);
  });

  it("keeps an extra reference image when pull-forward is on", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-dest-pf-extra-")));
    setActiveRuntimeMediaRegistry(registry);
    const source = registry.register(PNG, "image/png");
    const extra = registry.register(PNG, "image/png");
    let edited: { sourcePath?: string; referencePath?: string } = {};
    await constructDestinationImage({
      repoRoot,
      body: {
        sourceMediaId: source.mediaId,
        beatId: "B",
        intent: "Move forward into the cleft.",
        visualDescription: "A narrow stone corridor with orange light.",
        referenceMediaId: extra.mediaId,
      },
      editImage: async (request) => {
        edited = {
          sourcePath: request.sourceImage.kind === "file" ? request.sourceImage.path : undefined,
          referencePath:
            request.referenceImages?.[0]?.kind === "file" ? request.referenceImages[0].path : undefined,
        };
        return fakeGenerated("https://example.test/pf-extra.png");
      },
      fetchOutput: async () => ({ bytes: PNG, contentType: "image/png" }),
    });
    expect(edited.sourcePath).toBe(source.filePath);
    expect(edited.referencePath).toBe(extra.filePath);
  });

  it("omits the previous-canonical source when pull-forward is off", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-dest-pf-off-")));
    setActiveRuntimeMediaRegistry(registry);
    const uploaded = registry.register(PNG, "image/png");
    let edited = false;
    let generated: { prompt?: string; hasSource?: boolean } = {};
    await constructDestinationImage({
      repoRoot,
      body: {
        sourceMediaId: uploaded.mediaId,
        beatId: "B",
        intent: "Advance through the threshold into the courtyard.",
        visualDescription: "A sunlit Mediterranean courtyard beyond the doorway.",
        nextDestination: {
          intent: "Cross the gate.",
          visualDescription: "A greenhouse of iron and glass.",
        },
        pullForwardReferenceEnabled: false,
      },
      editImage: async () => {
        edited = true;
        throw new Error("editImage should not run when pull-forward is off");
      },
      generateImage: async (request) => {
        generated = { prompt: request.prompt, hasSource: "sourceImage" in request };
        return fakeGenerated("https://example.test/pf-off.png");
      },
      fetchOutput: async () => ({ bytes: PNG, contentType: "image/png" }),
    });
    expect(edited).toBe(false);
    expect(generated.hasSource).toBe(false);
    expect(generated.prompt).toMatch(/Do not preserve the previous composition merely for visual continuity/);
    expect(generated.prompt).toMatch(/SPATIAL PROGRESSION IS PRIMARY/);
    expect(generated.prompt).toMatch(/Far-field continuity:/);
    expect(generated.prompt).not.toMatch(/Preserve the same physical world/);
  });

  it("does not drop the Agent repair opposite-canonical extra reference when pull-forward is off", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-dest-pf-repair-")));
    setActiveRuntimeMediaRegistry(registry);
    const start = registry.register(PNG, "image/png");
    const end = registry.register(PNG, "image/png");
    let edited: { sourcePath?: string; referenceCount?: number; referencePath?: string } = {};
    let generated = false;
    await constructDestinationImage({
      repoRoot,
      body: {
        sourceMediaId: start.mediaId,
        beatId: "B",
        intent: "Enter the next volume.",
        visualDescription: "A continuing corridor.",
        repairRole: "end",
        repairInstruction: "The corridor beyond A does not connect to B.",
        referenceMediaId: end.mediaId,
        pullForwardReferenceEnabled: false,
      },
      editImage: async (request) => {
        edited = {
          sourcePath: request.sourceImage.kind === "file" ? request.sourceImage.path : undefined,
          referenceCount: request.referenceImages?.length ?? 0,
          referencePath:
            request.referenceImages?.[0]?.kind === "file" ? request.referenceImages[0].path : undefined,
        };
        return fakeGenerated("https://example.test/pf-repair.png");
      },
      generateImage: async () => {
        generated = true;
        throw new Error("repair must stay on editImage");
      },
      fetchOutput: async () => ({ bytes: PNG, contentType: "image/png" }),
    });
    expect(generated).toBe(false);
    expect(edited.sourcePath).toBe(start.filePath);
    expect(edited.referenceCount).toBe(1);
    expect(edited.referencePath).toBe(end.filePath);
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
          model: "google/nano-banana-2-lite",
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

  it("constructs C from resolved B runtime media, not A", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-dest-c-src-")));
    setActiveRuntimeMediaRegistry(registry);
    const sourceA = registry.register(PNG, "image/png");
    const sourceB = registry.register(PNG, "image/png");
    let edited: { sourcePath?: string; prompt?: string } = {};
    const result = await constructDestinationImage({
      repoRoot,
      body: {
        sourceMediaId: sourceB.mediaId,
        beatId: "C",
        intent: "Follow a magma vein downward.",
        visualDescription: "A jagged underground tunnel.",
      },
      editImage: async (request) => {
        edited = {
          sourcePath: request.sourceImage.kind === "file" ? request.sourceImage.path : undefined,
          prompt: request.prompt,
        };
        return {
          provider: "replicate",
          model: "google/nano-banana-2-lite",
          modelVersion: "test",
          predictionId: "pred-c",
          status: "succeeded",
          outputUrl: "https://example.test/c.png",
          metadata: {},
          startedAt: "2026-09-07T00:00:00.000Z",
          completedAt: "2026-09-07T00:00:02.000Z",
          elapsedMs: 2000,
        };
      },
      fetchOutput: async (url) => {
        expect(url).toBe("https://example.test/c.png");
        return { bytes: PNG, contentType: "image/png" };
      },
    });
    expect(edited.sourcePath).toBe(sourceB.filePath);
    expect(edited.sourcePath).not.toBe(sourceA.filePath);
    expect(edited.prompt).toBe(
      destinationConstructionPrompt({
        intent: "Follow a magma vein downward.",
        visualDescription: "A jagged underground tunnel.",
      }),
    );
    expect(edited.prompt).not.toMatch(/Far-field continuity/);
    expect(result.mediaId).not.toBe(sourceA.mediaId);
    expect(result.mediaId).not.toBe(sourceB.mediaId);
    expect(registry.get(sourceB.mediaId)?.filePath).toBe(sourceB.filePath);
    expect(resolveTrustedMedia(repoRoot, result.mediaId)).toEqual({
      kind: "file",
      path: registry.get(result.mediaId)?.filePath,
    });
  });

  it("rejects a missing beat id", async () => {
    setActiveRuntimeMediaRegistry(
      createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-dest-c-"))),
    );
    await expect(
      constructDestinationImage({
        repoRoot,
        body: {
          sourceMediaId: "wardrobe-loop-vision-a",
          beatId: "",
          intent: "Go forward.",
          visualDescription: "A doorway.",
        },
        editImage: async () => {
          throw new Error("editImage should not run");
        },
      }),
    ).rejects.toThrow(/not ready to construct/i);
  });
});

describe("opening frame generation server path", () => {
  it("generates from the journey story and registers runtime media", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-open-")));
    setActiveRuntimeMediaRegistry(registry);
    let prompt = "";
    let aspectRatio: { width: number; height: number } | undefined;
    const result = await generateOpeningFrameImage({
      body: { story: "Travel forward through an imagined interior at night." },
      generateImage: async (request) => {
        prompt = request.prompt;
        aspectRatio = request.aspectRatio;
        return {
          provider: "replicate",
          model: "google/nano-banana-2-lite",
          modelVersion: "test",
          predictionId: "pred-a",
          status: "succeeded",
          outputUrl: "https://example.test/a.png",
          metadata: {},
          startedAt: "2026-09-07T00:00:00.000Z",
          completedAt: "2026-09-07T00:00:02.000Z",
          elapsedMs: 2000,
        };
      },
      fetchOutput: async (url) => {
        expect(url).toBe("https://example.test/a.png");
        return { bytes: PNG, contentType: "image/png" };
      },
    });
    expect(prompt).toBe(
      openingFrameGenerationPrompt("Travel forward through an imagined interior at night."),
    );
    expect(aspectRatio).toEqual({ width: 16, height: 9 });
    expect(result.evidence.request.aspectRatio).toEqual({ width: 16, height: 9 });
    expect(result.evidence.request.beatId).toBe("A");
    expect(result.mediaId).not.toBe(TRUSTED_MEDIA_IDS.wardrobeLoopVisionA);
    expect(resolveTrustedMedia(repoRoot, result.mediaId)).toEqual({
      kind: "file",
      path: registry.get(result.mediaId)?.filePath,
    });
  });

  it("refuses an empty story before calling the image model", async () => {
    await expect(
      generateOpeningFrameImage({
        body: { story: "  " },
        generateImage: async () => {
          throw new Error("generateImage should not run");
        },
      }),
    ).rejects.toThrow(/journey story/i);
  });
});
