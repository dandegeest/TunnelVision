import { describe, expect, it } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { motionPlanAutoKey, projectWithCinematographerAssessment } from "./cinematographer";
import { projectWithMotionPlan, motionPlanStageRequestFromAssessment } from "./motion-plan";
import { projectWithJourneyShotTake } from "./shoot";
import { TRUSTED_MEDIA_IDS } from "./trusted-media-id";
import type { CinematographerAssessment, SegmentMotionPlan } from "./types";

const assessment: CinematographerAssessment = {
  shootability: "shootable",
  summary: "Walk through the root gateway into the darker mouth.",
  route: "Advance along the forest path.",
  threshold: "The dark root-mouth opening.",
  camera: "Track forward along the path.",
  parallax: "Near trunks.",
  transitionStrategy: "Pass through the visible gateway.",
  segmentPromptAddition: "Track forward through the visible opening.",
  pace: "fast",
  setConsistency: 87,
  traversalConfidence: 74,
  concerns: [],
};

function planFor(id: "A-B" | "B-C"): SegmentMotionPlan {
  const token = id === "A-B" ? "a" : "c";
  return {
    cinematographer: { ...assessment, summary: `${id} choreography.` },
    startCanonicalMediaId: id === "A-B" ? TRUSTED_MEDIA_IDS.forestAtoFA : TRUSTED_MEDIA_IDS.forestAtoFB,
    endCanonicalMediaId: id === "A-B" ? TRUSTED_MEDIA_IDS.forestAtoFB : TRUSTED_MEDIA_IDS.forestAtoFC,
    startShootingFrame: {
      mediaId: `upload-${token.repeat(32)}`,
      imageUrl: `/${id}-start.png`,
    },
    endShootingFrame: {
      mediaId: `upload-${"b".repeat(32)}`,
      imageUrl: `/${id}-end.png`,
    },
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
    effectivePrompt: assessment.segmentPromptAddition,
    pace: "fast",
  };
}

describe("per-segment Motion Plan", () => {
  it("stores CM + Camotion on one JourneyShot and leaves neighbors untouched", () => {
    const forest = createForestProject();
    const ab = planFor("A-B");
    const bc = planFor("B-C");
    const withAB = projectWithMotionPlan(forest, "A-B", ab);
    const withBoth = projectWithMotionPlan(withAB, "B-C", bc);
    expect(withBoth.journeys.find((journey) => journey.id === "A-B")?.motionPlan?.cinematographer.summary).toBe(
      "A-B choreography.",
    );
    expect(withBoth.journeys.find((journey) => journey.id === "B-C")?.motionPlan?.cinematographer.summary).toBe(
      "B-C choreography.",
    );
    expect(withBoth.destinations).toEqual(forest.destinations);
    expect(withBoth.journeys.find((journey) => journey.id === "C-D")?.motionPlan).toBeUndefined();
    expect(motionPlanAutoKey(forest)).toContain(
      `A-B:${TRUSTED_MEDIA_IDS.forestAtoFA}:${TRUSTED_MEDIA_IDS.forestAtoFB}:needed`,
    );
    expect(motionPlanAutoKey(withAB)).toContain(
      `A-B:${TRUSTED_MEDIA_IDS.forestAtoFA}:${TRUSTED_MEDIA_IDS.forestAtoFB}:planned`,
    );
    expect(motionPlanAutoKey(withAB)).not.toBe(motionPlanAutoKey(forest));
    expect(withAB.journeys.find((journey) => journey.id === "A-B")?.motionPlan).toMatchObject({
      startCanonicalMediaId: TRUSTED_MEDIA_IDS.forestAtoFA,
      endCanonicalMediaId: TRUSTED_MEDIA_IDS.forestAtoFB,
    });
  });

  it("restaging A→B clears only A→B footage", () => {
    const forest = createForestProject();
    const shot = projectWithJourneyShotTake(forest, "A-B", {
      take: {
        startShootingFrame: planFor("A-B").startShootingFrame,
        endShootingFrame: planFor("A-B").endShootingFrame,
        startPlan: planFor("A-B").startPlan,
        endPlan: planFor("A-B").endPlan,
        segmentPromptAddition: assessment.segmentPromptAddition,
        effectivePrompt: assessment.segmentPromptAddition,
        pace: "fast",
        provider: "replicate",
        model: "prunaai/p-video",
        modelVersion: "test",
        durationSeconds: 6,
        videoInputs: { startShootingFrame: true, endShootingFrame: true },
      },
      videoUrl: "/a-b.mp4",
    });
    const withBC = projectWithMotionPlan(shot, "B-C", planFor("B-C"));
    expect(withBC.journeys.find((journey) => journey.id === "B-C")?.videoUrl).toBeUndefined();
    const restaged = projectWithMotionPlan(withBC, "A-B", planFor("A-B"));
    expect(restaged.journeys.find((journey) => journey.id === "A-B")?.take).toBeUndefined();
    expect(restaged.journeys.find((journey) => journey.id === "A-B")?.videoUrl).toBeUndefined();
    expect(restaged.journeys.find((journey) => journey.id === "A-B")?.status).toBe("ready");
    expect(restaged.journeys.find((journey) => journey.id === "B-C")?.motionPlan?.cinematographer.summary).toBe(
      "B-C choreography.",
    );
    expect(restaged.journeys.find((journey) => journey.id === "C-D")?.videoUrl).toBe(forest.journeys[2]?.videoUrl);
  });

  it("does not treat Cinematographer-only choreography as a staged Motion Plan", () => {
    const next = projectWithCinematographerAssessment(createForestProject(), "A-B", assessment);
    expect(next.journeys.find((journey) => journey.id === "A-B")?.cinematographer).toEqual(assessment);
    expect(next.journeys.find((journey) => journey.id === "A-B")?.motionPlan).toBeUndefined();
  });

  it("derives CameraMotionPlan from the same CM travel object", () => {
    const request = motionPlanStageRequestFromAssessment("A-B", "upload-a", "upload-b", {
      ...assessment,
      travel: {
        start: {
          vanishingPoint: [0.62, 0.41],
          destinationPoint: [0.62, 0.41],
          label: "corridor mouth left of center",
        },
        end: {
          vanishingPoint: [0.71, 0.36],
          destinationPoint: [0.71, 0.36],
          label: "corridor vanishing after the bend",
        },
        direction: "forward through the left-of-center opening as the corridor bends right",
        confidence: "high",
      },
    });
    expect(request.segmentPromptAddition).toBe(assessment.segmentPromptAddition);
    expect(request.startPlan?.camera.vanishing_point).toEqual([0.62, 0.41]);
    expect(request.endPlan?.camera.vanishing_point).toEqual([0.71, 0.36]);
    expect(request.startPlan?.camera.forward).toBe(1);
    expect(request.endPlan?.exposure.strength).toBe(0.08);
  });
});
