import { randomBytes } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

import { concatenateClipFiles, downloadClipToFile, measureOutgoingStartDrop, prepareExportDirectory } from "./export-movie.ts";
import { isMovieExportFilename, nextMovieExportFilename } from "./src/project/export-movie.ts";
import { runtimeMediaIdFromUrl } from "./runtime-media-limits.ts";
import { getActiveRuntimeMediaRegistry } from "./runtime-media.ts";

type ExportRecord = {
  filePath: string;
  filename: string;
};

const exportsById = new Map<string, ExportRecord>();

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

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

function exportIdFromUrl(url: string): string | undefined {
  const match = /^\/api\/export-movie\/([^/]+)$/.exec(url);
  return match?.[1];
}

function clipUrl(origin: string, videoUrl: string): string {
  if (/^https?:\/\//i.test(videoUrl) || videoUrl.startsWith("file:")) {
    return videoUrl;
  }
  if (videoUrl.startsWith("/")) {
    return new URL(videoUrl, origin).href;
  }
  return videoUrl;
}

function localClipPath(videoUrl: string): string | undefined {
  if (/^https?:\/\//i.test(videoUrl)) {
    return undefined;
  }
  const candidate = videoUrl.startsWith("file:") ? fileURLToPath(videoUrl) : videoUrl;
  return existsSync(candidate) ? candidate : undefined;
}

async function resolveMeasurableClipPath(videoUrl: string, origin: string): Promise<string | undefined> {
  const local = localClipPath(videoUrl);
  if (local) {
    return local;
  }
  const mediaId = runtimeMediaIdFromUrl(videoUrl);
  const runtime = mediaId ? getActiveRuntimeMediaRegistry()?.get(mediaId) : undefined;
  if (runtime?.filePath && existsSync(runtime.filePath)) {
    return runtime.filePath;
  }
  try {
    const dest = join(
      tmpdir(),
      `tunnelvision-seam-src-${Date.now()}-${Math.random().toString(16).slice(2)}.mp4`,
    );
    await downloadClipToFile(clipUrl(origin, videoUrl), dest);
    return dest;
  } catch {
    return undefined;
  }
}

export async function handleExportMovieRequest(
  req: IncomingMessage,
  res: ServerResponse,
  origin: string,
): Promise<boolean> {
  const url = req.url?.split("?")[0] ?? "";
  if (req.method === "POST" && url === "/api/seam-drop") {
    try {
      const body = (await readJsonBody(req)) as { incomingVideoUrl?: string; outgoingVideoUrl?: string };
      const incomingUrl = typeof body.incomingVideoUrl === "string" ? body.incomingVideoUrl.trim() : "";
      const outgoingUrl = typeof body.outgoingVideoUrl === "string" ? body.outgoingVideoUrl.trim() : "";
      if (!incomingUrl || !outgoingUrl) {
        sendJson(res, 400, { error: "Seam drop needs incoming and outgoing clip URLs." });
        return true;
      }
      const incomingPath = await resolveMeasurableClipPath(incomingUrl, origin);
      const outgoingPath = await resolveMeasurableClipPath(outgoingUrl, origin);
      if (!incomingPath || !outgoingPath) {
        sendJson(res, 200, { dropped: false });
        return true;
      }
      const measured = await measureOutgoingStartDrop(incomingPath, outgoingPath);
      sendJson(res, 200, measured ?? { dropped: false });
    } catch (error) {
      sendJson(res, 502, {
        error: error instanceof Error ? error.message : "Seam drop measure failed",
      });
    }
    return true;
  }

  if (req.method === "POST" && url === "/api/export-movie") {
    try {
      const body = (await readJsonBody(req)) as {
        included?: Array<{ journeyId?: string; videoUrl?: string }>;
        missingJourneyIds?: unknown;
        filename?: unknown;
      };
      const included = Array.isArray(body.included) ? body.included : [];
      const clips = included.filter(
        (item): item is { journeyId: string; videoUrl: string } =>
          typeof item?.journeyId === "string" &&
          item.journeyId.trim().length > 0 &&
          typeof item?.videoUrl === "string" &&
          item.videoUrl.trim().length > 0,
      );
      if (clips.length < 1) {
        sendJson(res, 400, { error: "Export Movie needs at least one rendered journey clip." });
        return true;
      }
      const missingJourneyIds = Array.isArray(body.missingJourneyIds)
        ? body.missingJourneyIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        : [];
      const directory = await prepareExportDirectory();
      const clipPaths: string[] = [];
      for (const [index, clip] of clips.entries()) {
        const dest = join(directory, `${String(index).padStart(2, "0")}-${clip.journeyId}.mp4`);
        const localPath = localClipPath(clip.videoUrl);
        if (localPath) {
          clipPaths.push(localPath);
          continue;
        }
        await downloadClipToFile(clipUrl(origin, clip.videoUrl), dest);
        clipPaths.push(dest);
      }
      const outputName = isMovieExportFilename(body.filename)
        ? body.filename
        : nextMovieExportFilename("Untitled");
      const outputPath = join(directory, outputName);
      await concatenateClipFiles({ clipPaths, outputPath });
      const id = `export-${randomBytes(16).toString("hex")}`;
      const filename = outputName;
      exportsById.set(id, { filePath: outputPath, filename });
      sendJson(res, 200, {
        videoUrl: `/api/export-movie/${id}`,
        filename,
        complete: missingJourneyIds.length === 0,
        includedJourneyIds: clips.map((clip) => clip.journeyId),
        missingJourneyIds,
      });
    } catch (error) {
      sendJson(res, 502, {
        error: error instanceof Error ? error.message : "Movie export failed",
      });
    }
    return true;
  }

  const exportId = exportIdFromUrl(url);
  if (req.method === "GET" && exportId) {
    const recorded = exportsById.get(exportId);
    if (!recorded) {
      sendJson(res, 404, { error: "Exported movie not found." });
      return true;
    }
    const bytes = await readFile(recorded.filePath);
    res.statusCode = 200;
    res.setHeader("content-type", "video/mp4");
    res.setHeader("content-disposition", `inline; filename="${recorded.filename}"`);
    res.setHeader("content-length", String(bytes.length));
    createReadStream(recorded.filePath).pipe(res);
    return true;
  }

  return false;
}

export function exportMoviePlugin(): Plugin {
  return {
    name: "tunnelvision-export-movie",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const host = req.headers.host ?? "localhost";
        const origin = `http://${host}`;
        try {
          if (await handleExportMovieRequest(req, res, origin)) {
            return;
          }
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : "Movie export failed",
          });
          return;
        }
        next();
      });
    },
  };
}
