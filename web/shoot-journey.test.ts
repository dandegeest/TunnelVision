import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { TUNNELVISION_LOCOMOTION_BASELINE, composeShootingPrompt } from "../media/src/cinematographer/shooting-prompt.ts";
import { productionCameraMotionPlan } from "../media/src/cinematographer/camera-motion-plan.ts";
import { shootPreparedJourney } from "./shoot-journey.ts";
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
    expect(take.effectivePrompt).toBe(composeShootingPrompt(TUNNELVISION_LOCOMOTION_BASELINE, addition));
    expect(take.effectivePrompt.startsWith(TUNNELVISION_LOCOMOTION_BASELINE)).toBe(true);
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
});
