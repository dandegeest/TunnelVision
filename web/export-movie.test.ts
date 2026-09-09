import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { concatenateClipFiles } from "./export-movie.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wardrobeAB = resolve(repoRoot, "camotion/integration/wardrobe-loop-01/videos/A-B.mp4");
const wardrobeCD = resolve(repoRoot, "camotion/integration/wardrobe-loop-01/videos/C-D.mp4");

describe("Export Movie concatenation", () => {
  it("concatenates existing clips in order without inventing missing legs", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tunnelvision-export-test-"));
    const outputPath = join(directory, "movie.mp4");
    const result = await concatenateClipFiles({
      clipPaths: [wardrobeAB, wardrobeCD],
      outputPath,
    });
    expect(result.outputPath).toBe(outputPath);
    expect(["copy", "transcode"]).toContain(result.method);
    const { stat } = await import("node:fs/promises");
    const output = await stat(outputPath);
    const first = await stat(wardrobeAB);
    const second = await stat(wardrobeCD);
    expect(output.size).toBeGreaterThan(first.size / 2);
    expect(output.size).toBeGreaterThan(second.size / 2);
  }, 30_000);
});
