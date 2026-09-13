import { EventEmitter } from "node:events";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createCanonicalDepthCache } from "./camotion-depth.ts";

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8ffff3f0005fe02fedccc59e70000000049454e44ae426082",
  "hex",
);

describe("canonical depth cache", () => {
  it("reuses estimated depth for an unchanged canonical", async () => {
    const work = mkdtempSync(join(tmpdir(), "tv-depth-cache-"));
    const imagePath = join(work, "B.png");
    writeFileSync(imagePath, PNG);
    const pythonBin = join(work, "python");
    writeFileSync(pythonBin, "");
    let estimates = 0;
    const cache = createCanonicalDepthCache({
      repoRoot: work,
      pythonBin,
      cacheDir: join(work, "cache"),
      spawnImpl: (_command, args) => {
        estimates += 1;
        const output = args[args.indexOf("--output") + 1];
        if (output) {
          writeFileSync(output, PNG);
        }
        const child = new EventEmitter() as ReturnType<typeof import("node:child_process").spawn>;
        child.stderr = new EventEmitter() as NodeJS.ReadableStream;
        child.kill = () => true;
        queueMicrotask(() => child.emit("close", 0));
        return child;
      },
    });
    const first = await cache.resolve("canonical-b", imagePath);
    const second = await cache.resolve("canonical-b", imagePath);
    expect(first).toBeTruthy();
    expect(second).toBe(first);
    expect(estimates).toBe(1);
    expect(cache.peek("canonical-b")).toBe(first);
  });

  it("invalidates cached depth when the canonical identity changes", async () => {
    const work = mkdtempSync(join(tmpdir(), "tv-depth-invalidate-"));
    const imagePath = join(work, "B.png");
    writeFileSync(imagePath, PNG);
    const pythonBin = join(work, "python");
    writeFileSync(pythonBin, "");
    const cache = createCanonicalDepthCache({
      repoRoot: work,
      pythonBin,
      cacheDir: join(work, "cache"),
      spawnImpl: (_command, args) => {
        const output = args[args.indexOf("--output") + 1];
        if (output) {
          writeFileSync(output, PNG);
        }
        const child = new EventEmitter() as ReturnType<typeof import("node:child_process").spawn>;
        child.stderr = new EventEmitter() as NodeJS.ReadableStream;
        child.kill = () => true;
        queueMicrotask(() => child.emit("close", 0));
        return child;
      },
    });
    const original = await cache.resolve("canonical-b", imagePath);
    cache.invalidate("canonical-b");
    expect(cache.peek("canonical-b")).toBeUndefined();
    const replaced = await cache.resolve("canonical-b-replaced", imagePath);
    expect(replaced).toBeTruthy();
    expect(replaced).not.toBe(original);
  });

  it("falls back cleanly when depth estimation is unavailable", async () => {
    const work = mkdtempSync(join(tmpdir(), "tv-depth-miss-"));
    const imagePath = join(work, "B.png");
    writeFileSync(imagePath, PNG);
    const pythonBin = join(work, "python");
    writeFileSync(pythonBin, "");
    const cache = createCanonicalDepthCache({
      repoRoot: work,
      pythonBin,
      cacheDir: join(work, "cache"),
      spawnImpl: () => {
        const child = new EventEmitter() as ReturnType<typeof import("node:child_process").spawn>;
        child.stderr = new EventEmitter() as NodeJS.ReadableStream;
        child.kill = () => true;
        queueMicrotask(() => child.emit("close", 1));
        return child;
      },
    });
    await expect(cache.resolve("canonical-b", imagePath)).resolves.toBeNull();
    await expect(cache.resolve("canonical-b", imagePath)).resolves.toBeNull();
  });
});
