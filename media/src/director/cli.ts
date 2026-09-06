import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadDotEnvLocal } from "../config/environment.ts";
import { plan } from "./plan-storyboard.ts";
import { ReplicateReasoningProvider } from "../replicate/reasoning.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

type CliInput = {
  readonly story?: string;
  readonly agency?: "directed" | "autonomous";
  readonly startFrameId?: string;
  readonly startFrameIntent?: string;
  readonly startImagePath?: string;
};

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

const body = JSON.parse((await readStdin()) || "{}") as CliInput;
loadDotEnvLocal(repoRoot);

const startImagePath =
  body.startImagePath?.trim() ||
  resolve(repoRoot, "camotion/integration/wardrobe-loop-01/canonical/vision/A.jpg");

try {
  readFileSync(startImagePath);
} catch {
  console.error(JSON.stringify({ error: `Starting image not found: ${startImagePath}` }));
  process.exit(1);
}

try {
  const result = await plan({
    reasoning: new ReplicateReasoningProvider(),
    story: body.story ?? "",
    agency: body.agency === "autonomous" ? "autonomous" : "directed",
    startFrame: {
      id: body.startFrameId?.trim() || "A",
      intent: body.startFrameIntent,
      image: { kind: "file", path: startImagePath },
    },
  });
  process.stdout.write(
    JSON.stringify({
      plan: result.plan,
      evidence: {
        request: {
          story: result.request.story,
          agency: result.request.agency,
          startFrameId: result.request.startFrameId,
          startFrameIntent: result.request.startFrameIntent,
          systemInstruction: result.request.systemInstruction,
          prompt: result.request.prompt,
        },
        rawText: result.rawText,
        model: result.model,
        modelVersion: result.modelVersion,
        predictionId: result.predictionId,
        elapsedMs: result.elapsedMs,
      },
    }),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : "Director planning failed";
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code)
      : "generation_failed";
  console.error(JSON.stringify({ error: message, code }));
  process.exit(1);
}