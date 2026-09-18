import assert from "node:assert/strict";
import { test } from "node:test";

import { ReplicateMediaProvider } from "../src/replicate/provider.ts";
import { kling25TurboProDuration, KLING_25_TURBO_PRO_MODEL, toKling25TurboProInput } from "../src/replicate/kling-v2.5-turbo-pro.ts";
import { klingV3Duration, KLING_V3_VIDEO_MODEL, toKlingV3VideoInput } from "../src/replicate/kling-v3-video.ts";
import { toVeo31FastInput, VEO_31_FAST_MODEL, veo31FastDuration } from "../src/replicate/veo-3.1-fast.ts";
import { SEEDANCE_20_FAST_MODEL, toSeedance20FastInput } from "../src/replicate/seedance-2.0-fast.ts";
import { P_VIDEO_MODEL } from "../src/replicate/p-video.ts";
import { SEEDANCE_25_MODEL } from "../src/replicate/seedance-2.5.ts";
import {
  DEFAULT_VIDEO_MODEL_ID,
  parseVideoModelId,
  mapDurationToVideoModel,
  videoModelDurationSeconds,
  videoModelDurationSupport,
  videoModelMenuLabel,
  videoModelSlug,
  VIDEO_MODELS,
} from "../src/replicate/video-models.ts";
import type { ReplicatePredictionClient } from "../src/replicate/client.ts";

const request = {
  startImage: { kind: "url" as const, url: "https://example.com/a-prime.png" },
  endImage: { kind: "url" as const, url: "https://example.com/b-prime.png" },
  prompt: "First person POV camera continuously moving forward.",
  durationSeconds: 6,
};

const start = { kind: "url" as const, url: "https://example.com/a-prime.png" };
const end = { kind: "url" as const, url: "https://example.com/b-prime.png" };

test("catalog maps a cinematic target onto each model's supported durations", () => {
  assert.deepEqual(videoModelDurationSupport("kling-v2.5-turbo-pro"), { kind: "enum", values: [5, 10] });
  assert.deepEqual(videoModelDurationSupport("veo-3.1-fast"), { kind: "enum", values: [4, 6, 8] });
  assert.equal(mapDurationToVideoModel("pruna-p-video", 7), 7);
  assert.equal(mapDurationToVideoModel("pruna-p-video", 15), 15);
  assert.equal(mapDurationToVideoModel("pruna-p-video", 21), 20);
  assert.equal(mapDurationToVideoModel("kling-v2.5-turbo-pro", 7), 5);
  assert.equal(mapDurationToVideoModel("kling-v2.5-turbo-pro", 8), 10);
  assert.equal(mapDurationToVideoModel("kling-v2.5-turbo-pro", 5), 5);
  assert.equal(mapDurationToVideoModel("veo-3.1-fast", 7), 6);
  assert.equal(mapDurationToVideoModel("veo-3.1-fast", 5), 6);
  assert.equal(mapDurationToVideoModel("veo-3.1-fast", 4), 4);
  assert.equal(mapDurationToVideoModel("kling-v3-video", 7), 7);
  assert.equal(mapDurationToVideoModel("seedance-2.0-fast", 3), 4);
  assert.equal(mapDurationToVideoModel("seedance-2.5", 31), 30);
  assert.equal(mapDurationToVideoModel("pruna-p-video", Number.NaN), 5);
});

test("catalog keeps Pruna as the development default and labels cost tiers", () => {
  assert.equal(DEFAULT_VIDEO_MODEL_ID, "pruna-p-video");
  assert.equal(videoModelSlug("pruna-p-video"), P_VIDEO_MODEL);
  assert.equal(videoModelSlug("kling-v2.5-turbo-pro"), KLING_25_TURBO_PRO_MODEL);
  assert.equal(videoModelSlug("kling-v3-video"), KLING_V3_VIDEO_MODEL);
  assert.equal(videoModelSlug("veo-3.1-fast"), VEO_31_FAST_MODEL);
  assert.equal(videoModelSlug("seedance-2.0-fast"), SEEDANCE_20_FAST_MODEL);
  assert.equal(videoModelSlug("seedance-2.5"), SEEDANCE_25_MODEL);
  assert.equal(videoModelDurationSeconds("pruna-p-video"), 5);
  assert.equal(videoModelDurationSeconds("kling-v2.5-turbo-pro"), 5);
  assert.equal(videoModelDurationSeconds("kling-v3-video"), 6);
  assert.equal(videoModelDurationSeconds("veo-3.1-fast"), 6);
  assert.equal(parseVideoModelId("kwaivgi/kling-v3-video"), "kling-v3-video");
  assert.equal(parseVideoModelId("google/veo-3.1-fast"), "veo-3.1-fast");
  assert.equal(parseVideoModelId("bytedance/seedance-2.5"), "seedance-2.5");
  assert.equal(parseVideoModelId("wan-2.2-first-last-frame"), "kling-v2.5-turbo-pro");
  assert.equal(videoModelMenuLabel(VIDEO_MODELS[0]!), "Pruna $");
  assert.deepEqual(
    VIDEO_MODELS.map((item) => item.cost),
    ["$", "$$", "$$$", "$$$", "$$", "$$$"],
  );
});

test("Kling 2.5 Turbo Pro maps A′/B′ onto start_image and end_image", () => {
  const input = toKling25TurboProInput(request, start, end);
  assert.equal(input.start_image, "https://example.com/a-prime.png");
  assert.equal(input.end_image, "https://example.com/b-prime.png");
  assert.equal(input.duration, 5);
  assert.equal("aspect_ratio" in input, false);
  assert.equal("image" in input, false);
  assert.equal(kling25TurboProDuration(6), 5);
  assert.equal(kling25TurboProDuration(10), 10);
});

test("Kling 3 maps A′/B′ onto start_image and end_image at 6s with mode", () => {
  const input = toKlingV3VideoInput(request, start, end, { mode: "pro" });
  assert.equal(input.start_image, "https://example.com/a-prime.png");
  assert.equal(input.end_image, "https://example.com/b-prime.png");
  assert.equal(input.duration, 6);
  assert.equal(input.mode, "pro");
  assert.equal(input.generate_audio, false);
  assert.equal(klingV3Duration(), 6);
  assert.equal(klingV3Duration(6), 6);
  assert.equal(klingV3Duration(5), 5);
  const standard = toKlingV3VideoInput(request, start, end);
  assert.equal(standard.mode, "standard");
});

test("Veo 3.1 Fast maps A′/B′ onto image and last_frame at 6s 1080p", () => {
  const input = toVeo31FastInput(request, start, end);
  assert.equal(input.image, "https://example.com/a-prime.png");
  assert.equal(input.last_frame, "https://example.com/b-prime.png");
  assert.equal(input.duration, 6);
  assert.equal(input.resolution, "1080p");
  assert.equal(input.aspect_ratio, "16:9");
  assert.equal(input.generate_audio, false);
  assert.equal(toVeo31FastInput(request, start, end, { generateAudio: true }).generate_audio, true);
  assert.equal(veo31FastDuration(), 6);
  assert.equal(veo31FastDuration(6), 6);
  assert.equal(veo31FastDuration(8), 8);
  assert.equal(veo31FastDuration(4), 4);
});

test("Seedance 2.0 Fast maps A′/B′ onto image and last_frame_image without audio", () => {
  const input = toSeedance20FastInput(request, start, end);
  assert.equal(input.image, "https://example.com/a-prime.png");
  assert.equal(input.last_frame_image, "https://example.com/b-prime.png");
  assert.equal(input.duration, 6);
  assert.equal(input.resolution, "720p");
  assert.equal(input.aspect_ratio, "adaptive");
  assert.equal(input.generate_audio, false);
  assert.equal("watermark" in input, false);
});

test("provider Kling path forwards start_image and end_image", async () => {
  let captured: Record<string, unknown> | undefined;
  const client: ReplicatePredictionClient = {
    async create(options) {
      captured = options.input;
      return { id: "pred_kling", status: "starting", model: "kwaivgi/kling-v2.5-turbo-pro" };
    },
    async wait() {
      return {
        id: "pred_kling",
        status: "succeeded",
        model: "kwaivgi/kling-v2.5-turbo-pro",
        output: "https://replicate.delivery/kling.mp4",
      };
    },
  };
  const provider = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    model: "kwaivgi/kling-v2.5-turbo-pro",
    client,
  });
  await provider.generateVideo(request);
  assert.equal(captured?.start_image, "https://example.com/a-prime.png");
  assert.equal(captured?.end_image, "https://example.com/b-prime.png");
  assert.equal(captured?.duration, 5);
  assert.equal("aspect_ratio" in (captured ?? {}), false);
});

test("provider Kling 3 path forwards start_image, end_image, 6s, and mode", async () => {
  let captured: Record<string, unknown> | undefined;
  const client: ReplicatePredictionClient = {
    async create(options) {
      captured = options.input;
      return { id: "pred_kling3", status: "starting", model: "kwaivgi/kling-v3-video" };
    },
    async wait() {
      return {
        id: "pred_kling3",
        status: "succeeded",
        model: "kwaivgi/kling-v3-video",
        output: "https://replicate.delivery/kling3.mp4",
      };
    },
  };
  const provider = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    model: "kwaivgi/kling-v3-video",
    klingV3: { mode: "4k" },
    client,
  });
  await provider.generateVideo(request);
  assert.equal(captured?.start_image, "https://example.com/a-prime.png");
  assert.equal(captured?.end_image, "https://example.com/b-prime.png");
  assert.equal(captured?.duration, 6);
  assert.equal(captured?.mode, "4k");
  assert.equal(captured?.generate_audio, false);
});

test("provider Veo and Seedance forward generate_audio when asked", async () => {
  let captured: Record<string, unknown> | undefined;
  const client: ReplicatePredictionClient = {
    async create(options) {
      captured = options.input;
      return { id: "pred_audio", status: "starting", model: options.model };
    },
    async wait(prediction) {
      return {
        id: prediction.id,
        status: "succeeded",
        model: prediction.model,
        output: "https://replicate.delivery/audio.mp4",
      };
    },
  };
  const veo = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    model: "google/veo-3.1-fast",
    generateAudio: true,
    client,
  });
  await veo.generateVideo(request);
  assert.equal(captured?.generate_audio, true);
  const seedance = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    model: "bytedance/seedance-2.5",
    generateAudio: true,
    client,
  });
  await seedance.generateVideo(request);
  assert.equal(captured?.generate_audio, true);
});

test("provider Veo 3.1 Fast path forwards image and last_frame", async () => {
  let captured: Record<string, unknown> | undefined;
  const client: ReplicatePredictionClient = {
    async create(options) {
      captured = options.input;
      return { id: "pred_veo", status: "starting", model: "google/veo-3.1-fast" };
    },
    async wait() {
      return {
        id: "pred_veo",
        status: "succeeded",
        model: "google/veo-3.1-fast",
        output: "https://replicate.delivery/veo.mp4",
      };
    },
  };
  const provider = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    model: "google/veo-3.1-fast",
    client,
  });
  await provider.generateVideo(request);
  assert.equal(captured?.image, "https://example.com/a-prime.png");
  assert.equal(captured?.last_frame, "https://example.com/b-prime.png");
  assert.equal(captured?.duration, 6);
  assert.equal(captured?.resolution, "1080p");
  assert.equal(captured?.generate_audio, false);
});

test("provider Seedance 2.0 Fast path omits 2.5-only watermark fields", async () => {
  let captured: Record<string, unknown> | undefined;
  const client: ReplicatePredictionClient = {
    async create(options) {
      captured = options.input;
      return { id: "pred_fast", status: "starting", model: "bytedance/seedance-2.0-fast" };
    },
    async wait() {
      return {
        id: "pred_fast",
        status: "succeeded",
        model: "bytedance/seedance-2.0-fast",
        output: "https://replicate.delivery/fast.mp4",
      };
    },
  };
  const provider = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    model: "bytedance/seedance-2.0-fast",
    seedance: {
      generateAudio: false,
      resolution: "720p",
      aspectRatio: "adaptive",
      watermark: false,
      outputFormat: "mp4",
    },
    client,
  });
  await provider.generateVideo(request);
  assert.equal(captured?.image, "https://example.com/a-prime.png");
  assert.equal(captured?.last_frame_image, "https://example.com/b-prime.png");
  assert.equal(captured?.generate_audio, false);
  assert.equal("watermark" in (captured ?? {}), false);
  assert.equal("output_format" in (captured ?? {}), false);
});

test("provider rejects an unknown video model", async () => {
  const provider = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    model: "someone/unknown-video",
    client: {
      async create() {
        throw new Error("should not call Replicate");
      },
      async wait() {
        throw new Error("should not wait");
      },
    },
  });
  await assert.rejects(
    () => provider.generateVideo(request),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.match(error.message, /Unsupported video model/);
      return true;
    },
  );
});
