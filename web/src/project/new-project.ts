import type { Project } from "./types";

/** Minimum valid product project. Not a research fixture. */
export function createNewProject(): Project {
  return {
    id: "untitled",
    title: "UNTITLED",
    story: "",
    agency: "directed",
    construction: "planned",
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
