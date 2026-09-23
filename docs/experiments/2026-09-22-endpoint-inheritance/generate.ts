#!/usr/bin/env npx tsx
/** Offline Kling generation for the endpoint-inheritance experiment. Not production. */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { KLING_25_TURBO_PRO_MODEL, ReplicateMediaProvider } from "../../../media/src/index.ts";
import { loadDotEnvLocal } from "../../../media/src/config/environment.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const out = join(here, "FirstTracksTheDescent2");

const LEG = process.argv[2];
if (LEG !== "bc" && LEG !== "cd") {
  console.error("Usage: generate.ts bc|cd");
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
  if (LEG === "bc") {
    const prompt = await readFile(join(out, "prompts/B-C-effective.txt"), "utf8");
    const started = Date.now();
    const result = await provider.generateVideo({
      startImage: { kind: "file", path: join(out, "stills/B-720p.png") },
      prompt,
      durationSeconds: 5,
    });
    const videoPath = join(out, "generated/kling25-720p/B-C.mp4");
    await download(result.outputUrl, videoPath);
    await writeFile(
      join(out, "generated/kling25-720p/B-C-generation.json"),
      JSON.stringify(
        {
          leg: "B-C",
          model: KLING_25_TURBO_PRO_MODEL,
          resolutionIntent: "720p",
          durationRequested: 5,
          endImage: null,
          startImage: "stills/B-720p.png",
          promptFile: "prompts/B-C-effective.txt",
          wallMs: Date.now() - started,
          result,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`B-C wrote ${videoPath} in ${Date.now() - started}ms`);
    return;
  }

  const prompt = await readFile(join(out, "prompts/C-D-effective.txt"), "utf8");
  const started = Date.now();
  const result = await provider.generateVideo({
    startImage: { kind: "file", path: join(out, "generated/kling25-720p/Cs.png") },
    endImage: { kind: "file", path: join(out, "stills/D-prime-1080p.png") },
    prompt,
    durationSeconds: 5,
  });
  const videoPath = join(out, "generated/kling25-720p/C-D.mp4");
  await download(result.outputUrl, videoPath);
  await writeFile(
    join(out, "generated/kling25-720p/C-D-generation.json"),
    JSON.stringify(
      {
        leg: "C-D",
        model: KLING_25_TURBO_PRO_MODEL,
        resolutionIntent: "720p",
        durationRequested: 5,
        startImage: "generated/kling25-720p/Cs.png",
        endImage: "stills/D-prime-1080p.png",
        promptFile: "prompts/C-D-effective.txt",
        wallMs: Date.now() - started,
        result,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`C-D wrote ${videoPath} in ${Date.now() - started}ms`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
