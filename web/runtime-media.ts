/**
 * Session/dev-runtime stills: filmmaker uploads and generated destinations.
 * Not durable project persistence. Server-generated opaque ids; original
 * filenames are ignored.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { STARTING_FRAME_MAX_BYTES, runtimeMediaPreviewUrl } from "./runtime-media-limits.ts";
import { isTrustedMediaIdShape } from "./src/project/trusted-media-id.ts";

export type RuntimeImageKind = "png" | "jpeg" | "webp";

export type RuntimeMediaRecord = {
  mediaId: string;
  filePath: string;
  mimeType: string;
};

const KIND_BY_MIME: Record<string, RuntimeImageKind> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/webp": "webp",
};

const MIME_BY_KIND: Record<RuntimeImageKind, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const EXT_BY_KIND: Record<RuntimeImageKind, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
};

export class RuntimeMediaError extends Error {
  readonly code: "unsupported_type" | "too_large" | "invalid_identity";

  constructor(message: string, code: "unsupported_type" | "too_large" | "invalid_identity") {
    super(message);
    this.name = "RuntimeMediaError";
    this.code = code;
  }
}

export function detectImageKind(bytes: Buffer): RuntimeImageKind | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

function declaredKind(contentType: string | undefined): RuntimeImageKind | null | "unknown" {
  const mime = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!mime || mime === "application/octet-stream") {
    return null;
  }
  return KIND_BY_MIME[mime] ?? "unknown";
}

export function createRuntimeMediaId(): string {
  return `upload-${randomBytes(16).toString("hex")}`;
}

export type RuntimeMediaRegistry = {
  directory: string;
  register(bytes: Buffer, contentType?: string): RuntimeMediaRecord & { imageUrl: string };
  get(id: string): RuntimeMediaRecord | undefined;
  list(): RuntimeMediaRecord[];
};

export function createRuntimeMediaRegistry(directory: string): RuntimeMediaRegistry {
  mkdirSync(directory, { recursive: true });
  const entries = new Map<string, RuntimeMediaRecord>();

  return {
    directory,
    register(bytes, contentType) {
      if (bytes.length > STARTING_FRAME_MAX_BYTES) {
        throw new RuntimeMediaError("Image is too large.", "too_large");
      }
      const kind = detectImageKind(bytes);
      if (!kind) {
        throw new RuntimeMediaError(
          "Unsupported image type. Use PNG, JPEG, or WebP.",
          "unsupported_type",
        );
      }
      const declared = declaredKind(contentType);
      if (declared === "unknown" || (declared && declared !== kind)) {
        throw new RuntimeMediaError(
          "Unsupported image type. Use PNG, JPEG, or WebP.",
          "unsupported_type",
        );
      }
      const mediaId = createRuntimeMediaId();
      if (!isTrustedMediaIdShape(mediaId)) {
        throw new RuntimeMediaError("Server returned an invalid media identity.", "invalid_identity");
      }
      const filePath = join(directory, `${mediaId}.${EXT_BY_KIND[kind]}`);
      writeFileSync(filePath, bytes);
      const record: RuntimeMediaRecord = {
        mediaId,
        filePath,
        mimeType: MIME_BY_KIND[kind],
      };
      entries.set(mediaId, record);
      return { ...record, imageUrl: runtimeMediaPreviewUrl(mediaId) };
    },
    get(id) {
      if (!isTrustedMediaIdShape(id)) {
        return undefined;
      }
      return entries.get(id);
    },
    list() {
      return [...entries.values()];
    },
  };
}

let activeRegistry: RuntimeMediaRegistry | undefined;

export function setActiveRuntimeMediaRegistry(registry: RuntimeMediaRegistry | undefined) {
  activeRegistry = registry;
}

export function getActiveRuntimeMediaRegistry(): RuntimeMediaRegistry | undefined {
  return activeRegistry;
}
