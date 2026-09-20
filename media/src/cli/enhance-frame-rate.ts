import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { loadDotEnvLocal } from "../config/environment.ts";
import { DEFAULT_ENHANCE_FRAME_RATE } from "../runway/enhance-frame-rate.ts";
import { downloadRunwayOutput } from "../runway/download.ts";
import { RunwayDevProvider } from "../runway/provider.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    fps: { type: "string" },
  },
});

const [inputVideo, outputVideo] = positionals;
if (!inputVideo || !outputVideo) {
  console.error(
    "Usage: npm --prefix media run runway:enhance-frame-rate -- <input.mp4> <output.mp4> [--fps 120]",
  );
  process.exit(2);
}

loadDotEnvLocal(repoRoot);

const inputPath = resolve(repoRoot, inputVideo);
const outputPath = resolve(repoRoot, outputVideo);
const provider = new RunwayDevProvider();
const progress = { submitted: false };

try {
  const result = await provider.enhanceFrameRate(
    { kind: "file", path: inputPath },
    {
      fps: values.fps ?? DEFAULT_ENHANCE_FRAME_RATE,
      onProgress(message) {
        if (message === "uploading" || message === "submitting") {
          if (!progress.submitted) {
            progress.submitted = true;
            process.stdout.write("uploading/submitting\n");
          }
          return;
        }
        process.stdout.write(`${message}\n`);
      },
    },
  );
  await downloadRunwayOutput(result.outputUrl, outputPath);
  process.stdout.write(`elapsed ${result.elapsedMs}ms\n`);
  if (result.metadata.cost || result.metadata.estimatedCost) {
    process.stdout.write(
      `cost ${JSON.stringify({
        cost: result.metadata.cost,
        estimatedCost: result.metadata.estimatedCost,
      })}\n`,
    );
  }
  process.stdout.write(`output path ${outputPath}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Runway enhance frame rate failed";
  console.error(message);
  process.exit(1);
}
