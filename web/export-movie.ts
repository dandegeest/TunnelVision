import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { compareFrameFiles } from "./frame-metrics.ts";
import { shouldDropOutgoingStart } from "./src/project/drop-outgoing-start.ts";

const execFileAsync = promisify(execFile);

export type ClipSize = {
  width: number;
  height: number;
};

type ProbedClip = {
  size: ClipSize;
  hasAudio: boolean;
  durationSeconds: number;
};

export type ConcatenateClipsInput = {
  clipPaths: string[];
  outputPath: string;
  execFileImpl?: typeof execFileAsync;
};

export type SeamDropDecision = {
  outgoingIndex: number;
  dropped: boolean;
  ssim: number;
  mae: number;
};

export type ConcatenateClipsResult = {
  method: "copy" | "transcode";
  outputPath: string;
  seamDrops: SeamDropDecision[];
};

async function probeClip(
  path: string,
  exec: typeof execFileAsync,
): Promise<ProbedClip | null> {
  try {
    const { stdout } = await exec("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,width,height:format=duration",
      "-of",
      "json",
      path,
    ]);
    const parsed = JSON.parse(stdout) as {
      streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
      format?: { duration?: string };
    };
    const video = parsed.streams?.find((stream) => stream.codec_type === "video");
    const width = Number(video?.width);
    const height = Number(video?.height);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
      return null;
    }
    const durationSeconds = Number(parsed.format?.duration);
    return {
      size: { width, height },
      hasAudio: parsed.streams?.some((stream) => stream.codec_type === "audio") === true,
      durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0,
    };
  } catch {
    return null;
  }
}

function mostCommonSize(sizes: readonly ClipSize[]): ClipSize {
  const counts = new Map<string, { size: ClipSize; count: number }>();
  for (const size of sizes) {
    const key = `${size.width}x${size.height}`;
    const current = counts.get(key);
    if (current) {
      current.count += 1;
    } else {
      counts.set(key, { size, count: 1 });
    }
  }
  let best: { size: ClipSize; count: number } | undefined;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) {
      best = entry;
    }
  }
  return best?.size ?? sizes[0]!;
}

async function concatCopy(
  clipPaths: string[],
  outputPath: string,
  exec: typeof execFileAsync,
): Promise<void> {
  const listPath = join(tmpdir(), `tunnelvision-concat-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
  await writeFile(listPath, `${clipPaths.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join("\n")}\n`);
  await exec("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

async function concatTranscode(
  clipPaths: string[],
  clips: readonly ProbedClip[],
  outputPath: string,
  exec: typeof execFileAsync,
): Promise<void> {
  const target = mostCommonSize(clips.map((clip) => clip.size));
  const keepAudio = clips.some((clip) => clip.hasAudio);
  const labels = clipPaths.map((_, index) => `v${index}`);
  const scaled = clipPaths
    .map((_, index) => {
      return `[${index}:v]scale=${target.width}:${target.height}:force_original_aspect_ratio=decrease,pad=${target.width}:${target.height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=24,format=yuv420p[${labels[index]}]`;
    })
    .join(";");
  const audio = keepAudio
    ? clipPaths
        .map((_, index) => {
          if (clips[index]?.hasAudio) {
            return `[${index}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,aresample=48000[a${index}]`;
          }
          const duration = Math.max(clips[index]?.durationSeconds ?? 0, 0.1).toFixed(3);
          return `anullsrc=channel_layout=stereo:sample_rate=48000:d=${duration}[a${index}]`;
        })
        .join(";")
    : "";
  const concatInputs = keepAudio
    ? labels.map((label, index) => `[${label}][a${index}]`).join("")
    : labels.map((label) => `[${label}]`).join("");
  const filter = keepAudio
    ? `${scaled};${audio};${concatInputs}concat=n=${clipPaths.length}:v=1:a=1[v][a]`
    : `${scaled};${concatInputs}concat=n=${clipPaths.length}:v=1:a=0[v]`;
  await exec("ffmpeg", [
    "-y",
    ...clipPaths.flatMap((path) => ["-i", path]),
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    ...(keepAudio ? ["-map", "[a]", "-c:a", "aac"] : ["-an"]),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

async function extractFrame(
  clipPath: string,
  destPath: string,
  which: "first" | "last",
  exec: typeof execFileAsync,
): Promise<boolean> {
  try {
    if (which === "first") {
      await exec("ffmpeg", [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        clipPath,
        "-vf",
        "select=eq(n\\,0)",
        "-frames:v",
        "1",
        destPath,
      ]);
    } else {
      await exec("ffmpeg", [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-sseof",
        "-0.05",
        "-i",
        clipPath,
        "-update",
        "1",
        "-frames:v",
        "1",
        destPath,
      ]);
    }
    return existsSync(destPath);
  } catch {
    return false;
  }
}

async function trimOutgoingStart(
  clipPath: string,
  destPath: string,
  durationSeconds: number,
  exec: typeof execFileAsync,
): Promise<boolean> {
  const frameDuration = durationSeconds > 0 ? Math.min(1 / 24, durationSeconds / 2) : 1 / 24;
  try {
    await exec("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      clipPath,
      "-vf",
      "select=gte(n\\,1),setpts=PTS-STARTPTS",
      "-af",
      `atrim=start=${frameDuration.toFixed(4)},asetpts=PTS-STARTPTS`,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      destPath,
    ]);
    return existsSync(destPath);
  } catch {
    try {
      await exec("ffmpeg", [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        clipPath,
        "-vf",
        "select=gte(n\\,1),setpts=PTS-STARTPTS",
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        destPath,
      ]);
      return existsSync(destPath);
    } catch {
      return false;
    }
  }
}

export async function measureOutgoingStartDrop(
  incomingPath: string,
  outgoingPath: string,
  exec: typeof execFileAsync = execFileAsync,
): Promise<{ ssim: number; mae: number; dropped: boolean } | null> {
  const work = join(tmpdir(), `tunnelvision-seam-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(work, { recursive: true });
  const lastPath = join(work, "be.png");
  const firstPath = join(work, "bs.png");
  if (!(await extractFrame(incomingPath, lastPath, "last", exec))) {
    return null;
  }
  if (!(await extractFrame(outgoingPath, firstPath, "first", exec))) {
    return null;
  }
  try {
    const metrics = await compareFrameFiles(lastPath, firstPath);
    return { ssim: metrics.ssim, mae: metrics.mae, dropped: shouldDropOutgoingStart(metrics) };
  } catch {
    return null;
  }
}

async function applyOutgoingStartDrops(
  clipPaths: string[],
  clips: readonly ProbedClip[],
  exec: typeof execFileAsync,
): Promise<{ paths: string[]; seamDrops: SeamDropDecision[] }> {
  const paths = [...clipPaths];
  const seamDrops: SeamDropDecision[] = [];
  if (paths.length < 2) {
    return { paths, seamDrops };
  }
  const work = join(tmpdir(), `tunnelvision-drop0-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(work, { recursive: true });
  for (let index = 1; index < paths.length; index += 1) {
    const incoming = paths[index - 1]!;
    const outgoing = paths[index]!;
    const measured = await measureOutgoingStartDrop(incoming, outgoing, exec);
    if (!measured) {
      continue;
    }
    if (measured.dropped) {
      const trimmed = join(work, `${index}-from1.mp4`);
      const ok = await trimOutgoingStart(outgoing, trimmed, clips[index]?.durationSeconds ?? 0, exec);
      if (ok) {
        paths[index] = trimmed;
        seamDrops.push({ outgoingIndex: index, dropped: true, ssim: measured.ssim, mae: measured.mae });
        continue;
      }
    }
    seamDrops.push({
      outgoingIndex: index,
      dropped: measured.dropped,
      ssim: measured.ssim,
      mae: measured.mae,
    });
  }
  return { paths, seamDrops };
}

export async function concatenateClipFiles(input: ConcatenateClipsInput): Promise<ConcatenateClipsResult> {
  if (input.clipPaths.length < 1) {
    throw new Error("Export Movie needs at least one rendered journey clip.");
  }
  const exec = input.execFileImpl ?? execFileAsync;
  const clips: ProbedClip[] = [];
  for (const path of input.clipPaths) {
    const clip = await probeClip(path, exec);
    if (!clip) {
      throw new Error(`Could not probe video size for ${path}`);
    }
    clips.push(clip);
  }
  const prepared = await applyOutgoingStartDrops(input.clipPaths, clips, exec);
  const sameSize = clips.every(
    (clip) => clip.size.width === clips[0]!.size.width && clip.size.height === clips[0]!.size.height,
  );
  const dropped = prepared.seamDrops.some((seam) => seam.dropped);
  try {
    if (sameSize && !dropped) {
      await concatCopy(prepared.paths, input.outputPath, exec);
      return { method: "copy", outputPath: input.outputPath, seamDrops: prepared.seamDrops };
    }
  } catch {
    // Mixed codecs or concat-demuxer failure: fall through to a narrow transcode.
  }
  const transcodeClips = dropped
    ? await Promise.all(
        prepared.paths.map(async (path, index) => (await probeClip(path, exec)) ?? clips[index] ?? clips[0]!),
      )
    : clips;
  await concatTranscode(prepared.paths, transcodeClips, input.outputPath, exec);
  return { method: "transcode", outputPath: input.outputPath, seamDrops: prepared.seamDrops };
}

export async function downloadClipToFile(
  url: string,
  destPath: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to download journey clip: ${url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(destPath, bytes);
}

export async function prepareExportDirectory(root = tmpdir()): Promise<string> {
  const directory = join(root, `tunnelvision-export-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(directory, { recursive: true });
  return directory;
}
