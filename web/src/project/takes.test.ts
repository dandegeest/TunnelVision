import { describe, expect, it } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { movieExportPlan } from "./export-movie";
import { createNewProject } from "./new-project";
import { projectWithCinematographerAssessment } from "./cinematographer";
import { projectWithMotionPlan } from "./motion-plan";
import { projectWithSyncedProductionLegs } from "./production-legs";
import {
  projectWithJourneyShotFailed,
  projectWithJourneyShooting,
  projectWithJourneyShotTake,
} from "./shoot";
import {
  journeyTakes,
  projectWithAppendedTake,
  filmedTakeFitsCurrentJourney,
  mergeProjectUpdate,
  projectWithLatestJourneyTakes,
  projectWithSelectedTake,
  selectedTake,
  selectedTakeVideoUrl,
  TAKE_PREVIOUS_CANONICALS_COPY,
  takeCanonicalPair,
  takeClipDurationSeconds,
  takeDisplayLabel,
  takeId,
  takeMatchesCurrentCanonicals,
  takesShareHandoffCanonical,
} from "./takes";
import type { CinematographerAssessment, JourneyShot, JourneyShotTake, Project, SegmentMotionPlan } from "./types";

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

function stagedLeg(): Project {
  return projectWithMotionPlan(projectWithCinematographerAssessment(projectWithLeg(), "A-B", assessment), "A-B", motionPlan);
}

function emptyJourney(): JourneyShot {
  return {
    id: "A-B",
    startDestinationId: "A",
    endDestinationId: "B",
    durationSeconds: 6,
    status: "ready",
  };
}

describe("legacy footage → Take 1", () => {
  it("loads a stored take as Take 1 and selects it", () => {
    const journey: JourneyShot = {
      ...emptyJourney(),
      status: "rendered",
      videoUrl: "https://example.test/legacy-take.mp4",
      take,
    };
    const takes = journeyTakes(journey);
    expect(takes).toHaveLength(1);
    expect(takes[0]?.id).toBe(takeId("A-B", 1));
    expect(takes[0]?.number).toBe(1);
    expect(takes[0]?.videoUrl).toBe("https://example.test/legacy-take.mp4");
    expect(takes[0]?.effectivePrompt).toBe(take.effectivePrompt);
    expect(takes[0]?.provider).toBe("replicate");
    expect(takes[0]?.model).toBe("prunaai/p-video");
    expect(takeCanonicalPair(takes[0]!)).toBeUndefined();
    expect(takeDisplayLabel(takes[0]!)).toBe("TAKE 1");
    expect(selectedTake(journey)?.id).toBe(takeId("A-B", 1));
    expect(selectedTakeVideoUrl(journey)).toBe("https://example.test/legacy-take.mp4");
  });

  it("loads a videoUrl-only fixture as Take 1 without inventing shooting-frame URLs", () => {
    const forest = createForestProject().journeys[0]!;
    const takes = journeyTakes(forest);
    expect(takes).toHaveLength(1);
    expect(takes[0]?.number).toBe(1);
    expect(takes[0]?.videoUrl).toBe(forest.videoUrl);
    expect(takes[0]?.startShootingFrame.imageUrl).toBe("");
    expect(takeCanonicalPair(takes[0]!)).toBeUndefined();
    expect(selectedTake(forest)?.id).toBe(takeId("A-B", 1));
  });

  it("has zero Takes when a segment has never been generated", () => {
    expect(journeyTakes(emptyJourney())).toEqual([]);
    expect(selectedTake(emptyJourney())).toBeUndefined();
    expect(selectedTakeVideoUrl(emptyJourney())).toBeUndefined();
  });
});

describe("NEW TAKE appends rather than replaces", () => {
  it("keeps Take 1 when generating Take 2 and selects the newest", () => {
    const first = projectWithJourneyShotTake(stagedLeg(), "A-B", {
      take,
      videoUrl: "https://example.test/take-1.mp4",
    });
    const second = projectWithAppendedTake(first, "A-B", {
      take: { ...take, durationSeconds: 5, seed: 70 },
      videoUrl: "https://example.test/take-2.mp4",
    });
    const journey = second.journeys[0]!;
    expect(journeyTakes(journey)).toHaveLength(2);
    expect(journey.takes?.[0]?.videoUrl).toBe("https://example.test/take-1.mp4");
    expect(journey.takes?.[0]?.durationSeconds).toBe(6);
    expect(journey.takes?.[1]?.videoUrl).toBe("https://example.test/take-2.mp4");
    expect(journey.takes?.[1]?.durationSeconds).toBe(5);
    expect(journey.takes?.[1]?.seed).toBe(70);
    expect(journey.selectedTakeId).toBe(takeId("A-B", 2));
    expect(journey.videoUrl).toBe("https://example.test/take-2.mp4");
    expect(journey.take?.videoUrl).toBe("https://example.test/take-2.mp4");
    expect(journey.durationSeconds).toBe(5);
    expect(first.journeys[0]?.takes).toHaveLength(1);
    expect(takeCanonicalPair(journey.takes?.[0]!)).toEqual({
      startCanonicalMediaId: motionPlan.startCanonicalMediaId,
      endCanonicalMediaId: motionPlan.endCanonicalMediaId,
    });
    expect(takeCanonicalPair(journey.takes?.[1]!)).toEqual({
      startCanonicalMediaId: motionPlan.startCanonicalMediaId,
      endCanonicalMediaId: motionPlan.endCanonicalMediaId,
    });
  });

  it("keeps existing Takes when a later NEW TAKE fails", () => {
    const rendered = projectWithJourneyShotTake(stagedLeg(), "A-B", {
      take,
      videoUrl: "https://example.test/take-1.mp4",
    });
    const shooting = projectWithJourneyShooting(rendered, "A-B");
    expect(journeyTakes(shooting.journeys[0]!)).toHaveLength(1);
    const failed = projectWithJourneyShotFailed(shooting, "A-B", "provider down");
    expect(failed.journeys[0]?.status).toBe("rendered");
    expect(failed.journeys[0]?.shootError).toBe("provider down");
    expect(journeyTakes(failed.journeys[0]!)).toHaveLength(1);
    expect(failed.journeys[0]?.videoUrl).toBe("https://example.test/take-1.mp4");
  });

  it("reapplies a C-D take that landed while a later destination write used a stale snapshot", () => {
    const forest = createForestProject();
    const filmed = projectWithAppendedTake(forest, "C-D", {
      take,
      videoUrl: "https://replicate.delivery/c-d.mp4",
    });
    const stale = {
      ...filmed,
      journeys: filmed.journeys.map((journey) =>
        journey.id === "C-D"
          ? {
              ...journey,
              takes: undefined,
              take: undefined,
              selectedTakeId: undefined,
              videoUrl: undefined,
              status: "ready" as const,
            }
          : journey,
      ),
    };
    const restored = projectWithLatestJourneyTakes(stale, filmed);
    const cd = restored.journeys.find((journey) => journey.id === "C-D");
    expect(journeyTakes(cd!).length).toBeGreaterThan(0);
    expect(cd?.videoUrl).toBe("https://replicate.delivery/c-d.mp4");
    expect(projectWithLatestJourneyTakes(filmed, stale).journeys.find((journey) => journey.id === "C-D")?.videoUrl).toBe(
      "https://replicate.delivery/c-d.mp4",
    );
  });

  it("does not copy A-B footage from a different project", () => {
    const feather = {
      ...projectWithAppendedTake(stagedLeg(), "A-B", {
        take,
        videoUrl: "https://example.test/featherflight.mp4",
      }),
      id: "featherflight",
      title: "FeatherFlight",
    };
    const chernobyl = { ...stagedLeg(), id: "chernobyl", title: "Chernobyl" };
    expect(mergeProjectUpdate(feather, chernobyl)).toEqual(chernobyl);
    expect(mergeProjectUpdate(chernobyl, feather)).toEqual(feather);
  });

  it("keeps in-flight A-B footage when the same project updates", () => {
    const filmed = projectWithAppendedTake(stagedLeg(), "A-B", {
      take,
      videoUrl: "https://example.test/keep.mp4",
    });
    const stale = {
      ...filmed,
      story: "updated story",
      journeys: filmed.journeys.map((journey) =>
        journey.id === "A-B"
          ? {
              ...journey,
              takes: undefined,
              take: undefined,
              selectedTakeId: undefined,
              videoUrl: undefined,
              status: "ready" as const,
            }
          : journey,
      ),
    };
    const restored = mergeProjectUpdate(stale, filmed);
    expect(restored.story).toBe("updated story");
    expect(restored.journeys[0]?.videoUrl).toBe("https://example.test/keep.mp4");
  });

  it("rejects a take whose START/END no longer match the current journey", () => {
    const staged = stagedLeg();
    expect(
      filmedTakeFitsCurrentJourney(staged, "A-B", {
        startCanonicalMediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        endCanonicalMediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      }),
    ).toBe(true);
    expect(
      filmedTakeFitsCurrentJourney(staged, "A-B", {
        startCanonicalMediaId: "upload-ffffffffffffffffffffffffffffffff",
        endCanonicalMediaId: "upload-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      }),
    ).toBe(false);
    expect(filmedTakeFitsCurrentJourney({ ...staged, journeys: [] }, "A-B", undefined)).toBe(false);
  });
});

describe("selection changes current footage", () => {
  it("mirrors the selected Take onto take, videoUrl, and duration", () => {
    const withTwo = projectWithAppendedTake(
      projectWithJourneyShotTake(stagedLeg(), "A-B", {
        take,
        videoUrl: "https://example.test/take-1.mp4",
      }),
      "A-B",
      { take: { ...take, durationSeconds: 5 }, videoUrl: "https://example.test/take-2.mp4" },
    );
    const selected = projectWithSelectedTake(withTwo, "A-B", takeId("A-B", 1));
    const journey = selected.journeys[0]!;
    expect(journey.selectedTakeId).toBe(takeId("A-B", 1));
    expect(selectedTake(journey)?.number).toBe(1);
    expect(journey.videoUrl).toBe("https://example.test/take-1.mp4");
    expect(journey.take?.videoUrl).toBe("https://example.test/take-1.mp4");
    expect(journey.durationSeconds).toBe(6);
    expect(journeyTakes(journey)[1]?.videoUrl).toBe("https://example.test/take-2.mp4");
  });

  it("reads Kling 5s and Pruna 6s from the Take, or from the generator when duration is missing", () => {
    expect(takeClipDurationSeconds({ durationSeconds: 6, model: "prunaai/p-video" }, 8)).toBe(6);
    expect(takeClipDurationSeconds({ durationSeconds: 5, model: "kwaivgi/kling-v2.5-turbo-pro" }, 8)).toBe(5);
    expect(takeClipDurationSeconds({ durationSeconds: 0, model: "kwaivgi/kling-v2.5-turbo-pro" }, 8)).toBe(5);
    expect(takeClipDurationSeconds({ durationSeconds: 0, model: "prunaai/p-video" }, 8)).toBe(6);
    expect(takeClipDurationSeconds({ durationSeconds: 0, model: "kwaivgi/kling-v3-video" }, 8)).toBe(6);
  });
});

describe("assembly uses the selected Take", () => {
  it("exports the selected clip URL, not a later unselected Take", () => {
    const forest = createForestProject();
    const firstUrl = forest.journeys[0]?.videoUrl;
    expect(movieExportPlan(forest).included[0]?.videoUrl).toBe(firstUrl);

    const withTwo = projectWithAppendedTake(forest, "A-B", {
      take: { ...take, durationSeconds: 6 },
      videoUrl: "https://example.test/forest-take-2.mp4",
    });
    expect(movieExportPlan(withTwo).included[0]?.videoUrl).toBe("https://example.test/forest-take-2.mp4");

    const selectedFirst = projectWithSelectedTake(withTwo, "A-B", takeId("A-B", 1));
    expect(movieExportPlan(selectedFirst).included[0]?.videoUrl).toBe(firstUrl);
    expect(movieExportPlan(selectedFirst).included.map((clip) => clip.journeyId)).toEqual([
      "A-B",
      "B-C",
      "C-D",
      "D-E",
      "E-F",
    ]);
  });
});

describe("Take canonical pair", () => {
  it("stamps the Motion Plan pair when NEW TAKE does not send one", () => {
    const rendered = projectWithJourneyShotTake(stagedLeg(), "A-B", {
      take,
      videoUrl: "https://example.test/take-1.mp4",
    });
    expect(takeCanonicalPair(rendered.journeys[0]!.takes![0]!)).toEqual({
      startCanonicalMediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      endCanonicalMediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
  });

  it("keeps an explicit pair instead of assuming the current segment letters", () => {
    const b1 = "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const b2 = "upload-cccccccccccccccccccccccccccccccc";
    const rendered = projectWithJourneyShotTake(stagedLeg(), "A-B", {
      take: {
        ...take,
        startCanonicalMediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        endCanonicalMediaId: b2,
      },
      videoUrl: "https://example.test/a-b2.mp4",
    });
    expect(rendered.journeys[0]?.takes?.[0]?.endCanonicalMediaId).toBe(b2);
    expect(rendered.journeys[0]?.takes?.[0]?.endCanonicalMediaId).not.toBe(b1);
  });

  it("treats handoff compatibility as shared B media identity, not segment index", () => {
    const aToB1 = {
      ...take,
      startCanonicalMediaId: "media-a",
      endCanonicalMediaId: "media-b1",
    };
    const b1ToC = {
      ...take,
      startCanonicalMediaId: "media-b1",
      endCanonicalMediaId: "media-c",
    };
    const aToB2 = {
      ...take,
      startCanonicalMediaId: "media-a",
      endCanonicalMediaId: "media-b2",
    };
    expect(takesShareHandoffCanonical(aToB1, b1ToC)).toBe(true);
    expect(takesShareHandoffCanonical(aToB2, b1ToC)).toBe(false);
    expect(takesShareHandoffCanonical(take, b1ToC)).toBeUndefined();
  });

  it("marks a Take stale after START or END canon changes", () => {
    const rendered = projectWithJourneyShotTake(stagedLeg(), "A-B", {
      take,
      videoUrl: "https://example.test/take-1.mp4",
    });
    const journey = rendered.journeys[0]!;
    expect(takeMatchesCurrentCanonicals(rendered, journey, journey.takes![0]!)).toBe(true);
    const reshot = {
      ...rendered,
      storyboard: rendered.storyboard.map((frame) =>
        frame.id === "B"
          ? { ...frame, mediaId: "upload-ffffffffffffffffffffffffffffffff" }
          : frame,
      ),
    };
    expect(takeMatchesCurrentCanonicals(reshot, reshot.journeys[0]!, reshot.journeys[0]!.takes![0]!)).toBe(false);
    expect(TAKE_PREVIOUS_CANONICALS_COPY).toMatch(/current START\/END/i);
  });
});
