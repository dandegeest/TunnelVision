import { mkdtempSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Plugin } from "vite";

import { STARTING_FRAME_MAX_BYTES } from "./runtime-media-limits.ts";
import { isTrustedMediaIdShape } from "./src/project/trusted-media-id.ts";
import {
  createRuntimeMediaRegistry,
  getActiveRuntimeMediaRegistry,
  RuntimeMediaError,
  setActiveRuntimeMediaRegistry,
} from "./runtime-media.ts";

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function statusForRuntimeError(error: RuntimeMediaError): number {
  return error.code === "too_large" ? 413 : 400;
}

export function readBodyWithLimit(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const declared = Number(req.headers["content-length"] ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    return Promise.reject(new RuntimeMediaError("Image is too large.", "too_large"));
  }
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk) => {
      const next = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += next.length;
      if (total > maxBytes) {
        req.destroy();
        reject(new RuntimeMediaError("Image is too large.", "too_large"));
        return;
      }
      chunks.push(next);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export function runtimeMediaIdFromUrl(url: string): string | undefined {
  const match = /^\/api\/runtime-media\/([^/]+)$/.exec(url);
  return match?.[1];
}

export async function handleRuntimeMediaRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = req.url?.split("?")[0] ?? "";
  if (req.method === "POST" && url === "/api/runtime-media") {
    try {
      const registry = getActiveRuntimeMediaRegistry();
      if (!registry) {
        sendJson(res, 500, { error: "Upload failed." });
        return true;
      }
      const bytes = await readBodyWithLimit(req, STARTING_FRAME_MAX_BYTES);
      const contentType = req.headers["content-type"];
      const recorded = registry.register(
        bytes,
        typeof contentType === "string" ? contentType : undefined,
      );
      sendJson(res, 200, { mediaId: recorded.mediaId, imageUrl: recorded.imageUrl });
    } catch (error) {
      if (error instanceof RuntimeMediaError) {
        sendJson(res, statusForRuntimeError(error), { error: error.message });
      } else {
        sendJson(res, 500, { error: "Upload failed." });
      }
    }
    return true;
  }

  if (req.method === "GET") {
    const id = runtimeMediaIdFromUrl(url);
    if (id !== undefined) {
      try {
        if (!isTrustedMediaIdShape(id)) {
          sendJson(res, 404, { error: "Unknown or untrusted media identity" });
          return true;
        }
        const record = getActiveRuntimeMediaRegistry()?.get(id);
        if (!record) {
          sendJson(res, 404, { error: "Unknown or untrusted media identity" });
          return true;
        }
        const bytes = await readFile(record.filePath);
        res.statusCode = 200;
        res.setHeader("content-type", record.mimeType);
        res.setHeader("cache-control", "no-store");
        res.end(bytes);
      } catch {
        sendJson(res, 500, { error: "Upload failed." });
      }
      return true;
    }
  }

  return false;
}

export function runtimeMediaPlugin(): Plugin {
  return {
    name: "tunnelvision-runtime-media",
    configureServer(server) {
      const directory = mkdtempSync(join(tmpdir(), "tunnelvision-runtime-media-"));
      setActiveRuntimeMediaRegistry(createRuntimeMediaRegistry(directory));
      server.middlewares.use((req, res, next) => {
        void handleRuntimeMediaRequest(req, res).then((handled) => {
          if (!handled) {
            next();
          }
        });
      });
    },
  };
}
