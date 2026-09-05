import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { MediaGenerationError } from "../src/errors.ts";
import { classifyProviderFailure } from "../src/errors.ts";
import { sha256Bytes, sha256File } from "../src/hash.ts";
import { resolveMediaInput, toReplicateFileInput } from "../src/media-input.ts";
import { ReplicateMediaProvider } from "../src/replicate/provider.ts";
import { toSeedance25Input } from "../src/replicate/seedance-2.5.ts";
import { toFlux11ProUltraInput } from "../src/replicate/flux-1.1-pro-ultra.ts";
import type { ReplicatePredictionClient } from "../src/replicate/client.ts";

test("missing REPLICATE_API_TOKEN fails with configuration error", async () => {
  const provider = new ReplicateMediaProvider({
    token: "",
    client: {
      async create() {
        throw new Error("should not call Replicate");
      },
      async wait() {
        throw new Error("should not call Replicate");
      },
    },
  });
  await assert.rejects(
    () =>
      provider.generateVideo({
        startImage: { kind: "url", url: "https://example.com/a.png" },
        prompt: "go",
      }),
    (error: unknown) => {
      assert(error instanceof MediaGenerationError);
      assert.equal(error.code, "configuration");
      assert.equal(error.message, "REPLICATE_API_TOKEN is not set");
      return true;
    },
  );
});

test("generic request maps onto current Seedance 2.5 schema", () => {
  const input = toSeedance25Input(
    {
      startImage: { kind: "url", url: "https://example.com/a.png" },
      endImage: { kind: "url", url: "https://example.com/b.png" },
      prompt: "forward through the library",
      durationSeconds: 6,
    },
    { kind: "url", url: "https://example.com/a.png" },
    { kind: "url", url: "https://example.com/b.png" },
    {
      resolution: "720p",
      aspectRatio: "adaptive",
      generateAudio: false,
      watermark: false,
      outputFormat: "mp4",
    },
  );
  assert.deepEqual(
    {
      prompt: input.prompt,
      image: input.image,
      last_frame_image: input.last_frame_image,
      duration: input.duration,
      resolution: input.resolution,
      aspect_ratio: input.aspect_ratio,
      generate_audio: input.generate_audio,
      watermark: input.watermark,
      output_format: input.output_format,
    },
    {
      prompt: "forward through the library",
      image: "https://example.com/a.png",
      last_frame_image: "https://example.com/b.png",
      duration: 6,
      resolution: "720p",
      aspect_ratio: "adaptive",
      generate_audio: false,
      watermark: false,
      output_format: "mp4",
    },
  );
  assert.equal("seed" in input, false);
});

test("first/last-frame mapping rejects non-adaptive aspect ratio", () => {
  assert.throws(
    () =>
      toSeedance25Input(
        {
          startImage: { kind: "url", url: "https://example.com/a.png" },
          endImage: { kind: "url", url: "https://example.com/b.png" },
          prompt: "go",
        },
        { kind: "url", url: "https://example.com/a.png" },
        { kind: "url", url: "https://example.com/b.png" },
        { aspectRatio: "16:9" },
      ),
    /adaptive/,
  );
});

test("local MediaInput is resolved as file bytes for Replicate upload", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tv-media-"));
  const path = join(dir, "start.png");
  const bytes = Buffer.from([137, 80, 78, 71]);
  await writeFile(path, bytes);
  const resolved = await resolveMediaInput({ kind: "file", path });
  assert.equal(resolved.kind, "file");
  if (resolved.kind === "file") {
    assert.equal(resolved.path, path);
    assert.equal(resolved.filename, "start.png");
    assert.ok(Buffer.isBuffer(resolved.bytes));
    assert.equal(Buffer.compare(resolved.bytes, bytes), 0);
    assert.ok(Buffer.isBuffer(toReplicateFileInput(resolved)));
  }
});

test("SHA-256 hashes exact local bytes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tv-hash-"));
  const path = join(dir, "bytes.bin");
  const bytes = Buffer.from("tunnelvision-hash-fixture");
  await writeFile(path, bytes);
  const hashed = await sha256File(path);
  assert.equal(hashed.sha256, sha256Bytes(bytes));
  assert.equal(hashed.bytes, bytes.length);
});

test("provider error normalization does not infer moderation", () => {
  assert.equal(
    classifyProviderFailure({ error: "prediction failed" }),
    "generation_failed",
  );
  assert.equal(
    classifyProviderFailure({ error: "flagged by moderation" }),
    "moderation",
  );
  assert.equal(
    classifyProviderFailure({ timeout: true }),
    "provider_unavailable",
  );
  assert.equal(
    classifyProviderFailure({ httpStatus: 401, error: "Unauthenticated" }),
    "configuration",
  );
  assert.equal(
    classifyProviderFailure({ httpStatus: 422, error: "Invalid type" }),
    "invalid_input",
  );
});

test("successful prediction returns structured GeneratedVideo without secrets", async () => {
  const client: ReplicatePredictionClient = {
    async create() {
      return {
        id: "pred_123",
        status: "starting",
        model: "bytedance/seedance-2.5",
        version: "abc123",
      };
    },
    async wait() {
      return {
        id: "pred_123",
        status: "succeeded",
        model: "bytedance/seedance-2.5",
        version: "abc123",
        output: "https://replicate.delivery/example.mp4",
        metrics: { predict_time: 12.3 },
      };
    },
  };
  const provider = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    client,
  });
  const result = await provider.generateVideo({
    startImage: { kind: "url", url: "https://example.com/a.png" },
    prompt: "go",
    durationSeconds: 6,
  });
  assert.equal(result.provider, "replicate");
  assert.equal(result.predictionId, "pred_123");
  assert.equal(result.modelVersion, "abc123");
  assert.equal(result.outputUrl, "https://replicate.delivery/example.mp4");
  assert.equal(JSON.stringify(result).includes("r8_testtokenvalue"), false);
});

test("normalized provider errors do not include secret values", async () => {
  const token = "r8_testtokenvalue";
  const provider = new ReplicateMediaProvider({
    token,
    client: {
      async create() {
        throw new Error(`upstream failed for ${token}`);
      },
      async wait() {
        throw new Error("should not wait");
      },
    },
  });
  await assert.rejects(
    () =>
      provider.generateVideo({
        startImage: { kind: "url", url: "https://example.com/a.png" },
        prompt: "go",
      }),
    (error: unknown) => {
      assert(error instanceof MediaGenerationError);
      assert.equal(error.message.includes(token), false);
      assert.equal((error.providerMessage ?? "").includes(token), false);
      assert.equal(JSON.stringify(error).includes(token), false);
      return true;
    },
  );
});

test("Replicate 422 validation errors map to invalid_input", async () => {
  const provider = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    client: {
      async create() {
        const error = new Error("Input validation failed") as Error & {
          response: { status: number };
        };
        error.response = { status: 422 };
        throw error;
      },
      async wait() {
        throw new Error("should not wait");
      },
    },
  });
  await assert.rejects(
    () =>
      provider.generateVideo({
        startImage: { kind: "url", url: "https://example.com/a.png" },
        prompt: "go",
      }),
    (error: unknown) => {
      assert(error instanceof MediaGenerationError);
      assert.equal(error.code, "invalid_input");
      return true;
    },
  );
});

test("generic image request maps onto FLUX 1.1 Pro Ultra without a reference image", () => {
  const input = toFlux11ProUltraInput(
    {
      prompt: "First-person cinematic POV inside a cozy attic bedroom",
      seed: 10101,
    },
    {
      aspectRatio: "16:9",
      raw: false,
      outputFormat: "png",
      safetyTolerance: 2,
    },
  );
  assert.deepEqual(input, {
    prompt: "First-person cinematic POV inside a cozy attic bedroom",
    aspect_ratio: "16:9",
    raw: false,
    output_format: "png",
    safety_tolerance: 2,
    seed: 10101,
  });
  assert.equal("image_prompt" in input, false);
  assert.equal("image_prompt_strength" in input, false);
});

test("successful image prediction returns structured GeneratedImage without secrets", async () => {
  const client: ReplicatePredictionClient = {
    async create(options) {
      assert.equal(options.model, "black-forest-labs/flux-1.1-pro-ultra");
      assert.equal("image_prompt" in options.input, false);
      return {
        id: "pred_img",
        status: "starting",
        model: "black-forest-labs/flux-1.1-pro-ultra",
        version: "flux-version",
      };
    },
    async wait() {
      return {
        id: "pred_img",
        status: "succeeded",
        model: "black-forest-labs/flux-1.1-pro-ultra",
        version: "flux-version",
        output: "https://replicate.delivery/example.png",
      };
    },
  };
  const provider = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    client,
  });
  const result = await provider.generateImage({
    prompt: "attic bedroom",
    seed: 10101,
  });
  assert.equal(result.provider, "replicate");
  assert.equal(result.predictionId, "pred_img");
  assert.equal(result.outputUrl, "https://replicate.delivery/example.png");
  assert.equal(JSON.stringify(result).includes("r8_testtokenvalue"), false);
  const flux = result.metadata.flux as Record<string, unknown>;
  assert.equal(flux.seed, 10101);
  assert.equal(flux.aspect_ratio, "16:9");
});
