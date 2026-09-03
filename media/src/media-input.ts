import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";

import { MediaGenerationError } from "./errors.ts";
import { MediaInput } from "./types.ts";

export type ResolvedMedia =
  | { readonly kind: "url"; readonly url: string }
  | {
      readonly kind: "file";
      readonly path: string;
      readonly filename: string;
      readonly bytes: Buffer;
    };

export async function resolveMediaInput(input: MediaInput): Promise<ResolvedMedia> {
  if (input.kind === "url") {
    if (!/^https?:\/\//i.test(input.url)) {
      throw new MediaGenerationError(
        "invalid_input",
        "Media URL must be http or https",
      );
    }
    return { kind: "url", url: input.url };
  }

  try {
    const info = await stat(input.path);
    if (!info.isFile()) {
      throw new MediaGenerationError(
        "invalid_input",
        `Media path is not a file: ${input.path}`,
      );
    }
  } catch (error) {
    if (error instanceof MediaGenerationError) {
      throw error;
    }
    throw new MediaGenerationError(
      "invalid_input",
      `Media file not found: ${input.path}`,
      { cause: error },
    );
  }

  return {
    kind: "file",
    path: input.path,
    filename: basename(input.path),
    bytes: await readFile(input.path),
  };
}

/**
 * Official Replicate JS SDK auto-uploads Blob, File, or Buffer only.
 * Node ReadStreams are serialized as JSON objects and Replicate returns
 * HTTP 422 (`Expected: string, given: object`). Pass local files as bytes.
 */
export function toReplicateFileInput(resolved: ResolvedMedia): string | Buffer {
  return resolved.kind === "url" ? resolved.url : resolved.bytes;
}
