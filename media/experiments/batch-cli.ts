import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { loadDotEnvLocal, getOptionalEnv } from "../src/config/environment.ts";
import {
  formatPaidSummary,
  parseExperimentList,
  runBenchmarkBatch,
} from "./batch.ts";

const mediaDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(mediaDir, "..", "..");

const { values } = parseArgs({
  options: {
    experiments: { type: "string" },
    execute: { type: "boolean", default: false },
    "rerun-existing": { type: "boolean", default: false },
  },
});

if (!values.experiments) {
  console.error(
    "Usage: npm --prefix media run benchmark -- --experiments 01.3,01.4,01.6,01.7,01.8 [--execute] [--rerun-existing]",
  );
  process.exit(2);
}

loadDotEnvLocal(repoRoot);

const experiments = parseExperimentList(values.experiments);
const execute = Boolean(values.execute);
const rerunExisting = Boolean(values["rerun-existing"]);

const plan = await runBenchmarkBatch({
  repoRoot,
  experiments,
  execute: false,
  rerunExisting,
});

console.error(formatPaidSummary(plan));
console.log(JSON.stringify(plan, null, 2));

if (!execute) {
  console.error("Dry run only. Pass --execute to invoke Replicate.");
  process.exit(0);
}

if (plan.items.some((item) => item.status === "blocked")) {
  console.error("Refusing --execute because one or more experiments are blocked.");
  process.exit(1);
}

if (plan.paid_generation_count === 0) {
  console.error("No paid generations to run.");
  process.exit(0);
}

if (getOptionalEnv("REPLICATE_API_TOKEN") === undefined) {
  console.error("REPLICATE_API_TOKEN is not set");
  process.exit(1);
}

console.error("Executing paid generations sequentially. Failures stop the batch.");
const result = await runBenchmarkBatch({
  repoRoot,
  experiments,
  execute: true,
  rerunExisting,
});
console.log(JSON.stringify(result, null, 2));
if (result.items.some((item) => item.status === "failed" || item.status === "blocked")) {
  process.exit(1);
}
