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
    expect(hydrated.project.story).toBe("Follow the koi.");
    expect(hydrated.project.imageModel).toBe("nano-banana-2-lite");
    expect(documents.manifest.settings.durationMode).toBe("adaptive");
    expect(documents.manifest.settings.fixedDurationSeconds).toBe(5);
    expect(hydrated.project.durationMode).toBe("adaptive");
    expect(hydrated.project.fixedDurationSeconds).toBe(5);
    expect(documents.manifest.settings.cameraGrammar).toBe("pov");
    expect(hydrated.project.cameraGrammar).toBe("pov");
    expect(hydrated.warnings.missingAssets).toEqual([]);
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
});
