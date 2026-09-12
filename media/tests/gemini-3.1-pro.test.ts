import assert from "node:assert/strict";
import { test } from "node:test";

import sharp from "sharp";

import { MediaGenerationError } from "../src/errors.ts";
import {
  GEMINI_31_PRO_IMAGE_BYTE_BUDGET,
  GEMINI_31_PRO_MAX_IMAGE_EDGE,
  GEMINI_31_PRO_VISION_FILENAME,
  GEMINI_31_PRO_VISION_TYPE,
  fitGemini31ProImageBytes,
  prepareGemini31ProMedia,
  toGemini31ProFileInput,
  toGemini31ProInput,
} from "../src/replicate/gemini-3.1-pro.ts";

async function pngOfSize(width: number, height: number, compressionLevel = 6): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i += 1) {
    pixels[i] = (i * 13) % 251;
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .png({ compressionLevel })
    .toBuffer();
}

async function assertVisionJpeg(bytes: Buffer, maxWidth: number, maxHeight: number) {
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xd8);
  assert.equal(bytes.length <= GEMINI_31_PRO_IMAGE_BYTE_BUDGET, true);
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.equal((metadata.width ?? 0) <= maxWidth, true);
  assert.equal((metadata.height ?? 0) <= maxHeight, true);
}

test("Gemini vision copies are JPEG at or under 1024 on the long edge", async () => {
  const original = await pngOfSize(1024, 576);
  const fitted = await fitGemini31ProImageBytes(original);
  await assertVisionJpeg(fitted, 1024, 576);
  const prepared = await prepareGemini31ProMedia({
    kind: "file",
    path: "/tmp/a.png",
    filename: "a.png",
    bytes: original,
  });
  assert.equal(prepared.kind, "file");
  if (prepared.kind === "file") {
    assert.equal(prepared.filename, GEMINI_31_PRO_VISION_FILENAME);
    await assertVisionJpeg(prepared.bytes, 1024, 576);
    const file = toGemini31ProFileInput(prepared);
    assert(file instanceof File);
    assert.equal(file.type, GEMINI_31_PRO_VISION_TYPE);
    assert.equal(file.name, GEMINI_31_PRO_VISION_FILENAME);
  }
});

test("2K stills are downscaled to a 1024 JPEG vision copy", async () => {
  const original = await pngOfSize(2048, 1152, 0);
  assert.equal(Math.max(2048, 1152) > GEMINI_31_PRO_MAX_IMAGE_EDGE, true);
  const fitted = await fitGemini31ProImageBytes(original);
  await assertVisionJpeg(fitted, 1024, 576);
  const metadata = await sharp(fitted).metadata();
  assert.equal(metadata.width, 1024);
  assert.equal(metadata.height, 576);
});

test("Gemini URL images stay URLs", async () => {
  const resolved = await prepareGemini31ProMedia({
    kind: "url",
    url: "https://example.com/2k.png",
  });
  assert.deepEqual(resolved, { kind: "url", url: "https://example.com/2k.png" });
  const input = toGemini31ProInput(
    { prompt: "plan this shot" },
    [resolved],
  );
  assert.deepEqual(input.images, ["https://example.com/2k.png"]);
});

test("undecodable Gemini images fail as invalid input", async () => {
  await assert.rejects(
    () => fitGemini31ProImageBytes(Buffer.from("not-an-image")),
    (error: unknown) => {
      assert(error instanceof MediaGenerationError);
      assert.equal(error.code, "invalid_input");
      return true;
    },
  );
});
