import assert from "node:assert/strict";
import { test } from "node:test";

import { ReplicateMediaProvider } from "../src/replicate/provider.ts";
import {
  P_VIDEO_MODEL,
  describePVideoInput,
  isPVideoModel,
  toPVideoInput,
} from "../src/replicate/p-video.ts";
import type { ReplicatePredictionClient } from "../src/replicate/client.ts";

test("p-video mapping sends A′ and B′ and keeps the composed prompt intact", () => {
  const input = toPVideoInput(
    {
      startImage: { kind: "url", url: "https://example.com/a-prime.png" },
      endImage: { kind: "url", url: "https://example.com/b-prime.png" },
      prompt: "First person POV camera continuously moving forward.\nTrack through the opening.",
      durationSeconds: 6,
      seed: 70,
    },
    { kind: "url", url: "https://example.com/a-prime.png" },
    { kind: "url", url: "https://example.com/b-prime.png" },
    { draft: true, promptUpsampling: false, resolution: "720p" },
  );
  assert.equal(input.image, "https://example.com/a-prime.png");
  assert.equal(input.last_frame_image, "https://example.com/b-prime.png");
  assert.equal(input.duration, 6);
  assert.equal(input.resolution, "720p");
  assert.equal(input.draft, true);
  assert.equal(input.prompt_upsampling, false);
  assert.equal(input.save_audio, false);
  assert.equal(input.seed, 70);
  const described = describePVideoInput(
    {
      startImage: { kind: "url", url: "https://example.com/a-prime.png" },
      endImage: { kind: "url", url: "https://example.com/b-prime.png" },
      prompt: "go",
      durationSeconds: 6,
    },
    "<start A′>",
    "<end B′>",
  );
  assert.equal(described.endImageSent, true);
  assert.equal(described.last_frame_image, "<end B′>");
  assert.equal(described.image, "<start A′>");
});

test("p-video mapping omits last_frame_image when no end frame is supplied", () => {
  const input = toPVideoInput(
    {
      startImage: { kind: "url", url: "https://example.com/a-prime.png" },
      prompt: "forward",
      durationSeconds: 6,
    },
    { kind: "url", url: "https://example.com/a-prime.png" },
  );
  assert.equal("last_frame_image" in input, false);
  const described = describePVideoInput(
    {
      startImage: { kind: "url", url: "https://example.com/a-prime.png" },
      prompt: "go",
      durationSeconds: 6,
    },
    "<start A′>",
  );
  assert.equal(described.endImageSent, false);
  assert.equal("last_frame_image" in described, false);
});

test("provider p-video path forwards B′ as last_frame_image", async () => {
  let captured: Record<string, unknown> | undefined;
  const client: ReplicatePredictionClient = {
    async create(options) {
      captured = options.input;
      return { id: "pred_p", status: "starting", model: P_VIDEO_MODEL };
    },
    async wait() {
      return {
        id: "pred_p",
        status: "succeeded",
        model: P_VIDEO_MODEL,
        version: "abc",
        output: "https://replicate.delivery/p-video.mp4",
        input: captured,
      };
    },
  };
  const provider = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    model: P_VIDEO_MODEL,
    client,
  });
  const result = await provider.generateVideo({
    startImage: { kind: "url", url: "https://example.com/a-prime.png" },
    endImage: { kind: "url", url: "https://example.com/b-prime.png" },
    prompt: "forward",
    durationSeconds: 6,
  });
  assert.equal(isPVideoModel(P_VIDEO_MODEL), true);
  assert.equal(captured?.image, "https://example.com/a-prime.png");
  assert.equal(captured?.last_frame_image, "https://example.com/b-prime.png");
  assert.equal(captured?.draft, true);
  assert.equal(captured?.prompt_upsampling, false);
  assert.equal(captured?.duration, 6);
  assert.equal(captured?.resolution, "720p");
  assert.equal(result.model, P_VIDEO_MODEL);
  assert.equal(result.outputUrl, "https://replicate.delivery/p-video.mp4");
});
