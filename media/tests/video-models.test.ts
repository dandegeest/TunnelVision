import assert from "node:assert/strict";
import { test } from "node:test";

import { ReplicateMediaProvider } from "../src/replicate/provider.ts";
import { lumaRayFlash2Duration, LUMA_RAY_FLASH_2_720P_MODEL, toLumaRayFlash2Input } from "../src/replicate/luma-ray-flash-2-720p.ts";
import { toWan22I2vFastInput, WAN_22_I2V_FAST_MODEL, wan22FrameCount } from "../src/replicate/wan-2.2-i2v-fast.ts";
import { SEEDANCE_20_FAST_MODEL, toSeedance20FastInput } from "../src/replicate/seedance-2.0-fast.ts";
import { P_VIDEO_MODEL } from "../src/replicate/p-video.ts";
import { SEEDANCE_25_MODEL } from "../src/replicate/seedance-2.5.ts";
import {
  DEFAULT_VIDEO_MODEL_ID,
  parseVideoModelId,
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

test("catalog keeps Pruna as the development default and labels cost tiers", () => {
  assert.equal(DEFAULT_VIDEO_MODEL_ID, "pruna-p-video");
  assert.equal(videoModelSlug("pruna-p-video"), P_VIDEO_MODEL);
  assert.equal(videoModelSlug("luma-ray-flash-2-720p"), LUMA_RAY_FLASH_2_720P_MODEL);
  assert.equal(videoModelSlug("wan-2.2-first-last-frame"), WAN_22_I2V_FAST_MODEL);
  assert.equal(videoModelSlug("seedance-2.0-fast"), SEEDANCE_20_FAST_MODEL);
  assert.equal(videoModelSlug("seedance-2.5"), SEEDANCE_25_MODEL);
  assert.equal(parseVideoModelId("bytedance/seedance-2.5"), "seedance-2.5");
  assert.equal(videoModelMenuLabel(VIDEO_MODELS[0]!), "Pruna $");
  assert.deepEqual(
    VIDEO_MODELS.map((item) => item.cost),
    ["$", "$$", "$$", "$$", "$$$"],
  );
});

test("Luma Ray Flash 2 maps A′/B′ onto start_image and end_image", () => {
  const input = toLumaRayFlash2Input(request, start, end);
  assert.equal(input.start_image, "https://example.com/a-prime.png");
  assert.equal(input.end_image, "https://example.com/b-prime.png");
  assert.equal(input.duration, 5);
  assert.equal(input.aspect_ratio, "16:9");
  assert.equal(input.loop, false);
  assert.equal(lumaRayFlash2Duration(6), 5);
  assert.equal(lumaRayFlash2Duration(9), 9);
});

test("Wan 2.2 I2V Fast maps A′/B′ onto image and last_image", () => {
  const input = toWan22I2vFastInput(request, start, end);
  assert.equal(input.image, "https://example.com/a-prime.png");
  assert.equal(input.last_image, "https://example.com/b-prime.png");
  assert.equal(input.go_fast, true);
  assert.equal(input.num_frames, wan22FrameCount(6));
  assert.equal(wan22FrameCount(6), 97);
  assert.equal(input.frames_per_second, 16);
  assert.equal(input.resolution, "480p");
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

test("provider Luma path forwards start_image and end_image", async () => {
  let captured: Record<string, unknown> | undefined;
  const client: ReplicatePredictionClient = {
    async create(options) {
      captured = options.input;
      return { id: "pred_luma", status: "starting", model: "luma/ray-flash-2-720p" };
    },
    async wait() {
      return {
        id: "pred_luma",
        status: "succeeded",
        model: "luma/ray-flash-2-720p",
        output: "https://replicate.delivery/luma.mp4",
      };
    },
  };
  const provider = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    model: "luma/ray-flash-2-720p",
    client,
  });
  await provider.generateVideo(request);
  assert.equal(captured?.start_image, "https://example.com/a-prime.png");
  assert.equal(captured?.end_image, "https://example.com/b-prime.png");
  assert.equal(captured?.loop, false);
});

test("provider Wan path forwards image and last_image", async () => {
  let captured: Record<string, unknown> | undefined;
  const client: ReplicatePredictionClient = {
    async create(options) {
      captured = options.input;
      return { id: "pred_wan", status: "starting", model: "wan-video/wan-2.2-i2v-fast" };
    },
    async wait() {
      return {
        id: "pred_wan",
        status: "succeeded",
        model: "wan-video/wan-2.2-i2v-fast",
        output: "https://replicate.delivery/wan.mp4",
      };
    },
  };
  const provider = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    model: "wan-video/wan-2.2-i2v-fast",
    client,
  });
  await provider.generateVideo(request);
  assert.equal(captured?.image, "https://example.com/a-prime.png");
  assert.equal(captured?.last_image, "https://example.com/b-prime.png");
  assert.equal(captured?.go_fast, true);
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
