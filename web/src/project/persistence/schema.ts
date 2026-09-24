import type { Agency, Construction, Project, StoryDuration } from "../types";

export const PROJECT_SCHEMA_VERSION = 1;

export class ProjectSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectSchemaError";
  }
}

export type ProjectSettingsSnapshot = {
  agency: Agency;
  construction: Construction;
  videoModel: Project["videoModel"];
  videoModelsByIntent?: Project["videoModelsByIntent"];
  defaultTakeIntent?: Project["defaultTakeIntent"];
  klingV3Mode?: Project["klingV3Mode"];
  imageModel: Project["imageModel"];
  imageOutputFormat: Project["imageOutputFormat"];
  imageResolution: Project["imageResolution"];
  canonicalAspectRatio?: Project["canonicalAspectRatio"];
  autoGenerateOpening: boolean;
  autoGenerateAllDestinations: boolean;
  autoBlockShots: boolean;
  autoShoot: boolean;
  generateAudio?: boolean;
  pullForwardReferenceEnabled?: boolean;
  cameraGrammar?: Project["cameraGrammar"];
  durationMode?: Project["durationMode"];
  fixedDurationSeconds?: number;
  adaptivePace?: boolean;
  journeyPace?: Project["journeyPace"];
  journeyPaceStory?: string;
  storyIdea?: string;
  storyDuration: StoryDuration;
  storyDurationLocked: boolean;
};

export type ProjectManifest = {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  journey: {
    mode: Construction;
    agency: Agency;
    initialPrompt: string;
    status: string;
    storyDuration: StoryDuration;
    storyDurationLocked: boolean;
  };
  canonicals: Array<{ id: string; label: string; file: string }>;
  traversals: Array<{ id: string; from: string; to: string | null; file: string }>;
  settings: ProjectSettingsSnapshot;
  media: Record<string, string>;
  exports?: Array<{ filename: string; path: string; complete?: boolean; videoUrl?: string }>;
  missingAssets?: string[];
};

export type MediaCopyRequest = {
  mediaId: string;
  relativePath: string;
  sourceUrl?: string;
};

export type SerializedProjectDocuments = {
  manifest: ProjectManifest;
  canonicals: Record<string, unknown>;
  traversals: Record<string, unknown>;
  shootingFrames: Record<string, unknown>;
  mediaCopies: MediaCopyRequest[];
};

export type OpenedProjectWarnings = {
  missingAssets: string[];
};

export function assertSupportedSchemaVersion(version: unknown): asserts version is number {
  if (version !== PROJECT_SCHEMA_VERSION) {
    throw new ProjectSchemaError(
      typeof version === "number"
        ? `Unsupported project schemaVersion ${version}. This app reads version ${PROJECT_SCHEMA_VERSION}.`
        : "Project manifest is missing schemaVersion.",
    );
  }
}

export function parseManifest(value: unknown): ProjectManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProjectSchemaError("project.json is not a valid object.");
  }
  const record = value as Record<string, unknown>;
  assertSupportedSchemaVersion(record.schemaVersion);
  if (typeof record.id !== "string" || !record.id.trim()) {
    throw new ProjectSchemaError("project.json is missing id.");
  }
  if (typeof record.name !== "string" || !record.name.trim()) {
    throw new ProjectSchemaError("project.json is missing name.");
  }
  if (typeof record.createdAt !== "string" || typeof record.updatedAt !== "string") {
    throw new ProjectSchemaError("project.json is missing timestamps.");
  }
  if (!record.journey || typeof record.journey !== "object") {
    throw new ProjectSchemaError("project.json is missing journey.");
  }
  if (!Array.isArray(record.canonicals) || !Array.isArray(record.traversals)) {
    throw new ProjectSchemaError("project.json is missing canonical or traversal indexes.");
  }
  if (!record.settings || typeof record.settings !== "object") {
    throw new ProjectSchemaError("project.json is missing settings.");
  }
  const media =
    record.media && typeof record.media === "object" && !Array.isArray(record.media)
      ? (record.media as Record<string, string>)
      : {};
  return record as ProjectManifest & { media: typeof media };
}
