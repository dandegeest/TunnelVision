import type { Project } from "./types";

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
