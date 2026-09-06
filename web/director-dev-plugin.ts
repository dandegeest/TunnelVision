import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import type { Plugin } from "vite";

import { loadDotEnvLocal } from "../media/src/config/environment.ts";
import { plan } from "../media/src/director/plan-storyboard.ts";
import { MediaGenerationError, redactSecrets } from "../media/src/errors.ts";
import { ReplicateReasoningProvider } from "../media/src/replicate/reasoning.ts";

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw.trim()) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(raw) as unknown);
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function statusForError(error: unknown): number {
  if (error instanceof MediaGenerationError && error.code === "invalid_input") {
    return 400;
  }
  if (error instanceof MediaGenerationError && error.code === "configuration") {
    return 500;
  }
  return 502;
}

export function directorDevPlugin(repoRoot: string): Plugin {
  const startImagePath = resolve(
    repoRoot,
    "camotion/integration/wardrobe-loop-01/canonical/vision/A.jpg",
  );

  return {
    name: "tunnelvision-director-dev",
    configureServer(server) {
      loadDotEnvLocal(repoRoot);
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/api/director/plan") {
          next();
          return;
        }
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "POST /api/director/plan" });
          return;
        }
        try {
          const body = (await readJsonBody(req)) as Record<string, unknown>;
          const result = await plan({
            reasoning: new ReplicateReasoningProvider(),
            story: typeof body.story === "string" ? body.story : "",
            agency: body.agency === "autonomous" ? "autonomous" : "directed",
            startFrame: {
              id: typeof body.startFrameId === "string" ? body.startFrameId.trim() || "A" : "A",
              intent:
                typeof body.startFrameIntent === "string" ? body.startFrameIntent : undefined,
              image: { kind: "file", path: startImagePath },
            },
          });
          sendJson(res, 200, {
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
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Director planning failed";
          sendJson(res, statusForError(error), { error: redactSecrets(message) });
        }
      });
    },
  };
}
