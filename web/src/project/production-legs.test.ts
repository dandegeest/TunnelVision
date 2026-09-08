import { describe, expect, it } from "vitest";
import { createNewProject } from "./new-project";
import { createWardrobeProject } from "../fixtures/wardrobe-loop";
import { projectWithDirectorPlan } from "./storyboard";
import { projectWithConstructedDestination } from "./destination";
import { projectWithReplacedStartImage } from "./starting-frame";
import {
  consecutiveProductionPairs,
  projectWithSyncedProductionLegs,
} from "./production-legs";
import type { CinematographerAssessment, Project, StoryboardFrame } from "./types";

const A_MEDIA = {
  mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  imageUrl: "/api/runtime-media/upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};
const B_MEDIA = {
  mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  imageUrl: "/api/runtime-media/upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};
const C_MEDIA = {
  mediaId: "upload-cccccccccccccccccccccccccccccccc",
  imageUrl: "/api/runtime-media/upload-cccccccccccccccccccccccccccccccc",
};

const assessment: CinematographerAssessment = {
  shootability: "needs_review",
  summary: "Keep the camera on the visible corridor.",
  route: "Advance through the opening.",
  threshold: "The doorway.",
  camera: "Track forward.",
  parallax: "Near walls.",
  transitionStrategy: "Pass through the opening.",
  segmentPromptAddition: "Track forward through the opening.",
  camotionSuitability: "uncertain",
  concerns: ["Geometry is tight."],
};

function actualFrame(
  id: string,
  media: { mediaId: string; imageUrl: string },
  origin: "user" | "generated" = "generated",
): StoryboardFrame {
  return {
    id,
    label: id,
    image: media.imageUrl,
    imageOrigin: origin,
    mediaId: media.mediaId,
    destinationId: id,
  };
}

function projectWithFrames(frames: StoryboardFrame[], extras?: Partial<Project>): Project {
  return {
    ...createNewProject(),
    storyboard: frames,
    ...extras,
  };
}

describe("consecutive production pairs", () => {
  it("does not invent a leg from A-only", () => {
    const project = projectWithSyncedProductionLegs(
      projectWithFrames([actualFrame("A", A_MEDIA, "user")]),
    );
    expect(consecutiveProductionPairs(project)).toEqual([]);
    expect(project.destinations).toEqual([]);
    expect(project.journeys).toEqual([]);
  });

  it("does not invent an endpoint for unresolved B", () => {
    const project = projectWithSyncedProductionLegs(
      projectWithFrames([
        actualFrame("A", A_MEDIA, "user"),
        { id: "B", label: "B", imageOrigin: "none" },
      ]),
    );
    expect(consecutiveProductionPairs(project)).toEqual([]);
    expect(project.journeys).toEqual([]);
  });

  it("does not skip unresolved B to fabricate A→C", () => {
    const project = projectWithSyncedProductionLegs(
      projectWithFrames([
        actualFrame("A", A_MEDIA, "user"),
        { id: "B", label: "B", imageOrigin: "none" },
        actualFrame("C", C_MEDIA),
      ]),
    );
    expect(consecutiveProductionPairs(project)).toEqual([]);
    expect(project.journeys).toEqual([]);
  });

  it("creates A→B when both adjacent canonicals are actual", () => {
    const project = projectWithSyncedProductionLegs(
      projectWithFrames([actualFrame("A", A_MEDIA, "user"), actualFrame("B", B_MEDIA)]),
    );
    expect(project.destinations.map((destination) => destination.id)).toEqual(["A", "B"]);
    expect(project.destinations[0]?.image).toBe(A_MEDIA.imageUrl);
    expect(project.destinations[1]?.image).toBe(B_MEDIA.imageUrl);
    expect(project.journeys).toEqual([
      {
        id: "A-B",
        startDestinationId: "A",
        endDestinationId: "B",
        durationSeconds: 6,
        status: "ready",
      },
    ]);
  });

  it("creates A→B and B→C from three actual adjacent canonicals", () => {
    const project = projectWithSyncedProductionLegs(
      projectWithFrames([
        actualFrame("A", A_MEDIA, "user"),
        actualFrame("B", B_MEDIA),
        actualFrame("C", C_MEDIA),
      ]),
    );
    expect(project.destinations.map((destination) => destination.id)).toEqual(["A", "B", "C"]);
    expect(project.journeys.map((journey) => journey.id)).toEqual(["A-B", "B-C"]);
  });
});

describe("production leg merge", () => {
  it("preserves JourneyShot operational status, video, and cinematographer", () => {
    const prepared: Project = {
      ...projectWithFrames([actualFrame("A", A_MEDIA, "user"), actualFrame("B", B_MEDIA)]),
      destinations: [
        { id: "A", label: "A", image: "/old-a.jpg", status: "ready" },
        { id: "B", label: "B", image: "/old-b.jpg", status: "ready" },
      ],
      journeys: [
        {
          id: "A-B",
          startDestinationId: "A",
          endDestinationId: "B",
          durationSeconds: 6,
          status: "rendered",
          videoUrl: "/clip.mp4",
          cinematographer: assessment,
        },
      ],
    };
    const next = projectWithSyncedProductionLegs(prepared);
    const journey = next.journeys.find((item) => item.id === "A-B");
    expect(journey?.status).toBe("rendered");
    expect(journey?.videoUrl).toBe("/clip.mp4");
    expect(journey?.cinematographer).toEqual(assessment);
    expect(next.destinations.find((destination) => destination.id === "B")?.image).toBe(B_MEDIA.imageUrl);
  });

  it("does not treat advisory not_shootable as an operational status", () => {
    const blocked: Project = {
      ...projectWithFrames([actualFrame("A", A_MEDIA, "user"), actualFrame("B", B_MEDIA)]),
      destinations: [
        { id: "A", label: "A", image: A_MEDIA.imageUrl, status: "ready" },
        { id: "B", label: "B", image: B_MEDIA.imageUrl, status: "ready" },
      ],
      journeys: [
        {
          id: "A-B",
          startDestinationId: "A",
          endDestinationId: "B",
          durationSeconds: 6,
          status: "ready",
          cinematographer: { ...assessment, shootability: "not_shootable" },
        },
      ],
    };
    const next = projectWithSyncedProductionLegs(blocked);
    expect(next.journeys).toHaveLength(1);
    expect(next.journeys[0]?.status).toBe("ready");
    expect(next.journeys[0]?.cinematographer?.shootability).toBe("not_shootable");
  });

  it("keeps wardrobe extras when constructing actual B", () => {
    const planned = projectWithDirectorPlan(createWardrobeProject(), {
      summary: "A planned journey.",
      beats: [
        { id: "B", intent: "Enter the wardrobe.", visualDescription: "Dark coats." },
        { id: "C", intent: "Enter the forest.", visualDescription: "Trees." },
      ],
    });
    const constructed = projectWithConstructedDestination(planned, {
      beatId: "B",
      ...B_MEDIA,
    });
    expect(constructed.journeys.map((journey) => journey.id)).toEqual(
      planned.journeys.map((journey) => journey.id),
    );
    expect(constructed.journeys.find((journey) => journey.id === "A-B")?.status).toBe("rendered");
    expect(constructed.destinations.find((destination) => destination.id === "B")?.image).toBe(
      B_MEDIA.imageUrl,
    );
    expect(constructed.destinations.find((destination) => destination.id === "C")?.image).toBe(
      planned.destinations.find((destination) => destination.id === "C")?.image,
    );
  });

  it("updates Shoot images when the Plan canonical is replaced", () => {
    const withLegs = projectWithSyncedProductionLegs(
      projectWithFrames([actualFrame("A", A_MEDIA, "user"), actualFrame("B", B_MEDIA)]),
    );
    const replaced = projectWithReplacedStartImage(withLegs, {
      mediaId: "upload-ffffffffffffffffffffffffffffffff",
      imageUrl: "/api/runtime-media/upload-ffffffffffffffffffffffffffffffff",
    });
    expect(replaced.destinations.find((destination) => destination.id === "A")?.image).toBe(
      "/api/runtime-media/upload-ffffffffffffffffffffffffffffffff",
    );
    expect(replaced.journeys.map((journey) => journey.id)).toEqual(["A-B"]);
  });
});
