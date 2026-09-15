import { describe, expect, it } from "vitest";
import { projectWithCinematographerAssessment } from "./cinematographer";
import {
  projectWithConstructedDestination,
  projectWithGeneratedOpeningFrame,
  precedingActualFrame,
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

const oneBeatPlan = {
  summary: "One move.",
  beats: [{ id: "B", intent: "Enter the next volume.", visualDescription: "A continuing corridor." }],
};

function repairedStill(beatId: string, attempt: number) {
  return {
    mediaId: `upload-repair${beatId.toLowerCase()}${String(attempt).padStart(22, "0")}`,
    imageUrl: `/${beatId.toLowerCase()}-repair-${attempt}.png`,
  };
}

function assessmentWith(
  overrides: Partial<CinematographerAssessment> = {},
): CinematographerAssessment {
  return { ...assessment, ...overrides };
}

function domainOps(options: { assessments?: CinematographerAssessment[] } = {}): JourneyAgentOperations {
  const assessments = options.assessments ? [...options.assessments] : [];
  const repairCount: Record<string, number> = {};
  return {
    generateOpening: async (project) => projectWithGeneratedOpeningFrame(project, MEDIA.A),
    writeStoryFromOpening: async (project) => ({ ...project, story: STORY }),
    planJourney: async (project) => projectWithDirectorPlan(project, twoBeatPlan),
    constructDestination: async (project, beatId) => {
      const media = beatId === "C" ? MEDIA.C : MEDIA.B;
      return projectWithConstructedDestination(project, { beatId, ...media });
    },
    assessCinematographer: async (project, journeyId) => {
      const nextAssessment = assessments.shift() ?? assessment;
      return projectWithCinematographerAssessment(project, journeyId, nextAssessment);
    },
    repairCanonical: async (project, beatId) => {
      repairCount[beatId] = (repairCount[beatId] ?? 0) + 1;
      const media = repairedStill(beatId, repairCount[beatId]);
      if (beatId === "A") {
        return projectWithGeneratedOpeningFrame(project, media);
      }
      return projectWithConstructedDestination(project, { beatId, ...media });
    },
    planMotion: async (project, journeyId) => {
      const journey = project.journeys.find((item) => item.id === journeyId);
      const start = project.storyboard.find((frame) => frame.destinationId === journey?.startDestinationId);
      const end = project.storyboard.find((frame) => frame.destinationId === journey?.endDestinationId);
      const nextAssessment = journey?.cinematographer ?? assessments.shift() ?? assessment;
      const assessed = projectWithCinematographerAssessment(project, journeyId, nextAssessment);
      return projectWithMotionPlan(assessed, journeyId, {
        ...motionPlan,
        cinematographer: nextAssessment,
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

function recordingOps(
  overrides: Partial<JourneyAgentOperations> = {},
  domainOptions?: { assessments?: CinematographerAssessment[] },
) {
  const calls: string[] = [];
  const received: {
    plan?: Project;
    construct: string[];
    constructFrom: { beatId: string; from?: string }[];
    repairs: string[];
  } = {
    construct: [],
    constructFrom: [],
    repairs: [],
  };
  const base = { ...domainOps(domainOptions), ...overrides };
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
      const beat = project.storyboard.find((frame) => frame.id === beatId);
      const previous = beat ? precedingActualFrame(project, beat) : undefined;
      received.constructFrom.push({ beatId, from: previous?.mediaId });
      return base.constructDestination(project, beatId);
    },
    assessCinematographer: async (project, journeyId) => {
      calls.push(`assess:${journeyId}`);
      return base.assessCinematographer(project, journeyId);
    },
    repairCanonical: async (project, beatId, input) => {
      calls.push(`repair:${beatId}:${input.role}`);
      received.repairs.push(beatId);
      return base.repairCanonical(project, beatId, input);
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
    expect(calls.indexOf("construct:B")).toBeLessThan(calls.indexOf("assess:A-B"));
    expect(calls.indexOf("assess:A-B")).toBeLessThan(calls.indexOf("planMotion:A-B"));
    expect(calls.indexOf("planMotion:A-B")).toBeLessThan(calls.indexOf("construct:C"));
    expect(calls.indexOf("construct:C")).toBeLessThan(calls.indexOf("assess:B-C"));
    expect(calls.indexOf("assess:B-C")).toBeLessThan(calls.indexOf("planMotion:B-C"));
    expect(calls.filter((call) => call === "planMotion:A-B")).toHaveLength(1);
    expect(calls.filter((call) => call === "planMotion:B-C")).toHaveLength(1);
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

describe("JourneyAgent canonical repair", () => {
  const weakEnd = assessmentWith({
    setConsistency: 25,
    traversalConfidence: 45,
    repairRecommendation: "RESHOOT_END",
    repairInstruction: "The space beyond A contradicts the immediate environment established by B.",
  });
  const weakStart = assessmentWith({
    setConsistency: 25,
    traversalConfidence: 45,
    repairRecommendation: "RESHOOT_START",
    repairInstruction: "Start does not establish a plausible route toward end.",
  });
  const weakBoth = assessmentWith({
    setConsistency: 18,
    traversalConfidence: 12,
    repairRecommendation: "RESHOOT_BOTH",
    repairInstruction: "Neither endpoint can reasonably anchor the traversal.",
  });
  const weakTraversal = assessmentWith({
    setConsistency: 90,
    traversalConfidence: 22,
    repairRecommendation: "RESHOOT_END",
    repairInstruction: "Doorway geometry does not connect start to end.",
  });
  const repaired = assessmentWith({
    setConsistency: 72,
    traversalConfidence: 68,
    repairRecommendation: "SHOOT",
  });

  it("proceeds directly to shooting when the pair is above thresholds", async () => {
    const { ops, calls } = recordingOps();
    const result = await runJourneyAgent(promptedProject(), ops);
    expect(calls.filter((call) => call.startsWith("repair:"))).toEqual([]);
    expect(result.snapshot.events.some((event) => event.phase === "REPAIRING_CANONICALS")).toBe(false);
    expect(calls).toContain("createTake:A-B");
    expect(result.snapshot.phase).toBe("COMPLETE");
  });

  it("repairs when Set Consistency is below 60, reevaluates, and continues to NEW TAKE", async () => {
    const { ops, calls } = recordingOps(
      {
        planJourney: async (project) => projectWithDirectorPlan(project, oneBeatPlan),
      },
      { assessments: [weakEnd, repaired] },
    );
    const result = await runJourneyAgent(promptedProject(), ops);
    expect(calls.filter((call) => call.startsWith("repair:"))).toEqual(["repair:B:end"]);
    expect(calls.filter((call) => call === "assess:A-B").length).toBeGreaterThanOrEqual(2);
    expect(calls.indexOf("repair:B:end")).toBeGreaterThan(calls.indexOf("assess:A-B"));
    expect(calls.indexOf("planMotion:A-B")).toBeGreaterThan(calls.indexOf("repair:B:end"));
    expect(result.snapshot.events.some((event) => event.kind === "cinematographer-evaluation")).toBe(true);
    expect(result.snapshot.events.some((event) => event.kind === "cinematographer-evaluated")).toBe(true);
    expect(result.snapshot.events.some((event) => event.kind === "cinematographer-reevaluation")).toBe(true);
    expect(result.snapshot.events.some((event) => event.kind === "cinematographer-reevaluated")).toBe(true);
    expect(result.snapshot.events.some((event) => event.kind === "canonical-repair")).toBe(true);
    const complete = result.snapshot.events.find((event) => event.kind === "canonical-repair-complete");
    expect(complete?.activity).toMatch(/Set Consistency 25 → 72/);
    expect(complete?.activity).toMatch(/Traversal Confidence 45 → 68/);
    expect(complete?.setConsistency).toBe(25);
    expect(complete?.afterSetConsistency).toBe(72);
    expect(calls).toContain("createTake:A-B");
    expect(calls.at(-1)).toBe("assembleMovie");
    expect(result.snapshot.phase).toBe("COMPLETE");
    expect(result.project.storyboard.find((frame) => frame.id === "B")?.mediaId).not.toBe(MEDIA.B.mediaId);
  });

  it("repairs when Traversal Confidence is below 30", async () => {
    const { ops, calls } = recordingOps(
      {
        planJourney: async (project) => projectWithDirectorPlan(project, oneBeatPlan),
      },
      { assessments: [weakTraversal, repaired] },
    );
    const result = await runJourneyAgent(promptedProject(), ops);
    expect(calls.filter((call) => call.startsWith("repair:"))).toEqual(["repair:B:end"]);
    expect(result.snapshot.phase).toBe("COMPLETE");
  });

  it("repairs only the new END even when CM recommends START or BOTH", async () => {
    for (const diagnosis of [weakStart, weakEnd, weakBoth]) {
      const { ops, calls } = recordingOps(
        { planJourney: async (project) => projectWithDirectorPlan(project, oneBeatPlan) },
        { assessments: [diagnosis, repaired] },
      );
      await runJourneyAgent(promptedProject(), ops);
      expect(calls.filter((call) => call.startsWith("repair:"))).toEqual(["repair:B:end"]);
    }
  });

  it("stops after two repair attempts and shoots the current pair", async () => {
    const stubborn = assessmentWith({
      setConsistency: 25,
      traversalConfidence: 45,
      repairRecommendation: "RESHOOT_END",
      repairInstruction: "The pair still lacks a continuous route.",
    });
    const { ops, calls } = recordingOps(
      { planJourney: async (project) => projectWithDirectorPlan(project, oneBeatPlan) },
      { assessments: [stubborn, stubborn, stubborn, stubborn] },
    );
    const result = await runJourneyAgent(promptedProject(), ops);
    expect(calls.filter((call) => call.startsWith("repair:"))).toEqual(["repair:B:end", "repair:B:end"]);
    expect(calls).toContain("createTake:A-B");
    expect(result.snapshot.phase).toBe("COMPLETE");
  });

  it("repairs generated END instead of rewriting a filmmaker-supplied START", async () => {
    const { ops, calls } = recordingOps(
      { planJourney: async (project) => projectWithDirectorPlan(project, oneBeatPlan) },
      { assessments: [weakStart, repaired] },
    );
    const result = await runJourneyAgent(withActualA(), ops);
    expect(calls.filter((call) => call.startsWith("repair:"))).toEqual(["repair:B:end"]);
    expect(result.project.storyboard[0]?.mediaId).toBe(MEDIA.A.mediaId);
    expect(result.project.storyboard.find((frame) => frame.id === "B")?.mediaId).not.toBe(MEDIA.B.mediaId);
    expect(result.snapshot.phase).toBe("COMPLETE");
  });

  it("fails when the new END is filmmaker-supplied and the pair needs repair", async () => {
    const start = projectWithDirectorPlan(
      {
        ...promptedProject(),
        storyboard: [actualFrame("A", "generated"), actualFrame("B", "user")],
      },
      oneBeatPlan,
    );
    const { ops, calls } = recordingOps(
      { planJourney: async (project) => project },
      { assessments: [weakEnd] },
    );
    const result = await runJourneyAgent(start, ops);
    expect(result.snapshot.phase).toBe("FAILED");
    expect(result.snapshot.failureReason).toMatch(/filmmaker-supplied/i);
    expect(calls.filter((call) => call.startsWith("repair:"))).toEqual([]);
    expect(result.project.storyboard.find((frame) => frame.id === "A")?.mediaId).toBe(MEDIA.A.mediaId);
    expect(result.project.storyboard.find((frame) => frame.id === "B")?.mediaId).toBe(MEDIA.B.mediaId);
    expect(calls).not.toContain("assembleMovie");
  });

  it("never destructively repairs a canonical that already has dependent Takes", async () => {
    const planned = projectWithDirectorPlan(
      { ...promptedProject(), storyboard: [actualFrame("A", "generated")] },
      oneBeatPlan,
    );
    const constructed = await domainOps().constructDestination(planned, "B");
    const staged = await domainOps({ assessments: [weakEnd] }).planMotion(constructed, "A-B");
    const withTake = projectWithJourneyShotTake(staged, "A-B", {
      take,
      videoUrl: "https://example.test/keep-take-1.mp4",
    });
    const originalB = withTake.storyboard.find((frame) => frame.id === "B")?.mediaId;
    const { ops, calls } = recordingOps({
      planJourney: async (project) => project,
    });
    const result = await runJourneyAgent(withTake, ops);
    expect(calls.filter((call) => call.startsWith("repair:"))).toEqual([]);
    expect(result.project.storyboard.find((frame) => frame.id === "B")?.mediaId).toBe(originalB);
    expect(selectedTakeVideoUrl(result.project.journeys[0]!)).toBe("https://example.test/keep-take-1.mp4");
    expect(result.snapshot.phase).toBe("COMPLETE");
  });

  it("keeps partial work when canonical repair fails", async () => {
    const { ops, calls } = recordingOps(
      {
        planJourney: async (project) => projectWithDirectorPlan(project, oneBeatPlan),
        repairCanonical: async () => {
          throw new Error("Canonical repair failed.");
        },
      },
      { assessments: [weakEnd] },
    );
    const result = await runJourneyAgent(promptedProject(), ops);
    expect(result.snapshot.phase).toBe("FAILED");
    expect(result.snapshot.failureReason).toBe("Canonical repair failed.");
    expect(result.project.storyboard.find((frame) => frame.id === "A")?.image).toBe(MEDIA.A.imageUrl);
    expect(result.project.storyboard.find((frame) => frame.id === "B")?.image).toBe(MEDIA.B.imageUrl);
    expect(calls).not.toContain("createTake:A-B");
    expect(calls).not.toContain("assembleMovie");
  });

  it("does not generate C until A→B has finished its CM/repair cycle", async () => {
    const { ops, calls } = recordingOps({}, { assessments: [weakEnd, repaired, assessment] });
    const result = await runJourneyAgent(promptedProject(), ops);
    const repairB = calls.indexOf("repair:B:end");
    const constructC = calls.indexOf("construct:C");
    const assessBc = calls.indexOf("assess:B-C");
    expect(repairB).toBeGreaterThan(calls.indexOf("assess:A-B"));
    expect(constructC).toBeGreaterThan(calls.lastIndexOf("assess:A-B"));
    expect(calls.indexOf("planMotion:A-B")).toBeGreaterThan(repairB);
    expect(calls.indexOf("planMotion:A-B")).toBeLessThan(constructC);
    expect(assessBc).toBeGreaterThan(constructC);
    expect(calls.filter((call) => call.startsWith("repair:"))).toEqual(["repair:B:end"]);
    expect(result.snapshot.phase).toBe("COMPLETE");
  });

  it("generates C from the accepted B, not the pre-repair still", async () => {
    const { ops, received } = recordingOps({}, { assessments: [weakEnd, repaired, assessment] });
    const result = await runJourneyAgent(promptedProject(), ops);
    const constructC = received.constructFrom.find((item) => item.beatId === "C");
    expect(constructC?.from).toBe(repairedStill("B", 1).mediaId);
    expect(constructC?.from).not.toBe(MEDIA.B.mediaId);
    expect(result.project.storyboard.find((frame) => frame.id === "B")?.mediaId).toBe(
      repairedStill("B", 1).mediaId,
    );
    expect(result.snapshot.phase).toBe("COMPLETE");
  });

  it("discards a CM result whose canonical IDs no longer match the pair", async () => {
    let attempts = 0;
    const { ops, calls } = recordingOps({
      planJourney: async (project) => projectWithDirectorPlan(project, oneBeatPlan),
      assessCinematographer: async (project, journeyId) => {
        attempts += 1;
        if (attempts === 1) {
          return projectWithCinematographerAssessment(project, journeyId, weakEnd, {
            startCanonicalMediaId: "upload-oldaaaaaaaaaaaaaaaaaaaaaaaaaa",
            endCanonicalMediaId: "upload-oldbbbbbbbbbbbbbbbbbbbbbbbbbb",
          });
        }
        return projectWithCinematographerAssessment(project, journeyId, repaired);
      },
    });
    const result = await runJourneyAgent(promptedProject(), ops);
    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(calls.filter((call) => call.startsWith("repair:"))).toEqual([]);
    expect(result.snapshot.phase).toBe("COMPLETE");
  });

  it("does not rewrite established B while evaluating B→C", async () => {
    const weakBcStart = assessmentWith({
      setConsistency: 25,
      traversalConfidence: 20,
      repairRecommendation: "RESHOOT_START",
      repairInstruction: "B does not establish a plausible route toward C.",
    });
    const { ops, calls } = recordingOps(
      {},
      { assessments: [weakEnd, repaired, weakBcStart, repaired] },
    );
    const result = await runJourneyAgent(promptedProject(), ops);
    expect(calls.filter((call) => call.startsWith("repair:"))).toEqual(["repair:B:end", "repair:C:end"]);
    expect(result.project.storyboard.find((frame) => frame.id === "B")?.mediaId).toBe(
      repairedStill("B", 1).mediaId,
    );
    expect(result.project.storyboard.find((frame) => frame.id === "C")?.mediaId).toBe(
      repairedStill("C", 1).mediaId,
    );
    expect(result.snapshot.phase).toBe("COMPLETE");
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
    expect(
      formatJourneyAgentButtonLabel({
        phase: "REPAIRING_CANONICALS",
        activity: {
          message: "RESHOOT · D",
          kind: "canonical-repair",
          destinationIds: ["D"],
          journeyId: "C-D",
        },
        events: [],
      }),
    ).toBe("Reshooting D…");
  });
});
