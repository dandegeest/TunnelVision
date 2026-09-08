import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_GEMINI_31_PRO_SETTINGS,
  GEMINI_31_PRO_MODEL,
  parseCinematographerAssessment,
  sha256File,
} from "../../src/index.ts";
import { assertNoSecret } from "../../src/errors.ts";
import { loadDotEnvLocal, getOptionalEnv } from "../../src/config/environment.ts";
import { ReplicateReasoningProvider } from "../../src/replicate/reasoning.ts";
import { gitCommit } from "../runner.ts";
import { cinematographerPairFromRequest } from "../../../web/trusted-media.ts";
import { TRUSTED_MEDIA_IDS } from "../../../web/src/project/trusted-media-id.ts";
import {
  EXPERIMENT_02_SYSTEM_INSTRUCTION,
  experiment02UserPrompt,
} from "./cinematographer-generative-traversal-prompt.ts";

/**
 * Exact Forest fixture story and destination intents from
 * web/src/fixtures/forest-a-to-f.ts. Product CM context, not experiment hints.
 */
const FOREST_USER_PROMPT =
  "Travel forward through this night forest and keep going. The journey should stay physically continuous, passing through openings and tunnels, and become stranger the deeper it goes.";

const FOREST_STORYBOARD_INTENTS = {
  A: "Night forest path toward the tree-trunk / root gateway in mist.",
  B: "Root-tunnel mouth. The dark opening is slightly right of center.",
  C: "Centered circular root tunnel.",
  D: "Root tunnel with a large glowing crystal cluster occupying the path.",
  E: "Dark reflective corridor toward a tall vertical portal.",
  F: "Open void / debris field around a central light.",
} as const;

const PAIRS = [
  {
    journeyId: "A-B",
    startId: "A",
    endId: "B",
    startMediaId: TRUSTED_MEDIA_IDS.forestAtoFA,
    endMediaId: TRUSTED_MEDIA_IDS.forestAtoFB,
  },
  {
    journeyId: "C-D",
    startId: "C",
    endId: "D",
    startMediaId: TRUSTED_MEDIA_IDS.forestAtoFC,
    endMediaId: TRUSTED_MEDIA_IDS.forestAtoFD,
  },
  {
    journeyId: "D-E",
    startId: "D",
    endId: "E",
    startMediaId: TRUSTED_MEDIA_IDS.forestAtoFD,
    endMediaId: TRUSTED_MEDIA_IDS.forestAtoFE,
  },
  {
    journeyId: "E-F",
    startId: "E",
    endId: "F",
    startMediaId: TRUSTED_MEDIA_IDS.forestAtoFE,
    endMediaId: TRUSTED_MEDIA_IDS.forestAtoFF,
  },
] as const;

const EXPERIMENT_ID = "cinematographer-generative-traversal-02";
const MAX_ATTEMPTS = 2;

const mediaDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(mediaDir, "../../..");
const evidenceRoot = join(
  repoRoot,
  "camotion/integration/forest-a-to-f/experiments",
  EXPERIMENT_ID,
);

function repoPath(path: string): string {
  return relative(repoRoot, path).split("\\").join("/");
}

function assertSafe(payload: unknown, token: string | undefined): void {
  assertNoSecret(payload, token);
  const serialized = JSON.stringify(payload);
  if (serialized.includes("REPLICATE_API_TOKEN") || /r8_[A-Za-z0-9]{8,}/.test(serialized)) {
    throw new Error("refusing to write a secret into experiment evidence");
  }
}

async function writeJson(path: string, value: unknown, token: string | undefined): Promise<void> {
  assertSafe(value, token);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

type Pair = (typeof PAIRS)[number];

async function assessPair(options: {
  readonly pair: Pair;
  readonly reasoning: ReplicateReasoningProvider;
  readonly token: string | undefined;
}): Promise<void> {
  const { pair, reasoning, token } = options;
  const startIntent = FOREST_STORYBOARD_INTENTS[pair.startId];
  const endIntent = FOREST_STORYBOARD_INTENTS[pair.endId];
  const resolved = cinematographerPairFromRequest(repoRoot, {
    startMediaId: pair.startMediaId,
    endMediaId: pair.endMediaId,
    startDestinationId: pair.startId,
    endDestinationId: pair.endId,
    startIntent,
    endIntent,
  });
  if (resolved.start.image.kind !== "file" || resolved.end.image.kind !== "file") {
    throw new Error(`${pair.journeyId} did not resolve to trusted files`);
  }
  const startPath = resolved.start.image.path;
  const endPath = resolved.end.image.path;
  const prompt = experiment02UserPrompt({
    journeyId: pair.journeyId,
    startId: pair.startId,
    endId: pair.endId,
    story: FOREST_USER_PROMPT,
    startIntent,
    endIntent,
  });
  const input = {
    pair: pair.journeyId,
    journeyId: pair.journeyId,
    startDestinationId: pair.startId,
    endDestinationId: pair.endId,
    startMediaId: pair.startMediaId,
    endMediaId: pair.endMediaId,
    startIntent,
    endIntent,
    story: FOREST_USER_PROMPT,
    startImage: {
      path: repoPath(startPath),
      sha256: await sha256File(startPath),
    },
    endImage: {
      path: repoPath(endPath),
      sha256: await sha256File(endPath),
    },
  };

  const pairDir = join(evidenceRoot, pair.journeyId);
  await mkdir(pairDir, { recursive: true });
  await writeJson(join(pairDir, "input.json"), input, token);
  await writeJson(
    join(pairDir, "prompt.json"),
    {
      systemInstruction: EXPERIMENT_02_SYSTEM_INSTRUCTION,
      prompt,
    },
    token,
  );

  const attempts: Array<Record<string, unknown>> = [];
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const startedAt = new Date().toISOString();
    try {
      const result = await reasoning.complete({
        systemInstruction: EXPERIMENT_02_SYSTEM_INSTRUCTION,
        prompt,
        images: [resolved.start.image, resolved.end.image],
      });
      const assessment = parseCinematographerAssessment(result.text);
      const completedAt = new Date().toISOString();
      attempts.push({
        attempt,
        status: "succeeded",
        startedAt,
        completedAt,
        elapsedMs: result.elapsedMs,
        predictionId: result.predictionId,
      });
      await writeFile(join(pairDir, "raw.txt"), result.text.endsWith("\n") ? result.text : `${result.text}\n`);
      await writeJson(join(pairDir, "assessment.json"), assessment, token);
      await writeJson(
        join(pairDir, "meta.json"),
        {
          pair: pair.journeyId,
          status: "succeeded",
          provider: "replicate",
          model: result.model,
          modelVersion: result.modelVersion,
          predictionId: result.predictionId,
          elapsedMs: result.elapsedMs,
          startedAt,
          completedAt,
          attempts,
        },
        token,
      );
      console.log(`${pair.journeyId} ${assessment.shootability} ${result.predictionId}`);
      return;
    } catch (error) {
      const completedAt = new Date().toISOString();
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const predictionId =
        error && typeof error === "object" && "predictionId" in error
          ? String((error as { predictionId?: unknown }).predictionId ?? "")
          : "";
      attempts.push({
        attempt,
        status: "failed",
        startedAt,
        completedAt,
        error: message,
        ...(predictionId ? { predictionId } : {}),
        retry: attempt < MAX_ATTEMPTS,
      });
      console.error(`${pair.journeyId} attempt ${attempt} failed: ${message}`);
    }
  }

  await writeJson(
    join(pairDir, "meta.json"),
    {
      pair: pair.journeyId,
      status: "failed",
      provider: "replicate",
      attempts,
      error: lastError instanceof Error ? lastError.message : String(lastError),
    },
    token,
  );
}

async function main(): Promise<void> {
  loadDotEnvLocal(repoRoot);
  const token = getOptionalEnv("REPLICATE_API_TOKEN");
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN is not set");
  }
  await mkdir(evidenceRoot, { recursive: true });
  const runStartedAt = new Date().toISOString();
  const manifest = {
    experiment: EXPERIMENT_ID,
    hypothesis:
      "Evaluating generative traversal potential, rather than literal geometric proof of adjacency, better predicts observed video behavior.",
    singleVariable: "experiment-only Cinematographer evaluation objective",
    pairs: PAIRS.map((pair) => pair.journeyId),
    provider: "replicate",
    model: GEMINI_31_PRO_MODEL,
    gemini: DEFAULT_GEMINI_31_PRO_SETTINGS,
    gitCommit: await gitCommit(repoRoot),
    productionCinematographerUnchanged: true,
    experiment01Unchanged: true,
    startedAt: runStartedAt,
  };
  await writeJson(join(evidenceRoot, "manifest.json"), manifest, token);

  const reasoning = new ReplicateReasoningProvider();
  for (const pair of PAIRS) {
    await assessPair({ pair, reasoning, token });
  }

  const completedAt = new Date().toISOString();
  await writeJson(
    join(evidenceRoot, "manifest.json"),
    {
      ...manifest,
      completedAt,
    },
    token,
  );
}

await main();
