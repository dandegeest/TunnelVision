import { describe, expect, it, vi } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { createNewProject } from "./new-project";
import { prepareDirectorPlan } from "./conversation";
import { directorPlanRequestFromProject } from "./director";
import { directorUserPrompt } from "../../../media/src/director/prompts";
import { projectWithConstructedDestination } from "./destination";
import {
  canAddStoryboardDestination,
  canPlanMovie,
  projectWithAddedDestination,
  projectWithDirectorPlan,
  projectWithRemovedDestination,
} from "./storyboard";
import { movieExportPlan, canExportMovie, describeMovieExport } from "./export-movie";
import { consecutiveProductionPairs } from "./production-legs";
import type { Project, StoryboardFrame } from "./types";

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
const D_MEDIA = {
  mediaId: "upload-dddddddddddddddddddddddddddddddd",
  imageUrl: "/api/runtime-media/upload-dddddddddddddddddddddddddddddddd",
};

function actualFrame(id: string, media: { mediaId: string; imageUrl: string }, origin: "user" | "generated"): StoryboardFrame {
  return {
    id,
    label: id,
    imageOrigin: origin,
    image: media.imageUrl,
    mediaId: media.mediaId,
    destinationId: id,
  };
}

function projectWithA(story = ""): Project {
  return {
    ...createNewProject(),
    story,
    storyboard: [actualFrame("A", A_MEDIA, "user")],
  };
}

describe("partially specified movie interaction model", () => {
  it("keeps PLAN and Add Destination unavailable until A is actual", () => {
    const empty = createNewProject();
    expect(empty.storyboard.map((frame) => frame.id)).toEqual(["A"]);
    expect(empty.storyboard[0]?.imageOrigin).toBe("none");
    expect(canPlanMovie(empty)).toBe(false);
    expect(canAddStoryboardDestination(empty)).toBe(false);
    expect(consecutiveProductionPairs(empty)).toEqual([]);
  });

  it("makes PLAN available from actual A even without a story", () => {
    const withA = projectWithA();
    expect(canPlanMovie(withA)).toBe(true);
    expect(canAddStoryboardDestination(withA)).toBe(false);
    const ready = projectWithA("Travel forward through connected volumes.");
    expect(canPlanMovie(ready)).toBe(true);
    expect(canAddStoryboardDestination(ready)).toBe(true);
  });

  it("lets PLAN run without A when auto generate opening is enabled", () => {
    const untitled = {
      ...createNewProject(),
      story: "Travel forward through connected volumes.",
    };
    expect(canPlanMovie(untitled)).toBe(true);
    expect(canAddStoryboardDestination(untitled)).toBe(false);
    expect(canPlanMovie({ ...untitled, autoGenerateOpening: false })).toBe(false);
  });

  it("plans from a generated opening frame A without requiring an upload", () => {
    const generated = {
      ...createNewProject(),
      story: "Travel forward through connected volumes.",
      storyboard: [actualFrame("A", A_MEDIA, "generated")],
    };
    expect(canPlanMovie(generated)).toBe(true);
    const next = projectWithDirectorPlan(generated, {
      summary: "Continue the interior.",
      beats: [
        { id: "B", intent: "Move forward.", visualDescription: "A deeper volume." },
        { id: "C", intent: "Reach the far room.", visualDescription: "The destination chamber." },
      ],
    });
    expect(next.storyboard[0]).toEqual(generated.storyboard[0]);
    expect(next.storyboard.map((frame) => frame.id)).toEqual(["A", "B", "C"]);
  });

  it("appends unresolved destinations without invoking the Director", () => {
    const director = vi.fn();
    let project = projectWithA();
    project = projectWithAddedDestination(project);
    project = projectWithAddedDestination(project);
    project = projectWithAddedDestination(project);
    expect(director).not.toHaveBeenCalled();
    expect(project.storyboard.map((frame) => frame.id)).toEqual(["A", "B", "C", "D"]);
    expect(project.storyboard[0]?.imageOrigin).toBe("user");
    expect(project.storyboard.slice(1).map((frame) => frame.imageOrigin)).toEqual(["none", "none", "none"]);
    expect(project.storyboard.slice(1).every((frame) => !frame.image)).toBe(true);
  });

  it("sends the complete storyboard on PLAN and leaves unresolved images unresolved", () => {
    const project = {
      ...projectWithAddedDestination(
        projectWithAddedDestination(projectWithAddedDestination(projectWithA("A night interior journey."))),
      ),
    };
    const request = directorPlanRequestFromProject(project);
    expect(request.storyboard?.map((slot) => ({ id: slot.id, specified: slot.specified }))).toEqual([
      { id: "A", specified: true },
      { id: "B", specified: false },
      { id: "C", specified: false },
      { id: "D", specified: false },
    ]);
    expect(request.anchors).toBeUndefined();
    const prompt = directorUserPrompt(request);
    expect(prompt).toMatch(/Complete ordered storyboard/);
    expect(prompt).toMatch(/B \(unresolved\)/);
    expect(prompt).toMatch(/Fill the unresolved slots \(B, C, D\)/);
    expect(prompt).toMatch(/Do not invent a destination after D/);
    const planned = projectWithDirectorPlan(project, {
      summary: "Continue through the interior volumes.",
      beats: [
        { id: "B", intent: "Enter the hall.", visualDescription: "A dark hall." },
        { id: "C", intent: "Cross the chamber.", visualDescription: "A stone chamber." },
        { id: "D", intent: "Reach the window.", visualDescription: "A tall window." },
      ],
    });
    expect(planned.storyboard.map((frame) => frame.id)).toEqual(["A", "B", "C", "D"]);
    expect(planned.storyboard[0]?.image).toBe(A_MEDIA.imageUrl);
    expect(planned.storyboard.slice(1).every((frame) => frame.imageOrigin === "none")).toBe(true);
    expect(planned.storyboard[1]?.intent).toBe("Enter the hall.");
  });

  it("preserves four actual canonicals and does not invent a fifth destination", () => {
    const project: Project = {
      ...projectWithA("Four stills already specify this movie."),
      storyboard: [
        actualFrame("A", A_MEDIA, "user"),
        actualFrame("B", B_MEDIA, "generated"),
        actualFrame("C", C_MEDIA, "generated"),
        actualFrame("D", D_MEDIA, "generated"),
      ],
    };
    const request = directorPlanRequestFromProject(project);
    expect(request.storyboard?.every((slot) => slot.specified)).toBe(true);
    expect(directorUserPrompt(request)).toMatch(/Do not add a new destination/);
    const planned = projectWithDirectorPlan(project, {
      summary: "The supplied sequence already names the journey.",
      beats: [
        { id: "B", intent: "Pass B.", visualDescription: "B still." },
        { id: "C", intent: "Pass C.", visualDescription: "C still." },
        { id: "D", intent: "Arrive at D.", visualDescription: "D still." },
      ],
    });
    expect(planned.storyboard.map((frame) => frame.id)).toEqual(["A", "B", "C", "D"]);
    expect(planned.storyboard[0]).toEqual(project.storyboard[0]);
    expect(planned.storyboard[1]).toEqual(project.storyboard[1]);
    expect(planned.storyboard[2]).toEqual(project.storyboard[2]);
    expect(planned.storyboard[3]).toEqual(project.storyboard[3]);
    expect(() =>
      projectWithDirectorPlan(project, {
        summary: "Invent an extra beat.",
        beats: [
          { id: "B", intent: "Pass B.", visualDescription: "B still." },
          { id: "C", intent: "Pass C.", visualDescription: "C still." },
          { id: "D", intent: "Arrive at D.", visualDescription: "D still." },
          { id: "E", intent: "Invented.", visualDescription: "Should not appear." },
        ],
      }),
    ).toThrow(/invented extra destinations/i);
  });

  it("treats story text as project intent and does not plan from the story field alone", () => {
    const project = { ...projectWithA(), story: "" };
    const edited = { ...project, story: "A greenhouse at night." };
    expect(prepareDirectorPlan(project).ok).toBe(false);
    const prepared = prepareDirectorPlan(edited);
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.request.story).toBe("A greenhouse at night.");
    }
    expect(edited.storyboard).toEqual(project.storyboard);
  });

  it("does not replan when the storyboard grows after a plan", () => {
    const planned = projectWithDirectorPlan(projectWithA("Travel forward."), {
      summary: "Enter the next room.",
      beats: [{ id: "B", intent: "Enter the hall.", visualDescription: "A hall." }],
    });
    const added = projectWithAddedDestination(planned);
    expect(added.storyboard.map((frame) => frame.id)).toEqual(["A", "B", "C"]);
    expect(added.storyboard[2]?.imageOrigin).toBe("none");
    expect(added.storyboard[1]?.intent).toBe("Enter the hall.");
  });

  it("removes a later destination without invoking the Director", () => {
    const director = vi.fn();
    const planned = projectWithDirectorPlan(projectWithA("Travel forward."), {
      summary: "Enter the next rooms.",
      beats: [
        { id: "B", intent: "Enter the hall.", visualDescription: "A hall." },
        { id: "C", intent: "Enter the chamber.", visualDescription: "A chamber." },
      ],
    });
    const next = projectWithRemovedDestination(planned, "C");
    expect(director).not.toHaveBeenCalled();
    expect(next.storyboard.map((frame) => frame.id)).toEqual(["A", "B"]);
    expect(next.storyboard[1]?.intent).toBe("Enter the hall.");
  });

  it("still exposes an A→B production leg from actual adjacent canonicals without PLAN", () => {
    const constructed = projectWithConstructedDestination(projectWithAddedDestination(projectWithA()), {
      beatId: "B",
      mediaId: B_MEDIA.mediaId,
      imageUrl: B_MEDIA.imageUrl,
    });
    const pairs = consecutiveProductionPairs(constructed);
    expect(pairs.map((pair) => `${pair.start.id}-${pair.end.id}`)).toEqual(["A-B"]);
  });
});

describe("Export Movie plan", () => {
  it("concatenates rendered clips in journey order", () => {
    const forest = createForestProject();
    const plan = movieExportPlan(forest);
    expect(plan.included.map((clip) => clip.journeyId)).toEqual(["A-B", "B-C", "C-D", "D-E", "E-F"]);
    expect(plan.missing).toEqual([]);
    expect(canExportMovie(forest)).toBe(true);
  });

  it("reports missing legs while keeping existing clips in order", () => {
    const forest = createForestProject();
    const incomplete: Project = {
      ...forest,
      journeys: forest.journeys.map((journey) =>
        journey.id === "B-C"
          ? { ...journey, status: "ready" as const, videoUrl: undefined }
          : journey,
      ),
    };
    const plan = movieExportPlan(incomplete);
    expect(plan.included.map((clip) => clip.journeyId)).toEqual(["A-B", "C-D", "D-E", "E-F"]);
    expect(plan.missing.map((item) => item.journeyId)).toEqual(["B-C"]);
    expect(
      describeMovieExport({
        videoUrl: "/api/export-movie/test",
        filename: "movie.mp4",
        complete: false,
        includedJourneyIds: plan.included.map((clip) => clip.journeyId),
        missingJourneyIds: ["B-C"],
      }),
    ).toMatch(/Incomplete export: 1 leg was missing \(B-C\)/);
  });

  it("is unavailable when no rendered clips exist", () => {
    expect(canExportMovie(createNewProject())).toBe(false);
    expect(canExportMovie(projectWithA())).toBe(false);
  });
});
