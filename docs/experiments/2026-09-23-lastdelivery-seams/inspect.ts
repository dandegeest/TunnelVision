import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { concatenateClipFiles } from "../../../web/export-movie.ts";
import { compareFrameFiles } from "../../../web/frame-metrics.ts";
import { shouldDropOutgoingStart } from "../../../web/src/project/drop-outgoing-start.ts";

const exec = promisify(execFile);
const root = "/Users/ddegeest/Source/tunnelvision/projects/TheLastDelivery";
const dest = "/Users/ddegeest/Source/tunnelvision/docs/experiments/2026-09-23-lastdelivery-seams";
const legs = [
  { id: "A-B", path: join(root, "traversals/A-B/take-01.mp4"), seconds: 10, place: "rain city → parking ramp" },
  { id: "B-C", path: join(root, "traversals/B-C/take-01.mp4"), seconds: 5, place: "ramp → rail yard" },
  { id: "C-D", path: join(root, "traversals/C-D/take-01.mp4"), seconds: 10, place: "rail yard → mountain road" },
  { id: "D-E", path: join(root, "traversals/D-E/take-01.mp4"), seconds: 10, place: "forest road → wooden bridge" },
  { id: "E-F", path: join(root, "traversals/E-F/take-01.mp4"), seconds: 10, place: "bridge → observatory ridge" },
] as const;

async function extract(clip: string, destPath: string, which: "last" | "first" | "second") {
  if (which === "last") {
    await exec("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-sseof", "-0.05", "-i", clip, "-update", "1", "-frames:v", "1", destPath]);
    return;
  }
  const n = which === "first" ? 0 : 1;
  await exec("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", clip, "-vf", `select=eq(n\\,${n})`, "-frames:v", "1", destPath]);
}

async function sideBySide(left: string, mid: string, right: string, out: string) {
  await exec("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    left,
    "-i",
    mid,
    "-i",
    right,
    "-filter_complex",
    "[0:v]scale=640:-2[a];[1:v]scale=640:-2[b];[2:v]scale=640:-2[c];[a][b][c]hstack=inputs=3",
    out,
  ]);
}

async function main() {
  const frames = join(dest, "frames");
  const diagnostics = join(dest, "diagnostics");
  await mkdir(frames, { recursive: true });
  await mkdir(diagnostics, { recursive: true });

  const seams = [];
  for (let i = 1; i < legs.length; i += 1) {
    const incoming = legs[i - 1]!;
    const outgoing = legs[i]!;
    const be = join(frames, `${outgoing.id}-Be.png`);
    const bs = join(frames, `${outgoing.id}-Bs.png`);
    const o1 = join(frames, `${outgoing.id}-O1.png`);
    await extract(incoming.path, be, "last");
    await extract(outgoing.path, bs, "first");
    await extract(outgoing.path, o1, "second");
    const lock = await compareFrameFiles(be, bs);
    const stepBe = await compareFrameFiles(be, o1);
    const native = await compareFrameFiles(bs, o1);
    const motionRatio = native.mae > 1e-6 ? stepBe.mae / native.mae : null;
    const dropped = shouldDropOutgoingStart(lock);
    await sideBySide(be, bs, o1, join(diagnostics, `${outgoing.id}-Be-Bs-O1.png`));
    seams.push({
      seam: `${incoming.id}|${outgoing.id}`,
      outgoing: outgoing.id,
      place: `${incoming.place.split("→").pop()?.trim()} → ${outgoing.place.split("→").pop()?.trim()}`,
      incomingSeconds: incoming.seconds,
      outgoingSeconds: outgoing.seconds,
      lock,
      stepBe,
      native,
      motionRatio,
      dropped,
    });
  }

  const concat = await concatenateClipFiles({
    clipPaths: legs.map((leg) => leg.path),
    outputPath: join(dest, "gated-concat.mp4"),
  });

  console.log(JSON.stringify({ seams, concat }, null, 2));
}

main();
