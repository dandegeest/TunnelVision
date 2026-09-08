import { isTrustedMediaIdShape } from "./trusted-media-id";
import type { Project, StoryboardFrame, StoryboardMediaInfo } from "./types";
import {
  RUNTIME_MEDIA_URL_PREFIX,
  STARTING_FRAME_MAX_BYTES,
  runtimeMediaPreviewUrl,
} from "../../runtime-media-limits";

export { STARTING_FRAME_MAX_BYTES, runtimeMediaPreviewUrl };

export const STARTING_FRAME_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const STARTING_FRAME_ACCEPT = STARTING_FRAME_MIME_TYPES.join(",");

/** Plan replacement is for authoritative A, not every filmmaker-provided still. */
export function isAuthoritativeStartingFrame(frame: Pick<StoryboardFrame, "id">): boolean {
  return frame.id === "A";
}

const ALLOWED_MIME = new Set<string>([...STARTING_FRAME_MIME_TYPES, "image/jpg"]);

export type StartingFrameUpload = {
  mediaId: string;
  imageUrl: string;
  mediaInfo?: StoryboardMediaInfo;
};

export function startingFrameFileError(file: { size: number; type: string }): string | null {
  if (file.size > STARTING_FRAME_MAX_BYTES) {
    return "Image is too large.";
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return "Unsupported image type. Use PNG, JPEG, or WebP.";
  }
  return null;
}

export function parseStartingFrameUpload(body: unknown): StartingFrameUpload {
  if (!body || typeof body !== "object") {
    throw new Error("Server returned an invalid media identity.");
  }
  const mediaId = "mediaId" in body ? body.mediaId : undefined;
  const imageUrl = "imageUrl" in body ? body.imageUrl : undefined;
  if (!isTrustedMediaIdShape(mediaId)) {
    throw new Error("Server returned an invalid media identity.");
  }
  if (imageUrl !== runtimeMediaPreviewUrl(mediaId)) {
    throw new Error("Server returned an invalid media identity.");
  }
  return { mediaId, imageUrl };
}

/**
 * Replace Plan A with a trusted uploaded still. Drops B...N. Preserves story
 * and Shoot destinations/journeys. Does not invoke the Director.
 */
export function projectWithReplacedStartImage(
  project: Project,
  next: StartingFrameUpload,
): Project {
  if (!isTrustedMediaIdShape(next.mediaId)) {
    throw new Error("Starting frame has no trusted media identity");
  }
  const start =
    project.storyboard.find((frame) => frame.imageOrigin === "user") ?? project.storyboard[0];
  if (!start) {
    throw new Error("Project has no starting storyboard frame");
  }
  const replaced: StoryboardFrame = {
    ...start,
    image: next.imageUrl,
    mediaId: next.mediaId,
    imageOrigin: "user",
  };
  delete replaced.intent;
  if (next.mediaInfo) {
    replaced.mediaInfo = next.mediaInfo;
  } else {
    delete replaced.mediaInfo;
  }
  return {
    ...project,
    storyboard: [replaced],
  };
}

export async function uploadStartingFrame(file: File): Promise<StartingFrameUpload> {
  const localError = startingFrameFileError(file);
  if (localError) {
    throw new Error(localError);
  }
  const response = await fetch(RUNTIME_MEDIA_URL_PREFIX, {
    method: "POST",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: file,
  });
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "Upload failed.";
    throw new Error(message);
  }
  return parseStartingFrameUpload(body);
}
