import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

import { loadDotEnvLocal } from "../media/src/config/environment.ts";
import { MediaGenerationError, redactSecrets } from "../media/src/errors.ts";
import { imageModelSlug } from "../media/src/replicate/image-models.ts";
import { ReplicateMediaProvider } from "../media/src/replicate/provider.ts";
import { constructDestinationImage, generateOpeningFrameImage } from "./destination-construct.ts";
import {
  imageModelIdFromBody,
  imageOutputFormatFromBody,
  imageResolutionFromBody,
} from "./src/project/destination.ts";
import { UntrustedMediaError } from "./trusted-media.ts";

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
  const message = error instanceof Error ? error.message : "";
  if (/not ready to construct|no trusted media identity|requires intent|requires a journey story|not ready to generate/i.test(message)) {
    return 400;
  }
  return 502;
}

export function destinationDevPlugin(repoRoot: string): Plugin {
  return {
    name: "tunnelvision-destination-dev",
    configureServer(server) {
      loadDotEnvLocal(repoRoot);
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/api/destination/construct" && url !== "/api/destination/generate-opening") {
          next();
          return;
        }
        if (req.method !== "POST") {
          sendJson(res, 405, {
            error:
              url === "/api/destination/generate-opening"
                ? "POST /api/destination/generate-opening"
                : "POST /api/destination/construct",
          });
          return;
        }
        try {
          const body = (await readJsonBody(req)) as Record<string, unknown>;
          const imageModelId = imageModelIdFromBody(body.imageModel);
          const imageModel = imageModelSlug(imageModelId);
          const imageResolution = imageResolutionFromBody(imageModelId, body.imageResolution);
          const provider = new ReplicateMediaProvider({
            imageModel,
            imageEditModel: imageModel,
            nanoBanana: {
              outputFormat: imageOutputFormatFromBody(imageModelId, body.imageOutputFormat),
              ...(imageResolution ? { resolution: imageResolution } : {}),
            },
          });
          const constructed =
            url === "/api/destination/generate-opening"
              ? await generateOpeningFrameImage({
                  body,
                  generateImage: (request) => provider.generateImage(request),
                })
              : await constructDestinationImage({
                  repoRoot,
                  body,
                  editImage: (request) => provider.editImage(request),
                });
          sendJson(res, 200, constructed);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Destination construction failed";
          sendJson(res, statusForError(error), { error: redactSecrets(message) });
        }
      });
    },
  };
}
