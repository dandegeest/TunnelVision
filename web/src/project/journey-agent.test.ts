import { describe, expect, it } from "vitest";
import { projectWithCinematographerAssessment } from "./cinematographer";
import {
  projectWithConstructedDestination,
  projectWithGeneratedOpeningFrame,
} from "./destination";
import type { MovieExportResult } from "./export-movie";
import {
  formatJourneyAgentButtonLabel,
  idleJourneyAgentSnapshot,
  journeyAgentIsBusy,
  runJourneyAgent,
  type JourneyAgentOperations,
  type JourneyAgentSnapshot,
} from "./journey-agent";
import { projectWithMotionPlan } from "./motion-plan";
import { createNewProject } from "./new-project";
import { projectWithJourneyShotTake } from "./shoot";
import { projectWithDirectorPlan } from "./storyboard";
import { journeyTakes, selectedTakeVideoUrl } from "./takes";
import type { CinematographerAssessment, JourneyShotTake, Project, SegmentMotionPlan } from "./types";

const STORY = "Travel forward through connected interior volumes.";

const MEDIA = {
  A: { mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", imageUrl: "/a.png" },
  B: { mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", imageUrl: "/b.png" },
  C: { mediaId: "upload-cccccccccccccccccccccccccccccccc", imageUrl: "/c.png" },
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

const motionPlan: SegmentMotionPlan = {
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
};

const assembled: MovieExportResult = {
  videoUrl: "/api/export-movie/test",
  filename: "journey.mp4",
  complete: true,
  includedJourneyIds: ["A-B", "B-C"],
  missingJourneyIds: [],
};

function actualFrame(
  id: "A" | "B" | "C",
  origin: "user" | "generated" = "user",
): Project["storyboard"][number] {
  return {
    id,
    label: id,
    imageOrigin: origin,
    image: MEDIA[id].imageUrl,
    mediaId: MEDIA[id].mediaId,
    destinationId: id,
  };
}

function promptedProject(): Project {
  return { ...createNewProject(), story: STORY, agency: "autonomous" };
}

function withActualA(project: Project = promptedProject()): Project {
  return {
    ...project,
    storyboard: [actualFrame("A")],
  };
}

const twoBeatPlan = {
  summary: "A continuous forward journey.",
  beats: [
    { id: "B", intent: "Enter the next volume.", visualDescription: "A continuing corridor." },
    { id: "C", intent: "Continue deeper.", visualDescription: "A deeper chamber." },
  ],
};

function domainOps(): JourneyAgentOperations {
  return {
    generateOpening: async (project) => projectWithGeneratedOpeningFrame(project, MEDIA.A),
    writeStoryFromOpening: async (project) => ({ ...project, story: STORY }),
    planJourney: async (project) => projectWithDirectorPlan(project, twoBeatPlan),
    constructDestination: async (project, beatId) => {
      const media = beatId === "C" ? MEDIA.C : MEDIA.B;
      return projectWithConstructedDestination(project, { beatId, ...media });
    },
    planMotion: async (project, journeyId) => {
      const journey = project.journeys.find((item) => item.id === journeyId);
      const start = project.storyboard.find((frame) => frame.destinationId === journey?.startDestinationId);
      const end = project.storyboard.find((frame) => frame.destinationId === journey?.endDestinationId);
      const assessed = projectWithCinematographerAssessment(project, journeyId, assessment);
      return projectWithMotionPlan(assessed, journeyId, {
        ...motionPlan,
        startCanonicalMediaId: start?.mediaId ?? motionPlan.startCanonicalMediaId,
        endCanonicalMediaId: end?.mediaId ?? motionPlan.endCanonicalMediaId,
        startShootingFrame: {
          mediaId: start?.mediaId ?? take.startShootingFrame.mediaId,
          imageUrl: "/start-prime.png",
        },
        endShootingFrame: {
          mediaId: end?.mediaId ?? take.endShootingFrame.mediaId,
          imageUrl: "/end-prime.png",
        },
      });
    },
    createTake: async (project, journeyId) =>
      projectWithJourneyShotTake(project, journeyId, {
        take: {
          ...take,
          startShootingFrame: { mediaId: `${journeyId}-start`, imageUrl: "/start-prime.png" },
          endShootingFrame: { mediaId: `${journeyId}-end`, imageUrl: "/end-prime.png" },
        },
        videoUrl: `https://example.test/${journeyId}.mp4`,
      }),
    assembleMovie: async (project) => ({ project, export: assembled }),
  };
}

function recordingOps(overrides: Partial<JourneyAgentOperations> = {}) {
  const calls: string[] = [];
  const received: { plan?: Project; construct: string[] } = { construct: [] };
  const base = { ...domainOps(), ...overrides };
  const ops: JourneyAgentOperations = {
    generateOpening: async (project) => {
      calls.push("generateOpening");
      return base.generateOpening(project);
    },
    writeStoryFromOpening: async (project) => {
      calls.push("writeStoryFromOpening");
      return base.writeStoryFromOpening(project);
    },
    planJourney: async (project) => {
      calls.push("planJourney");
      received.plan = project;
      return base.planJourney(project);
    },
    constructDestination: async (project, beatId) => {
      calls.push(`construct:${beatId}`);
      received.construct.push(beatId);
      return base.constructDestination(project, beatId);
    },
    planMotion: async (project, journeyId) => {
      calls.push(`planMotion:${journeyId}`);
      return base.planMotion(project, journeyId);
    },
    createTake: async (project, journeyId) => {
      calls.push(`createTake:${journeyId}`);
      return base.createTake(project, journeyId);
    },
    assembleMovie: async (project) => {
      calls.push("assembleMovie");
      return base.assembleMovie(project);
    },
  };
  return { ops, calls, received };
}

describe("JourneyAgent", () => {
  it("completes the happy path from an empty project plus Journey Prompt", async () => {
    const { ops, calls, received } = recordingOps();
    const snapshots: JourneyAgentSnapshot[] = [];
    const result = await runJourneyAgent(promptedProject(), ops, (snapshot) => snapshots.push(snapshot));

    expect(result.snapshot.phase).toBe("COMPLETE");
    expect(result.movieExport?.videoUrl).toBe(assembled.videoUrl);
    expect(calls[0]).toBe("generateOpening");
    expect(calls).toContain("planJourney");
    expect(received.plan?.storyboard[0]?.mediaId).toBe(MEDIA.A.mediaId);
    expect(received.construct).toEqual(["B", "C"]);
    expect(calls).toContain("planMotion:A-B");
    expect(calls).toContain("planMotion:B-C");
    expect(calls).toContain("createTake:A-B");
    expect(calls).toContain("createTake:B-C");
    expect(calls.at(-1)).toBe("assembleMovie");
    expect(result.project.storyboard.map((frame) => frame.id)).toEqual(["A", "B", "C"]);
    expect(selectedTakeVideoUrl(result.project.journeys[0]!)).toBe("https://example.test/A-B.mp4");
    expect(snapshots.map((item) => item.activity?.message)).toContain("generating opening destination A");
    expect(snapshots.map((item) => item.activity?.message)).toContain("creating A→B TAKE 1");
    expect(snapshots.map((item) => item.activity?.message)).toContain("assembling journey");
    expect(snapshots.map((item) => item.activity?.message)).toContain("complete");
  });

  it("preserves an existing opening A", async () => {
    const { ops, calls } = recordingOps();
    const result = await runJourneyAgent(withActualA(), ops);
    expect(calls).not.toContain("generateOpening");
    expect(result.project.storyboard[0]?.mediaId).toBe(MEDIA.A.mediaId);
    expect(result.project.storyboard[0]?.imageOrigin).toBe("user");
    expect(result.snapshot.phase).toBe("COMPLETE");
  });

  it("preserves filmmaker-supplied future canonicals and only constructs unresolved beats", async () => {
    const start = projectWithDirectorPlan(
      {
        ...withActualA(),
        storyboard: [actualFrame("A"), actualFrame("B"), { id: "C", label: "C", imageOrigin: "none" }],
      },
      twoBeatPlan,
    );
    const { ops, calls, received } = recordingOps({
      planJourney: async (project) => project,
    });
    const result = await runJourneyAgent(start, ops);
    expect(calls).not.toContain("generateOpening");
    expect(received.construct).toEqual(["C"]);
    expect(result.project.storyboard.find((frame) => frame.id === "B")?.mediaId).toBe(MEDIA.B.mediaId);
    expect(result.project.storyboard.find((frame) => frame.id === "B")?.imageOrigin).toBe("user");
    expect(result.snapshot.phase).toBe("COMPLETE");
  });

  it("preserves an existing selected Take and only creates missing footage", async () => {
    const planned = projectWithDirectorPlan(withActualA(), {
      summary: "One move.",
      beats: [{ id: "B", intent: "Enter the next volume.", visualDescription: "A continuing corridor." }],
    });
    const constructed = await domainOps().constructDestination(planned, "B");
    const staged = await domainOps().planMotion(constructed, "A-B");
    const withTake = projectWithJourneyShotTake(staged, "A-B", {
      take,
      videoUrl: "https://example.test/keep-take-1.mp4",
    });
    const { ops, calls } = recordingOps({
      planJourney: async (project) => project,
    });
    const result = await runJourneyAgent(withTake, ops);
    expect(calls.filter((call) => call.startsWith("createTake"))).toEqual([]);
    expect(selectedTakeVideoUrl(result.project.journeys[0]!)).toBe("https://example.test/keep-take-1.mp4");
    expect(journeyTakes(result.project.journeys[0]!).length).toBe(1);
    expect(result.snapshot.phase).toBe("COMPLETE");
  });

  it("creates a new Take when a staged segment has no footage", async () => {
    const planned = projectWithDirectorPlan(withActualA(), {
      summary: "One move.",
      beats: [{ id: "B", intent: "Enter the next volume.", visualDescription: "A continuing corridor." }],
    });
    const constructed = await domainOps().constructDestination(planned, "B");
    const staged = await domainOps().planMotion(constructed, "A-B");
    const { ops, calls } = recordingOps({
      planJourney: async (project) => project,
    });
    const result = await runJourneyAgent(staged, ops);
    expect(calls).toContain("createTake:A-B");
    expect(journeyTakes(result.project.journeys[0]!).length).toBe(1);
    expect(result.snapshot.events.some((event) => event.activity === "creating A→B TAKE 1")).toBe(true);
  });

  it("stops on operation failure, keeps partial work, and transitions FAILED", async () => {
    const { ops, calls } = recordingOps({
      constructDestination: async (project, beatId) => {
        calls.push(`construct:${beatId}`);
        if (beatId === "C") {
          throw new Error("Destination construction failed.");
        }
        return projectWithConstructedDestination(project, { beatId, ...MEDIA.B });
      },
    });
    const result = await runJourneyAgent(promptedProject(), ops);
    expect(result.snapshot.phase).toBe("FAILED");
    expect(result.snapshot.failureReason).toBe("Destination construction failed.");
    expect(result.project.storyboard.find((frame) => frame.id === "A")?.image).toBe(MEDIA.A.imageUrl);
    expect(result.project.storyboard.find((frame) => frame.id === "B")?.image).toBe(MEDIA.B.imageUrl);
    expect(result.project.storyboard.find((frame) => frame.id === "C")?.image).toBeUndefined();
    expect(calls).not.toContain("createTake:A-B");
    expect(calls).not.toContain("assembleMovie");
  });

  it("fails instead of COMPLETE when the journey cannot be exported", async () => {
    const { ops, calls } = recordingOps({
      planJourney: async (project) => project,
    });
    const result = await runJourneyAgent(withActualA(), ops);
    expect(result.snapshot.phase).toBe("FAILED");
    expect(result.snapshot.failureReason).toBe("Export Movie needs at least one rendered journey clip.");
    expect(result.snapshot.events.some((event) => event.phase === "COMPLETE")).toBe(false);
    expect(calls).not.toContain("assembleMovie");
    expect(result.movieExport).toBeUndefined();
    expect(result.project.storyboard[0]?.mediaId).toBe(MEDIA.A.mediaId);
  });

  it("threads one Project through existing domain operations instead of a parallel model", async () => {
    const seen: Project[] = [];
    const { ops } = recordingOps({
      planJourney: async (project) => {
        seen.push(project);
        return projectWithDirectorPlan(project, twoBeatPlan);
      },
    });
    await runJourneyAgent(promptedProject(), ops);
    expect(seen[0]?.storyboard[0]?.mediaId).toBe(MEDIA.A.mediaId);
    expect(seen[0]?.story).toBe(STORY);
  });
});

describe("JourneyAgent UI helpers", () => {
  it("treats COMPLETE and FAILED as idle for the CREATE JOURNEY button", () => {
    expect(journeyAgentIsBusy(idleJourneyAgentSnapshot())).toBe(false);
    expect(
      formatJourneyAgentButtonLabel({
        phase: "SHOOTING",
        activity: { message: "creating A→B TAKE 1", journeyId: "A-B" },
        events: [],
      }),
    ).toBe("Creating A→B TAKE 1…");
  });
});
