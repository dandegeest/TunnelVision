import {
  GENERATED_OPENING_ASPECT_RATIO,
  isImageAspectRatio,
} from "../../../media/src/image-aspect-ratio.ts";
import type { ImageAspectRatio } from "../../../media/src/types.ts";
import { storyboardFrameForDestination, type Project, type StoryboardMediaInfo } from "./types";

export { GENERATED_OPENING_ASPECT_RATIO };
export type { ImageAspectRatio };

export function canonicalAspectRatioFromMediaInfo(
  info: Pick<StoryboardMediaInfo, "width" | "height">,
): ImageAspectRatio | undefined {
  return isImageAspectRatio(info) ? { width: info.width, height: info.height } : undefined;
}

/** Measured still aspect for preview, then project canonical, then generated 16:9. */
export function previewFrameAspectRatio(project: Project, frameId?: string): ImageAspectRatio {
  if (frameId) {
    const frame = storyboardFrameForDestination(project.storyboard, frameId);
    const fromFrame = frame?.mediaInfo ? canonicalAspectRatioFromMediaInfo(frame.mediaInfo) : undefined;
    if (fromFrame) {
      return fromFrame;
    }
  }
  return projectCanonicalAspectRatio(project) ?? GENERATED_OPENING_ASPECT_RATIO;
}

/** One still, or two stills side by side, for the Shoot preview monitor. */
export function previewMonitorAspectRatio(frameAspect: ImageAspectRatio, pair: boolean): ImageAspectRatio {
  return pair ? { width: frameAspect.width * 2, height: frameAspect.height } : frameAspect;
}

/** Project canonical AR, falling back to A's measured pixels or generated 16:9. */
export function projectCanonicalAspectRatio(project: Project): ImageAspectRatio | undefined {
  if (isImageAspectRatio(project.canonicalAspectRatio)) {
    return {
      width: project.canonicalAspectRatio.width,
      height: project.canonicalAspectRatio.height,
    };
  }
  const opening = project.storyboard.find((frame) => frame.id === "A");
  if (opening?.mediaInfo) {
    return canonicalAspectRatioFromMediaInfo(opening.mediaInfo);
  }
  if (opening?.imageOrigin === "generated") {
    return GENERATED_OPENING_ASPECT_RATIO;
  }
  return undefined;
}

export function projectWithCanonicalAspectRatio(
  project: Project,
  aspectRatio: ImageAspectRatio | undefined,
): Project {
  const next: Project = { ...project };
  if (aspectRatio) {
    next.canonicalAspectRatio = aspectRatio;
  } else {
    delete next.canonicalAspectRatio;
  }
  return next;
}
