import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CameraMotionPlanV1 } from "../media/src/cinematographer/plan-shot.ts";

const CAMOTION_TIMEOUT_MS = 90_000;

export function camotionPythonBin(repoRoot: string): string {
  return join(repoRoot, "camotion/.venv/bin/python");
}

export function camotionSrcDir(repoRoot: string): string {
  return join(repoRoot, "camotion/src");
}

export type CamotionSpawn = (
  command: string,
  args: readonly string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv },
) => ReturnType<typeof spawn>;

export type CamotionDepthLookup = {
  resolve(mediaId: string, imagePath: string): Promise<string | null>;
};

export type CamotionRenderResult = {
  bytes: Buffer;
  workDir: string;
  planPath: string;
  outputPath: string;
  depthPath: string | null;
  depthSupplied: boolean;
  workDirRetained: boolean;
};

/**
 * Product Camotion CLI. Radial operator, samples, and pace strength stay
 * frozen. ``--adaptive`` applies depth / destination / VP weights.
 * Missing depth is non-fatal: dest/VP weights still run.
 */
export async function renderCamotionShootingFrame(input: {
  repoRoot: string;
  imagePath: string;
  plan: CameraMotionPlanV1;
  mediaId?: string;
  pythonBin?: string;
  spawnImpl?: CamotionSpawn;
  retainWorkDir?: boolean;
  adaptive?: boolean;
  depthCache?: CamotionDepthLookup;
}): Promise<CamotionRenderResult> {
  const pythonBin = input.pythonBin ?? camotionPythonBin(input.repoRoot);
  try {
    await access(pythonBin);
  } catch {
    throw new Error(`Camotion Python is not available at ${pythonBin}`);
  }
  const work = await mkdtemp(join(tmpdir(), "tunnelvision-camotion-"));
  const planPath = join(work, "plan.json");
  const outputPath = join(work, "shooting.png");
  await writeFile(planPath, `${JSON.stringify(input.plan, null, 2)}\n`, "utf8");
  const adaptive = input.adaptive !== false;
  let depthPath: string | null = null;
  if (input.mediaId && input.depthCache) {
    try {
      depthPath = await input.depthCache.resolve(input.mediaId, input.imagePath);
    } catch {
      depthPath = null;
    }
  }
  const args = ["-m", "camotion", "--image", input.imagePath, "--plan", planPath, "--output", outputPath];
  if (adaptive) {
    args.push("--adaptive");
  }
  if (depthPath) {
    args.push("--depth", depthPath);
  }
  if (input.retainWorkDir) {
    args.push("--debug-dir", work);
  }
  const spawnImpl = input.spawnImpl ?? spawn;
  const child = spawnImpl(pythonBin, args, {
    cwd: join(input.repoRoot, "camotion"),
    env: {
      ...process.env,
      PYTHONPATH: camotionSrcDir(input.repoRoot),
    },
  });
  const stderr: Buffer[] = [];
  child.stderr?.on("data", (chunk) => {
    stderr.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  try {
    const exitCode = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("Camotion timed out"));
      }, CAMOTION_TIMEOUT_MS);
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
      const detail = Buffer.concat(stderr).toString("utf8").trim();
      throw new Error(detail || `Camotion exited with ${exitCode}`);
    }
    const bytes = await readFile(outputPath);
    const retain = Boolean(input.retainWorkDir);
    if (!retain) {
      await rm(work, { recursive: true, force: true });
    }
    return {
      bytes,
      workDir: work,
      planPath,
      outputPath,
      depthPath,
      depthSupplied: Boolean(depthPath),
      workDirRetained: retain,
    };
  } catch (error) {
    if (!input.retainWorkDir) {
      await rm(work, { recursive: true, force: true });
    }
    throw error;
  }
}
