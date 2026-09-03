import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { loadDotEnvLocal } from "../src/config/environment.ts";
import { prepareExperiment, runExperiment } from "./runner.ts";

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

const readiness = {
  execute: Boolean(values.execute),
  experiment: prepared.manifest.experiment,
  model: prepared.manifest.model,
  start_image: prepared.manifest.start_image,
  end_image: prepared.manifest.end_image ?? null,
  start_sha256: prepared.startHash.sha256,
  end_sha256: prepared.endHash?.sha256 ?? null,
  prompt: prepared.manifest.prompt,
  submitted_settings: prepared.seedanceInput,
  output_dir: prepared.outputDir.replace(repoRoot + "/", ""),
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
