import type { Project } from "./types";
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
