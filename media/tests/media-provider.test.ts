import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { MediaGenerationError } from "../src/errors.ts";
import { classifyProviderFailure, formatErrorWithCause } from "../src/errors.ts";
import { sha256Bytes, sha256File } from "../src/hash.ts";
import { resolveMediaInput, toReplicateFileInput } from "../src/media-input.ts";
import { ReplicateMediaProvider } from "../src/replicate/provider.ts";
import { toSeedance25Input } from "../src/replicate/seedance-2.5.ts";
import { toFlux11ProUltraInput } from "../src/replicate/flux-1.1-pro-ultra.ts";
import { toFluxKontextProInput } from "../src/replicate/flux-kontext-pro.ts";
import {
  toNanoBananaEditInput,
  toNanoBananaGenerateInput,
} from "../src/replicate/nano-banana.ts";
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

test("provider fetch failures include the undici cause", () => {
  const failed = new TypeError("fetch failed", {
    cause: new Error("connect ECONNREFUSED 127.0.0.1:443"),
  });
  assert.equal(
    formatErrorWithCause(failed),
    "fetch failed: connect ECONNREFUSED 127.0.0.1:443",
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

test("successful prediction copies integer seed from Replicate input into metadata", async () => {
  const provider = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    seedance: { seed: 70 },
    client: {
      async create() {
        return { id: "pred_seed", status: "starting", model: "bytedance/seedance-2.5" };
      },
      async wait() {
        return {
          id: "pred_seed",
          status: "succeeded",
          model: "bytedance/seedance-2.5",
          output: "https://replicate.delivery/seed.mp4",
          input: { seed: 70, prompt: "go" },
        };
      },
    },
  });
  const result = await provider.generateVideo({
    startImage: { kind: "url", url: "https://example.com/a.png" },
    prompt: "go",
  });
  assert.equal(result.metadata.seed, 70);
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

test("generic image request maps onto Nano Banana without a reference image", () => {
  const input = toNanoBananaGenerateInput({
    prompt: "First-person cinematic POV inside a cozy attic bedroom",
    aspectRatio: { width: 16, height: 9 },
  });
  assert.deepEqual(input, {
    prompt: "First-person cinematic POV inside a cozy attic bedroom",
    aspect_ratio: "16:9",
    output_format: "png",
  });
  assert.equal("image_input" in input, false);
  assert.equal("resolution" in input, false);
  const hq = toNanoBananaGenerateInput(
    {
      prompt: "First-person cinematic POV inside a cozy attic bedroom",
      aspectRatio: { width: 16, height: 9 },
    },
    { outputFormat: "jpg", resolution: "2K" },
  );
  assert.equal(hq.output_format, "jpg");
  assert.equal(hq.resolution, "2K");
});

test("legacy FLUX 1.1 Pro Ultra adapter still maps a text-only request", () => {
  const input = toFlux11ProUltraInput(
    {
      prompt: "First-person cinematic POV inside a cozy attic bedroom",
      seed: 10101,
      aspectRatio: { width: 16, height: 9 },
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
      assert.equal(options.model, "google/nano-banana-2-lite");
      assert.equal("image_input" in options.input, false);
      assert.equal("input_image" in options.input, false);
      assert.equal("resolution" in options.input, false);
      return {
        id: "pred_img",
        status: "starting",
        model: "google/nano-banana-2-lite",
        version: "nano-version",
      };
    },
    async wait() {
      return {
        id: "pred_img",
        status: "succeeded",
        model: "google/nano-banana-2-lite",
        version: "nano-version",
        output: "https://replicate.delivery/example.png",
      };
    },
  };
  const provider = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    nanoBanana: { resolution: "4K" },
    client,
  });
  const result = await provider.generateImage({
    prompt: "attic bedroom",
    aspectRatio: { width: 16, height: 9 },
  });
  assert.equal(result.provider, "replicate");
  assert.equal(result.predictionId, "pred_img");
  assert.equal(result.outputUrl, "https://replicate.delivery/example.png");
  assert.equal(JSON.stringify(result).includes("r8_testtokenvalue"), false);
  const nanoBanana = result.metadata.nanoBanana as Record<string, unknown>;
  assert.equal(nanoBanana.aspect_ratio, "16:9");
  assert.equal(nanoBanana.output_format, "png");
  assert.equal("resolution" in nanoBanana, false);
});

test("Nano Banana 2 generate sends resolution when the project chose one", async () => {
  const client: ReplicatePredictionClient = {
    async create(options) {
      assert.equal(options.model, "google/nano-banana-2");
      assert.equal(options.input.output_format, "jpg");
      assert.equal(options.input.resolution, "2K");
      return {
        id: "pred_img_hq",
        status: "starting",
        model: "google/nano-banana-2",
      };
    },
    async wait() {
      return {
        id: "pred_img_hq",
        status: "succeeded",
        model: "google/nano-banana-2",
        output: "https://replicate.delivery/example-2k.jpg",
      };
    },
  };
  const provider = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    imageModel: "google/nano-banana-2",
    nanoBanana: { outputFormat: "jpg", resolution: "2K" },
    client,
  });
  const result = await provider.generateImage({
    prompt: "attic bedroom",
    aspectRatio: { width: 16, height: 9 },
  });
  const nanoBanana = result.metadata.nanoBanana as Record<string, unknown>;
  assert.equal(nanoBanana.output_format, "jpg");
  assert.equal(nanoBanana.resolution, "2K");
});

test("image edit requires a source image and a prompt", () => {
  const source = { kind: "url" as const, url: "https://example.com/a.jpg" };
  const resolved = { kind: "url" as const, url: "https://example.com/a.jpg" };
  assert.throws(
    () =>
      toNanoBananaEditInput(
        { sourceImage: source, prompt: "   " },
        resolved,
      ),
    (error: unknown) => {
      assert(error instanceof MediaGenerationError);
      assert.equal(error.code, "invalid_input");
      assert.match(error.message, /prompt is required/);
      return true;
    },
  );
  assert.throws(
    () =>
      toNanoBananaEditInput(
        { prompt: "move forward", sourceImage: undefined as never },
        resolved,
      ),
    (error: unknown) => {
      assert(error instanceof MediaGenerationError);
      assert.equal(error.code, "invalid_input");
      assert.match(error.message, /sourceImage is required/);
      return true;
    },
  );
});

test("image-conditioned edit maps onto Nano Banana with image_input", () => {
  const source = { kind: "url" as const, url: "https://example.com/a.jpg" };
  const input = toNanoBananaEditInput(
    {
      sourceImage: source,
      prompt: "Move the camera through the open wardrobe.",
      aspectRatio: { width: 1000, height: 558 },
    },
    { kind: "url", url: source.url },
  );
  assert.deepEqual(input, {
    prompt: "Move the camera through the open wardrobe.",
    aspect_ratio: "16:9",
    output_format: "png",
    image_input: ["https://example.com/a.jpg"],
  });
  assert.equal("input_image" in input, false);
});

test("legacy FLUX Kontext Pro adapter still maps input_image", () => {
  const source = { kind: "url" as const, url: "https://example.com/a.jpg" };
  const input = toFluxKontextProInput(
    {
      sourceImage: source,
      prompt: "Move the camera through the open wardrobe.",
      seed: 42,
    },
    { kind: "url", url: source.url },
  );
  assert.deepEqual(input, {
    prompt: "Move the camera through the open wardrobe.",
    input_image: "https://example.com/a.jpg",
    aspect_ratio: "match_input_image",
    prompt_upsampling: false,
    output_format: "png",
    safety_tolerance: 2,
    seed: 42,
  });
  assert.equal("image_prompt" in input, false);
});

test("image-conditioned edit uses an explicit aspect ratio instead of match_input_image", () => {
  const source = { kind: "url" as const, url: "https://example.com/a.jpg" };
  const input = toFluxKontextProInput(
    {
      sourceImage: source,
      prompt: "Move the camera through the open wardrobe.",
      aspectRatio: { width: 1000, height: 558 },
    },
    { kind: "url", url: source.url },
    { aspectRatio: "match_input_image" },
  );
  assert.equal(input.aspect_ratio, "16:9");
  assert.equal(input.input_image, "https://example.com/a.jpg");
  assert.notEqual(input.aspect_ratio, "match_input_image");
});

test("successful image edit returns structured GeneratedImage without secrets", async () => {
  const client: ReplicatePredictionClient = {
    async create(options) {
      assert.equal(options.model, "google/nano-banana-2-lite");
      assert.equal(options.input.prompt, "Move the camera through the open wardrobe.");
      assert.deepEqual(options.input.image_input, ["https://example.com/a.jpg"]);
      assert.equal("input_image" in options.input, false);
      return {
        id: "pred_edit",
        status: "starting",
        model: "google/nano-banana-2-lite",
        version: "nano-version",
      };
    },
    async wait() {
      return {
        id: "pred_edit",
        status: "succeeded",
        model: "google/nano-banana-2-lite",
        version: "nano-version",
        output: "https://replicate.delivery/edited.png",
      };
    },
  };
  const provider = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    client,
  });
  const result = await provider.editImage({
    sourceImage: { kind: "url", url: "https://example.com/a.jpg" },
    prompt: "Move the camera through the open wardrobe.",
  });
  assert.equal(result.predictionId, "pred_edit");
  assert.equal(result.outputUrl, "https://replicate.delivery/edited.png");
  assert.equal(result.model, "google/nano-banana-2-lite");
  assert.equal(JSON.stringify(result).includes("r8_testtokenvalue"), false);
  const nanoBanana = result.metadata.nanoBanana as Record<string, unknown>;
  assert.equal(nanoBanana.prompt, "Move the camera through the open wardrobe.");
  assert.deepEqual(nanoBanana.image_input, ["https://example.com/a.jpg"]);
});

test("image edit with a project aspect ratio sends an explicit Nano Banana aspect_ratio", async () => {
  const client: ReplicatePredictionClient = {
    async create(options) {
      assert.equal(options.input.aspect_ratio, "16:9");
      assert.notEqual(options.input.aspect_ratio, "match_input_image");
      assert.deepEqual(options.input.image_input, ["https://example.com/a.jpg"]);
      return {
        id: "pred_edit_ar",
        status: "starting",
        model: "google/nano-banana-2-lite",
      };
    },
    async wait() {
      return {
        id: "pred_edit_ar",
        status: "succeeded",
        model: "google/nano-banana-2-lite",
        output: "https://replicate.delivery/edited-ar.png",
      };
    },
  };
  const provider = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    client,
  });
  const result = await provider.editImage({
    sourceImage: { kind: "url", url: "https://example.com/a.jpg" },
    prompt: "Move the camera through the open wardrobe.",
    aspectRatio: { width: 1000, height: 558 },
  });
  const nanoBanana = result.metadata.nanoBanana as Record<string, unknown>;
  assert.equal(nanoBanana.aspect_ratio, "16:9");
});

test("image edit local MediaInput is uploaded as file bytes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tv-edit-"));
  const path = join(dir, "A.jpg");
  const bytes = Buffer.from([255, 216, 255, 224]);
  await writeFile(path, bytes);
  let captured: unknown;
  const client: ReplicatePredictionClient = {
    async create(options) {
      captured = options.input.image_input;
      assert.equal(options.model, "google/nano-banana-2-lite");
      return {
        id: "pred_file",
        status: "starting",
        model: "google/nano-banana-2-lite",
      };
    },
    async wait() {
      return {
        id: "pred_file",
        status: "succeeded",
        model: "google/nano-banana-2-lite",
        output: "https://replicate.delivery/file-edit.png",
      };
    },
  };
  const provider = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    client,
  });
  await provider.editImage({
    sourceImage: { kind: "file", path },
    prompt: "Move the camera forward.",
  });
  assert.ok(Array.isArray(captured));
  assert.ok(Buffer.isBuffer((captured as unknown[])[0]));
  assert.equal(Buffer.compare((captured as Buffer[])[0]!, bytes), 0);
});

test("image edit provider errors surface as MediaGenerationError", async () => {
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
      provider.editImage({
        sourceImage: { kind: "url", url: "https://example.com/a.jpg" },
        prompt: "go",
      }),
    (error: unknown) => {
      assert(error instanceof MediaGenerationError);
      assert.equal(error.code, "invalid_input");
      return true;
    },
  );
});
