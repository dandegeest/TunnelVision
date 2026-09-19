import { describe, expect, it } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { projectWithCinematographerAssessment } from "./cinematographer";
import {
  assessmentWithFilmmakerLocks,
  effectiveJourneyDurationSeconds,
  effectiveJourneyPace,
  projectWithJourneyFilmmakerDuration,
  projectWithJourneyFilmmakerPace,
} from "./journey-overrides";
import type { CinematographerAssessment } from "./types";

const assessment: CinematographerAssessment = {
  shootability: "shootable",
  setConsistency: 80,
  traversalConfidence: 80,
  summary: "Track forward.",
  route: "Along the path.",
  threshold: "The opening.",
  camera: "Forward.",
  parallax: "Trunks.",
  transitionStrategy: "Pass through.",
  segmentPromptAddition: "Track forward through the opening.",
  pace: "fast",
  desiredDurationSeconds: 8,
  concerns: [],
};

describe("filmmaker pace and duration locks", () => {
  it("lets the filmmaker override CM pace and duration on the stored plan", () => {
    const assessed = projectWithCinematographerAssessment(createForestProject(), "A-B", assessment);
    const paced = projectWithJourneyFilmmakerPace(assessed, "A-B", "slow");
    const journey = paced.journeys.find((item) => item.id === "A-B")!;
    expect(journey.filmmakerPace).toBe("slow");
    expect(journey.cinematographer?.pace).toBe("slow");
    expect(effectiveJourneyPace(journey)).toBe("slow");
    const timed = projectWithJourneyFilmmakerDuration(paced, "A-B", 12);
    const next = timed.journeys.find((item) => item.id === "A-B")!;
    expect(next.filmmakerDurationSeconds).toBe(12);
    expect(next.cinematographer?.desiredDurationSeconds).toBe(12);
    expect(effectiveJourneyDurationSeconds(next)).toBe(12);
  });

  it("keeps filmmaker locks when a later CM assessment returns different values", () => {
    const locked = projectWithJourneyFilmmakerDuration(
      projectWithJourneyFilmmakerPace(
        projectWithCinematographerAssessment(createForestProject(), "A-B", assessment),
        "A-B",
        "moderate",
      ),
      "A-B",
      10,
    );
    const overwritten = projectWithCinematographerAssessment(locked, "A-B", {
      ...assessment,
      pace: "hyperspeed",
      desiredDurationSeconds: 4,
    });
    const journey = overwritten.journeys.find((item) => item.id === "A-B")!;
    expect(journey.cinematographer?.pace).toBe("moderate");
    expect(journey.cinematographer?.desiredDurationSeconds).toBe(10);
    expect(
      assessmentWithFilmmakerLocks(assessment, {
        filmmakerPace: "slow-motion",
        filmmakerDurationSeconds: 3,
      }),
    ).toMatchObject({ pace: "slow-motion", desiredDurationSeconds: 3 });
  });
});
