import { describe, expect, it } from "vitest";
import { createNewProject } from "./new-project";
import { projectWithCinematographerAssessment } from "./cinematographer";
import { projectWithMotionPlan } from "./motion-plan";
import { projectWithSyncedProductionLegs } from "./production-legs";
import {
  canShootJourney,
  journeysReadyToAutoShoot,
  journeysReadyToTakeAll,
  projectWithJourneyClipDuration,
  projectWithJourneyShotFailed,
  projectWithJourneyShooting,
  projectWithJourneysShooting,
  projectWithDefaultTakeIntent,
  projectWithJourneyShotTake,
  projectWithVideoModel,
  projectWithVideoModelForIntent,
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
  setConsistency: 72,
  traversalConfidence: 48,
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
  startCanonicalMediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  endCanonicalMediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
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

function projectWithTwoLegs(): Project {
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
      {
        id: "C",
        label: "C",
        imageOrigin: "generated",
        image: "/c.png",
        mediaId: "upload-cccccccccccccccccccccccccccccccc",
        destinationId: "C",
      },
    ],
  });
}

const motionPlanBC: SegmentMotionPlan = {
  ...motionPlan,
  startCanonicalMediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  endCanonicalMediaId: "upload-cccccccccccccccccccccccccccccccc",
  startShootingFrame: { mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", imageUrl: "/b-prime.png" },
  endShootingFrame: { mediaId: "upload-cccccccccccccccccccccccccccccccc", imageUrl: "/c-prime.png" },
};

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
    const kling = shootRequestFromProject({ ...prepared, videoModel: "kling-v2.5-turbo-pro" }, "A-B");
    expect(kling.videoModel).toBe("kling-v2.5-turbo-pro");
    expect(kling.generationIntent).toBe("fast");
    const quality = shootRequestFromProject(
      {
        ...prepared,
        videoModelsByIntent: {
          fast: "pruna-p-video",
          balanced: "wan-2.2-first-last-frame",
          quality: "seedance-2.5",
        },
      },
      "A-B",
      "quality",
    );
    expect(quality.videoModel).toBe("seedance-2.5");
    expect(quality.generationIntent).toBe("quality");
    const agentQuality = shootRequestFromProject(
      { ...prepared, defaultTakeIntent: "quality" },
      "A-B",
    );
    expect(agentQuality.videoModel).toBe("seedance-2.5");
    const kling3 = shootRequestFromProject(
      {
        ...prepared,
        klingV3Mode: "pro",
        videoModelsByIntent: {
          fast: "pruna-p-video",
          balanced: "wan-2.2-first-last-frame",
          quality: "kling-v3-video",
        },
      },
      "A-B",
      "quality",
    );
    expect(kling3.videoModel).toBe("kling-v3-video");
    expect(kling3.klingV3Mode).toBe("pro");
    expect(kling3.generationIntent).toBe("quality");
    expect(agentQuality.generationIntent).toBe("quality");
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
    expect(rendered.journeys[0]?.takes).toHaveLength(1);
    expect(rendered.journeys[0]?.selectedTakeId).toBe("A-B:take:1");
    expect(rendered.journeys[0]?.take?.videoInputs.endShootingFrame).toBe(true);
    const failed = projectWithJourneyShotFailed(prepared, "A-B", "provider down");
    expect(failed.journeys[0]?.status).toBe("failed");
    expect(failed.journeys[0]?.cinematographer).toEqual(assessment);
    expect(failed.journeys[0]?.shootError).toBe("provider down");
  });

  it("marks every NEW TAKE ALL segment shooting so provider calls can overlap", () => {
    const staged = projectWithMotionPlan(projectWithMotionPlan(projectWithTwoLegs(), "A-B", motionPlan), "B-C", motionPlanBC);
    expect(journeysReadyToTakeAll(staged).map((journey) => journey.id)).toEqual(["A-B", "B-C"]);
    const firstTake = projectWithJourneyShotTake(staged, "A-B", {
      take,
      videoUrl: "https://example.test/a-b.mp4",
    });
    expect(journeysReadyToTakeAll(firstTake).map((journey) => journey.id)).toEqual(["A-B", "B-C"]);
    expect(journeysReadyToAutoShoot(firstTake).map((journey) => journey.id)).toEqual(["B-C"]);
    const launching = projectWithJourneysShooting(
      firstTake,
      journeysReadyToTakeAll(firstTake).map((journey) => journey.id),
    );
    expect(launching.journeys.map((journey) => journey.status)).toEqual(["shooting", "shooting"]);
    expect(journeysReadyToTakeAll(launching)).toEqual([]);
    expect(shootRequestFromProject(launching, "A-B").journeyId).toBe("A-B");
    expect(shootRequestFromProject(launching, "B-C").journeyId).toBe("B-C");
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

  it("appends a second take without replacing the first", () => {
    const prepared = projectWithMotionPlan(projectWithLeg(), "A-B", motionPlan);
    const first = projectWithJourneyShotTake(prepared, "A-B", {
      take,
      videoUrl: "https://example.test/a-b.mp4",
    });
    const second = projectWithJourneyShotTake(first, "A-B", {
      take: { ...take, durationSeconds: 5, seed: 11 },
      videoUrl: "https://example.test/a-b-2.mp4",
    });
    expect(second.journeys[0]?.takes).toHaveLength(2);
    expect(second.journeys[0]?.takes?.[0]?.videoUrl).toBe("https://example.test/a-b.mp4");
    expect(second.journeys[0]?.takes?.[1]?.videoUrl).toBe("https://example.test/a-b-2.mp4");
    expect(second.journeys[0]?.selectedTakeId).toBe("A-B:take:2");
    expect(second.journeys[0]?.videoUrl).toBe("https://example.test/a-b-2.mp4");
    const failedSecond = projectWithJourneyShotFailed(projectWithJourneyShooting(first, "A-B"), "A-B", "timeout");
    expect(failedSecond.journeys[0]?.status).toBe("rendered");
    expect(failedSecond.journeys[0]?.takes).toHaveLength(1);
    expect(failedSecond.journeys[0]?.videoUrl).toBe("https://example.test/a-b.mp4");
  });

  it("does not generate footage from a Motion Plan for a previous canonical pair", () => {
    const prepared = projectWithMotionPlan(projectWithLeg(), "A-B", motionPlan);
    const stale = {
      ...prepared,
      storyboard: prepared.storyboard.map((frame) =>
        frame.id === "A"
          ? { ...frame, mediaId: "upload-ffffffffffffffffffffffffffffffff" }
          : frame,
      ),
    };
    expect(canShootJourney(stale, stale.journeys[0]!)).toBe(false);
    expect(() => shootRequestFromProject(stale, "A-B")).toThrow(/Stage this journey/i);
  });

  it("resizes a rendered leg to the take's clip length", () => {
    const prepared = projectWithCinematographerAssessment(projectWithLeg(), "A-B", assessment);
    expect(prepared.journeys[0]?.durationSeconds).toBe(6);
    const klingTake: JourneyShotTake = { ...take, model: "kwaivgi/kling-v2.5-turbo-pro", durationSeconds: 5 };
    const rendered = projectWithJourneyShotTake(prepared, "A-B", {
      take: klingTake,
      videoUrl: "https://example.test/kling.mp4",
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
    const kling = projectWithVideoModel(prepared, "kling-v2.5-turbo-pro");
    expect(kling.videoModel).toBe("kling-v2.5-turbo-pro");
    expect(kling.journeys[0]?.durationSeconds).toBe(5);
    const rendered = projectWithJourneyShotTake(kling, "A-B", {
      take: { ...take, model: "kwaivgi/kling-v2.5-turbo-pro", durationSeconds: 5 },
      videoUrl: "https://example.test/kling.mp4",
    });
    const backToPruna = projectWithVideoModel(rendered, "pruna-p-video");
    expect(backToPruna.videoModel).toBe("pruna-p-video");
    expect(backToPruna.journeys[0]?.durationSeconds).toBe(5);
    expect(backToPruna.journeys[0]?.take?.durationSeconds).toBe(5);
  });

  it("previews unshot duration from the default Take intent mapping", () => {
    const prepared = projectWithCinematographerAssessment(projectWithLeg(), "A-B", assessment);
    const qualityKling = projectWithVideoModelForIntent(
      projectWithDefaultTakeIntent(prepared, "quality"),
      "quality",
      "kling-v2.5-turbo-pro",
    );
    expect(qualityKling.defaultTakeIntent).toBe("quality");
    expect(qualityKling.videoModel).toBe("pruna-p-video");
    expect(qualityKling.journeys[0]?.durationSeconds).toBe(5);
    const rendered = projectWithJourneyShotTake(qualityKling, "A-B", {
      take: { ...take, model: "kwaivgi/kling-v2.5-turbo-pro", durationSeconds: 5 },
      videoUrl: "https://example.test/kling.mp4",
    });
    const backToFast = projectWithDefaultTakeIntent(rendered, "fast");
    expect(backToFast.defaultTakeIntent).toBe("fast");
    expect(backToFast.journeys[0]?.durationSeconds).toBe(5);
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
