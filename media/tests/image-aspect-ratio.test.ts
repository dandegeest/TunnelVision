import assert from "node:assert/strict";
import test from "node:test";
import {
  FLUX_11_PRO_ULTRA_ASPECT_RATIOS,
  FLUX_KONTEXT_PRO_EXPLICIT_ASPECT_RATIOS,
  GENERATED_OPENING_ASPECT_RATIO,
  nearestExplicitAspectRatio,
  parseImageAspectRatio,
} from "../src/image-aspect-ratio.ts";

test("generated opening aspect is explicit 16:9", () => {
  assert.deepEqual(GENERATED_OPENING_ASPECT_RATIO, { width: 16, height: 9 });
  assert.equal(
    nearestExplicitAspectRatio(GENERATED_OPENING_ASPECT_RATIO, FLUX_11_PRO_ULTRA_ASPECT_RATIOS),
    "16:9",
  );
  assert.equal(
    nearestExplicitAspectRatio(GENERATED_OPENING_ASPECT_RATIO, FLUX_KONTEXT_PRO_EXPLICIT_ASPECT_RATIOS),
    "16:9",
  );
});

test("uploaded pixel dimensions snap to the closest explicit provider ratio", () => {
  assert.equal(
    nearestExplicitAspectRatio({ width: 1000, height: 558 }, FLUX_KONTEXT_PRO_EXPLICIT_ASPECT_RATIOS),
    "16:9",
  );
  assert.equal(
    nearestExplicitAspectRatio({ width: 1920, height: 1080 }, FLUX_11_PRO_ULTRA_ASPECT_RATIOS),
    "16:9",
  );
  assert.equal(
    nearestExplicitAspectRatio({ width: 1080, height: 1920 }, FLUX_KONTEXT_PRO_EXPLICIT_ASPECT_RATIOS),
    "9:16",
  );
  assert.equal(
    nearestExplicitAspectRatio({ width: 1, height: 1 }, FLUX_KONTEXT_PRO_EXPLICIT_ASPECT_RATIOS),
    "1:1",
  );
  assert.equal(
    nearestExplicitAspectRatio({ width: 1392, height: 752 }, FLUX_KONTEXT_PRO_EXPLICIT_ASPECT_RATIOS),
    "16:9",
  );
});

test("Kontext explicit mapping never returns match_input_image", () => {
  for (const aspect of [
    { width: 16, height: 9 },
    { width: 1000, height: 558 },
    { width: 9, height: 16 },
    { width: 21, height: 9 },
  ]) {
    const mapped = nearestExplicitAspectRatio(aspect, FLUX_KONTEXT_PRO_EXPLICIT_ASPECT_RATIOS);
    assert.notEqual(mapped, "match_input_image");
    assert.equal(FLUX_KONTEXT_PRO_EXPLICIT_ASPECT_RATIOS.includes(mapped), true);
  }
});

test("parseImageAspectRatio accepts positive integer pairs only", () => {
  assert.deepEqual(parseImageAspectRatio({ width: 1280, height: 720 }), { width: 1280, height: 720 });
  assert.equal(parseImageAspectRatio({ width: 0, height: 9 }), undefined);
  assert.equal(parseImageAspectRatio({ width: 16, height: 9.5 }), undefined);
  assert.equal(parseImageAspectRatio("16:9"), undefined);
  assert.equal(parseImageAspectRatio("match_input_image"), undefined);
});
