import { parseArgs } from "node:util";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_SEEDANCE_25_SETTINGS,
  MediaGenerationError,
  ReplicateMediaProvider,
  describeSeedance25Input,
  sha256File,
} from "../../src/index.ts";
import { assertNoSecret } from "../../src/errors.ts";
import { loadDotEnvLocal, getOptionalEnv } from "../../src/config/environment.ts";
import { gitCommit } from "../runner.ts";

const execFileAsync = promisify(execFile);
const mediaDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(mediaDir, "..", "..", "..");
const outputRoot = join(repoRoot, "camotion/integration/forest-a-to-f");
const pythonBin = join(repoRoot, "camotion/.venv/bin/python");
const renderHelper = join(repoRoot, "camotion/integration/wardrobe_loop_render.py");

const CANONICAL_IDS = ["A", "B", "C", "D", "E", "F"] as const;
type CanonicalId = (typeof CANONICAL_IDS)[number];

const CANONICAL_FILES: Record<CanonicalId, string> = {
  A: "A.jpg",
  B: "B.png",
  C: "C.png",
  D: "D.png",
  E: "E.png",
  F: "F.png",
};

const SHOTS = [
  { id: "A-B", start: "A", end: "B" },
  { id: "B-C", start: "B", end: "C" },
  { id: "C-D", start: "C", end: "D" },
  { id: "D-E", start: "D", end: "E" },
  { id: "E-F", start: "E", end: "F" },
] as const;

const VIDEO_MODEL = "bytedance/seedance-2.5";
const VIDEO_DURATION_SECONDS = 6;
const SEEDANCE_SETTINGS = {
  resolution: "720p",
  aspectRatio: "adaptive",
  generateAudio: false,
  watermark: false,
  outputFormat: "mp4",
} as const;
const REVIEW_MOVIE = "forest-a-to-f-camotion-evidence.mp4";

function repoPath(path: string): string {
  return relative(repoRoot, path).split("\\").join("/");
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

async function download(url: string, path: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to download ${url}: ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await ensureDir(dirname(path));
  await writeFile(path, bytes);
  return bytes;
}

function assertSafe(payload: unknown, token: string | undefined): void {
  assertNoSecret(payload, token);
  const serialized = JSON.stringify(payload);
  if (serialized.includes("REPLICATE_API_TOKEN")) {
    throw new Error("refusing to write REPLICATE_API_TOKEN into artifacts");
  }
  if (token && serialized.includes(token)) {
    throw new Error("refusing to write API token into artifacts");
  }
}

async function runPythonJobs(jobs: unknown): Promise<void> {
  const jobsPath = join(outputRoot, ".camotion-jobs.json");
  await writeFile(jobsPath, `${JSON.stringify(jobs, null, 2)}\n`);
  const result = await execFileAsync(pythonBin, [renderHelper, "--jobs", jobsPath], {
    cwd: repoRoot,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

async function validatePlanWithPython(path: string): Promise<void> {
  await execFileAsync(
    pythonBin,
    [
      "-c",
      "from camotion.plan import load_plan; import sys; load_plan(sys.argv[1]); print('ok')",
      path,
    ],
    { cwd: join(repoRoot, "camotion") },
  );
}

async function probeDurationSeconds(path: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      path,
    ]);
    const value = Number(stdout.trim());
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

async function probeVideoSize(
  path: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
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

function mostCommonSize(
  sizes: readonly { width: number; height: number }[],
): { width: number; height: number } {
  const counts = new Map<string, { width: number; height: number; n: number }>();
  for (const size of sizes) {
    const key = `${size.width}x${size.height}`;
    const current = counts.get(key);
    if (current) {
      current.n += 1;
    } else {
      counts.set(key, { ...size, n: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0];
}

async function extractPreviewFrames(videoPath: string, destDir: string): Promise<string[]> {
  await ensureDir(destDir);
  const stamps = ["0", "1.5", "3", "4.5", "5.8"];
  const written: string[] = [];
  for (const [index, stamp] of stamps.entries()) {
    const output = join(destDir, `frame-${String(index).padStart(2, "0")}.png`);
    try {
      await execFileAsync("ffmpeg", [
        "-y",
        "-ss",
        stamp,
        "-i",
        videoPath,
        "-frames:v",
        "1",
        output,
      ]);
      if (await fileExists(output)) {
        written.push(repoPath(output));
      }
    } catch {
      // Preview extraction is observational only.
    }
  }
  return written;
}

function isRetryableProviderFailure(error: unknown): boolean {
  if (!(error instanceof MediaGenerationError)) {
    return true;
  }
  return error.code === "provider_unavailable" || error.code === "generation_failed";
}

const { values } = parseArgs({
  options: {
    execute: { type: "boolean", default: false },
  },
});

loadDotEnvLocal(repoRoot);
const token = getOptionalEnv("REPLICATE_API_TOKEN");

await ensureDir(join(outputRoot, "canonical/depth"));
await ensureDir(join(outputRoot, "shooting"));
await ensureDir(join(outputRoot, "videos"));
await ensureDir(join(outputRoot, "evaluation"));

const sources = JSON.parse(await readFile(join(outputRoot, "sources.json"), "utf8")) as {
  frames: Record<
    CanonicalId,
    { runtime_filename: string; sha256: string; bytes: number; path: string }
  >;
};
const prompt = (await readFile(join(outputRoot, "prompt.txt"), "utf8")).trim();

for (const id of CANONICAL_IDS) {
  const expected = sources.frames[id];
  const path = join(outputRoot, "canonical", CANONICAL_FILES[id]);
  if (!(await fileExists(path))) {
    throw new Error(`STOP: exact canonical ${id} is missing at ${repoPath(path)}`);
  }
  const hashed = await sha256File(path);
  if (hashed.sha256 !== expected.sha256 || hashed.bytes !== expected.bytes) {
    throw new Error(
      `STOP: canonical ${id} does not match frozen runtime identity ${expected.runtime_filename}`,
    );
  }
}

for (const id of CANONICAL_IDS) {
  await validatePlanWithPython(join(outputRoot, "plans", `${id}.json`));
}

await runPythonJobs({
  depths: CANONICAL_IDS.map((id) => ({
    image: join(outputRoot, "canonical", CANONICAL_FILES[id]),
    output: join(outputRoot, "canonical/depth", `${id}.png`),
  })),
  vision: [],
  renders: CANONICAL_IDS.map((id) => ({
    image: join(outputRoot, "canonical", CANONICAL_FILES[id]),
    plan: join(outputRoot, "plans", `${id}.json`),
    depth: join(outputRoot, "canonical/depth", `${id}.png`),
    output: join(outputRoot, "shooting", `${id}.png`),
  })),
});

const shootingRecords: Record<string, unknown> = {};
for (const id of CANONICAL_IDS) {
  const path = join(outputRoot, "shooting", `${id}.png`);
  if (!(await fileExists(path))) {
    throw new Error(`Camotion did not write shooting frame ${id}`);
  }
  shootingRecords[id] = {
    canonical_id: id,
    path: repoPath(path),
    plan: repoPath(join(outputRoot, "plans", `${id}.json`)),
    depth: repoPath(join(outputRoot, "canonical/depth", `${id}.png`)),
    camotion_baseline: "01.8-route-preserved",
    exposure_strength: 0.08,
    samples: 16,
    ...(await sha256File(path)),
  };
}

if (!values.execute) {
  console.log(
    JSON.stringify(
      {
        execute: false,
        output: repoPath(outputRoot),
        video_model: VIDEO_MODEL,
        prompt,
        shooting: Object.fromEntries(
          CANONICAL_IDS.map((id) => [id, (shootingRecords[id] as { path: string }).path]),
        ),
        replicate_api_token_present: Boolean(token),
      },
      null,
      2,
    ),
  );
  console.error("Camotion shooting frames written. Pass --execute to invoke Seedance.");
  process.exit(0);
}

if (!token) {
  console.error("REPLICATE_API_TOKEN is not set");
  process.exit(1);
}

const media = new ReplicateMediaProvider({
  model: VIDEO_MODEL,
  seedance: {
    resolution: SEEDANCE_SETTINGS.resolution,
    aspectRatio: SEEDANCE_SETTINGS.aspectRatio,
    generateAudio: SEEDANCE_SETTINGS.generateAudio,
    watermark: SEEDANCE_SETTINGS.watermark,
    outputFormat: SEEDANCE_SETTINGS.outputFormat,
  },
});

const shotRecords: Record<string, unknown> = {};
let videoCalls = 0;

for (const shot of SHOTS) {
  const startShooting = join(outputRoot, "shooting", `${shot.start}.png`);
  const endShooting = join(outputRoot, "shooting", `${shot.end}.png`);
  const videoPath = join(outputRoot, "videos", `${shot.id}.mp4`);
  const startPlan = JSON.parse(
    await readFile(join(outputRoot, "plans", `${shot.start}.json`), "utf8"),
  );
  const endPlan = JSON.parse(await readFile(join(outputRoot, "plans", `${shot.end}.json`), "utf8"));
  const request = {
    startImage: { kind: "file" as const, path: startShooting },
    endImage: { kind: "file" as const, path: endShooting },
    prompt,
    durationSeconds: VIDEO_DURATION_SECONDS,
  };
  const submitted = describeSeedance25Input(
    request,
    `<local file upload: ${repoPath(startShooting)}>`,
    `<local file upload: ${repoPath(endShooting)}>`,
    {
      resolution: SEEDANCE_SETTINGS.resolution,
      aspectRatio: SEEDANCE_SETTINGS.aspectRatio,
      generateAudio: SEEDANCE_SETTINGS.generateAudio,
      watermark: SEEDANCE_SETTINGS.watermark,
      outputFormat: SEEDANCE_SETTINGS.outputFormat,
    },
  );

  let videoRecord: Record<string, unknown>;
  if (await fileExists(videoPath)) {
    const hashed = await sha256File(videoPath);
    videoRecord = {
      skipped: true,
      output_path: repoPath(videoPath),
      duration_seconds_probed: await probeDurationSeconds(videoPath),
      ...hashed,
    };
    console.log(`video ${shot.id} exists, skipping generation`);
  } else {
    let generated = false;
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        videoCalls += 1;
        const result = await media.generateVideo(request);
        await download(result.outputUrl, videoPath);
        const hashed = await sha256File(videoPath);
        videoRecord = {
          skipped: false,
          prompt,
          provider: result.provider,
          model: result.model,
          model_version: result.modelVersion,
          prediction_id: result.predictionId,
          duration_seconds_requested: VIDEO_DURATION_SECONDS,
          duration_seconds_probed: await probeDurationSeconds(videoPath),
          settings: submitted,
          output_path: repoPath(videoPath),
          output_url: result.outputUrl,
          started_at: result.startedAt,
          completed_at: result.completedAt,
          elapsed_ms: result.elapsedMs,
          metadata: result.metadata,
          transport_retry: attempt > 1,
          ...hashed,
        };
        generated = true;
        lastError = undefined;
        console.log(`video ${shot.id} wrote ${videoPath}`);
        break;
      } catch (error) {
        lastError = error;
        console.error(`video ${shot.id} attempt ${attempt} failed: ${error}`);
        if (error instanceof MediaGenerationError) {
          console.error(error.code, error.providerMessage);
        }
        if (attempt === 1 && !isRetryableProviderFailure(error)) {
          break;
        }
      }
    }
    if (!generated) {
      throw lastError instanceof Error ? lastError : new Error(`failed video ${shot.id}`);
    }
  }

  shotRecords[shot.id] = {
    shot: shot.id,
    start_canonical: shot.start,
    end_canonical: shot.end,
    start_shooting: repoPath(startShooting),
    end_shooting: repoPath(endShooting),
    start_camera_motion_plan: startPlan,
    end_camera_motion_plan: endPlan,
    shared_boundary_rule:
      `${shot.start}' starts this leg and ${shot.end}' ends it; the same shooting file is reused on every adjacent leg that shares that canonical`,
    video: videoRecord!,
    preview_frames: await extractPreviewFrames(
      videoPath,
      join(outputRoot, "evaluation", shot.id),
    ),
  };
}

const clipPaths = SHOTS.map((shot) => join(outputRoot, "videos", `${shot.id}.mp4`));
const listPath = join(outputRoot, "videos/concat-list.txt");
const assemblyPath = join(outputRoot, "videos", REVIEW_MOVIE);
await writeFile(
  listPath,
  `${clipPaths.map((path) => `file '${path}'`).join("\n")}\n`,
);

const clipSizes = [];
for (const path of clipPaths) {
  const size = await probeVideoSize(path);
  if (!size) {
    throw new Error(`could not probe video size for ${path}`);
  }
  clipSizes.push(size);
}
const sameSize = clipSizes.every(
  (size) => size.width === clipSizes[0].width && size.height === clipSizes[0].height,
);

let concat: Record<string, unknown>;
if (sameSize) {
  const copyCommand = [
    "ffmpeg",
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
    assemblyPath,
  ];
  await execFileAsync(copyCommand[0], copyCommand.slice(1));
  concat = {
    method: "concat demuxer, stream copy, strip audio, faststart",
    transcoded: false,
    command: copyCommand.join(" "),
    clip_sizes: clipSizes,
  };
} else {
  const target = mostCommonSize(clipSizes);
  const labels = clipPaths.map((_, index) => `v${index}`);
  const scaled = clipPaths
    .map((_, index) => {
      return `[${index}:v]scale=${target.width}:${target.height}:force_original_aspect_ratio=decrease,pad=${target.width}:${target.height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=24,format=yuv420p[${labels[index]}]`;
    })
    .join(";");
  const concatInputs = labels.map((label) => `[${label}]`).join("");
  const filter = `${scaled};${concatInputs}concat=n=${clipPaths.length}:v=1:a=0[v]`;
  const transcodeCommand = [
    "ffmpeg",
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
    assemblyPath,
  ];
  await execFileAsync(transcodeCommand[0], transcodeCommand.slice(1));
  concat = {
    method:
      "filter concat, scale+pad to the majority clip size, H.264 yuv420p, no audio; required because stream-copy of mixed resolutions froze later legs",
    transcoded: true,
    command: transcodeCommand.join(" "),
    clip_sizes: clipSizes,
    target_size: target,
  };
}

const assemblyHash = await sha256File(assemblyPath);
concat = {
  ...concat,
  list_path: repoPath(listPath),
  output_path: repoPath(assemblyPath),
  duration_seconds_probed: await probeDurationSeconds(assemblyPath),
  ...assemblyHash,
};

const manifest = {
  experiment: "forest-a-to-f-camotion-evidence",
  git_commit: await gitCommit(repoRoot),
  attribution:
    "TunnelVision is agentic filmmaking research extending filmmaker Terran Boylan's original TunnelVision technique. This Camotion implementation and agentic pipeline are not Terran's code.",
  sequence: "A → B → C → D → E → F",
  video_provider: "replicate",
  video_model: VIDEO_MODEL,
  camotion_baseline: "01.8-route-preserved",
  seedance_defaults: DEFAULT_SEEDANCE_25_SETTINGS,
  prompt,
  duration_seconds_requested: VIDEO_DURATION_SECONDS,
  replicate_video_calls: videoCalls,
  sources: sources.frames,
  shooting: shootingRecords,
  shots: shotRecords,
  concat,
};
assertSafe(manifest, token);
await writeFile(join(outputRoot, "generation-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const manifestText = await readFile(join(outputRoot, "generation-manifest.json"), "utf8");
if (token && manifestText.includes(token)) {
  throw new Error("manifest contains API token");
}

console.log(
  JSON.stringify(
    {
      output: repoPath(outputRoot),
      review_movie: repoPath(assemblyPath),
      replicate_video_calls: videoCalls,
    },
    null,
    2,
  ),
);
