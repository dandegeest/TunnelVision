import { describe, expect, it } from "vitest";
import { projectWithCinematographerAssessment } from "./cinematographer";
import { projectWithMotionPlan } from "./motion-plan";
import { createNewProject } from "./new-project";
import { hydrateProject, serializeProjectDocuments } from "./persistence/serialize";
import { projectWithSyncedProductionLegs } from "./production-legs";
import { shootRequestFromProject } from "./shoot";
import { journeyClipDurationSeconds } from "./takes";
import {
  actualDurationSecondsForModel,
  durationModeFromProject,
  fixedDurationSecondsFromProject,
  projectWithDurationMode,
  projectWithFixedDurationSeconds,
  intentDurationSeconds,
  requestedDurationSeconds,
  targetDurationSeconds,
} from "./shot-duration";
import { layoutShootTimeline } from "../timeline/shoot-layout";
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
  desiredDurationSeconds: 7,
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
  durationSeconds: 10,
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

describe("shot duration", () => {
  it("keeps pace as camera speed while Adaptive uses CM desired duration", () => {
    const prepared = projectWithMotionPlan(
      projectWithCinematographerAssessment(projectWithLeg(), "A-B", assessment),
      "A-B",
      motionPlan,
    );
    expect(prepared.journeys[0]?.cinematographer?.pace).toBe("fast");
    expect(prepared.journeys[0]?.cinematographer?.desiredDurationSeconds).toBe(7);
    expect(prepared.journeys[0]?.durationSeconds).toBe(7);
    const request = shootRequestFromProject(prepared, "A-B");
    expect(request.pace).toBe("fast");
    expect(request.targetDurationSeconds).toBe(7);
    expect(actualDurationSecondsForModel(prepared, "pruna-p-video", prepared.journeys[0])).toBe(7);
    expect(actualDurationSecondsForModel(prepared, "kling-v2.5-turbo-pro", prepared.journeys[0])).toBe(5);
    expect(actualDurationSecondsForModel(prepared, "veo-3.1-fast", prepared.journeys[0])).toBe(6);
  });

  it("lets a filmmaker duration lock beat Adaptive CM and Fixed project duration", () => {
    const prepared = projectWithCinematographerAssessment(projectWithLeg(), "A-B", assessment);
    const locked = {
      ...prepared,
      journeys: prepared.journeys.map((journey) =>
        journey.id === "A-B" ? { ...journey, filmmakerDurationSeconds: 12 } : journey,
      ),
    };
    expect(targetDurationSeconds(locked, locked.journeys[0], "pruna-p-video")).toBe(12);
    expect(intentDurationSeconds(locked, locked.journeys[0])).toBe(12);
    const fixed = { ...locked, durationMode: "fixed" as const, fixedDurationSeconds: 5 };
    expect(targetDurationSeconds(fixed, fixed.journeys[0], "pruna-p-video")).toBe(12);
  });

  it("uses a 5s product base when Adaptive has no CM desired duration", () => {
    const prepared = projectWithLeg();
    expect(targetDurationSeconds(prepared, prepared.journeys[0], "pruna-p-video")).toBe(5);
    expect(actualDurationSecondsForModel(prepared, "pruna-p-video", prepared.journeys[0])).toBe(5);
    expect(actualDurationSecondsForModel(prepared, "kling-v2.5-turbo-pro", prepared.journeys[0])).toBe(5);
    expect(actualDurationSecondsForModel(prepared, "veo-3.1-fast", prepared.journeys[0])).toBe(6);
  });

  it("uses fixedDurationSeconds in Fixed mode without overwriting CM desired duration", () => {
    const prepared = projectWithMotionPlan(
      projectWithCinematographerAssessment(projectWithLeg(), "A-B", assessment),
      "A-B",
      motionPlan,
    );
    const fixed = projectWithFixedDurationSeconds(projectWithDurationMode(prepared, "fixed"), 5);
    expect(fixed.journeys[0]?.cinematographer?.desiredDurationSeconds).toBe(7);
    expect(fixed.journeys[0]?.cinematographer?.pace).toBe("fast");
    expect(fixed.journeys[0]?.durationSeconds).toBe(5);
    const request = shootRequestFromProject(fixed, "A-B");
    expect(request.pace).toBe("fast");
    expect(request.targetDurationSeconds).toBe(5);
    expect(targetDurationSeconds(fixed, fixed.journeys[0], "pruna-p-video")).toBe(5);
    expect(actualDurationSecondsForModel(fixed, "veo-3.1-fast", fixed.journeys[0])).toBe(6);
  });

  it("retries remapping from the original target, not the previous actual clip", () => {
    const adaptive = projectWithMotionPlan(
      projectWithCinematographerAssessment(projectWithLeg(), "A-B", assessment),
      "A-B",
      motionPlan,
    );
    const afterTake = {
      ...adaptive,
      journeys: adaptive.journeys.map((journey) =>
        journey.id === "A-B"
          ? { ...journey, durationSeconds: 10, take: { ...take, durationSeconds: 10 }, takes: [{ ...take, durationSeconds: 10 }] }
          : journey,
      ),
    };
    const adaptiveRetry = shootRequestFromProject(
      {
        ...afterTake,
        videoModelsByIntent: {
          fast: "pruna-p-video",
          balanced: "kling-v2.5-turbo-pro",
          quality: "veo-3.1-fast",
        },
      },
      "A-B",
      "quality",
    );
    expect(adaptiveRetry.pace).toBe("fast");
    expect(adaptiveRetry.targetDurationSeconds).toBe(7);
    expect(actualDurationSecondsForModel(afterTake, "veo-3.1-fast", afterTake.journeys[0])).toBe(6);
    expect(actualDurationSecondsForModel(afterTake, "kling-v3-video", afterTake.journeys[0])).toBe(7);

    const fixed = projectWithFixedDurationSeconds(projectWithDurationMode(afterTake, "fixed"), 5);
    const fixedRetry = shootRequestFromProject(
      {
        ...fixed,
        videoModelsByIntent: {
          fast: "pruna-p-video",
          balanced: "kling-v2.5-turbo-pro",
          quality: "veo-3.1-fast",
        },
      },
      "A-B",
      "quality",
    );
    expect(fixed.journeys[0]?.cinematographer?.desiredDurationSeconds).toBe(7);
    expect(fixedRetry.targetDurationSeconds).toBe(5);
    expect(actualDurationSecondsForModel(fixed, "veo-3.1-fast", fixed.journeys[0])).toBe(6);
    expect(actualDurationSecondsForModel(fixed, "kling-v2.5-turbo-pro", fixed.journeys[0])).toBe(5);
  });

  it("persists duration settings and CM desired duration across reload", () => {
    const prepared = projectWithCinematographerAssessment(
      projectWithFixedDurationSeconds(projectWithDurationMode(projectWithLeg(), "fixed"), 5),
      "A-B",
      assessment,
    );
    const documents = serializeProjectDocuments({ project: prepared });
    expect(documents.manifest.settings.durationMode).toBe("fixed");
    expect(documents.manifest.settings.fixedDurationSeconds).toBe(5);
    const traversal = documents.traversals["A-B"] as { cinematographer?: CinematographerAssessment };
    expect(traversal.cinematographer?.desiredDurationSeconds).toBe(7);
    expect(traversal.cinematographer?.pace).toBe("fast");

    const present = new Set(documents.mediaCopies.map((item) => item.relativePath));
    const hydrated = hydrateProject({
      manifest: documents.manifest,
      canonicals: documents.canonicals,
      traversals: documents.traversals,
      assetExists: (relative) => present.has(relative),
    });
    expect(durationModeFromProject(hydrated.project)).toBe("fixed");
    expect(fixedDurationSecondsFromProject(hydrated.project)).toBe(5);
    expect(hydrated.project.journeys[0]?.cinematographer?.desiredDurationSeconds).toBe(7);
    expect(hydrated.project.journeys[0]?.cinematographer?.pace).toBe("fast");
  });

  it("infers Adaptive and 5s for projects that predate duration settings", () => {
    const project = projectWithLeg();
    const legacy: Project = { ...project };
    delete legacy.durationMode;
    delete legacy.fixedDurationSeconds;
    expect(durationModeFromProject(legacy)).toBe("adaptive");
    expect(fixedDurationSecondsFromProject(legacy)).toBe(5);
    const documents = serializeProjectDocuments({ project: legacy });
    const settings = { ...documents.manifest.settings };
    delete settings.durationMode;
    delete settings.fixedDurationSeconds;
    const hydrated = hydrateProject({
      manifest: { ...documents.manifest, settings },
      canonicals: documents.canonicals,
      traversals: documents.traversals,
      assetExists: () => true,
    });
    expect(hydrated.project.durationMode).toBe("adaptive");
    expect(hydrated.project.fixedDurationSeconds).toBe(5);
  });

  it("records the model-resolved duration on the take and leaves CM desired intact", () => {
    const prepared = projectWithMotionPlan(
      projectWithCinematographerAssessment(projectWithLeg(), "A-B", assessment),
      "A-B",
      motionPlan,
    );
    const rendered = {
      ...prepared,
      journeys: prepared.journeys.map((journey) =>
        journey.id === "A-B"
          ? {
              ...journey,
              durationSeconds: 10,
              take: { ...take, durationSeconds: 10 },
              takes: [{ ...take, durationSeconds: 10 }],
            }
          : journey,
      ),
    };
    expect(rendered.journeys[0]?.take?.durationSeconds).toBe(10);
    expect(rendered.journeys[0]?.cinematographer?.desiredDurationSeconds).toBe(7);
    expect(shootRequestFromProject(rendered, "A-B").targetDurationSeconds).toBe(7);
  });

  it("maps Pruna desired 15 to 15 and Kling desired 8 to 10", () => {
    const prepared = projectWithCinematographerAssessment(projectWithLeg(), "A-B", {
      ...assessment,
      desiredDurationSeconds: 15,
    });
    expect(requestedDurationSeconds(prepared, prepared.journeys[0], "fast")).toBe(15);
    const eight = projectWithCinematographerAssessment(projectWithLeg(), "A-B", {
      ...assessment,
      desiredDurationSeconds: 8,
    });
    expect(requestedDurationSeconds(eight, eight.journeys[0], "balanced")).toBe(10);
    expect(actualDurationSecondsForModel(eight, "kling-v2.5-turbo-pro", eight.journeys[0])).toBe(10);
  });

  it("sizes unshot timeline bars to the mapped request, not the catalog default", () => {
    const stale = {
      ...projectWithCinematographerAssessment(projectWithLeg(), "A-B", {
        ...assessment,
        desiredDurationSeconds: 8,
      }),
      defaultTakeIntent: "balanced" as const,
      videoModelsByIntent: {
        fast: "pruna-p-video" as const,
        balanced: "kling-v2.5-turbo-pro" as const,
        quality: "veo-3.1-fast" as const,
      },
    };
    stale.journeys = stale.journeys.map((journey) => ({ ...journey, durationSeconds: 5 }));
    expect(journeyClipDurationSeconds(stale, stale.journeys[0]!)).toBe(10);
    const layout = layoutShootTimeline(stale, 1);
    expect(layout.journeys[0]?.endTime - layout.journeys[0]?.startTime).toBe(10);
    expect(layout.journeys[0]?.width).toBe(10 * 38);
  });
});
