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

  it("keeps audio when a Take has a soundtrack", async () => {
    const calls: string[][] = [];
    const probe = JSON.stringify({
      streams: [
        { codec_type: "video", width: 1280, height: 720 },
        { codec_type: "audio" },
      ],
      format: { duration: "6.0" },
    });
    await concatenateClipFiles({
      clipPaths: ["/tmp/a.mp4", "/tmp/b.mp4"],
      outputPath: "/tmp/out.mp4",
      execFileImpl: async (cmd, args) => {
        calls.push([String(cmd), ...(args ?? []).map(String)]);
        if (cmd === "ffprobe") {
          return { stdout: probe, stderr: "" };
        }
        return { stdout: "", stderr: "" };
      },
    });
    const ffmpeg = calls.find((call) => call[0] === "ffmpeg");
    expect(ffmpeg).toBeDefined();
    expect(ffmpeg).not.toContain("-an");
  });

  it("drops outgoing frame 0 when incoming last and outgoing first match", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const exec = promisify(execFile);
    const directory = await mkdtemp(join(tmpdir(), "tunnelvision-drop0-"));
    const incoming = join(directory, "in.mp4");
    const outgoing = join(directory, "out.mp4");
    const outputPath = join(directory, "movie.mp4");
    const color = "color=c=0x336699:s=128x128:r=24:d=0.5";
    await exec("ffmpeg", ["-y", "-f", "lavfi", "-i", color, "-pix_fmt", "yuv420p", incoming]);
    await exec("ffmpeg", ["-y", "-f", "lavfi", "-i", color, "-pix_fmt", "yuv420p", outgoing]);
    const result = await concatenateClipFiles({ clipPaths: [incoming, outgoing], outputPath });
    expect(result.seamDrops).toEqual([
      expect.objectContaining({ outgoingIndex: 1, dropped: true }),
    ]);
    expect(result.seamDrops[0]!.ssim).toBeGreaterThan(0.99);
    expect(result.seamDrops[0]!.mae).toBeLessThan(1);
  }, 30_000);

  it("keeps outgoing frame 0 when the lock is not tight", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const exec = promisify(execFile);
    const directory = await mkdtemp(join(tmpdir(), "tunnelvision-keep0-"));
    const incoming = join(directory, "in.mp4");
    const outgoing = join(directory, "out.mp4");
    const outputPath = join(directory, "movie.mp4");
    await exec("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=red:s=128x128:r=24:d=0.5",
      "-pix_fmt",
      "yuv420p",
      incoming,
    ]);
    await exec("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=green:s=128x128:r=24:d=0.5",
      "-pix_fmt",
      "yuv420p",
      outgoing,
    ]);
    const result = await concatenateClipFiles({ clipPaths: [incoming, outgoing], outputPath });
    expect(result.seamDrops).toEqual([
      expect.objectContaining({ outgoingIndex: 1, dropped: false }),
    ]);
  }, 30_000);
});
