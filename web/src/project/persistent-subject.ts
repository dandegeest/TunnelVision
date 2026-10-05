import { runtimeMediaPreviewUrl } from "../../runtime-media-limits";
import type { PersistentSubject, Project } from "./types";
import { isTrustedMediaIdShape } from "./trusted-media-id";

/** Image that can be sent as a canonical reference. Description-only sheets are not. */
export function persistentSubjectReference(
  project: Pick<Project, "persistentSubject">,
): { mediaId: string; imageUrl: string; description: string } | undefined {
  const subject = project.persistentSubject;
  const mediaId = subject?.mediaId?.trim() ?? "";
  const imageUrl = subject?.imageUrl?.trim() ?? "";
  if (!subject || !isTrustedMediaIdShape(mediaId) || imageUrl !== runtimeMediaPreviewUrl(mediaId)) {
    return undefined;
  }
  return { mediaId, imageUrl, description: subject.description.trim() };
}

export function persistentSubjectRequestFields(
  project: Pick<Project, "persistentSubject">,
): { subjectMediaId: string; subjectDescription?: string } | undefined {
  const subject = persistentSubjectReference(project);
  if (!subject) {
    return undefined;
  }
  return {
    subjectMediaId: subject.mediaId,
    ...(subject.description ? { subjectDescription: subject.description } : {}),
  };
}

export function projectWithPersistentSubjectDescription(project: Project, description: string): Project {
  const current = project.persistentSubject;
  const image = persistentSubjectReference(project);
  if (!image && !description.trim()) {
    if (!current) {
      return project;
    }
    const { persistentSubject: _removed, ...rest } = project;
    return rest;
  }
  const next: PersistentSubject = {
    description,
    ...(image ? { mediaId: image.mediaId, imageUrl: image.imageUrl } : {}),
  };
  if (
    current?.description === next.description &&
    current.mediaId === next.mediaId &&
    current.imageUrl === next.imageUrl
  ) {
    return project;
  }
  return { ...project, persistentSubject: next };
}

export function projectWithPersistentSubjectImage(
  project: Project,
  image: { mediaId: string; imageUrl: string } | null,
): Project {
  const description = project.persistentSubject?.description.trim() ?? "";
  if (!image) {
    if (!description) {
      if (!project.persistentSubject) {
        return project;
      }
      const { persistentSubject: _removed, ...rest } = project;
      return rest;
    }
    if (!project.persistentSubject?.mediaId && project.persistentSubject?.description === description) {
      return { ...project, persistentSubject: { description } };
    }
    return { ...project, persistentSubject: { description } };
  }
  if (!isTrustedMediaIdShape(image.mediaId) || image.imageUrl !== runtimeMediaPreviewUrl(image.mediaId)) {
    throw new Error("Persistent subject image has no trusted media identity");
  }
  const current = persistentSubjectReference(project);
  if (current?.mediaId === image.mediaId && (project.persistentSubject?.description.trim() ?? "") === description) {
    return project;
  }
  return {
    ...project,
    persistentSubject: { mediaId: image.mediaId, imageUrl: image.imageUrl, description },
  };
}
