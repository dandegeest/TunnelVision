import { describe, expect, it } from "vitest";
import { createNewProject } from "./new-project";
import { projectWithCinematographerAssessment } from "./cinematographer";
import { projectWithMotionPlan } from "./motion-plan";
import { projectWithSyncedProductionLegs } from "./production-legs";
import {
  canShootJourney,
  journeysReadyToAutoShoot,
  projectWithJourneyClipDuration,
  projectWithJourneyShotFailed,
  projectWithJourneyShooting,
  projectWithJourneyShotTake,
  projectWithVideoModel,
  shootRequestFromProject,
} from "./shoot";
import { layoutTimeline } from "../timeline/geometry";
import type { CinematographerAssessment, JourneyShotTake, Project, SegmentMotionPlan } from "./types";

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

const motionPlan: SegmentMotionPlan = {
  cinematographer: assessment,
  startShootingFrame: take.startShootingFrame,
  endShootingFrame: take.endShootingFrame,
  startPlan: take.startPlan,
  endPlan: take.endPlan,
  segmentPromptAddition: assessment.segmentPromptAddition,
  effectivePrompt: take.effectivePrompt,
  pace: assessment.pace,
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
  it("does not shoot until the segment Motion Plan has A′/B′", () => {
    const project = projectWithLeg();
    const journey = project.journeys[0]!;
    expect(canShootJourney(project, journey)).toBe(false);
    expect(() => shootRequestFromProject(project, journey.id)).toThrow(/Stage this journey/i);
    const choreographed = projectWithCinematographerAssessment(project, "A-B", assessment);
    expect(canShootJourney(choreographed, choreographed.journeys[0]!)).toBe(false);
    expect(() => shootRequestFromProject(choreographed, "A-B")).toThrow(/Stage this journey/i);
  });

  it("does not map CM shootability onto operational status", () => {
    const prepared = projectWithMotionPlan(projectWithLeg(), "A-B", motionPlan);
    expect(prepared.journeys[0]?.status).toBe("ready");
    expect(shootRequestFromProject(prepared, "A-B")).toMatchObject({
      journeyId: "A-B",
      segmentPromptAddition: assessment.segmentPromptAddition,
      pace: "fast",
      videoModel: "pruna-p-video",
      startShootingMediaId: take.startShootingFrame.mediaId,
      endShootingMediaId: take.endShootingFrame.mediaId,
    });
    expect(canShootJourney(prepared, prepared.journeys[0]!)).toBe(true);
    const luma = shootRequestFromProject({ ...prepared, videoModel: "luma-ray-flash-2-720p" }, "A-B");
    expect(luma.videoModel).toBe("luma-ray-flash-2-720p");
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
    const hold = projectWithMotionPlan(projectWithLeg(), "A-B", motionPlan);
    expect(journeysReadyToAutoShoot(hold).map((journey) => journey.id)).toEqual(["A-B"]);
    const shooting = projectWithJourneyShooting(hold, "A-B");
    expect(journeysReadyToAutoShoot(shooting)).toEqual([]);
    const rendered = projectWithJourneyShotTake(shooting, "A-B", {
      take,
      videoUrl: "https://example.test/a-b.mp4",
    });
    expect(journeysReadyToAutoShoot(rendered)).toEqual([]);
  });

  it("resizes a rendered leg to the take's clip length", () => {
    const prepared = projectWithCinematographerAssessment(projectWithLeg(), "A-B", assessment);
    expect(prepared.journeys[0]?.durationSeconds).toBe(6);
    const lumaTake: JourneyShotTake = { ...take, model: "luma/ray-flash-2-720p", durationSeconds: 5 };
    const rendered = projectWithJourneyShotTake(prepared, "A-B", {
      take: lumaTake,
      videoUrl: "https://example.test/luma.mp4",
    });
    expect(rendered.journeys[0]?.durationSeconds).toBe(5);
    expect(rendered.journeys[0]?.take?.durationSeconds).toBe(5);
    const layout = layoutTimeline(rendered.destinations, rendered.journeys, 1);
    expect(layout.journeys[0]?.endTime).toBe(5);
    expect(layout.journeys[0]?.width).toBe(5 * 38);
    expect(layout.totalDuration).toBe(5);
  });

  it("previews the new model's duration on unshot legs and keeps rendered takes", () => {
    const prepared = projectWithCinematographerAssessment(projectWithLeg(), "A-B", assessment);
    const luma = projectWithVideoModel(prepared, "luma-ray-flash-2-720p");
    expect(luma.videoModel).toBe("luma-ray-flash-2-720p");
    expect(luma.journeys[0]?.durationSeconds).toBe(5);
    const rendered = projectWithJourneyShotTake(luma, "A-B", {
      take: { ...take, model: "luma/ray-flash-2-720p", durationSeconds: 5 },
      videoUrl: "https://example.test/luma.mp4",
    });
    const backToPruna = projectWithVideoModel(rendered, "pruna-p-video");
    expect(backToPruna.videoModel).toBe("pruna-p-video");
    expect(backToPruna.journeys[0]?.durationSeconds).toBe(5);
    expect(backToPruna.journeys[0]?.take?.durationSeconds).toBe(5);
  });

  it("snaps the timeline to the actual clip duration", () => {
    const prepared = projectWithCinematographerAssessment(projectWithLeg(), "A-B", assessment);
    const rendered = projectWithJourneyShotTake(prepared, "A-B", {
      take,
      videoUrl: "https://example.test/a-b.mp4",
    });
    expect(rendered.journeys[0]?.durationSeconds).toBe(6);
    const snapped = projectWithJourneyClipDuration(rendered, "A-B", 5.04);
    expect(snapped.journeys[0]?.durationSeconds).toBe(5);
    expect(snapped.journeys[0]?.take?.durationSeconds).toBe(5);
    expect(projectWithJourneyClipDuration(snapped, "A-B", 5.04)).toBe(snapped);
  });
});
