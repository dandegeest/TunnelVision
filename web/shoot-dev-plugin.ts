import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

import { loadDotEnvLocal, getOptionalEnv } from "../media/src/config/environment.ts";
import { MediaGenerationError, redactSecrets } from "../media/src/errors.ts";
import { ReplicateMediaProvider } from "../media/src/replicate/provider.ts";
import { videoModelSlug } from "../media/src/replicate/video-models.ts";
import { renderCamotionShootingFrame } from "./camotion-cli.ts";
import { shootPreparedJourney, videoModelIdFromBody } from "./shoot-journey.ts";
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
  if (/prepare this journey|requires two actual|is required|Unknown video model/i.test(message)) {
    return 400;
  }
  return 502;
}

function optionalSeed(): number | undefined {
  const raw = getOptionalEnv("TUNNELVISION_VIDEO_SEED");
  if (!raw) {
    return undefined;
  }
  const seed = Number(raw);
  return Number.isInteger(seed) ? seed : undefined;
}

export function shootDevPlugin(repoRoot: string): Plugin {
  return {
    name: "tunnelvision-shoot-dev",
    configureServer(server) {
      loadDotEnvLocal(repoRoot);
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/api/journey/shoot") {
          next();
          return;
        }
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "POST /api/journey/shoot" });
          return;
        }
        try {
          const body = (await readJsonBody(req)) as Record<string, unknown>;
          const videoModelId = videoModelIdFromBody(body.videoModel);
          const provider = new ReplicateMediaProvider({
            model: videoModelSlug(videoModelId),
            pVideo: {
              draft: true,
              promptUpsampling: false,
              resolution: "720p",
              saveAudio: false,
              ...(optionalSeed() !== undefined ? { seed: optionalSeed() } : {}),
            },
            seedance: {
              generateAudio: false,
              resolution: "720p",
              aspectRatio: "adaptive",
              watermark: false,
              outputFormat: "mp4",
              ...(optionalSeed() !== undefined ? { seed: optionalSeed() } : {}),
            },
          });
          const take = await shootPreparedJourney({
            repoRoot,
            body,
            renderFrame: (imagePath, plan) =>
              renderCamotionShootingFrame({
                repoRoot,
                imagePath,
                plan,
                retainWorkDir: body.debug === true,
              }),
            generateVideo: (request) => provider.generateVideo(request),
          });
          sendJson(res, 200, { take, videoUrl: take.videoUrl });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Shoot failed";
          sendJson(res, statusForError(error), { error: redactSecrets(message) });
        }
      });
    },
  };
}
