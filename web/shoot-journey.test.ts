import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { locomotionBaseline, composeShootingPrompt } from "../media/src/cinematographer/shooting-prompt.ts";
import { productionCameraMotionPlan } from "../media/src/cinematographer/camera-motion-plan.ts";
import { shootPreparedJourney, videoModelIdFromBody } from "./shoot-journey.ts";
import {
  createRuntimeMediaRegistry,
  setActiveRuntimeMediaRegistry,
} from "./runtime-media.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8ffff3f0005fe02fedccc59e70000000049454e44ae426082",
  "hex",
);

afterEach(() => {
  setActiveRuntimeMediaRegistry(undefined);
});

describe("shootPreparedJourney", () => {
  it("renders A′ and B′, composes the frozen prompt, and sends both to video", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-shoot-")));
    setActiveRuntimeMediaRegistry(registry);
    const start = registry.register(PNG, "image/png");
    const end = registry.register(PNG, "image/png");
    const rendered: string[] = [];
    let videoRequest: { startPath?: string; endPath?: string; prompt?: string; duration?: number; hasEnd?: boolean } = {};
    const addition = "Track forward through the visible opening into the next volume.";
    const take = await shootPreparedJourney({
      repoRoot,
      body: {
        journeyId: "A-B",
        startMediaId: start.mediaId,
        endMediaId: end.mediaId,
        segmentPromptAddition: addition,
        pace: "slow",
      },
      renderFrame: async (imagePath) => {
        rendered.push(imagePath);
        return PNG;
      },
      generateVideo: async (request) => {
        videoRequest = {
          startPath: request.startImage.kind === "file" ? request.startImage.path : undefined,
          endPath: request.endImage?.kind === "file" ? request.endImage.path : undefined,
          prompt: request.prompt,
          duration: request.durationSeconds,
          hasEnd: Boolean(request.endImage),
        };
        return {
          provider: "replicate",
          model: "prunaai/p-video",
          modelVersion: "test",
          predictionId: "pred-v",
          status: "succeeded",
          outputUrl: "https://example.test/a-b.mp4",
          metadata: { seed: 70 },
          startedAt: "2026-09-08T00:00:00.000Z",
          completedAt: "2026-09-08T00:00:06.000Z",
          elapsedMs: 6000,
        };
      },
    });
    expect(rendered).toEqual([start.filePath, end.filePath]);
    expect(take.journeyId).toBe("A-B");
    expect(take.videoInputs).toEqual({ startShootingFrame: true, endShootingFrame: true });
    expect(take.effectivePrompt).toBe(composeShootingPrompt(locomotionBaseline("slow"), addition));
    expect(take.effectivePrompt.startsWith(addition)).toBe(true);
    expect(take.effectivePrompt.endsWith(locomotionBaseline("slow"))).toBe(true);
    expect(take.effectivePrompt).toMatch(/at a constant, slow speed/);
    expect(take.pace).toBe("slow");
    expect(take.startPlan).toEqual(productionCameraMotionPlan());
    expect(take.endPlan).toEqual(productionCameraMotionPlan());
    expect(take.durationSeconds).toBe(6);
    expect(take.model).toBe("prunaai/p-video");
    expect(take.seed).toBe(70);
    expect(videoRequest.hasEnd).toBe(true);
    expect(videoRequest.duration).toBe(6);
    expect(videoRequest.prompt).toBe(take.effectivePrompt);
    expect(videoRequest.startPath).toBe(registry.get(take.startShootingFrame.mediaId)?.filePath);
    expect(videoRequest.endPath).toBe(registry.get(take.endShootingFrame.mediaId)?.filePath);
    expect(take.startShootingFrame.mediaId).not.toBe(take.endShootingFrame.mediaId);
    expect(take.videoUrl).toBe("https://example.test/a-b.mp4");
    expect(take.camotion).toEqual({
      depthSupplied: false,
      depthPath: null,
      workDirRetained: false,
    });
  });

  it("requests and records Luma's 5s clip length", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-shoot-luma-")));
    setActiveRuntimeMediaRegistry(registry);
    const start = registry.register(PNG, "image/png");
    const end = registry.register(PNG, "image/png");
    let duration: number | undefined;
    const take = await shootPreparedJourney({
      repoRoot,
      body: {
        journeyId: "A-B",
        startMediaId: start.mediaId,
        endMediaId: end.mediaId,
        videoModel: "luma-ray-flash-2-720p",
      },
      renderFrame: async () => PNG,
      generateVideo: async (request) => {
        duration = request.durationSeconds;
        return {
          provider: "replicate",
          model: "luma/ray-flash-2-720p",
          modelVersion: "test",
          predictionId: "pred-luma",
          status: "succeeded",
          outputUrl: "https://example.test/luma.mp4",
          metadata: {},
          startedAt: "2026-09-09T00:00:00.000Z",
          completedAt: "2026-09-09T00:00:05.000Z",
          elapsedMs: 5000,
        };
      },
    });
    expect(duration).toBe(5);
    expect(take.durationSeconds).toBe(5);
    expect(take.model).toBe("luma/ray-flash-2-720p");
  });

  it("accepts a catalog video model id or Replicate slug", () => {
    expect(videoModelIdFromBody(undefined)).toBe("pruna-p-video");
    expect(videoModelIdFromBody("seedance-2.0-fast")).toBe("seedance-2.0-fast");
    expect(videoModelIdFromBody("luma/ray-flash-2-720p")).toBe("luma-ray-flash-2-720p");
    expect(() => videoModelIdFromBody("someone/unknown")).toThrow(/Unknown video model/);
  });
});
