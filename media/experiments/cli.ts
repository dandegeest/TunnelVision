import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

import { sha256Bytes } from "../src/index.ts";
import { loadDotEnvLocal } from "../src/config/environment.ts";
import {
  COST_ESTIMATE_NOTE,
  historicalObservedCostUsd,
} from "./batch.ts";
import {
  evidenceResultFilename,
  evidenceRunFilename,
} from "./record.ts";
import { cameraSpeedPromptDiff, embodiedWalkingPromptDiff } from "./prompt-control.ts";
import { gitCommit, prepareExperiment, runExperiment } from "./runner.ts";

const mediaDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(mediaDir, "..", "..");

const { values } = parseArgs({
  options: {
    manifest: { type: "string" },
    execute: { type: "boolean", default: false },
  },
});

if (!values.manifest) {
  console.error("Usage: npm --prefix media run experiment -- --manifest <path> [--execute]");
  process.exit(2);
}

loadDotEnvLocal(repoRoot);

const manifestPath = resolve(repoRoot, values.manifest);
const prepared = await prepareExperiment({
  repoRoot,
  manifestPath,
  execute: Boolean(values.execute),
});
const originatingCommit = await gitCommit(repoRoot);

const promptSha256 = sha256Bytes(Buffer.from(prepared.manifest.prompt, "utf8"));
const outputDir = relative(repoRoot, prepared.outputDir).split("\\").join("/");
const observedCostUsd = await historicalObservedCostUsd(repoRoot);
const approximateCost =
  observedCostUsd === null ? null : Number(observedCostUsd.toFixed(2));

let promptDiffFromFrozenLocomotion: string | null = null;
let promptDiffFromSeedanceSlow: string | null = null;
try {
  const frozen = JSON.parse(
    await readFile(join(repoRoot, "media/experiments/manifests/01.8.json"), "utf8"),
  ) as { prompt: string };
  if (frozen.prompt !== prepared.manifest.prompt) {
    promptDiffFromFrozenLocomotion = cameraSpeedPromptDiff(
      frozen.prompt,
      prepared.manifest.prompt,
    );
  }
} catch {
  promptDiffFromFrozenLocomotion = null;
}
try {
  const slow = JSON.parse(
    await readFile(
      join(
        repoRoot,
        "media/experiments/manifests/prompt-control/camera-speed/seedance-slow.json",
      ),
      "utf8",
    ),
  ) as { prompt: string };
  if (slow.prompt !== prepared.manifest.prompt) {
    promptDiffFromSeedanceSlow = embodiedWalkingPromptDiff(
      slow.prompt,
      prepared.manifest.prompt,
    );
  }
} catch {
  promptDiffFromSeedanceSlow = null;
}

const readiness = {
  execute: Boolean(values.execute),
  experiment: prepared.manifest.experiment,
  evidence_family: prepared.manifest.evidence_family ?? null,
  model: prepared.manifest.model,
  start_image: {
    path: prepared.manifest.start_image,
    sha256: prepared.startHash.sha256,
    bytes: prepared.startHash.bytes,
  },
  end_image: prepared.manifest.end_image
    ? {
        path: prepared.manifest.end_image,
        sha256: prepared.endHash?.sha256 ?? null,
        bytes: prepared.endHash?.bytes ?? null,
      }
    : null,
  duration_seconds: prepared.manifest.duration_seconds ?? null,
  prompt: prepared.manifest.prompt,
  prompt_sha256: promptSha256,
  prompt_diff_from_frozen_locomotion: promptDiffFromFrozenLocomotion,
  prompt_diff_from_seedance_slow: promptDiffFromSeedanceSlow,
  submitted_settings: prepared.seedanceInput,
  git_commit: originatingCommit,
  output_dir: outputDir,
  output_result: `${outputDir}/${evidenceResultFilename(prepared.manifest.experiment)}`,
  output_run: `${outputDir}/${evidenceRunFilename(prepared.manifest.experiment)}`,
  historical_observed_cost_usd_per_run: observedCostUsd,
  approximate_historical_cost_usd: approximateCost,
  cost_estimate_note: observedCostUsd === null ? null : COST_ESTIMATE_NOTE,
  replicate_api_token_present: prepared.tokenPresent,
};

console.log(JSON.stringify(readiness, null, 2));

if (!values.execute) {
  console.error("Dry run only. Pass --execute to invoke Replicate.");
  process.exit(0);
}

if (!prepared.tokenPresent) {
  console.error("REPLICATE_API_TOKEN is not set");
  process.exit(1);
}

const record = await runExperiment({
  repoRoot,
  manifestPath,
  execute: true,
});
console.log(JSON.stringify(record, null, 2));
