import { describe, expect, it } from "vitest";
import { CAMOTION_EXPOSURE_STRENGTH_BY_PACE } from "../../../media/src/cinematographer/camera-motion-plan.ts";
import { LOCOMOTION_PACES } from "../../../media/src/cinematographer/shooting-prompt.ts";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { layoutTimeline } from "../timeline/geometry";
import {
  camotionDirectionLabel,
  camotionInspectorHeading,
  camotionRecordKey,
  camotionRecordsForCanonical,
  camotionRecordsForDestination,
  camotionSourceLabel,
  formatExposureStrength,
  formatPlanPoint,
  preferredCamotionRecord,
} from "./camotion-diagnostics";
import { projectWithJourneyShotTake } from "./shoot";
import { TRUSTED_MEDIA_IDS } from "./trusted-media-id";
import type { JourneyShotTake } from "./types";

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
    camera: { vanishing_point: [0.4, 0.6], forward: 1 },
    destination: { point: [0.4, 0.6], protect: false, bbox: [0.1, 0.1, 0.9, 0.9] },
    exposure: { strength: 0.04, samples: 16 },
  },
  segmentPromptAddition: "Track forward.",
  effectivePrompt: "Track forward.",
  pace: "fast",
  provider: "replicate",
  model: "prunaai/p-video",
  modelVersion: "test",
  durationSeconds: 6,
  videoInputs: { startShootingFrame: true, endShootingFrame: true },
};

describe("Camotion destination diagnostics", () => {
  it("reads take evidence for the selected occurrence and does not invent records", () => {
    const forest = createForestProject();
    const opening = layoutTimeline(forest.destinations, forest.journeys, 1).occurrences[0]!;
    expect(
      camotionRecordsForDestination(forest, "A", opening.inboundJourneyId, opening.outboundJourneyId),
    ).toEqual([]);
    const shot = projectWithJourneyShotTake(forest, "A-B", { take, videoUrl: "/a-b.mp4" });
    const laid = layoutTimeline(shot.destinations, shot.journeys, 1);
    const a = laid.occurrences[0]!;
    const b = laid.occurrences[1]!;
    expect(camotionRecordsForCanonical(shot, "A").map((record) => camotionRecordKey(record))).toEqual([
      "A-B:start",
    ]);
    const fromA = camotionRecordsForDestination(shot, "A", a.inboundJourneyId, a.outboundJourneyId);
    expect(fromA).toHaveLength(1);
    expect(fromA[0]).toMatchObject({
      primedLabel: "A′",
      journeyId: "A-B",
      role: "start",
      shootingFrame: take.startShootingFrame,
      plan: take.startPlan,
    });
    const fromB = camotionRecordsForDestination(shot, "B", b.inboundJourneyId, b.outboundJourneyId);
    expect(fromB.map((record) => camotionRecordKey(record))).toEqual(["A-B:end"]);
    expect(fromB[0]?.plan.exposure.strength).toBe(0.04);
    expect(camotionSourceLabel(fromB[0]!)).toBe("A-B end′");
    expect(preferredCamotionRecord(fromA)?.role).toBe("start");
    expect(
      camotionInspectorHeading(fromA[0]!, shot.destinations, "A", "B"),
    ).toBe("A′ · A→B START");
    expect(camotionDirectionLabel(fromA[0]!)).toBe("Forward");
  });

  it("keeps inbound end′ and outbound start′ as separate occurrence records", () => {
    const forest = createForestProject();
    const withAB = projectWithJourneyShotTake(forest, "A-B", { take, videoUrl: "/a-b.mp4" });
    const withBoth = projectWithJourneyShotTake(withAB, "B-C", {
      take: {
        ...take,
        startShootingFrame: { mediaId: "upload-cccccccccccccccccccccccccccccccc", imageUrl: "/b-from-bc.png" },
        startPlan: {
          ...take.startPlan,
          camera: { vanishing_point: [0.3, 0.3], forward: 1 },
          exposure: { strength: 0.02, samples: 16 },
        },
      },
      videoUrl: "/b-c.mp4",
    });
    const b = layoutTimeline(withBoth.destinations, withBoth.journeys, 1).occurrences[1]!;
    const fromB = camotionRecordsForDestination(withBoth, "B", b.inboundJourneyId, b.outboundJourneyId);
    expect(fromB.map((record) => camotionRecordKey(record))).toEqual(["A-B:end", "B-C:start"]);
    expect(preferredCamotionRecord(fromB)?.journeyId).toBe("B-C");
    expect(preferredCamotionRecord(fromB)?.plan.exposure.strength).toBe(0.02);
  });

  it("labels stored exposure strengths without changing them", () => {
    const labels = {
      "slow-motion": "0.015 · Slow-motion",
      slow: "0.025 · Slow",
      moderate: "0.040 · Moderate",
      fast: "0.060 · Fast",
      hyperspeed: "0.080 · Hyperspeed",
      variable: "0.040 · Moderate",
    } as const;
    for (const pace of LOCOMOTION_PACES) {
      expect(formatExposureStrength(CAMOTION_EXPOSURE_STRENGTH_BY_PACE[pace])).toBe(labels[pace]);
    }
    expect(formatExposureStrength(0.02)).toBe("0.02 · Light");
    expect(formatPlanPoint([0.5, 0.5])).toBe("0.50, 0.50");
  });

  it("reads Motion Plan A′/B′ before a take exists", () => {
    const forest = createForestProject();
    const staged = {
      ...forest,
      journeys: forest.journeys.map((journey) =>
        journey.id === "A-B"
          ? {
              ...journey,
              status: "ready" as const,
              videoUrl: undefined,
              motionPlan: {
                cinematographer: {
                  shootability: "shootable" as const,
                  summary: "Forward.",
                  route: "Forward.",
                  threshold: "Opening.",
                  camera: "Track.",
                  parallax: "Trunks.",
                  transitionStrategy: "Pass through.",
                  segmentPromptAddition: "Track forward.",
                  pace: "fast" as const,
                  setConsistency: 87,
                  traversalConfidence: 74,
                  concerns: [],
                },
                startCanonicalMediaId: TRUSTED_MEDIA_IDS.forestAtoFA,
                endCanonicalMediaId: TRUSTED_MEDIA_IDS.forestAtoFB,
                startShootingFrame: take.startShootingFrame,
                endShootingFrame: take.endShootingFrame,
                startPlan: take.startPlan,
                endPlan: take.endPlan,
                segmentPromptAddition: "Track forward.",
                effectivePrompt: "Track forward.",
                pace: "fast" as const,
              },
            }
          : journey,
      ),
    };
    const a = layoutTimeline(staged.destinations, staged.journeys, 1).occurrences[0]!;
    const fromA = camotionRecordsForDestination(staged, "A", a.inboundJourneyId, a.outboundJourneyId);
    expect(fromA).toHaveLength(1);
    expect(fromA[0]?.shootingFrame).toEqual(take.startShootingFrame);
  });
});
