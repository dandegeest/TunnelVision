import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { sha256Bytes } from "../src/hash.ts";
import { parseManifest } from "../experiments/manifest.ts";
import {
  CAMERA_SPEED_PROMPT_DIFF,
  EMBODIED_WALKING_PROMPT_DIFF,
  applyEmbodiedWalking,
  applySlowWalkingSpeed,
  cameraSpeedPromptDiff,
  embodiedWalkingPromptDiff,
} from "../experiments/prompt-control.ts";
import { outputDirFor } from "../experiments/runner.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

async function loadManifest(relativePath: string) {
  return parseManifest(
    JSON.parse(await readFile(join(repoRoot, relativePath), "utf8")),
  );
}

test("seedance-slow is a velocity-only prompt-control of 01.8, not Camotion 01.9", async () => {
  const control = await loadManifest("media/experiments/manifests/01.8.json");
  const slow = await loadManifest(
    "media/experiments/manifests/prompt-control/camera-speed/seedance-slow.json",
  );

  assert.equal(slow.experiment, "seedance-slow");
  assert.notEqual(slow.experiment, "01.9");
  assert.equal(slow.evidence_family, "prompt-control/camera-speed");
  assert.equal(slow.start_image, control.start_image);
  assert.equal(slow.end_image, control.end_image);
  assert.equal(slow.provider, control.provider);
  assert.equal(slow.model, control.model);
  assert.equal(slow.duration_seconds, control.duration_seconds);
  assert.deepEqual(slow.settings, control.settings);
  assert.equal(slow.settings?.seed, undefined);
  assert.equal(slow.prompt, applySlowWalkingSpeed(control.prompt));
  assert.equal(cameraSpeedPromptDiff(control.prompt, slow.prompt), CAMERA_SPEED_PROMPT_DIFF);
  assert.equal(
    CAMERA_SPEED_PROMPT_DIFF,
    `- "at a constant, fast speed"\n+ "at a constant, slow walking speed"`,
  );

  const outputDir = outputDirFor(repoRoot, slow);
  assert.match(outputDir, /prompt-control\/camera-speed\/replicate-bytedance-seedance-2\.5\/seedance-slow$/);
  assert.equal(outputDir.includes("/01.8/"), false);
  assert.equal(outputDir.includes("/01.9"), false);

  const start = await readFile(join(repoRoot, slow.start_image));
  const end = await readFile(join(repoRoot, slow.end_image as string));
  assert.equal(
    sha256Bytes(start),
    "5f9c3bb8afb51cde59067f14349571cb2124db8c757307211f1b02912b5603d1",
  );
  assert.equal(
    sha256Bytes(end),
    "f03f4da501520c359f09d41753213ea6c4e3cf8c2f60f94b2773bc53f1f1f306",
  );
});

test("camera-speed prompt helper rejects any other rewrite", () => {
  const control =
    "moving at a constant, fast speed through the library";
  assert.throws(
    () => cameraSpeedPromptDiff(control, "moving slowly through the library"),
    /only by requested camera velocity/,
  );
});

test("seedance-slow-embodied adds only walking embodiment to seedance-slow", async () => {
  const slow = await loadManifest(
    "media/experiments/manifests/prompt-control/camera-speed/seedance-slow.json",
  );
  const embodied = await loadManifest(
    "media/experiments/manifests/prompt-control/camera-speed/seedance-slow-embodied.json",
  );

  assert.equal(embodied.experiment, "seedance-slow-embodied");
  assert.notEqual(embodied.experiment, "01.9");
  assert.equal(embodied.evidence_family, slow.evidence_family);
  assert.equal(embodied.start_image, slow.start_image);
  assert.equal(embodied.end_image, slow.end_image);
  assert.equal(embodied.provider, slow.provider);
  assert.equal(embodied.model, slow.model);
  assert.equal(embodied.duration_seconds, slow.duration_seconds);
  assert.deepEqual(embodied.settings, slow.settings);
  assert.equal(embodied.settings?.seed, undefined);
  assert.match(embodied.prompt, /at a constant, slow walking speed/);
  assert.equal(embodied.prompt.includes("at a constant, fast speed"), false);
  assert.equal(embodied.prompt, applyEmbodiedWalking(slow.prompt));
  assert.equal(
    embodiedWalkingPromptDiff(slow.prompt, embodied.prompt),
    EMBODIED_WALKING_PROMPT_DIFF,
  );

  const outputDir = outputDirFor(repoRoot, embodied);
  assert.match(
    outputDir,
    /prompt-control\/camera-speed\/replicate-bytedance-seedance-2\.5\/seedance-slow-embodied$/,
  );
  assert.equal(outputDir.includes("/01.9"), false);

  const start = await readFile(join(repoRoot, embodied.start_image));
  const end = await readFile(join(repoRoot, embodied.end_image as string));
  assert.equal(
    sha256Bytes(start),
    "5f9c3bb8afb51cde59067f14349571cb2124db8c757307211f1b02912b5603d1",
  );
  assert.equal(
    sha256Bytes(end),
    "f03f4da501520c359f09d41753213ea6c4e3cf8c2f60f94b2773bc53f1f1f306",
  );
});

test("embodied walking helper rejects unrelated prompt rewrites", () => {
  const slow =
    "at a constant, slow walking speed, traveling forward through the library";
  assert.throws(
    () => embodiedWalkingPromptDiff(slow, "at a constant, slow walking speed, sprinting forward through the library"),
    /only by embodied walking camera language/,
  );
});
