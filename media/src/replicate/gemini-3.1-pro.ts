import sharp from "sharp";

import { MediaGenerationError } from "../errors.ts";
import { type ResolvedMedia } from "../media-input.ts";
import { ReasoningRequest } from "../reasoning/types.ts";

export const GEMINI_31_PRO_MODEL = "google/gemini-3.1-pro";
/** Replicate documents each Gemini image input as 7MB max. */
export const GEMINI_31_PRO_MAX_IMAGE_BYTES = 7 * 1024 * 1024;
/** Stay under the published limit after JPEG encode. */
export const GEMINI_31_PRO_IMAGE_BYTE_BUDGET = 6 * 1024 * 1024;
/**
 * Longest edge for a Gemini vision copy. 1K product stills already
 * succeed; 2K/4K are reduced to this size. Stored canonicals stay put.
 */
export const GEMINI_31_PRO_MAX_IMAGE_EDGE = 1024;
export const GEMINI_31_PRO_VISION_FILENAME = "gemini-vision.jpg";
export const GEMINI_31_PRO_VISION_TYPE = "image/jpeg";

export type Gemini31ProThinkingLevel = "low" | "medium" | "high";

/**
 * Gemini knobs for the Cinematographer reasoning adapter.
 * Model ID stays on the adapter, not on the filmmaking role.
 */
export type Gemini31ProSettings = {
  readonly thinkingLevel?: Gemini31ProThinkingLevel;
  readonly temperature?: number;
  readonly topP?: number;
};

export const DEFAULT_GEMINI_31_PRO_SETTINGS = {
  thinkingLevel: "high",
  temperature: 1,
  topP: 0.95,
} as const satisfies Required<Gemini31ProSettings>;

export type Gemini31ProInput = {
  readonly prompt: string;
  readonly images?: ReadonlyArray<string | File>;
  readonly system_instruction?: string;
  readonly thinking_level: Gemini31ProThinkingLevel;
  readonly temperature: number;
  readonly top_p: number;
};

export function mergeGemini31ProSettings(
  settings?: Gemini31ProSettings,
): Gemini31ProSettings & typeof DEFAULT_GEMINI_31_PRO_SETTINGS {
  return {
    ...DEFAULT_GEMINI_31_PRO_SETTINGS,
    ...settings,
  };
}

export function toGemini31ProInput(
  request: ReasoningRequest,
  resolvedImages: readonly ResolvedMedia[],
  settings?: Gemini31ProSettings,
): Gemini31ProInput {
  if (!request.prompt.trim()) {
    throw new MediaGenerationError("invalid_input", "prompt is required");
  }

  const merged = mergeGemini31ProSettings(settings);
  const input: Gemini31ProInput = {
    prompt: request.prompt,
    thinking_level: merged.thinkingLevel,
    temperature: merged.temperature,
    top_p: merged.topP,
  };

  const withOptional: Gemini31ProInput = {
    ...input,
    ...(request.systemInstruction
      ? { system_instruction: request.systemInstruction }
      : {}),
    ...(resolvedImages.length > 0
      ? { images: resolvedImages.map((image) => toGemini31ProFileInput(image)) }
      : {}),
  };
  return withOptional;
}

export function toGemini31ProFileInput(resolved: ResolvedMedia): string | File {
  if (resolved.kind === "url") {
    return resolved.url;
  }
  return new File([resolved.bytes], resolved.filename, {
    type: resolved.filename === GEMINI_31_PRO_VISION_FILENAME
      ? GEMINI_31_PRO_VISION_TYPE
      : resolved.filename.endsWith(".png")
        ? "image/png"
        : GEMINI_31_PRO_VISION_TYPE,
  });
}

export async function prepareGemini31ProMedia(resolved: ResolvedMedia): Promise<ResolvedMedia> {
  if (resolved.kind === "url") {
    return resolved;
  }
  return {
    kind: "file",
    path: resolved.path,
    filename: GEMINI_31_PRO_VISION_FILENAME,
    bytes: await fitGemini31ProImageBytes(resolved.bytes),
  };
}

export async function fitGemini31ProImageBytes(bytes: Buffer): Promise<Buffer> {
  let quality = 80;
  let edge = GEMINI_31_PRO_MAX_IMAGE_EDGE;
  let next: Buffer;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      next = await sharp(bytes)
        .rotate()
        .resize({
          width: edge,
          height: edge,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
    } catch (error) {
      throw new MediaGenerationError("invalid_input", "Gemini vision image could not be resized", {
        cause: error,
      });
    }
    if (next.length <= GEMINI_31_PRO_IMAGE_BYTE_BUDGET) {
      return next;
    }
    edge = Math.max(768, Math.floor(edge * 0.75));
    quality = Math.max(50, quality - 15);
  }
  return next!;
}
