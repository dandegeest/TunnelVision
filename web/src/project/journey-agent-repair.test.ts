import { describe, expect, it } from "vitest";
import { projectWithCinematographerAssessment } from "./cinematographer";
import { projectWithConstructedDestination, projectWithGeneratedOpeningFrame } from "./destination";
import {
  JOURNEY_AGENT_REPAIR_THRESHOLDS,
  assertCanonicalRepairAllowed,
  canonicalPairNeedsRepair,
  canonicalRepairBlockReason,
  canonicalRepairPlanFromAssessment,
  canonicalRepairRole,
  destinationHasDependentTakes,
  formatCanonicalRepairActivity,
  formatCanonicalRepairCompleteActivity,
  oppositeCanonicalMediaId,
} from "./journey-agent-repair";
import { projectWithMotionPlan } from "./motion-plan";
import { createNewProject } from "./new-project";
import { projectWithJourneyShotTake } from "./shoot";
import { projectWithDirectorPlan } from "./storyboard";
import type { CinematographerAssessment, JourneyShotTake, SegmentMotionPlan } from "./types";

const MEDIA = {
  A: { mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", imageUrl: "/a.png" },
  B: { mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", imageUrl: "/b.png" },
} as const;

const assessment: CinematographerAssessment = {
  shootability: "shootable",
  summary: "Keep the camera on the visible corridor.",
  route: "Advance through the opening.",
  threshold: "The doorway.",
  camera: "Track forward.",
  parallax: "Near walls.",
  transitionStrategy: "Pass through the opening.",
  segmentPromptAddition: "Track forward through the opening.",
  pace: "fast",
  setConsistency: 90,
  traversalConfidence: 80,
  concerns: [],
};

const take: JourneyShotTake = {
  startShootingFrame: { mediaId: MEDIA.A.mediaId, imageUrl: "/a-prime.png" },
  endShootingFrame: { mediaId: MEDIA.B.mediaId, imageUrl: "/b-prime.png" },
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

function generatedPair() {
  const opening = projectWithGeneratedOpeningFrame(
    { ...createNewProject(), story: "Travel forward through connected interior volumes." },
    MEDIA.A,
  );
  const planned = projectWithDirectorPlan(opening, {
    summary: "One move.",
    beats: [{ id: "B", intent: "Enter the next volume.", visualDescription: "A continuing corridor." }],
  });
  return projectWithConstructedDestination(planned, { beatId: "B", ...MEDIA.B });
}

describe("JourneyAgent repair thresholds", () => {
  it("treats Set Consistency below 60 as a repair candidate", () => {
    expect(JOURNEY_AGENT_REPAIR_THRESHOLDS.setConsistencyBelow).toBe(60);
    expect(canonicalPairNeedsRepair({ setConsistency: 59, traversalConfidence: 80 })).toBe(true);
    expect(canonicalPairNeedsRepair({ setConsistency: 60, traversalConfidence: 80 })).toBe(false);
  });

  it("treats Traversal Confidence below 30 as a repair candidate", () => {
    expect(JOURNEY_AGENT_REPAIR_THRESHOLDS.traversalConfidenceBelow).toBe(30);
    expect(canonicalPairNeedsRepair({ setConsistency: 90, traversalConfidence: 29 })).toBe(true);
    expect(canonicalPairNeedsRepair({ setConsistency: 90, traversalConfidence: 30 })).toBe(false);
  });

  it("lets a good pair skip repair", () => {
    expect(canonicalPairNeedsRepair({ setConsistency: 90, traversalConfidence: 80 })).toBe(false);
  });
});

describe("CM repair target", () => {
  it("always plans a repair of the new END canonical", () => {
    const project = generatedPair();
    const journey = project.journeys[0]!;
    expect(
      canonicalRepairPlanFromAssessment(project, journey, {
        ...assessment,
        setConsistency: 25,
        repairRecommendation: "RESHOOT_START",
        repairInstruction: "Start does not establish a plausible route toward end.",
      })?.destinationIds,
    ).toEqual(["B"]);
    expect(
      canonicalRepairPlanFromAssessment(project, journey, {
        ...assessment,
        setConsistency: 25,
        repairRecommendation: "RESHOOT_END",
        repairInstruction: "End contradicts the visible space established by start.",
      })?.destinationIds,
    ).toEqual(["B"]);
    expect(
      canonicalRepairPlanFromAssessment(project, journey, {
        ...assessment,
        traversalConfidence: 10,
        repairRecommendation: "RESHOOT_BOTH",
        repairInstruction: "Neither endpoint can anchor the traversal.",
      }),
    ).toMatchObject({ recommendation: "RESHOOT_END", destinationIds: ["B"] });
  });

  it("falls back to an unprotected generated END when scores trip and CM says SHOOT", () => {
    const project = generatedPair();
    const plan = canonicalRepairPlanFromAssessment(project, project.journeys[0]!, {
      ...assessment,
      setConsistency: 25,
      repairRecommendation: "SHOOT",
    });
    expect(plan?.recommendation).toBe("RESHOOT_END");
    expect(plan?.destinationIds).toEqual(["B"]);
  });
});

describe("canonical repair protection", () => {
  it("blocks filmmaker-supplied canonicals", () => {
    const planned = projectWithDirectorPlan(
      {
        ...createNewProject(),
        story: "Travel forward through connected interior volumes.",
        storyboard: [
          {
            id: "A",
            label: "A",
            imageOrigin: "user",
            image: MEDIA.A.imageUrl,
            mediaId: MEDIA.A.mediaId,
            destinationId: "A",
          },
        ],
      },
      {
        summary: "One move.",
        beats: [{ id: "B", intent: "Enter the next volume.", visualDescription: "A continuing corridor." }],
      },
    );
    const project = projectWithConstructedDestination(planned, { beatId: "B", ...MEDIA.B });
    expect(canonicalRepairBlockReason(project, "A")).toMatch(/filmmaker-supplied/i);
    expect(() => assertCanonicalRepairAllowed(project, ["A"])).toThrow(/filmmaker-supplied/i);
    expect(canonicalRepairBlockReason(project, "B")).toBeUndefined();
  });

  it("blocks a canonical that already has dependent Takes", () => {
    const constructed = generatedPair();
    const assessed = projectWithCinematographerAssessment(constructed, "A-B", assessment);
    const staged = projectWithMotionPlan(assessed, "A-B", {
      cinematographer: assessment,
      startCanonicalMediaId: MEDIA.A.mediaId,
      endCanonicalMediaId: MEDIA.B.mediaId,
      startShootingFrame: take.startShootingFrame,
      endShootingFrame: take.endShootingFrame,
      startPlan: take.startPlan,
      endPlan: take.endPlan,
      segmentPromptAddition: assessment.segmentPromptAddition,
      effectivePrompt: take.effectivePrompt,
      pace: assessment.pace,
    } satisfies SegmentMotionPlan);
    const withTake = projectWithJourneyShotTake(staged, "A-B", {
      take,
      videoUrl: "https://example.test/A-B.mp4",
    });
    expect(destinationHasDependentTakes(withTake, "B")).toBe(true);
    expect(canonicalRepairBlockReason(withTake, "B")).toMatch(/Takes depend/i);
  });

  it("uses the opposite canonical as the spatial reference", () => {
    const project = generatedPair();
    const journey = project.journeys[0]!;
    expect(canonicalRepairRole(journey, "A")).toBe("start");
    expect(canonicalRepairRole(journey, "B")).toBe("end");
    expect(oppositeCanonicalMediaId(project, journey, "A")).toBe(MEDIA.B.mediaId);
    expect(oppositeCanonicalMediaId(project, journey, "B")).toBe(MEDIA.A.mediaId);
  });
});

describe("repair activity copy", () => {
  it("includes before scores, then after scores on complete", () => {
    expect(
      formatCanonicalRepairActivity({
        destinationIds: ["D"],
        journeyId: "C-D",
        setConsistency: 25,
        traversalConfidence: 45,
        instruction: "The space beyond C contradicts the immediate environment established by D.",
      }),
    ).toMatch(/RESHOOT · D/);
    expect(
      formatCanonicalRepairCompleteActivity({
        destinationIds: ["D"],
        beforeSetConsistency: 25,
        beforeTraversalConfidence: 45,
        afterSetConsistency: 72,
        afterTraversalConfidence: 68,
      }),
    ).toBe("RESHOOT COMPLETE · D Set Consistency 25 → 72 Traversal Confidence 45 → 68");
  });
});
