import assert from "node:assert/strict";
import { test } from "node:test";

import {
  NANO_BANANA_2_LITE_MODEL,
  NANO_BANANA_2_MODEL,
  isNanoBanana2,
} from "../src/replicate/nano-banana.ts";
import {
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_IMAGE_OUTPUT_FORMAT,
  DEFAULT_IMAGE_RESOLUTION,
  IMAGE_MODELS,
  imageModelDisplayLabel,
  imageModelHasFormatChoice,
  imageModelHasResolutionChoice,
  imageModelMenuLabel,
  imageModelSlug,
  parseImageModelId,
} from "../src/replicate/image-models.ts";

test("catalog keeps Nano Banana 2 Lite as the development default", () => {
  assert.equal(DEFAULT_IMAGE_MODEL_ID, "nano-banana-2-lite");
  assert.equal(imageModelSlug("nano-banana-2-lite"), NANO_BANANA_2_LITE_MODEL);
  assert.equal(imageModelSlug("nano-banana-2"), NANO_BANANA_2_MODEL);
  assert.equal(parseImageModelId("google/nano-banana-2-lite"), "nano-banana-2-lite");
  assert.equal(parseImageModelId("google/nano-banana-2"), "nano-banana-2");
  assert.equal(imageModelDisplayLabel("nano-banana-2-lite"), "Nano Banana 2 Lite");
  assert.equal(imageModelMenuLabel(IMAGE_MODELS[0]!), "Nano Banana 2 Lite $");
  assert.deepEqual(
    IMAGE_MODELS.map((item) => item.cost),
    ["$", "$$"],
  );
  assert.equal(
    IMAGE_MODELS.some((item) => item.slug.includes("flux")),
    false,
  );
  assert.equal(DEFAULT_IMAGE_OUTPUT_FORMAT, "png");
  assert.equal(DEFAULT_IMAGE_RESOLUTION, "1K");
  assert.equal(imageModelHasFormatChoice("nano-banana-2-lite"), true);
  assert.equal(imageModelHasFormatChoice("nano-banana-2"), true);
  assert.equal(imageModelHasResolutionChoice("nano-banana-2-lite"), false);
  assert.equal(imageModelHasResolutionChoice("nano-banana-2"), true);
  assert.equal(isNanoBanana2("google/nano-banana-2"), true);
  assert.equal(isNanoBanana2("google/nano-banana-2-lite"), false);
});
