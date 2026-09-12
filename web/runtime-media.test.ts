import { mkdtempSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, relative, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { handleRuntimeMediaRequest } from "./runtime-media-plugin.ts";
import {
  createRuntimeMediaId,
  createRuntimeMediaRegistry,
  detectImageKind,
  RuntimeMediaError,
  setActiveRuntimeMediaRegistry,
} from "./runtime-media.ts";
import { resolveTrustedMedia, UntrustedMediaError } from "./trusted-media.ts";
import { STARTING_FRAME_MAX_BYTES } from "./runtime-media-limits.ts";
import { isTrustedMediaIdShape } from "./src/project/trusted-media-id.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8ffff3f0005fe02fedccc59e70000000049454e44ae426082",
  "hex",
);
const JPEG = Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9", "hex");
const WEBP = Buffer.from(
  "524946461a000000574542505650384c0d0000002f0000001007101100630800340000",
  "hex",
);

afterEach(() => {
  setActiveRuntimeMediaRegistry(undefined);
});

function tempRegistry() {
  const directory = mkdtempSync(resolve(tmpdir(), "tv-runtime-media-"));
  const registry = createRuntimeMediaRegistry(directory);
  setActiveRuntimeMediaRegistry(registry);
  return registry;
}

describe("runtime media registration", () => {
  it("registers a PNG as an opaque trusted identity and preserves bytes", () => {
    const registry = tempRegistry();
    const recorded = registry.register(PNG, "image/png");
    expect(detectImageKind(PNG)).toBe("png");
    expect(isTrustedMediaIdShape(recorded.mediaId)).toBe(true);
    expect(recorded.mediaId.startsWith("upload-")).toBe(true);
    expect(recorded.mediaId).not.toMatch(/[/\\]/);
    expect(recorded.imageUrl).toBe(`/api/runtime-media/${recorded.mediaId}`);
    expect(basename(recorded.filePath)).toBe(`${recorded.mediaId}.png`);
    expect(relative(registry.directory, recorded.filePath).includes("..")).toBe(false);
    expect(readFileSync(recorded.filePath)).toEqual(PNG);
  });

  it("registers a JPEG the same way", () => {
    const registry = tempRegistry();
    const recorded = registry.register(JPEG, "image/jpeg");
    expect(detectImageKind(JPEG)).toBe("jpeg");
    expect(isTrustedMediaIdShape(recorded.mediaId)).toBe(true);
    expect(recorded.mimeType).toBe("image/jpeg");
    expect(basename(recorded.filePath)).toBe(`${recorded.mediaId}.jpg`);
    expect(readFileSync(recorded.filePath)).toEqual(JPEG);
  });

  it("registers WebP through the same path", () => {
    const registry = tempRegistry();
    const recorded = registry.register(WEBP, "image/webp");
    expect(recorded.mimeType).toBe("image/webp");
    expect(basename(recorded.filePath)).toBe(`${recorded.mediaId}.webp`);
  });

  it("trusts magic bytes when a provider Content-Type is wrong or unknown", () => {
    const registry = tempRegistry();
    const jpegAsPng = registry.register(JPEG, "image/png");
    expect(jpegAsPng.mimeType).toBe("image/jpeg");
    expect(basename(jpegAsPng.filePath)).toBe(`${jpegAsPng.mediaId}.jpg`);
    const pngAsJson = registry.register(PNG, "application/json");
    expect(pngAsJson.mimeType).toBe("image/png");
    expect(basename(pngAsJson.filePath)).toBe(`${pngAsJson.mediaId}.png`);
  });

  it("rejects an unsupported type", () => {
    const registry = tempRegistry();
    expect(() => registry.register(Buffer.from("%PDF-1.4"), "application/pdf")).toThrow(
      RuntimeMediaError,
    );
    expect(() => registry.register(Buffer.from("%PDF-1.4"), "application/pdf")).toThrow(
      /unsupported image type/i,
    );
  });

  it("rejects an oversized input", () => {
    const registry = tempRegistry();
    const oversized = Buffer.concat([PNG, Buffer.alloc(STARTING_FRAME_MAX_BYTES)]);
    expect(() => registry.register(oversized, "image/png")).toThrow(/too large/i);
  });

  it("ignores an original filename and never stores a client path", () => {
    const registry = tempRegistry();
    const recorded = registry.register(PNG, "image/png");
    expect(recorded.filePath).not.toContain("..");
    expect(recorded.filePath).not.toContain("etc/passwd");
    expect(recorded.mediaId).not.toBe("A.png");
    expect(createRuntimeMediaId()).toMatch(/^upload-[a-f0-9]{32}$/);
  });
});

describe("trusted resolver for uploaded media", () => {
  it("resolves a registered upload through the same Director MediaInput path", () => {
    const registry = tempRegistry();
    const recorded = registry.register(PNG, "image/png");
    expect(resolveTrustedMedia(repoRoot, recorded.mediaId)).toEqual({
      kind: "file",
      path: recorded.filePath,
    });
  });

  it("does not resolve an unregistered runtime-looking identity", () => {
    tempRegistry();
    expect(() => resolveTrustedMedia(repoRoot, "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toThrow(
      UntrustedMediaError,
    );
  });
});

describe("runtime media HTTP", () => {
  it("accepts a PNG body and returns only opaque identity plus preview URL", async () => {
    tempRegistry();
    const req = Readable.from([PNG]) as IncomingMessage;
    req.method = "POST";
    req.url = "/api/runtime-media";
    req.headers = { "content-type": "image/png", "content-length": String(PNG.length) };
    const res = mockResponse();
    await handleRuntimeMediaRequest(req, res as unknown as ServerResponse);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(String(res.body)) as { mediaId: string; imageUrl: string };
    expect(isTrustedMediaIdShape(body.mediaId)).toBe(true);
    expect(body.imageUrl).toBe(`/api/runtime-media/${body.mediaId}`);
    expect(JSON.stringify(body)).not.toMatch(/[/\\]tmp|camotion|passwd|\.\./);
  });

  it("serves registered preview bytes and rejects path-like ids", async () => {
    const registry = tempRegistry();
    const recorded = registry.register(JPEG, "image/jpeg");
    const okReq = Readable.from([]) as IncomingMessage;
    okReq.method = "GET";
    okReq.url = recorded.imageUrl;
    okReq.headers = {};
    const okRes = mockResponse();
    await handleRuntimeMediaRequest(okReq, okRes as unknown as ServerResponse);
    expect(okRes.statusCode).toBe(200);
    expect(okRes.headers["content-type"]).toBe("image/jpeg");
    expect(okRes.body).toEqual(JPEG);

    const attack = Readable.from([]) as IncomingMessage;
    attack.method = "GET";
    attack.url = "/api/runtime-media/../../etc/passwd";
    attack.headers = {};
    const attackRes = mockResponse();
    expect(await handleRuntimeMediaRequest(attack, attackRes as unknown as ServerResponse)).toBe(
      false,
    );
  });

  it("lists the session store directory for debug", async () => {
    const registry = tempRegistry();
    const recorded = registry.register(PNG, "image/png");
    const req = Readable.from([]) as IncomingMessage;
    req.method = "GET";
    req.url = "/api/debug/media";
    req.headers = {};
    const res = mockResponse();
    expect(await handleRuntimeMediaRequest(req, res as unknown as ServerResponse)).toBe(true);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(String(res.body)) as {
      storeDirectory: string;
      records: { mediaId: string; filePath: string }[];
      camotion: { depth: string };
    };
    expect(body.storeDirectory).toBe(registry.directory);
    expect(body.records).toEqual([
      expect.objectContaining({ mediaId: recorded.mediaId, filePath: recorded.filePath }),
    ]);
    expect(body.camotion.depth).toMatch(/does not pass --depth/i);
  });
});

function mockResponse() {
  return {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: Buffer.alloc(0) as Buffer | string,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
    end(chunk?: Buffer | string) {
      this.body = chunk ?? "";
    },
  };
}
