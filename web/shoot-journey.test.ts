import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { locomotionBaseline, composeShootingPrompt, LOCOMOTION_PACES } from "../media/src/cinematographer/shooting-prompt.ts";
import {
  CAMOTION_EXPOSURE_STRENGTH_BY_PACE,
  productionCameraMotionPlan,
} from "../media/src/cinematographer/camera-motion-plan.ts";
import { shootPreparedJourney, stagePreparedMotionPlan, videoModelIdFromBody } from "./shoot-journey.ts";
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
    const renderedStrengths: number[] = [];
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
      renderFrame: async (imagePath, plan) => {
        rendered.push(imagePath);
        renderedStrengths.push(plan.exposure.strength);
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
    expect(take.startCanonicalMediaId).toBe(start.mediaId);
    expect(take.endCanonicalMediaId).toBe(end.mediaId);
    expect(take.videoInputs).toEqual({ startShootingFrame: true, endShootingFrame: true });
    expect(take.effectivePrompt).toBe(composeShootingPrompt(locomotionBaseline("slow"), addition));
    expect(take.effectivePrompt.startsWith(addition)).toBe(true);
    expect(take.effectivePrompt.endsWith(locomotionBaseline("slow"))).toBe(true);
    expect(take.effectivePrompt).toMatch(/at a constant, slow speed/);
    expect(take.pace).toBe("slow");
    expect(take.startPlan).toEqual(productionCameraMotionPlan("slow"));
    expect(take.endPlan).toEqual(productionCameraMotionPlan("slow"));
    expect(renderedStrengths).toEqual([
      CAMOTION_EXPOSURE_STRENGTH_BY_PACE.slow,
      CAMOTION_EXPOSURE_STRENGTH_BY_PACE.slow,
    ]);
    expect(take.durationSeconds).toBe(5);
    expect(take.model).toBe("prunaai/p-video");
    expect(take.seed).toBe(70);
    expect(videoRequest.hasEnd).toBe(true);
    expect(videoRequest.duration).toBe(5);
    expect(videoRequest.prompt).toBe(take.effectivePrompt);
    expect(videoRequest.startPath).toBe(registry.get(take.startShootingFrame.mediaId)?.filePath);
    expect(videoRequest.endPath).toBe(registry.get(take.endShootingFrame.mediaId)?.filePath);
    expect(take.startShootingFrame.mediaId).not.toBe(take.endShootingFrame.mediaId);
    expect(take.videoUrl).toBe("https://example.test/a-b.mp4");
    expect(take.camotion).toEqual({
      depthSupplied: false,
      depthPath: null,
      startDepthPath: null,
      endDepthPath: null,
      workDirRetained: false,
    });
  });

  it("records reusable canonical depth while keeping A′/B′ segment-specific", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-shoot-depth-")));
    setActiveRuntimeMediaRegistry(registry);
    const start = registry.register(PNG, "image/png");
    const end = registry.register(PNG, "image/png");
    const mediaIds: string[] = [];
    const staged = await stagePreparedMotionPlan({
      repoRoot,
      body: {
        journeyId: "A-B",
        startMediaId: start.mediaId,
        endMediaId: end.mediaId,
      },
      renderFrame: async (_imagePath, _plan, mediaId) => {
        mediaIds.push(mediaId);
        return {
          bytes: PNG,
          workDir: "/tmp/start",
          planPath: "/tmp/plan.json",
          outputPath: "/tmp/shooting.png",
          depthPath: `/tmp/depth-${mediaId}.png`,
          depthSupplied: true,
          workDirRetained: false,
        };
      },
    });
    expect(mediaIds).toEqual([start.mediaId, end.mediaId]);
    expect(staged.startPlan.exposure.strength).toBe(staged.endPlan.exposure.strength);
    expect(staged.camotion.depthSupplied).toBe(true);
    expect(staged.camotion.startDepthPath).toBe(`/tmp/depth-${start.mediaId}.png`);
    expect(staged.camotion.endDepthPath).toBe(`/tmp/depth-${end.mediaId}.png`);
    expect(staged.startShootingFrame.mediaId).not.toBe(staged.endShootingFrame.mediaId);
  });

  it("maps an original target onto the selected model's supported duration", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-shoot-duration-")));
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
        videoModel: "veo-3.1-fast",
        targetDurationSeconds: 7,
        pace: "fast",
      },
      renderFrame: async () => PNG,
      generateVideo: async (request) => {
        duration = request.durationSeconds;
        return {
          provider: "replicate",
          model: "google/veo-3.1-fast",
          modelVersion: "test",
          predictionId: "pred-veo-duration",
          status: "succeeded",
          outputUrl: "https://example.test/veo.mp4",
          metadata: {},
          startedAt: "2026-09-17T00:00:00.000Z",
          completedAt: "2026-09-17T00:00:06.000Z",
          elapsedMs: 6000,
        };
      },
    });
    expect(duration).toBe(6);
    expect(take.durationSeconds).toBe(6);
    expect(take.pace).toBe("fast");
  });

  it("requests and records Kling's 5s clip length", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-shoot-kling-")));
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
        videoModel: "kling-v2.5-turbo-pro",
      },
      renderFrame: async () => PNG,
      generateVideo: async (request) => {
        duration = request.durationSeconds;
        return {
          provider: "replicate",
          model: "kwaivgi/kling-v2.5-turbo-pro",
          modelVersion: "test",
          predictionId: "pred-kling",
          status: "succeeded",
          outputUrl: "https://example.test/kling.mp4",
          metadata: {},
          startedAt: "2026-09-09T00:00:00.000Z",
          completedAt: "2026-09-09T00:00:05.000Z",
          elapsedMs: 5000,
        };
      },
    });
    expect(duration).toBe(5);
    expect(take.durationSeconds).toBe(5);
    expect(take.model).toBe("kwaivgi/kling-v2.5-turbo-pro");
  });

  it("requests Kling 3 at 6s like the other Quality models", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-shoot-kling3-")));
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
        videoModel: "kling-v3-video",
        klingV3Mode: "4k",
      },
      renderFrame: async () => PNG,
      generateVideo: async (request) => {
        duration = request.durationSeconds;
        return {
          provider: "replicate",
          model: "kwaivgi/kling-v3-video",
          modelVersion: "test",
          predictionId: "pred-kling3",
          status: "succeeded",
          outputUrl: "https://example.test/kling3.mp4",
          metadata: {},
          startedAt: "2026-09-15T00:00:00.000Z",
          completedAt: "2026-09-15T00:00:06.000Z",
          elapsedMs: 6000,
        };
      },
    });
    expect(duration).toBe(6);
    expect(take.durationSeconds).toBe(6);
    expect(take.model).toBe("kwaivgi/kling-v3-video");
    expect(videoModelIdFromBody("kwaivgi/kling-v3-video")).toBe("kling-v3-video");
  });

  it("stages A′/B′ without generating video", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-stage-")));
    setActiveRuntimeMediaRegistry(registry);
    const start = registry.register(PNG, "image/png");
    const end = registry.register(PNG, "image/png");
    const addition = "Track forward through the visible opening into the next volume.";
    const staged = await stagePreparedMotionPlan({
      repoRoot,
      body: {
        journeyId: "A-B",
        startMediaId: start.mediaId,
        endMediaId: end.mediaId,
        segmentPromptAddition: addition,
        pace: "slow",
      },
      renderFrame: async () => PNG,
    });
    expect(staged.effectivePrompt.startsWith(addition)).toBe(true);
    expect(staged.effectivePrompt).toMatch(/First person POV camera continuously moving forward/);
    expect(staged.startShootingFrame.mediaId).not.toBe(staged.endShootingFrame.mediaId);
    expect(registry.get(staged.startShootingFrame.mediaId)?.filePath).toBeDefined();
  });

  it("stages each camera grammar's locomotion instead of falling back to POV", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-stage-grammar-")));
    setActiveRuntimeMediaRegistry(registry);
    const start = registry.register(PNG, "image/png");
    const end = registry.register(PNG, "image/png");
    const addition = "Continue along the visible route.";
    const cases = [
      {
        grammar: "pov" as const,
        law: /First person POV camera continuously moving forward/,
        forbid: [] as RegExp[],
      },
      {
        grammar: "follow" as const,
        law: /Invisible objective camera continuously following/,
        forbid: [
          /First person POV camera continuously moving forward/,
          /Maintain an unembodied first-person POV/,
        ],
      },
      {
        grammar: "lead" as const,
        law: /Invisible objective camera traveling continuously ahead of a persistent subject while facing that subject/,
        forbid: [
          /First person POV camera continuously moving forward/,
          /Maintain an unembodied first-person POV/,
        ],
      },
      {
        grammar: "mounted" as const,
        law: /Camera physically mounted to a moving subject/,
        forbid: [
          /First person POV camera continuously moving forward/,
          /Maintain an unembodied first-person POV/,
        ],
      },
    ];
    for (const { grammar, law, forbid } of cases) {
      const staged = await stagePreparedMotionPlan({
        repoRoot,
        body: {
          journeyId: "A-B",
          startMediaId: start.mediaId,
          endMediaId: end.mediaId,
          segmentPromptAddition: addition,
          pace: "fast",
          cameraGrammar: grammar,
        },
        renderFrame: async () => PNG,
      });
      expect(staged.effectivePrompt).toBe(
        composeShootingPrompt(locomotionBaseline("fast", grammar), addition, "fast"),
      );
      expect(staged.effectivePrompt).toMatch(/Do not invent intermediate structures or passageways/);
      expect(staged.effectivePrompt).toMatch(law);
      for (const pattern of forbid) {
        expect(staged.effectivePrompt).not.toMatch(pattern);
      }
    }
  });

  it("stages threshold-connective travel when pull-forward is off", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-stage-pf-off-")));
    setActiveRuntimeMediaRegistry(registry);
    const start = registry.register(PNG, "image/png");
    const end = registry.register(PNG, "image/png");
    const addition = "Travel through the implied doorway into the courtyard.";
    const staged = await stagePreparedMotionPlan({
      repoRoot,
      body: {
        journeyId: "A-B",
        startMediaId: start.mediaId,
        endMediaId: end.mediaId,
        segmentPromptAddition: addition,
        pace: "fast",
        pullForwardReferenceEnabled: false,
      },
      renderFrame: async () => PNG,
    });
    expect(staged.effectivePrompt).toBe(
      composeShootingPrompt(locomotionBaseline("fast", "pov", false), addition, "fast"),
    );
    expect(staged.effectivePrompt).toMatch(/connective threshold implied by the Journey/);
    expect(staged.effectivePrompt).toMatch(/necessary connective geometry/);
    expect(staged.effectivePrompt).not.toMatch(/Do not invent intermediate structures or passageways/);
    expect(staged.effectivePrompt).toMatch(/Do not dissolve, morph, crossfade, cut, teleport/);
    expect(staged.effectivePrompt).toMatch(/First person POV camera continuously moving forward/);
  });

  it("executes Camotion with the mapped exposure for every CM pace", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-pace-exposure-")));
    setActiveRuntimeMediaRegistry(registry);
    const start = registry.register(PNG, "image/png");
    const end = registry.register(PNG, "image/png");
    for (const pace of LOCOMOTION_PACES) {
      const strength = CAMOTION_EXPOSURE_STRENGTH_BY_PACE[pace];
      const used: number[] = [];
      const staged = await stagePreparedMotionPlan({
        repoRoot,
        body: {
          journeyId: "A-B",
          startMediaId: start.mediaId,
          endMediaId: end.mediaId,
          segmentPromptAddition: "Track forward through the visible opening into the next volume.",
          pace,
        },
        renderFrame: async (_imagePath, plan) => {
          used.push(plan.exposure.strength);
          return PNG;
        },
      });
      expect(used).toEqual([strength, strength]);
      expect(staged.startPlan.exposure.strength).toBe(strength);
      expect(staged.endPlan.exposure.strength).toBe(strength);
      expect(staged.pace).toBe(pace);
    }
  });

  it("renders A′/B′ with the supplied per-segment CameraMotionPlans", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-stage-plans-")));
    setActiveRuntimeMediaRegistry(registry);
    const start = registry.register(PNG, "image/png");
    const end = registry.register(PNG, "image/png");
    const startPlan = {
      version: 1 as const,
      camera: { vanishing_point: [0.62, 0.41] as const, forward: 1 },
      destination: { point: [0.62, 0.41] as const, protect: true, bbox: [0.52, 0.31, 0.72, 0.51] as const },
      exposure: { strength: 0.08, samples: 16 },
    };
    const endPlan = {
      version: 1 as const,
      camera: { vanishing_point: [0.71, 0.36] as const, forward: 1 },
      destination: { point: [0.71, 0.36] as const, protect: true, bbox: [0.61, 0.26, 0.81, 0.46] as const },
      exposure: { strength: 0.08, samples: 16 },
    };
    const used: unknown[] = [];
    const staged = await stagePreparedMotionPlan({
      repoRoot,
      body: {
        journeyId: "A-B",
        startMediaId: start.mediaId,
        endMediaId: end.mediaId,
        segmentPromptAddition: "Track forward through the visible opening into the next volume.",
        pace: "fast",
        startPlan,
        endPlan,
      },
      renderFrame: async (_imagePath, plan) => {
        used.push(plan);
        return PNG;
      },
    });
    expect(used).toEqual([startPlan, endPlan]);
    expect(staged.startPlan).toEqual(startPlan);
    expect(staged.endPlan).toEqual(endPlan);
  });

  it("films staged A′/B′ without rendering Camotion again", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-staged-shoot-")));
    setActiveRuntimeMediaRegistry(registry);
    const start = registry.register(PNG, "image/png");
    const end = registry.register(PNG, "image/png");
    const primedStart = registry.register(PNG, "image/png");
    const primedEnd = registry.register(PNG, "image/png");
    const rendered: string[] = [];
    const addition = "Track forward through the visible opening into the next volume.";
    const take = await shootPreparedJourney({
      repoRoot,
      body: {
        journeyId: "A-B",
        startMediaId: start.mediaId,
        endMediaId: end.mediaId,
        startShootingMediaId: primedStart.mediaId,
        endShootingMediaId: primedEnd.mediaId,
        segmentPromptAddition: addition,
        pace: "slow",
        effectivePrompt: composeShootingPrompt(locomotionBaseline("slow"), addition),
      },
      renderFrame: async (imagePath) => {
        rendered.push(imagePath);
        return PNG;
      },
      generateVideo: async (request) => {
        expect(request.startImage.kind === "file" ? request.startImage.path : undefined).toBe(primedStart.filePath);
        expect(request.endImage?.kind === "file" ? request.endImage.path : undefined).toBe(primedEnd.filePath);
        return {
          provider: "replicate",
          model: "prunaai/p-video",
          modelVersion: "test",
          predictionId: "pred-staged",
          status: "succeeded",
          outputUrl: "https://example.test/staged.mp4",
          metadata: {},
          startedAt: "2026-09-10T00:00:00.000Z",
          completedAt: "2026-09-10T00:00:06.000Z",
          elapsedMs: 6000,
        };
      },
    });
    expect(rendered).toEqual([]);
    expect(take.startShootingFrame.mediaId).toBe(primedStart.mediaId);
    expect(take.endShootingFrame.mediaId).toBe(primedEnd.mediaId);
    expect(take.videoUrl).toBe("https://example.test/staged.mp4");
  });

  it("sends the stored Motion Plan effectivePrompt to video unchanged", async () => {
    const registry = createRuntimeMediaRegistry(mkdtempSync(resolve(tmpdir(), "tv-stored-prompt-")));
    setActiveRuntimeMediaRegistry(registry);
    const start = registry.register(PNG, "image/png");
    const end = registry.register(PNG, "image/png");
    const primedStart = registry.register(PNG, "image/png");
    const primedEnd = registry.register(PNG, "image/png");
    const stored = "STORED_MOTION_PLAN_PROMPT_MUST_PASS_THROUGH_UNCHANGED";
    let videoPrompt: string | undefined;
    const take = await shootPreparedJourney({
      repoRoot,
      body: {
        journeyId: "A-B",
        startMediaId: start.mediaId,
        endMediaId: end.mediaId,
        startShootingMediaId: primedStart.mediaId,
        endShootingMediaId: primedEnd.mediaId,
        segmentPromptAddition: "Would be recomposed if SHOOT rebuilt the prompt.",
        pace: "fast",
        cameraGrammar: "pov",
        effectivePrompt: stored,
      },
      renderFrame: async () => PNG,
      generateVideo: async (request) => {
        videoPrompt = request.prompt;
        return {
          provider: "replicate",
          model: "prunaai/p-video",
          modelVersion: "test",
          predictionId: "pred-stored",
          status: "succeeded",
          outputUrl: "https://example.test/stored.mp4",
          metadata: {},
          startedAt: "2026-09-10T00:00:00.000Z",
          completedAt: "2026-09-10T00:00:06.000Z",
          elapsedMs: 6000,
        };
      },
    });
    expect(videoPrompt).toBe(stored);
    expect(take.effectivePrompt).toBe(stored);
    expect(take.effectivePrompt).not.toMatch(/First person POV camera continuously moving forward/);
  });

  it("accepts a catalog video model id or Replicate slug", () => {
    expect(videoModelIdFromBody(undefined)).toBe("pruna-p-video");
    expect(videoModelIdFromBody("seedance-2.0-fast")).toBe("seedance-2.0-fast");
    expect(videoModelIdFromBody("kwaivgi/kling-v2.5-turbo-pro")).toBe("kling-v2.5-turbo-pro");
    expect(() => videoModelIdFromBody("someone/unknown")).toThrow(/Unknown video model/);
  });
});
