import { storyboardFrameWithOpeningPlan } from "./destination";
import { canonicalAspectRatioFromMediaInfo } from "./canonical-aspect";
import { isTrustedMediaIdShape } from "./trusted-media-id";
import { projectWithSyncedProductionLegs } from "./production-legs";
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
  return isAuthoritativeStartingFrame(frame) && canUploadStoryboardFrame(frame);
}

/** Unresolved destination slot that can receive a filmmaker still. */
export function canUploadStoryboardFrame(frame: Pick<StoryboardFrame, "image" | "imageOrigin">): boolean {
  return frame.imageOrigin === "none" && !frame.image;
}

export function hasAuthoritativeStartingFrame(project: Project): boolean {
  const start = project.storyboard.find((frame) => isAuthoritativeStartingFrame(frame));
  return Boolean(
    start?.image && start.imageOrigin !== "none" && isTrustedMediaIdShape(start.mediaId),
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

export const CLEAR_STORYBOARD_PLAN_ON_UPLOAD_PROMPT =
  "This destination already has a plan. Clear the intent and visual description so the next DIRECT can describe the new still?";

export function storyboardFrameHasPlanText(
  frame: Pick<StoryboardFrame, "intent" | "visualDescription">,
): boolean {
  return Boolean(frame.intent?.trim() || frame.visualDescription?.trim());
}

/** Ask whether to null existing plan text so a later DIRECT can describe the new still. */
export function shouldClearStoryboardPlanOnUpload(
  frame: Pick<StoryboardFrame, "intent" | "visualDescription">,
  confirm: (message: string) => boolean,
): boolean {
  if (!storyboardFrameHasPlanText(frame)) {
    return false;
  }
  return confirm(CLEAR_STORYBOARD_PLAN_ON_UPLOAD_PROMPT);
}

export type ReplaceFrameImageOptions = {
  clearPlan?: boolean;
};

/**
 * Replace a destination's canonical still in place. Keeps identity, order,
 * and neighboring frames. Does not invent a new destination.
 */
export function projectWithReplacedFrameImage(
  project: Project,
  frameId: string,
  next: StartingFrameUpload,
  options?: ReplaceFrameImageOptions,
): Project {
  if (!isTrustedMediaIdShape(next.mediaId)) {
    throw new Error("Starting frame has no trusted media identity");
  }
  const target = project.storyboard.find((frame) => frame.id === frameId);
  if (!target) {
    throw new Error("Unknown storyboard frame");
  }
  if (!target.image && !canUploadStoryboardFrame(target)) {
    throw new Error("Destination has no canonical still to replace");
  }
  const autoGenerateOpening =
    frameId === "A" && !project.storyDurationLocked ? false : project.autoGenerateOpening;
  const nextProject: Project = {
    ...project,
    autoGenerateOpening,
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
      delete replaced.generatedFrom;
      if (options?.clearPlan) {
        delete replaced.intent;
        delete replaced.visualDescription;
      }
      const withPlan =
        !options?.clearPlan && frameId === "A"
          ? storyboardFrameWithOpeningPlan(replaced, project.story, "user")
          : replaced;
      if (next.mediaInfo) {
        withPlan.mediaInfo = next.mediaInfo;
      } else {
        delete withPlan.mediaInfo;
      }
      return withPlan;
    }),
  };
  if (frameId === "A") {
    const aspectRatio = next.mediaInfo ? canonicalAspectRatioFromMediaInfo(next.mediaInfo) : undefined;
    if (aspectRatio) {
      nextProject.canonicalAspectRatio = aspectRatio;
    } else {
      delete nextProject.canonicalAspectRatio;
    }
  }
  return projectWithSyncedProductionLegs(nextProject);
}

/**
 * Replace Plan A's still. Subsequent storyboard frames remain in place.
 */
export function projectWithReplacedStartImage(
  project: Project,
  next: StartingFrameUpload,
  options?: ReplaceFrameImageOptions,
): Project {
  const start =
    project.storyboard.find((frame) => frame.imageOrigin === "user") ?? project.storyboard[0];
  if (!start) {
    throw new Error("Project has no starting storyboard frame");
  }
  return projectWithReplacedFrameImage(project, start.id, next, options);
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
