import { describe, expect, it } from "vitest";
import { createNewProject } from "../new-project";
import { frameWithAppendedCanonicalTake } from "../canonical-takes";
import { assertSupportedSchemaVersion, parseManifest, PROJECT_SCHEMA_VERSION, ProjectSchemaError } from "./schema";
import { hydrateProject, serializeProjectDocuments, parseConversationEvents, conversationEventsText } from "./serialize";
import type { CameraMotionPlanV1, JourneyShotTake } from "../types";

const PLAN: CameraMotionPlanV1 = {
  version: 1,
  camera: { vanishing_point: [0.5, 0.5], forward: 1 },
  destination: { point: [0.5, 0.5], protect: true, bbox: [0.2, 0.2, 0.8, 0.8] },
  exposure: { strength: 0.1, samples: 8 },
};

const FRAME = { mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", imageUrl: "/api/runtime-media/upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };

function take(number: number, videoId: string): JourneyShotTake {
  return {
    id: `A-B:take:${number}`,
    number,
    videoUrl: `/api/runtime-media/${videoId}`,
    videoMediaId: videoId,
    startCanonicalMediaId: FRAME.mediaId,
    endCanonicalMediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    startShootingFrame: FRAME,
    endShootingFrame: { mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", imageUrl: "/api/runtime-media/upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
    startPlan: PLAN,
    endPlan: PLAN,
    segmentPromptAddition: "stay with the koi",
    effectivePrompt: "stay with the koi. forward.",
    pace: "moderate",
    provider: "replicate",
    model: "pruna-p-video",
    modelVersion: null,
    durationSeconds: 5,
    videoInputs: { startShootingFrame: true, endShootingFrame: true },
  };
}

describe("project persistence schema", () => {
  it("validates schemaVersion", () => {
    expect(() => assertSupportedSchemaVersion(PROJECT_SCHEMA_VERSION)).not.toThrow();
    expect(() => assertSupportedSchemaVersion(99)).toThrow(ProjectSchemaError);
    expect(() => parseManifest({})).toThrow(/schemaVersion/);
  });

  it("round-trips canonical and traversal takes with relative asset paths", () => {
    let project = createNewProject();
    project = {
      ...project,
      title: "Glowing Koi",
      story: "Follow the koi.",
      storyDurationLocked: true,
      videoModel: "pruna-p-video",
      imageModel: "nano-banana-2-lite",
      imageOutputFormat: "png",
      imageResolution: "1K",
      storyboard: [
        frameWithAppendedCanonicalTake(
          frameWithAppendedCanonicalTake(project.storyboard[0]!, { ...FRAME, origin: "user", source: "upload" }),
          {
            mediaId: "upload-cccccccccccccccccccccccccccccccc",
            imageUrl: "/api/runtime-media/upload-cccccccccccccccccccccccccccccccc",
            origin: "generated",
            source: "repair",
          },
        ),
        {
          id: "B",
          label: "B",
          imageOrigin: "generated",
          image: "/api/runtime-media/upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      ],
      journeys: [
        {
          id: "A-B",
          startDestinationId: "A",
          endDestinationId: "B",
          durationSeconds: 5,
          status: "rendered",
          takes: [take(1, "upload-vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv"), take(2, "upload-wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww")],
          selectedTakeId: "A-B:take:1",
          filmmakerPace: "slow",
          filmmakerDurationSeconds: 12,
          outgoingStartDrop: {
            incomingJourneyId: "legacy",
            incomingTakeId: "legacy-in",
            outgoingTakeId: "A-B:take:1",
            dropped: true,
            ssim: 0.94,
            mae: 3.1,
          },
        },
      ],
    };

    const documents = serializeProjectDocuments({ project });
    expect(documents.manifest.schemaVersion).toBe(1);
    expect(documents.manifest.name).toBe("Glowing Koi");
    expect(documents.mediaCopies.every((item) => !item.relativePath.startsWith("/"))).toBe(true);
    expect(documents.mediaCopies.some((item) => item.relativePath === "canonicals/A/take-01.png")).toBe(true);
    expect(documents.mediaCopies.some((item) => item.relativePath === "canonicals/A/take-02.png")).toBe(true);
    expect(documents.mediaCopies.some((item) => item.relativePath.startsWith("traversals/A-B/take-"))).toBe(true);

    const present = new Set(documents.mediaCopies.map((item) => item.relativePath));
    const hydrated = hydrateProject({
      manifest: documents.manifest,
      canonicals: documents.canonicals,
      traversals: documents.traversals,
      assetExists: (relative) => present.has(relative),
    });
    const a = hydrated.project.storyboard.find((frame) => frame.id === "A")!;
    expect(a.takes).toHaveLength(2);
    expect(a.mediaId).toBe("upload-cccccccccccccccccccccccccccccccc");
    const journey = hydrated.project.journeys.find((item) => item.id === "A-B")!;
    expect(journey.takes).toHaveLength(2);
    expect(journey.selectedTakeId).toBe("A-B:take:1");
    expect(journey.filmmakerPace).toBe("slow");
    expect(journey.filmmakerDurationSeconds).toBe(12);
    expect(journey.outgoingStartDrop).toEqual({
      incomingJourneyId: "legacy",
      incomingTakeId: "legacy-in",
      outgoingTakeId: "A-B:take:1",
      dropped: true,
      ssim: 0.94,
      mae: 3.1,
    });
    expect(hydrated.project.story).toBe("Follow the koi.");
    expect(hydrated.project.storyIdea).toBeUndefined();
    expect(hydrated.project.imageModel).toBe("nano-banana-2-lite");
    expect(documents.manifest.settings.durationMode).toBe("adaptive");
    expect(documents.manifest.settings.fixedDurationSeconds).toBe(5);
    expect(documents.manifest.settings.adaptivePace).toBe(true);
    expect(hydrated.project.durationMode).toBe("adaptive");
    expect(hydrated.project.fixedDurationSeconds).toBe(5);
    expect(hydrated.project.adaptivePace).toBe(true);
    expect(documents.manifest.settings.cameraGrammar).toBe("pov");
    expect(hydrated.project.cameraGrammar).toBe("pov");
    expect(documents.manifest.settings.pullForwardReferenceEnabled).toBe(true);
    expect(hydrated.project.pullForwardReferenceEnabled).toBe(true);
    expect(hydrated.warnings.missingAssets).toEqual([]);
    expect(journey.takes?.[0]?.videoMediaId).toBe(
      `video-${documents.manifest.id}-a-b-take-1`,
    );
    expect(journey.takes?.[1]?.videoMediaId).toBe(
      `video-${documents.manifest.id}-a-b-take-2`,
    );
  });

  it("does not reuse video-a-b-take-N identities across Projects", () => {
    const takeOne = take(1, "upload-vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv");
    const projectA = {
      ...createNewProject(),
      id: "tv-aaaaaaaaaaaaaaaa",
      journeys: [
        {
          id: "A-B",
          startDestinationId: "A",
          endDestinationId: "B",
          durationSeconds: 5,
          status: "rendered" as const,
          takes: [takeOne],
        },
      ],
    };
    const projectB = { ...projectA, id: "tv-bbbbbbbbbbbbbbbb" };
    const idA = serializeProjectDocuments({ project: projectA }).traversals["A-B"] as {
      takes: { videoMediaId: string }[];
    };
    const idB = serializeProjectDocuments({ project: projectB }).traversals["A-B"] as {
      takes: { videoMediaId: string }[];
    };
    expect(idA.takes[0]?.videoMediaId).toBe("video-tv-aaaaaaaaaaaaaaaa-a-b-take-1");
    expect(idB.takes[0]?.videoMediaId).toBe("video-tv-bbbbbbbbbbbbbbbb-a-b-take-1");
    expect(idA.takes[0]?.videoMediaId).not.toBe(idB.takes[0]?.videoMediaId);
  });

  it("opens when optional event history is missing and reports a missing asset", () => {
    let project = createNewProject();
    project = {
      ...project,
      title: "Missing still",
      storyboard: [
        frameWithAppendedCanonicalTake(project.storyboard[0]!, { ...FRAME, origin: "user", source: "upload" }),
      ],
    };
    const documents = serializeProjectDocuments({ project });
    const hydrated = hydrateProject({
      manifest: documents.manifest,
      canonicals: documents.canonicals,
      traversals: documents.traversals,
      assetExists: () => false,
    });
    expect(hydrated.project.title).toBe("Missing still");
    expect(hydrated.warnings.missingAssets.length).toBeGreaterThan(0);
    expect(parseConversationEvents("")).toEqual([]);
    expect(conversationEventsText([])).toBe("");
  });

  it("persists pull-forward reference and treats a missing setting as ON", () => {
    const off = serializeProjectDocuments({
      project: { ...createNewProject(), pullForwardReferenceEnabled: false },
    });
    expect(off.manifest.settings.pullForwardReferenceEnabled).toBe(false);
    const hydratedOff = hydrateProject({
      manifest: off.manifest,
      canonicals: off.canonicals,
      traversals: off.traversals,
      assetExists: () => true,
    });
    expect(hydratedOff.project.pullForwardReferenceEnabled).toBe(false);

    const documents = serializeProjectDocuments({ project: createNewProject() });
    const { pullForwardReferenceEnabled: _omitted, ...settings } = documents.manifest.settings;
    const hydratedMissing = hydrateProject({
      manifest: { ...documents.manifest, settings },
      canonicals: documents.canonicals,
      traversals: documents.traversals,
      assetExists: () => true,
    });
    expect(hydratedMissing.project.pullForwardReferenceEnabled).toBe(true);
  });

  it("persists Story Idea without changing the Production Prompt", () => {
    const project = {
      ...createNewProject(),
      story: "Redwood Walk\n\nFive connected places.",
      storyIdea: "a walk in the redwood forest, 5 destinations",
    };
    const documents = serializeProjectDocuments({ project });
    expect(documents.manifest.journey.initialPrompt).toBe(project.story);
    expect(documents.manifest.settings.storyIdea).toBe(project.storyIdea);
    const hydrated = hydrateProject({
      manifest: documents.manifest,
      canonicals: documents.canonicals,
      traversals: documents.traversals,
      assetExists: () => true,
    });
    expect(hydrated.project.story).toBe(project.story);
    expect(hydrated.project.storyIdea).toBe(project.storyIdea);
  });

  it("persists a failed still and the intent of a failed take", () => {
    const blank = createNewProject();
    const project = {
      ...blank,
      storyboard: blank.storyboard.map((frame) =>
        frame.id === "A" ? { ...frame, constructionError: "still failed" } : frame,
      ),
      journeys: [
        {
          id: "A-B",
          startDestinationId: "A",
          endDestinationId: "B",
          durationSeconds: 5,
          status: "failed" as const,
          shootError: "provider down",
          failedShootIntent: "quality" as const,
        },
      ],
    };
    const documents = serializeProjectDocuments({ project });
    const canonical = documents.canonicals.A as { constructionError?: string };
    const traversal = documents.traversals["A-B"] as { shootError?: string; failedShootIntent?: string };
    expect(canonical.constructionError).toBe("still failed");
    expect(traversal.shootError).toBe("provider down");
    expect(traversal.failedShootIntent).toBe("quality");
    const hydrated = hydrateProject({
      manifest: documents.manifest,
      canonicals: documents.canonicals,
      traversals: documents.traversals,
      assetExists: () => true,
    });
    expect(hydrated.project.storyboard.find((frame) => frame.id === "A")?.constructionError).toBe("still failed");
    expect(hydrated.project.journeys[0]?.failedShootIntent).toBe("quality");
    expect(hydrated.project.journeys[0]?.shootError).toBe("provider down");
  });
});
