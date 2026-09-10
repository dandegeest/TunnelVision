import {
  GENERATED_OPENING_ASPECT_RATIO,
  isImageAspectRatio,
} from "../../../media/src/image-aspect-ratio.ts";
import type { ImageAspectRatio } from "../../../media/src/types.ts";
import type { Project, StoryboardMediaInfo } from "./types";

export { GENERATED_OPENING_ASPECT_RATIO };
export type { ImageAspectRatio };

export function canonicalAspectRatioFromMediaInfo(
  info: Pick<StoryboardMediaInfo, "width" | "height">,
): ImageAspectRatio | undefined {
  return isImageAspectRatio(info) ? { width: info.width, height: info.height } : undefined;
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
