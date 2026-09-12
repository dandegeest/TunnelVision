import type { Project } from "./types";
import {
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_IMAGE_OUTPUT_FORMAT,
  DEFAULT_IMAGE_RESOLUTION,
} from "../../../media/src/replicate/image-models.ts";
import { DEFAULT_VIDEO_MODEL_ID } from "../../../media/src/replicate/video-models.ts";

/** Minimum valid product project. Not a research fixture. */
export function createNewProject(): Project {
  return {
    id: "untitled",
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
