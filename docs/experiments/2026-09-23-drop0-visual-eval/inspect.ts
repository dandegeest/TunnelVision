import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { concatenateClipFiles } from "../../../web/export-movie.ts";
import { compareFrameFiles } from "../../../web/frame-metrics.ts";
import { shouldDropOutgoingStart } from "../../../web/src/project/drop-outgoing-start.ts";

const exec = promisify(execFile);
const root = "/Users/ddegeest/Source/tunnelvision/projects/Drop0VisualEval";
const ab = join(root, "traversals/A-B/take-01.mp4");
const bc = join(root, "traversals/B-C/take-01.mp4");
const dest = "/Users/ddegeest/Source/tunnelvision/docs/experiments/2026-09-23-drop0-visual-eval";

async function main() {
  await mkdir(dest, { recursive: true });
  const be = join(dest, "Be.png");
  const bs = join(dest, "Bs.png");
  const o1 = join(dest, "O1.png");
  await exec("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-sseof", "-0.05", "-i", ab, "-update", "1", "-frames:v", "1", be]);
  await exec("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", bc, "-vf", "select=eq(n\\,0)", "-frames:v", "1", bs]);
  await exec("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", bc, "-vf", "select=eq(n\\,1)", "-frames:v", "1", o1]);
  const lock = await compareFrameFiles(be, bs);
  const step = await compareFrameFiles(be, o1);
  const result = await concatenateClipFiles({
    clipPaths: [ab, bc],
    outputPath: join(dest, "reexport-gated.mp4"),
  });
  console.log(JSON.stringify({ lock, drop: shouldDropOutgoingStart(lock), step, concat: result }, null, 2));
}

main();
