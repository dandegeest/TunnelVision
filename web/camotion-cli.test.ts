import { EventEmitter } from "node:events";
import { access } from "node:fs/promises";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { productionCameraMotionPlan } from "../media/src/cinematographer/camera-motion-plan.ts";
import { camotionPythonBin, renderCamotionShootingFrame } from "./camotion-cli.ts";

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8ffff3f0005fe02fedccc59e70000000049454e44ae426082",
  "hex",
);

describe("Camotion CLI adapter", () => {
  it("invokes python -m camotion with image, plan, and output", async () => {
    const work = mkdtempSync(join(tmpdir(), "tv-camotion-cli-"));
    const imagePath = join(work, "A.png");
    writeFileSync(imagePath, PNG);
    const pythonBin = join(work, "python");
    writeFileSync(pythonBin, "");
    let args: string[] = [];
    const result = await renderCamotionShootingFrame({
      repoRoot: work,
      imagePath,
      plan: productionCameraMotionPlan(),
      pythonBin,
      spawnImpl: (_command, spawnArgs) => {
        args = [...spawnArgs];
        const output = spawnArgs[spawnArgs.indexOf("--output") + 1];
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
    expect(args.slice(0, 2)).toEqual(["-m", "camotion"]);
    expect(args).toContain("--image");
    expect(args).toContain(imagePath);
    expect(args).toContain("--plan");
    expect(args).toContain("--output");
    expect(result.bytes.equals(PNG)).toBe(true);
    expect(result.depthSupplied).toBe(false);
    expect(result.workDirRetained).toBe(false);
    expect(existsSync(result.workDir)).toBe(false);
  });

  it("keeps the Camotion work dir when Debug retain is on", async () => {
    const work = mkdtempSync(join(tmpdir(), "tv-camotion-cli-"));
    const imagePath = join(work, "A.png");
    writeFileSync(imagePath, PNG);
    const pythonBin = join(work, "python");
    writeFileSync(pythonBin, "");
    const result = await renderCamotionShootingFrame({
      repoRoot: work,
      imagePath,
      plan: productionCameraMotionPlan(),
      pythonBin,
      retainWorkDir: true,
      spawnImpl: (_command, spawnArgs) => {
        const output = spawnArgs[spawnArgs.indexOf("--output") + 1];
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
    expect(result.workDirRetained).toBe(true);
    expect(existsSync(result.workDir)).toBe(true);
    expect(existsSync(result.outputPath)).toBe(true);
    expect(existsSync(result.planPath)).toBe(true);
    expect(result.depthPath).toBeNull();
  });

  it("runs the frozen Camotion CLI when the venv is present", async () => {
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const pythonBin = camotionPythonBin(repoRoot);
    try {
      await access(pythonBin);
    } catch {
      return;
    }
    const imagePath = resolve(repoRoot, "camotion/integration/forest-a-to-f/canonical/A.jpg");
    const bytes = await renderCamotionShootingFrame({
      repoRoot,
      imagePath,
      plan: productionCameraMotionPlan(),
    });
    expect(bytes.bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      true,
    );
  });
});
