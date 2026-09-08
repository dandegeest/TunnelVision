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

/** Unresolved opening slot that can receive the filmmaker starting frame. */
export function canProvideStartingFrame(frame: Pick<StoryboardFrame, "id" | "image" | "imageOrigin">): boolean {
  return isAuthoritativeStartingFrame(frame) && frame.imageOrigin === "none" && !frame.image;
}

export function hasAuthoritativeStartingFrame(project: Project): boolean {
  const start = project.storyboard.find((frame) => isAuthoritativeStartingFrame(frame));
  return (
    start?.imageOrigin === "user" &&
    Boolean(start.image) &&
    isTrustedMediaIdShape(start.mediaId)
  );
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
 * Replace a destination's canonical still in place. Keeps identity, order,
 * and neighboring frames. Does not invent a new destination.
 */
export function projectWithReplacedFrameImage(
  project: Project,
  frameId: string,
  next: StartingFrameUpload,
): Project {
  if (!isTrustedMediaIdShape(next.mediaId)) {
    throw new Error("Starting frame has no trusted media identity");
  }
  const target = project.storyboard.find((frame) => frame.id === frameId);
  if (!target) {
    throw new Error("Unknown storyboard frame");
  }
  if (!target.image && !canProvideStartingFrame(target)) {
    throw new Error("Destination has no canonical still to replace");
  }
  return {
    ...project,
    storyboard: project.storyboard.map((frame) => {
      if (frame.id !== frameId) {
        return frame;
      }
      const replaced: StoryboardFrame = {
        ...frame,
        image: next.imageUrl,
        mediaId: next.mediaId,
        imageOrigin: "user",
        ...(frame.destinationId ? {} : { destinationId: frame.id }),
      };
      if (next.mediaInfo) {
        replaced.mediaInfo = next.mediaInfo;
      } else {
        delete replaced.mediaInfo;
      }
      return replaced;
    }),
  };
}

/**
 * Replace Plan A's still. Subsequent storyboard frames remain in place.
 */
export function projectWithReplacedStartImage(
  project: Project,
  next: StartingFrameUpload,
): Project {
  const start =
    project.storyboard.find((frame) => frame.imageOrigin === "user") ?? project.storyboard[0];
  if (!start) {
    throw new Error("Project has no starting storyboard frame");
  }
  return projectWithReplacedFrameImage(project, start.id, next);
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
