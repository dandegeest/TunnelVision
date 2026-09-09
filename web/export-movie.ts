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

export type ConcatenateClipsInput = {
  clipPaths: string[];
  outputPath: string;
  execFileImpl?: typeof execFileAsync;
};

export type ConcatenateClipsResult = {
  method: "copy" | "transcode";
  outputPath: string;
};

async function probeVideoSize(
  path: string,
  exec: typeof execFileAsync,
): Promise<ClipSize | null> {
  try {
    const { stdout } = await exec("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "csv=p=0",
      path,
    ]);
    const [widthText, heightText] = stdout.trim().split(",");
    const width = Number(widthText);
    const height = Number(heightText);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
      return null;
    }
    return { width, height };
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
    "-an",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

async function concatTranscode(
  clipPaths: string[],
  sizes: ClipSize[],
  outputPath: string,
  exec: typeof execFileAsync,
): Promise<void> {
  const target = mostCommonSize(sizes);
  const labels = clipPaths.map((_, index) => `v${index}`);
  const scaled = clipPaths
    .map((_, index) => {
      return `[${index}:v]scale=${target.width}:${target.height}:force_original_aspect_ratio=decrease,pad=${target.width}:${target.height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=24,format=yuv420p[${labels[index]}]`;
    })
    .join(";");
  const concatInputs = labels.map((label) => `[${label}]`).join("");
  const filter = `${scaled};${concatInputs}concat=n=${clipPaths.length}:v=1:a=0[v]`;
  await exec("ffmpeg", [
    "-y",
    ...clipPaths.flatMap((path) => ["-i", path]),
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    "-an",
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
  const sizes: ClipSize[] = [];
  for (const path of input.clipPaths) {
    const size = await probeVideoSize(path, exec);
    if (!size) {
      throw new Error(`Could not probe video size for ${path}`);
    }
    sizes.push(size);
  }
  const sameSize = sizes.every(
    (size) => size.width === sizes[0]!.width && size.height === sizes[0]!.height,
  );
  try {
    if (sameSize) {
      await concatCopy(input.clipPaths, input.outputPath, exec);
      return { method: "copy", outputPath: input.outputPath };
    }
  } catch {
    // Mixed codecs or concat-demuxer failure: fall through to a narrow transcode.
  }
  await concatTranscode(input.clipPaths, sizes, input.outputPath, exec);
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
