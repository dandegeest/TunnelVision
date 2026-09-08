import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

import { loadDotEnvLocal } from "../media/src/config/environment.ts";
import { assessJourney } from "../media/src/cinematographer/assess-journey.ts";
import { MediaGenerationError, redactSecrets } from "../media/src/errors.ts";
import { ReplicateReasoningProvider } from "../media/src/replicate/reasoning.ts";
import { cinematographerPairFromRequest, UntrustedMediaError } from "./trusted-media.ts";

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
  if (error instanceof UntrustedMediaError) {
    return 400;
  }
  if (error instanceof MediaGenerationError && error.code === "invalid_input") {
    return 400;
  }
  if (error instanceof MediaGenerationError && error.code === "configuration") {
    return 500;
  }
  return 502;
}

export function cinematographerDevPlugin(repoRoot: string): Plugin {
  return {
    name: "tunnelvision-cinematographer-dev",
    configureServer(server) {
      loadDotEnvLocal(repoRoot);
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/api/cinematographer/assess") {
          next();
          return;
        }
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "POST /api/cinematographer/assess" });
          return;
        }
        try {
          const body = (await readJsonBody(req)) as Record<string, unknown>;
          const pair = cinematographerPairFromRequest(repoRoot, body);
          const result = await assessJourney({
            reasoning: new ReplicateReasoningProvider(),
            journeyId: typeof body.journeyId === "string" ? body.journeyId : "",
            story: typeof body.story === "string" ? body.story : undefined,
            start: pair.start,
            end: pair.end,
          });
          sendJson(res, 200, {
            assessment: result.assessment,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Cinematographer assessment failed";
          sendJson(res, statusForError(error), { error: redactSecrets(message) });
        }
      });
    },
  };
}
