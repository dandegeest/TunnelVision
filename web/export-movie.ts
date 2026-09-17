import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

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

export type ConcatenateClipsResult = {
  method: "copy" | "transcode";
  outputPath: string;
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
  const sameSize = clips.every(
    (clip) => clip.size.width === clips[0]!.size.width && clip.size.height === clips[0]!.size.height,
  );
  try {
    if (sameSize) {
      await concatCopy(input.clipPaths, input.outputPath, exec);
      return { method: "copy", outputPath: input.outputPath };
    }
  } catch {
    // Mixed codecs or concat-demuxer failure: fall through to a narrow transcode.
  }
  await concatTranscode(input.clipPaths, clips, input.outputPath, exec);
  return { method: "transcode", outputPath: input.outputPath };
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
