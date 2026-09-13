import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { camotionPythonBin, camotionSrcDir, type CamotionSpawn } from "./camotion-cli.ts";

const DEPTH_TIMEOUT_MS = 120_000;

export type CanonicalDepthCache = {
  resolve(mediaId: string, imagePath: string): Promise<string | null>;
  peek(mediaId: string): string | null | undefined;
  remember(mediaId: string, depthPath: string | null): void;
  invalidate(mediaId: string): void;
};

/**
 * Depth belongs to the pristine canonical, not to a segment A′/B′.
 * The same unchanged B can serve A→B END′ and B→C START′.
 */
export function createCanonicalDepthCache(input: {
  repoRoot: string;
  pythonBin?: string;
  spawnImpl?: CamotionSpawn;
  cacheDir?: string;
}): CanonicalDepthCache {
  const pythonBin = input.pythonBin ?? camotionPythonBin(input.repoRoot);
  const cacheDir = input.cacheDir ?? join(tmpdir(), "tunnelvision-camotion-depth");
  const remembered = new Map<string, string | null>();

  async function estimate(mediaId: string, imagePath: string): Promise<string | null> {
    try {
      await access(pythonBin);
      await access(imagePath);
    } catch {
      return null;
    }
    await mkdir(cacheDir, { recursive: true });
    const outputPath = join(cacheDir, `${mediaId}.png`);
    const spawnImpl = input.spawnImpl ?? spawn;
    const child = spawnImpl(
      pythonBin,
      ["-m", "camotion.estimate_depth", "--image", imagePath, "--output", outputPath],
      {
        cwd: join(input.repoRoot, "camotion"),
        env: {
          ...process.env,
          PYTHONPATH: camotionSrcDir(input.repoRoot),
        },
      },
    );
    const stderr: Buffer[] = [];
    child.stderr?.on("data", (chunk) => {
      stderr.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    const exitCode = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("Camotion depth timed out"));
      }, DEPTH_TIMEOUT_MS);
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve(code ?? 1);
      });
    });
    if (exitCode !== 0) {
      return null;
    }
    try {
      await access(outputPath);
      return outputPath;
    } catch {
      return null;
    }
  }

  return {
    peek(mediaId) {
      return remembered.get(mediaId);
    },
    remember(mediaId, depthPath) {
      remembered.set(mediaId, depthPath);
    },
    invalidate(mediaId) {
      remembered.delete(mediaId);
    },
    async resolve(mediaId, imagePath) {
      if (remembered.has(mediaId)) {
        return remembered.get(mediaId) ?? null;
      }
      let depthPath: string | null = null;
      try {
        depthPath = await estimate(mediaId, imagePath);
      } catch {
        depthPath = null;
      }
      remembered.set(mediaId, depthPath);
      return depthPath;
    },
  };
}
