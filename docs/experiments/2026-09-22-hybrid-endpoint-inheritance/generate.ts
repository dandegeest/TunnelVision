#!/usr/bin/env npx tsx
/** Hybrid Kling 2.5: inherited start + pristine canonical end. Not production. */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { KLING_25_TURBO_PRO_MODEL, ReplicateMediaProvider } from "../../../media/src/index.ts";
import { loadDotEnvLocal } from "../../../media/src/config/environment.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const out = join(here, "TheLongWayDown");

const LEG = process.argv[2];
const START = process.argv[3];
const END = process.argv[4];
const DURATION = Number(process.argv[5] ?? 10);
if (!LEG || !START || !END) {
  console.error("Usage: generate.ts <A-B|B-C|C-D|D-E> <start> <end> [durationSeconds]");
  process.exit(2);
}

loadDotEnvLocal(repoRoot);

const provider = new ReplicateMediaProvider({
  model: KLING_25_TURBO_PRO_MODEL,
  generateAudio: false,
});

async function download(url: string, path: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`download failed ${response.status} ${url}`);
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
}

async function main(): Promise<void> {
  const prompt = await readFile(join(out, "prompts", `${LEG}.txt`), "utf8");
  const started = Date.now();
  const result = await provider.generateVideo({
    startImage: { kind: "file", path: resolve(START) },
    endImage: { kind: "file", path: resolve(END) },
    prompt,
    durationSeconds: DURATION,
  });
  const dir = join(out, "generated", LEG);
  await mkdir(dir, { recursive: true });
  const videoPath = join(dir, `${LEG}.mp4`);
  await download(result.outputUrl, videoPath);
  await writeFile(
    join(dir, "generation.json"),
    JSON.stringify(
      {
        experiment: "hybrid-endpoint-inheritance",
        leg: LEG,
        model: KLING_25_TURBO_PRO_MODEL,
        durationRequested: DURATION,
        startImage: START,
        endImage: END,
        camotionOnStart: LEG === "A-B",
        promptFile: `prompts/${LEG}.txt`,
        wallMs: Date.now() - started,
        result,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`${LEG} wrote ${videoPath} in ${Date.now() - started}ms`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
