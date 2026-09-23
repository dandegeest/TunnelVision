import { afterEach, describe, expect, it, vi } from "vitest";
import { CAMOTION_EXPOSURE_STRENGTH_BY_PACE } from "../../../media/src/cinematographer/camera-motion-plan.ts";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { createNewProject } from "./new-project";
import {
  adaptivePaceFromProject,
  journeyPaceIsCurrent,
  projectWithAdaptivePace,
  projectWithInvalidatedStalePaceMotionPlans,
  projectWithJourneyPace,
  projectWithStory,
} from "./adaptive-pace";
import {
  cinematographerRequestFromProject,
  ensureProjectJourneyPace,
  projectWithCinematographerAssessment,
  requestJourneyPace,
} from "./cinematographer";
import { effectiveJourneyPace } from "./journey-overrides";
import { motionPlanRequestFromProject, motionPlanStageRequestFromAssessment, projectWithMotionPlan } from "./motion-plan";
import { hydrateProject, serializeProjectDocuments } from "./persistence/serialize";
import type { CinematographerAssessment, Project, SegmentMotionPlan } from "./types";

const assessment = (pace: CinematographerAssessment["pace"], extras?: Partial<CinematographerAssessment>): CinematographerAssessment => ({
  shootability: "shootable",
  setConsistency: 80,
  traversalConfidence: 70,
  summary: "Track forward.",
  route: "Along the path.",
  threshold: "The opening.",
  camera: "Forward.",
  parallax: "Trunks.",
  transitionStrategy: "Pass through.",
  segmentPromptAddition: "Track forward through the opening.",
  pace,
  travel: {
    confidence: "high",
    direction: "forward through the opening",
  },
  concerns: [],
  ...extras,
});

const PLAN: SegmentMotionPlan["startPlan"] = {
  version: 1,
  camera: { vanishing_point: [0.5, 0.5], forward: 1 },
  destination: { point: [0.5, 0.5], protect: true, bbox: [0.25, 0.2, 0.75, 0.8] },
  exposure: { strength: 0.06, samples: 16 },
};

function withMotionPlan(project: Project, journeyId: string, pace: CinematographerAssessment["pace"]): Project {
  const journey = project.journeys.find((item) => item.id === journeyId);
  const cm = journey?.cinematographer ?? assessment(pace);
  return projectWithMotionPlan(project, journeyId, {
    cinematographer: cm,
    startCanonicalMediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    endCanonicalMediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    startShootingFrame: { mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", imageUrl: "/a.png" },
    endShootingFrame: { mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", imageUrl: "/b.png" },
    startPlan: PLAN,
    endPlan: PLAN,
    segmentPromptAddition: cm.segmentPromptAddition,
    effectivePrompt: cm.segmentPromptAddition,
    pace,
  });
}

function assessedForest(): Project {
  let project = createForestProject();
  project = projectWithCinematographerAssessment(project, "A-B", assessment("fast", { setConsistency: 91 }));
  project = projectWithCinematographerAssessment(project, "B-C", assessment("slow", { setConsistency: 64, traversalConfidence: 55 }));
  project = projectWithCinematographerAssessment(project, "C-D", assessment("hyperspeed", { setConsistency: 72 }));
  return project;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Adaptive Pace", () => {
  it("defaults and hydrates missing fields as Adaptive ON", () => {
    const created = createNewProject();
    expect(created.adaptivePace).toBe(true);
    expect(adaptivePaceFromProject(created)).toBe(true);
    expect(adaptivePaceFromProject({})).toBe(true);
    const legacy = createForestProject();
    expect(legacy.adaptivePace).toBeUndefined();
    expect(adaptivePaceFromProject(legacy)).toBe(true);
    expect(journeyPaceIsCurrent(legacy)).toBe(false);
    const documents = serializeProjectDocuments({ project: createNewProject() });
    expect(documents.manifest.settings.adaptivePace).toBe(true);
    expect(documents.manifest.settings.journeyPace).toBeUndefined();
    const settings = { ...documents.manifest.settings };
    delete settings.adaptivePace;
    delete settings.journeyPace;
    delete settings.journeyPaceStory;
    const hydrated = hydrateProject({
      manifest: { ...documents.manifest, settings },
      canonicals: documents.canonicals,
      traversals: documents.traversals,
      assetExists: () => false,
    });
    expect(adaptivePaceFromProject(hydrated.project)).toBe(true);
    expect(hydrated.project.journeyPace).toBeUndefined();
  });

  it("keeps independent per-segment CM paces when Adaptive Pace is ON", () => {
    const project = assessedForest();
    expect(effectiveJourneyPace(project.journeys[0]!, project)).toBe("fast");
    expect(effectiveJourneyPace(project.journeys[1]!, project)).toBe("slow");
    expect(effectiveJourneyPace(project.journeys[2]!, project)).toBe("hyperspeed");
    expect(cinematographerRequestFromProject(project, "B-C").journeyPace).toBeUndefined();
    expect(cinematographerRequestFromProject(project, "B-C").filmmakerPace).toBeUndefined();
  });

  it("asks CM for one journey pace when Adaptive Pace is OFF and persists it", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ pace: "slow" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const off = projectWithAdaptivePace(assessedForest(), false);
    expect(off.adaptivePace).toBe(false);
    expect(journeyPaceIsCurrent(off)).toBe(false);
    const chosen = await ensureProjectJourneyPace(off);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cinematographer/journey-pace",
      expect.objectContaining({ method: "POST" }),
    );
    expect(chosen.journeyPace).toBe("slow");
    expect(chosen.journeyPaceStory).toBe(chosen.story.trim());
    expect(journeyPaceIsCurrent(chosen)).toBe(true);
    const documents = serializeProjectDocuments({ project: chosen });
    expect(documents.manifest.settings.adaptivePace).toBe(false);
    expect(documents.manifest.settings.journeyPace).toBe("slow");
    const hydrated = hydrateProject({
      manifest: documents.manifest,
      canonicals: documents.canonicals,
      traversals: documents.traversals,
      assetExists: () => false,
    });
    expect(hydrated.project.adaptivePace).toBe(false);
    expect(hydrated.project.journeyPace).toBe("slow");
    const again = await ensureProjectJourneyPace(chosen);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(again.journeyPace).toBe("slow");
    const direct = await requestJourneyPace({ story: chosen.story });
    expect(direct.pace).toBe("slow");
  });

  it("uses the same journey pace for every segment when OFF and still stores independent SC / travel", () => {
    const project = projectWithJourneyPace(assessedForest(), "moderate");
    expect(cinematographerRequestFromProject(project, "A-B")).toMatchObject({ journeyPace: "moderate" });
    expect(cinematographerRequestFromProject(project, "B-C")).toMatchObject({ journeyPace: "moderate" });
    expect(cinematographerRequestFromProject(project, "C-D")).toMatchObject({ journeyPace: "moderate" });
    for (const journey of project.journeys.filter((item) => item.endDestinationId && item.cinematographer)) {
      expect(effectiveJourneyPace(journey, project)).toBe("moderate");
      expect(journey.cinematographer?.pace).not.toBe("moderate");
      expect(journey.cinematographer?.setConsistency).toBeGreaterThan(0);
      expect(journey.cinematographer?.traversalConfidence).toBeGreaterThan(0);
      expect(journey.cinematographer?.travel?.direction).toBe("forward through the opening");
    }
    expect(project.journeys[0]?.cinematographer?.setConsistency).toBe(91);
    expect(project.journeys[1]?.cinematographer?.setConsistency).toBe(64);
    expect(project.journeys[1]?.cinematographer?.traversalConfidence).toBe(55);
  });

  it("invalidates a stale journey pace when the story changes while OFF", () => {
    const locked = projectWithJourneyPace(assessedForest(), "fast");
    expect(journeyPaceIsCurrent(locked)).toBe(true);
    const edited = projectWithStory(locked, `${locked.story} and then keep descending.`);
    expect(edited.journeyPace).toBeUndefined();
    expect(edited.journeyPaceStory).toBeUndefined();
    expect(journeyPaceIsCurrent(edited)).toBe(false);
    expect(effectiveJourneyPace(edited.journeys[0]!, edited)).toBe("fast");
    expect(effectiveJourneyPace(edited.journeys[1]!, edited)).toBe("slow");
    expect(projectWithStory(locked, locked.story)).toBe(locked);
  });

  it("returns to per-segment pace immediately when switching Adaptive Pace ON", () => {
    const locked = projectWithJourneyPace(assessedForest(), "moderate");
    const on = projectWithAdaptivePace(locked, true);
    expect(adaptivePaceFromProject(on)).toBe(true);
    expect(on.journeyPace).toBeUndefined();
    expect(journeyPaceIsCurrent(on)).toBe(false);
    expect(effectiveJourneyPace(on.journeys[0]!, on)).toBe("fast");
    expect(effectiveJourneyPace(on.journeys[1]!, on)).toBe("slow");
    expect(effectiveJourneyPace(on.journeys[2]!, on)).toBe("hyperspeed");
    expect(cinematographerRequestFromProject(on, "B-C").journeyPace).toBeUndefined();
  });

  it("clears a motion plan whose pace no longer matches the authoritative pace", () => {
    let project = projectWithCinematographerAssessment(createForestProject(), "A-B", assessment("fast"));
    project = withMotionPlan(project, "A-B", "fast");
    expect(project.journeys[0]?.motionPlan?.pace).toBe("fast");
    const locked = projectWithJourneyPace(project, "slow");
    expect(locked.journeys[0]?.motionPlan).toBeUndefined();
    expect(locked.journeys[0]?.cinematographer?.setConsistency).toBe(80);
    const restaged = withMotionPlan(locked, "A-B", "slow");
    expect(restaged.journeys[0]?.motionPlan?.pace).toBe("slow");
    const on = projectWithAdaptivePace(restaged, true);
    expect(on.journeys[0]?.motionPlan).toBeUndefined();
    expect(projectWithInvalidatedStalePaceMotionPlans(restaged).journeys[0]?.motionPlan?.pace).toBe("slow");
  });

  it("maps journey pace through the existing Camotion exposure table", () => {
    expect(CAMOTION_EXPOSURE_STRENGTH_BY_PACE).toEqual({
      "slow-motion": 0.015,
      slow: 0.025,
      moderate: 0.04,
      fast: 0.06,
      hyperspeed: 0.08,
      variable: 0.04,
    });
    const assessed = projectWithCinematographerAssessment(createForestProject(), "A-B", assessment("fast"));
    const locked = projectWithJourneyPace(assessed, "slow");
    const request = motionPlanRequestFromProject(locked, "A-B");
    expect(request.pace).toBe("slow");
    expect(request.startPlan?.exposure.strength).toBe(CAMOTION_EXPOSURE_STRENGTH_BY_PACE.slow);
    expect(request.endPlan?.exposure.strength).toBe(CAMOTION_EXPOSURE_STRENGTH_BY_PACE.slow);
    expect(request.startPlan?.exposure.samples).toBe(16);
    const staged = motionPlanStageRequestFromAssessment("A-B", "upload-a", "upload-b", assessment("fast"), {
      pace: "hyperspeed",
    });
    expect(staged.pace).toBe("hyperspeed");
    expect(staged.startPlan?.exposure.strength).toBe(CAMOTION_EXPOSURE_STRENGTH_BY_PACE.hyperspeed);
  });
});
