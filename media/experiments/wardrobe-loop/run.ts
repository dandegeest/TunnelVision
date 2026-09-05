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
  ReplicateReasoningProvider,
  describeFlux11ProUltraInput,
  describeSeedance25Input,
  planShotMotion,
  sha256File,
} from "../../src/index.ts";
import { assertNoSecret } from "../../src/errors.ts";
import { copyExactFile, isApproximately16x9 } from "../../src/image-file.ts";
import { loadDotEnvLocal, getOptionalEnv } from "../../src/config/environment.ts";
import { gitCommit } from "../runner.ts";
import {
  CANONICAL_IDS,
  CANONICAL_PROMPTS,
  CANONICAL_SEEDS,
  COMMON_VIDEO_INTENT,
  IMAGE_MODEL,
  REASONING_MODEL,
  SEEDANCE_SETTINGS,
  SHARED_VISUAL_LANGUAGE,
  SHOTS,
  STORY_SYNOPSIS,
  VIDEO_DURATION_SECONDS,
  VIDEO_MODEL,
  VIDEO_PROMPTS,
  WARDROBE_LOOP_ID,
  WARDROBE_LOOP_TITLE,
  type CanonicalId,
  type ShotId,
} from "./story.ts";

const execFileAsync = promisify(execFile);
const mediaDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(mediaDir, "..", "..", "..");
const outputRoot = join(repoRoot, "camotion/integration/wardrobe-loop-01");
const pythonBin = join(repoRoot, "camotion/.venv/bin/python");
const renderHelper = join(repoRoot, "camotion/integration/wardrobe_loop_render.py");

type CallKind = "image" | "reasoning" | "video";

const callCounts: Record<CallKind, number> = {
  image: 0,
  reasoning: 0,
  video: 0,
};

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
  for (const forbidden of ["REPLICATE_API_TOKEN", "r8_"]) {
    if (serialized.includes(forbidden) && forbidden !== "r8_") {
      throw new Error(`refusing to write ${forbidden} into artifacts`);
    }
  }
  if (token && serialized.includes(token)) {
    throw new Error("refusing to write API token into artifacts");
  }
}

async function validateImage(path: string): Promise<{
  width: number;
  height: number;
  sha256: string;
  bytes: number;
  format: string;
}> {
  const { stdout } = await execFileAsync(
    pythonBin,
    [
      "-c",
      "from PIL import Image; import sys; im=Image.open(sys.argv[1]); print(im.format, im.size[0], im.size[1])",
      path,
    ],
    { cwd: repoRoot },
  );
  const [format, widthText, heightText] = stdout.trim().split(/\s+/);
  const width = Number(widthText);
  const height = Number(heightText);
  if (!isApproximately16x9(width, height)) {
    throw new Error(`${path} is ${width}x${height}, not 16:9`);
  }
  const hashed = await sha256File(path);
  return { width, height, format, ...hashed };
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

const { values } = parseArgs({
  options: {
    execute: { type: "boolean", default: false },
  },
});

loadDotEnvLocal(repoRoot);
const token = getOptionalEnv("REPLICATE_API_TOKEN");

await ensureDir(join(outputRoot, "canonical"));
await ensureDir(join(outputRoot, "canonical/depth"));
await ensureDir(join(outputRoot, "canonical/vision"));
await ensureDir(join(outputRoot, "plans"));
await ensureDir(join(outputRoot, "shooting"));
await ensureDir(join(outputRoot, "videos"));
await ensureDir(join(outputRoot, "evaluation"));

const story = {
  id: WARDROBE_LOOP_ID,
  title: WARDROBE_LOOP_TITLE,
  synopsis: STORY_SYNOPSIS,
  shared_visual_language: SHARED_VISUAL_LANGUAGE,
  loop: "A → B → C → D → E → A",
  note: "F is exactly A. Canonicals A–E are generated independently from text. No image-reference chain.",
  canonical_prompts: CANONICAL_PROMPTS,
  video_prompts: VIDEO_PROMPTS,
  common_video_intent: COMMON_VIDEO_INTENT,
};
assertSafe(story, token);
await writeFile(join(outputRoot, "story.json"), `${JSON.stringify(story, null, 2)}\n`);

if (!values.execute) {
  console.log(
    JSON.stringify(
      {
        execute: false,
        output: repoPath(outputRoot),
        image_model: IMAGE_MODEL,
        video_model: VIDEO_MODEL,
        reasoning_model: REASONING_MODEL,
        replicate_api_token_present: Boolean(token),
      },
      null,
      2,
    ),
  );
  console.error("Dry run only. Pass --execute to invoke Replicate.");
  process.exit(0);
}

if (!token) {
  console.error("REPLICATE_API_TOKEN is not set");
  process.exit(1);
}

const media = new ReplicateMediaProvider({
  model: VIDEO_MODEL,
  imageModel: IMAGE_MODEL,
  seedance: {
    resolution: SEEDANCE_SETTINGS.resolution,
    aspectRatio: SEEDANCE_SETTINGS.aspectRatio,
    generateAudio: SEEDANCE_SETTINGS.generateAudio,
    watermark: SEEDANCE_SETTINGS.watermark,
    outputFormat: SEEDANCE_SETTINGS.outputFormat,
  },
  flux: {
    aspectRatio: "16:9",
    raw: false,
    outputFormat: "png",
    safetyTolerance: 2,
  },
});
const reasoning = new ReplicateReasoningProvider({
  model: REASONING_MODEL,
});

const canonicalRecords: Record<string, unknown> = {};

for (const id of CANONICAL_IDS) {
  const path = join(outputRoot, "canonical", `${id}.png`);
  const prompt = CANONICAL_PROMPTS[id];
  const seed = CANONICAL_SEEDS[id];
  let generated = false;
  if (await fileExists(path)) {
    try {
      const valid = await validateImage(path);
      canonicalRecords[id] = {
        canonical_id: id,
        skipped: true,
        prompt,
        provider: "replicate",
        model: IMAGE_MODEL,
        aspect_ratio: "16:9",
        seed,
        parameters: describeFlux11ProUltraInput({ prompt, seed }),
        output_path: repoPath(path),
        ...valid,
      };
      console.log(`canonical ${id} exists, skipping generation`);
      continue;
    } catch (error) {
      console.error(`canonical ${id} exists but is unusable, regenerating: ${error}`);
    }
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      callCounts.image += 1;
      const result = await media.generateImage({ prompt, seed });
      const bytes = await download(result.outputUrl, path);
      const valid = await validateImage(path);
      generated = true;
      canonicalRecords[id] = {
        canonical_id: id,
        skipped: false,
        prompt,
        provider: result.provider,
        model: result.model,
        model_version: result.modelVersion,
        prediction_id: result.predictionId,
        aspect_ratio: "16:9",
        seed,
        parameters: describeFlux11ProUltraInput({ prompt, seed }),
        output_path: repoPath(path),
        output_url: result.outputUrl,
        started_at: result.startedAt,
        completed_at: result.completedAt,
        elapsed_ms: result.elapsedMs,
        metadata: result.metadata,
        bytes: bytes.length,
        ...valid,
      };
      console.log(`canonical ${id} wrote ${path}`);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      console.error(`canonical ${id} attempt ${attempt} failed: ${error}`);
    }
  }
  if (!generated) {
    throw lastError instanceof Error ? lastError : new Error(`failed to generate ${id}`);
  }
}

const aPath = join(outputRoot, "canonical/A.png");
const fPath = join(outputRoot, "canonical/F.png");
const fCopy = await copyExactFile(aPath, fPath);
const aHash = await sha256File(aPath);
if (fCopy.sha256 !== aHash.sha256) {
  throw new Error("F is not exactly A");
}
canonicalRecords.F = {
  canonical_id: "F",
  equals: "A",
  output_path: repoPath(fPath),
  sha256: fCopy.sha256,
  bytes: fCopy.bytes,
};
console.log("F == A");

await runPythonJobs({
  depths: CANONICAL_IDS.map((id) => ({
    image: join(outputRoot, "canonical", `${id}.png`),
    output: join(outputRoot, "canonical/depth", `${id}.png`),
  })),
  vision: CANONICAL_IDS.map((id) => ({
    image: join(outputRoot, "canonical", `${id}.png`),
    output: join(outputRoot, "canonical/vision", `${id}.jpg`),
  })),
  renders: [],
});

const shotRecords: Record<string, unknown> = {};

for (const shot of SHOTS) {
  const startId = shot.start as CanonicalId;
  const endId = shot.end as CanonicalId;
  const shotDir = join(outputRoot, "shooting", shot.id);
  await ensureDir(shotDir);
  const startPlanPath = join(outputRoot, "plans", `${shot.id}.json`);
  const endPlanPath = join(shotDir, "end-plan.json");
  const reasoningPath = join(shotDir, "reasoning.json");
  const startShooting = join(shotDir, "start.png");
  const endShooting = join(shotDir, "end.png");
  const videoPath = join(outputRoot, "videos", `${shot.id}.mp4`);

  const startVision = join(outputRoot, "canonical/vision", `${startId}.jpg`);
  const endVision = join(outputRoot, "canonical/vision", `${endId}.jpg`);
  const startCanonical = join(outputRoot, "canonical", `${startId}.png`);
  const endCanonical = join(outputRoot, "canonical", `${endId}.png`);

  if (!(await fileExists(startPlanPath)) || !(await fileExists(endPlanPath))) {
    callCounts.reasoning += 1;
    const planned = await planShotMotion({
      reasoning,
      shotId: shot.id,
      startId,
      endId,
      journey: `${STORY_SYNOPSIS}\nShot intent: ${VIDEO_PROMPTS[shot.id]}`,
      startImage: { kind: "file", path: startVision },
      endImage: { kind: "file", path: endVision },
    });
    await writeFile(startPlanPath, `${JSON.stringify(planned.plans.start, null, 2)}\n`);
    await writeFile(endPlanPath, `${JSON.stringify(planned.plans.end, null, 2)}\n`);
    const reasoningRecord = {
      shot: shot.id,
      provider: "replicate",
      model: planned.model,
      model_version: planned.modelVersion,
      prediction_id: planned.predictionId,
      elapsed_ms: planned.elapsedMs,
      route: planned.plans.route,
      pinned: planned.plans.pinned,
      raw: planned.plans.raw,
      text: planned.reasoningText,
    };
    assertSafe(reasoningRecord, token);
    await writeFile(reasoningPath, `${JSON.stringify(reasoningRecord, null, 2)}\n`);
    console.log(`cinematographer ${shot.id} wrote ${startPlanPath}`);
  } else {
    console.log(`plans for ${shot.id} exist, skipping cinematographer`);
  }

  await validatePlanWithPython(startPlanPath);
  await validatePlanWithPython(endPlanPath);

  await runPythonJobs({
    depths: [],
    vision: [],
    renders: [
      {
        image: startCanonical,
        plan: startPlanPath,
        depth: join(outputRoot, "canonical/depth", `${startId}.png`),
        output: startShooting,
      },
      {
        image: endCanonical,
        plan: endPlanPath,
        depth: join(outputRoot, "canonical/depth", `${endId}.png`),
        output: endShooting,
      },
    ],
  });

  const startHash = await sha256File(startShooting);
  const endHash = await sha256File(endShooting);
  const startPlan = JSON.parse(await readFile(startPlanPath, "utf8"));
  const endPlan = JSON.parse(await readFile(endPlanPath, "utf8"));

  let videoRecord: Record<string, unknown>;
  if (await fileExists(videoPath)) {
    const hashed = await sha256File(videoPath);
    videoRecord = {
      skipped: true,
      output_path: repoPath(videoPath),
      ...hashed,
    };
    console.log(`video ${shot.id} exists, skipping generation`);
  } else {
    const prompt = VIDEO_PROMPTS[shot.id];
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
    let generated = false;
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        callCounts.video += 1;
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
          duration_seconds: VIDEO_DURATION_SECONDS,
          settings: submitted,
          output_path: repoPath(videoPath),
          output_url: result.outputUrl,
          started_at: result.startedAt,
          completed_at: result.completedAt,
          elapsed_ms: result.elapsedMs,
          metadata: result.metadata,
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
      }
    }
    if (!generated) {
      throw lastError instanceof Error ? lastError : new Error(`failed video ${shot.id}`);
    }
  }

  const preview = await extractPreviewFrames(
    videoPath,
    join(outputRoot, "evaluation", shot.id),
  );

  shotRecords[shot.id] = {
    shot: shot.id,
    start_canonical: startId,
    end_canonical: endId,
    camera_motion_plan: startPlan,
    end_camera_motion_plan: endPlan,
    cinematographer_reasoning_path: (await fileExists(reasoningPath))
      ? repoPath(reasoningPath)
      : null,
    camotion: {
      baseline: "01.8-route-preserved",
      orientation: "outgoing",
      adaptive_exposure: false,
      start: { path: repoPath(startShooting), ...startHash },
      end: { path: repoPath(endShooting), ...endHash },
      start_plan: repoPath(startPlanPath),
      end_plan: repoPath(endPlanPath),
      start_depth: repoPath(join(outputRoot, "canonical/depth", `${startId}.png`)),
      end_depth: repoPath(join(outputRoot, "canonical/depth", `${endId}.png`)),
    },
    video: videoRecord!,
    preview_frames: preview,
  };
}

const manifest = {
  experiment: WARDROBE_LOOP_ID,
  title: WARDROBE_LOOP_TITLE,
  git_commit: await gitCommit(repoRoot),
  f_equals_a: true,
  image_provider: "replicate",
  image_model: IMAGE_MODEL,
  video_provider: "replicate",
  video_model: VIDEO_MODEL,
  reasoning_provider: "replicate",
  reasoning_model: REASONING_MODEL,
  camotion_baseline: "01.8-route-preserved",
  seedance_defaults: DEFAULT_SEEDANCE_25_SETTINGS,
  replicate_calls: callCounts,
  canonicals: canonicalRecords,
  shots: shotRecords,
};
assertSafe(manifest, token);
await writeFile(
  join(outputRoot, "generation-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

const manifestText = await readFile(join(outputRoot, "generation-manifest.json"), "utf8");
if (token && manifestText.includes(token)) {
  throw new Error("manifest contains API token");
}

console.log(
  JSON.stringify(
    {
      output: repoPath(outputRoot),
      f_equals_a: true,
      replicate_calls: callCounts,
    },
    null,
    2,
  ),
);
