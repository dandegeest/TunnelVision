import type { MediaProviderChoice, Project } from "./types";

export const MEDIA_PROVIDERS = ["runway", "replicate"] as const satisfies readonly MediaProviderChoice[];

export const MEDIA_PROVIDER_LABEL: Record<MediaProviderChoice, string> = {
  runway: "Runway",
  replicate: "Replicate",
};

export function isMediaProviderChoice(value: unknown): value is MediaProviderChoice {
  return value === "runway" || value === "replicate";
}

/** Older projects omit the field and keep the Runway default. */
export function mediaProviderFromProject(
  project: Pick<Project, "mediaProvider">,
): MediaProviderChoice {
  return isMediaProviderChoice(project.mediaProvider) ? project.mediaProvider : "runway";
}

export function projectWithMediaProvider(project: Project, choice: MediaProviderChoice): Project {
  if (mediaProviderFromProject(project) === choice && project.mediaProvider === choice) {
    return project;
  }
  return { ...project, mediaProvider: choice };
}
