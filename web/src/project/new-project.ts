import type { Project } from "./types";
import {
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_IMAGE_OUTPUT_FORMAT,
  DEFAULT_IMAGE_RESOLUTION,
} from "../../../media/src/replicate/image-models.ts";
import { DEFAULT_KLING_V3_MODE, DEFAULT_VIDEO_MODEL_ID } from "../../../media/src/replicate/video-models.ts";
import { DEFAULT_GENERATION_INTENT, defaultVideoModelsByIntent } from "./generation-intent";

/** Minimum valid product project. Not a research fixture. */
/** Unsaved in-memory projects keep this id until the first durable save. */
export const UNSAVED_PROJECT_ID = "untitled";

export function createNewProject(): Project {
  return {
    id: UNSAVED_PROJECT_ID,
    title: "UNTITLED",
    story: "",
    agency: "directed",
    construction: "planned",
    storyDuration: "auto",
    autoGenerateOpening: true,
    autoGenerateAllDestinations: false,
    autoBlockShots: false,
    autoShoot: false,
    generateAudio: false,
    pullForwardReferenceEnabled: true,
    cameraGrammar: "pov",
    durationMode: "adaptive",
    fixedDurationSeconds: 5,
    videoModel: DEFAULT_VIDEO_MODEL_ID,
    videoModelsByIntent: defaultVideoModelsByIntent(),
    defaultTakeIntent: DEFAULT_GENERATION_INTENT,
    klingV3Mode: DEFAULT_KLING_V3_MODE,
    imageModel: DEFAULT_IMAGE_MODEL_ID,
    imageOutputFormat: DEFAULT_IMAGE_OUTPUT_FORMAT,
    imageResolution: DEFAULT_IMAGE_RESOLUTION,
    storyDurationLocked: false,
    storyboard: [
      {
        id: "A",
        label: "A",
        imageOrigin: "none",
      },
    ],
    destinations: [],
    journeys: [],
  };
}

/** Image, video, duration, and pull-forward settings that roll forward. */
export type SessionProjectSettings = Pick<
  Project,
  | "generateAudio"
  | "pullForwardReferenceEnabled"
  | "durationMode"
  | "fixedDurationSeconds"
  | "videoModel"
  | "videoModelsByIntent"
  | "defaultTakeIntent"
  | "klingV3Mode"
  | "imageModel"
  | "imageOutputFormat"
  | "imageResolution"
>;

export function sessionProjectSettings(project: Project): SessionProjectSettings {
  return {
    generateAudio: project.generateAudio,
    pullForwardReferenceEnabled: project.pullForwardReferenceEnabled,
    durationMode: project.durationMode,
    fixedDurationSeconds: project.fixedDurationSeconds,
    videoModel: project.videoModel,
    videoModelsByIntent: project.videoModelsByIntent ? { ...project.videoModelsByIntent } : undefined,
    defaultTakeIntent: project.defaultTakeIntent,
    klingV3Mode: project.klingV3Mode,
    imageModel: project.imageModel,
    imageOutputFormat: project.imageOutputFormat,
    imageResolution: project.imageResolution,
  };
}

/** Fresh project. Only previous image/video settings roll forward — not grammar or journey. */
export function createNewProjectFromSession(previous: Project): Project {
  return {
    ...createNewProject(),
    ...sessionProjectSettings(previous),
  };
}
