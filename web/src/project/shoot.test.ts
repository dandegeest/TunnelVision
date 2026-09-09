import { describe, expect, it } from "vitest";
import { createNewProject } from "./new-project";
import { projectWithCinematographerAssessment } from "./cinematographer";
import { projectWithSyncedProductionLegs } from "./production-legs";
import {
  canShootJourney,
  journeysReadyToAutoShoot,
  projectWithJourneyShotFailed,
  projectWithJourneyShooting,
  projectWithJourneyShotTake,
  shootRequestFromProject,
} from "./shoot";
import type { CinematographerAssessment, JourneyShotTake, Project } from "./types";

const assessment: CinematographerAssessment = {
  shootability: "needs_review",
  summary: "Keep the camera on the visible corridor.",
  route: "Advance through the opening.",
  threshold: "The doorway.",
  camera: "Track forward.",
  parallax: "Near walls.",
  transitionStrategy: "Pass through the opening.",
  segmentPromptAddition: "Track forward through the opening.",
  pace: "fast",
  camotionSuitability: "uncertain",
  concerns: ["Geometry is tight."],
};

const take: JourneyShotTake = {
  startShootingFrame: { mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", imageUrl: "/a-prime.png" },
  endShootingFrame: { mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", imageUrl: "/b-prime.png" },
  startPlan: {
    version: 1,
    camera: { vanishing_point: [0.5, 0.5], forward: 1 },
    destination: { point: [0.5, 0.5], protect: true, bbox: [0.25, 0.2, 0.75, 0.8] },
    exposure: { strength: 0.08, samples: 16 },
  },
  endPlan: {
    version: 1,
    camera: { vanishing_point: [0.5, 0.5], forward: 1 },
    destination: { point: [0.5, 0.5], protect: true, bbox: [0.25, 0.2, 0.75, 0.8] },
    exposure: { strength: 0.08, samples: 16 },
  },
  segmentPromptAddition: assessment.segmentPromptAddition,
  effectivePrompt: "baseline\nTrack forward through the opening.",
  pace: "fast",
  provider: "replicate",
  model: "prunaai/p-video",
  modelVersion: "test",
  durationSeconds: 6,
  videoInputs: { startShootingFrame: true, endShootingFrame: true },
};

function projectWithLeg(): Project {
  return projectWithSyncedProductionLegs({
    ...createNewProject(),
    storyboard: [
      {
        id: "A",
        label: "A",
        imageOrigin: "user",
        image: "/a.png",
        mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        destinationId: "A",
      },
      {
        id: "B",
        label: "B",
        imageOrigin: "generated",
        image: "/b.png",
        mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        destinationId: "B",
      },
    ],
  });
}

describe("SHOOT gate and JourneyShot take", () => {
  it("does not shoot until BLOCK has stored choreography", () => {
    const project = projectWithLeg();
    const journey = project.journeys[0]!;
    expect(canShootJourney(project, journey)).toBe(false);
    expect(() => shootRequestFromProject(project, journey.id)).toThrow(/Block this journey/i);
  });

  it("does not map CM shootability onto operational status", () => {
    const prepared = projectWithCinematographerAssessment(projectWithLeg(), "A-B", assessment);
    expect(prepared.journeys[0]?.status).toBe("ready");
    expect(shootRequestFromProject(prepared, "A-B")).toMatchObject({
      journeyId: "A-B",
      segmentPromptAddition: assessment.segmentPromptAddition,
      pace: "fast",
    });
    expect(canShootJourney(prepared, prepared.journeys[0]!)).toBe(true);
    const shooting = projectWithJourneyShooting(prepared, "A-B");
    expect(shooting.journeys[0]?.status).toBe("shooting");
    expect(shooting.journeys[0]?.cinematographer).toEqual(assessment);
    const rendered = projectWithJourneyShotTake(shooting, "A-B", {
      take,
      videoUrl: "https://example.test/a-b.mp4",
    });
    expect(rendered.journeys[0]?.status).toBe("rendered");
    expect(rendered.journeys[0]?.cinematographer?.shootability).toBe("needs_review");
    expect(rendered.journeys[0]?.videoUrl).toBe("https://example.test/a-b.mp4");
    expect(rendered.journeys[0]?.take?.videoInputs.endShootingFrame).toBe(true);
    const failed = projectWithJourneyShotFailed(prepared, "A-B", "provider down");
    expect(failed.journeys[0]?.status).toBe("failed");
    expect(failed.journeys[0]?.cinematographer).toEqual(assessment);
    expect(failed.journeys[0]?.shootError).toBe("provider down");
  });

  it("auto-shoots blocked legs regardless of CM warnings and skips completed takes", () => {
    const hold = projectWithCinematographerAssessment(projectWithLeg(), "A-B", assessment);
    expect(journeysReadyToAutoShoot(hold).map((journey) => journey.id)).toEqual(["A-B"]);
    const shooting = projectWithJourneyShooting(hold, "A-B");
    expect(journeysReadyToAutoShoot(shooting)).toEqual([]);
    const rendered = projectWithJourneyShotTake(shooting, "A-B", {
      take,
      videoUrl: "https://example.test/a-b.mp4",
    });
    expect(journeysReadyToAutoShoot(rendered)).toEqual([]);
  });
});
