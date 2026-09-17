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
