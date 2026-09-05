import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { copyExactFile, isApproximately16x9, pngDimensions } from "../src/image-file.ts";
import { sha256Bytes } from "../src/hash.ts";

test("16:9 PNG header dimensions are accepted", () => {
  const png = Buffer.alloc(24, 0);
  png.write("PNG", 1, 3, "ascii");
  png.writeUInt32BE(1920, 16);
  png.writeUInt32BE(1080, 20);
  assert.deepEqual(pngDimensions(png), { width: 1920, height: 1080 });
  assert.equal(isApproximately16x9(1920, 1080), true);
  assert.equal(isApproximately16x9(1000, 1000), false);
});

test("F copy is byte-for-byte identical to A", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tv-copy-"));
  const source = join(dir, "A.png");
  const dest = join(dir, "F.png");
  const bytes = Buffer.from("canonical-A-bytes");
  await writeFile(source, bytes);
  const copied = await copyExactFile(source, dest);
  assert.equal(copied.sha256, sha256Bytes(bytes));
  assert.equal(copied.bytes, bytes.length);
});
