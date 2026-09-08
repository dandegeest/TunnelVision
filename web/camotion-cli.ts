import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CameraMotionPlanV1 } from "../media/src/cinematographer/plan-shot.ts";

const CAMOTION_TIMEOUT_MS = 60_000;

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

/**
 * Frozen Camotion v1 CLI. Does not change the operator, strength vocabulary,
 * or plan schema. Python owns rendering.
 */
export async function renderCamotionShootingFrame(input: {
  repoRoot: string;
  imagePath: string;
  plan: CameraMotionPlanV1;
  pythonBin?: string;
  spawnImpl?: CamotionSpawn;
}): Promise<Buffer> {
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
  const spawnImpl = input.spawnImpl ?? spawn;
  const child = spawnImpl(pythonBin, ["-m", "camotion", "--image", input.imagePath, "--plan", planPath, "--output", outputPath], {
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
  return readFile(outputPath);
}
