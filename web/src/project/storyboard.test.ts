import { describe, expect, it } from "vitest";
import { createWardrobeProject, STORYBOARD_INTENTS } from "../fixtures/wardrobe-loop";
import {
  generatedStoryboardReusesProductionCanonical,
  provenanceIsStoredNotInferred,
  selectionForWorkspaceView,
  nextStoryboardFrame,
  applyDirectorPlanToStoryboard,
  projectWithDirectorPlan,
} from "./storyboard";
import type { StoryboardFrame } from "./types";

describe("storyboard domain", () => {
  const project = createWardrobeProject();

  it("starts as authoritative A, not production Destinations or fixture B–E", () => {
    expect(project.storyboard.map((frame) => frame.id)).toEqual(["A"]);
    expect(project.storyboard[0]?.intent).toBe(STORYBOARD_INTENTS.A);
    expect(project.storyboard[0]).not.toHaveProperty("status");
    expect(project.destinations.map((destination) => destination.id)).toEqual(["A", "B", "C", "D", "E"]);
    expect(project.destinations[0]).toHaveProperty("status", "ready");
  });

  it("stores image origin explicitly; uploaded A is user", () => {
    const start = project.storyboard[0]!;
    expect(start.imageOrigin).toBe("user");
    expect(start.mediaId).toBe("wardrobe-loop-vision-a");
    expect(project.storyboard.every(provenanceIsStoredNotInferred)).toBe(true);
  });

  it("does not infer user provenance from a production-looking asset path", () => {
    const userFrame = project.storyboard.find((frame) => frame.id === "A")!;
    expect(userFrame.image).toMatch(/canonical\/vision\/A\.jpg/i);
    expect(userFrame.imageOrigin).toBe("user");
    expect(userFrame.imageOrigin).not.toBe("generated");
  });

  it("treats user-provided and generated frames as valid peers", () => {
    const generated: StoryboardFrame = {
      id: "G",
      label: "G",
      intent: "A later provisional drawing.",
      image: "/drawings/g.png",
      imageOrigin: "generated",
    };
    expect(provenanceIsStoredNotInferred(project.storyboard[0]!)).toBe(true);
    expect(provenanceIsStoredNotInferred(generated)).toBe(true);
  });

  it("allows a Director-planned storyboard frame with no image", () => {
    const planned = applyDirectorPlanToStoryboard(project.storyboard[0]!, {
      beats: [
        { id: "B", intent: "Enter the wardrobe.", visualDescription: "Dark coats." },
        { id: "C", intent: "Enter the winter forest.", visualDescription: "Trees." },
      ],
    });
    const empty = planned.filter((frame) => !frame.image);
    expect(empty.map((frame) => frame.id)).toEqual(["B", "C"]);
    expect(empty.every((frame) => frame.imageOrigin === "none")).toBe(true);
    expect(empty.every((frame) => (frame.intent?.length ?? 0) > 0)).toBe(true);
  });

  it("does not reuse production canonicals as generated storyboard drawings", () => {
    const generated: StoryboardFrame = {
      id: "B",
      label: "B",
      intent: "A generated drawing.",
      imageOrigin: "generated",
      destinationId: "B",
    };
    expect(generatedStoryboardReusesProductionCanonical(project, generated)).toBe(false);
  });

  it("keeps the Wardrobe story as a filmmaker prompt, not product synopsis copy", () => {
    expect(project.story).toMatch(/^Make a first-person POV journey/i);
    expect(project.story).not.toMatch(/finished sequence should be capable of looping/i);
    expect(project.story).not.toMatch(/EXACTLY/);
    expect(project.story).not.toMatch(/A → B → C → D → E → A/);
    expect(project.story).not.toMatch(/canonical/i);
  });

  it("keeps historical Shoot E when Plan has no fixture E beat", () => {
    const shootE = project.destinations.find((destination) => destination.id === "E")!;
    expect(project.storyboard.find((frame) => frame.id === "E")).toBeUndefined();
    expect(shootE.image).toMatch(/canonical\/vision\/E\.jpg/i);
    expect(shootE.status).toBe("ready");
  });

  it("maps Plan A to Shoot A and falls back to A when Shoot has no Plan beat", () => {
    const fromShootE = selectionForWorkspaceView(
      "plan",
      { kind: "destination", destinationId: "E", occurrenceIndex: 0 },
      project,
    );
    expect(fromShootE).toEqual({ kind: "storyboard", frameId: "A" });

    const shootSelection = selectionForWorkspaceView(
      "shoot",
      { kind: "storyboard", frameId: "A" },
      project,
    );
    expect(shootSelection).toEqual({
      kind: "destination",
      destinationId: "A",
      occurrenceIndex: 0,
    });
  });

  it("has no next beat until the Director plans a continuation", () => {
    expect(nextStoryboardFrame(project.storyboard, "A")).toBeUndefined();
  });

  it("does not invent provenance from filenames when origin is already stored", () => {
    const disguised: StoryboardFrame = {
      id: "X",
      label: "X",
      intent: "A supplied still whose filename looks generated.",
      image: "/assets/generated-storyboard-x.png",
      imageOrigin: "user",
    };
    expect(disguised.imageOrigin).toBe("user");
    expect(provenanceIsStoredNotInferred(disguised)).toBe(true);
  });
});

describe("Director owns the planned continuation", () => {
  const project = createWardrobeProject();
  const start = project.storyboard[0]!;

  it("preserves A unchanged and creates exactly the returned B...N beats", () => {
    const next = applyDirectorPlanToStoryboard(start, {
      summary: "Leave through the wardrobe.",
      beats: [
        { id: "B", intent: "Pass through the wardrobe.", visualDescription: "Coats and a snowy opening." },
        { id: "C", intent: "Enter the winter forest.", visualDescription: "Trees beyond the threshold." },
        { id: "D", intent: "Follow the ruins.", visualDescription: "Stone deeper in." },
      ],
    });
    expect(next[0]).toEqual(start);
    expect(next.map((frame) => frame.id)).toEqual(["A", "B", "C", "D"]);
    expect(next.slice(1).map((frame) => frame.intent)).toEqual([
      "Pass through the wardrobe.",
      "Enter the winter forest.",
      "Follow the ruins.",
    ]);
    expect(next.slice(1).map((frame) => frame.visualDescription)).toEqual([
      "Coats and a snowy opening.",
      "Trees beyond the threshold.",
      "Stone deeper in.",
    ]);
  });

  it("stores Director beats as FPO planned frames with no canonical image", () => {
    const next = applyDirectorPlanToStoryboard(start, {
      beats: [
        { id: "B", intent: "Enter the wardrobe.", visualDescription: "Dark coats." },
        { id: "C", intent: "Enter the forest.", visualDescription: "Moonlit trees." },
      ],
    });
    const planned = next.slice(1);
    expect(planned.every((frame) => frame.imageOrigin === "none")).toBe(true);
    expect(planned.every((frame) => frame.image === undefined)).toBe(true);
    expect(planned.every((frame) => frame.destinationId === undefined)).toBe(true);
    expect(planned.every((frame) => frame.mediaId === undefined)).toBe(true);
    expect(planned.every((frame) => !("status" in frame))).toBe(true);
  });

  it("does not keep fixture E merely because Shoot historically has five destinations", () => {
    const next = applyDirectorPlanToStoryboard(start, {
      beats: [
        { id: "B", intent: "Enter the wardrobe.", visualDescription: "Dark coats." },
        { id: "C", intent: "Enter the forest.", visualDescription: "Trees." },
      ],
    });
    expect(next.map((frame) => frame.id)).toEqual(["A", "B", "C"]);
    expect(next.some((frame) => frame.id === "E")).toBe(false);
  });

  it("drops a Director beat that repeats the starting frame id", () => {
    const next = applyDirectorPlanToStoryboard(start, {
      beats: [
        { id: "A", intent: "Remain in the attic.", visualDescription: "The supplied bedroom." },
        { id: "B", intent: "Enter the wardrobe.", visualDescription: "Dark coats." },
      ],
    });
    expect(next.map((frame) => frame.id)).toEqual(["A", "B"]);
  });

  it("fails instead of replacing the opening if Director returns only the start beat", () => {
    expect(() =>
      applyDirectorPlanToStoryboard(start, {
        beats: [{ id: "A", intent: "The attic.", visualDescription: "Opening still." }],
      }),
    ).toThrow(/no subsequent beats/i);
  });

  it("replaces a previous planned continuation on re-run without changing A", () => {
    const first = projectWithDirectorPlan(project, {
      beats: [
        { id: "B", intent: "Old wardrobe beat.", visualDescription: "Old coats." },
        { id: "C", intent: "Old forest beat.", visualDescription: "Old trees." },
        { id: "D", intent: "Old ruins beat.", visualDescription: "Old stone." },
        { id: "E", intent: "Old arch beat.", visualDescription: "Old return." },
      ],
    });
    const second = projectWithDirectorPlan(first, {
      beats: [
        { id: "B", intent: "New wardrobe beat.", visualDescription: "New coats." },
        { id: "C", intent: "New forest beat.", visualDescription: "New trees." },
        { id: "D", intent: "New ruins beat.", visualDescription: "New stone." },
        { id: "E", intent: "New cavern beat.", visualDescription: "New glow." },
        { id: "F", intent: "New stair beat.", visualDescription: "New steps." },
        { id: "G", intent: "New observatory beat.", visualDescription: "New sky." },
      ],
    });
    expect(second.storyboard[0]).toEqual(first.storyboard[0]);
    expect(second.storyboard[0]).toEqual(project.storyboard[0]);
    expect(second.storyboard.map((frame) => frame.id)).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
    expect(second.storyboard.slice(1).map((frame) => frame.intent)).toEqual([
      "New wardrobe beat.",
      "New forest beat.",
      "New ruins beat.",
      "New cavern beat.",
      "New stair beat.",
      "New observatory beat.",
    ]);
    expect(second.storyboard.some((frame) => frame.intent?.startsWith("Old "))).toBe(false);
  });

  it("applies Director beats to Plan without changing Shoot destinations or journeys", () => {
    const updated = projectWithDirectorPlan(project, {
      beats: [
        { id: "B", intent: "Director wardrobe beat.", visualDescription: "Inside the wardrobe." },
        { id: "C", intent: "Director forest beat.", visualDescription: "Winter trees." },
      ],
    });
    expect(updated.destinations).toEqual(project.destinations);
    expect(updated.journeys).toEqual(project.journeys);
    expect(updated.storyboard[0]?.image).toBe(project.storyboard[0]?.image);
    expect(updated.storyboard[0]?.mediaId).toBe(project.storyboard[0]?.mediaId);
    expect(updated.storyboard.some((frame) => frame.intent === "Director wardrobe beat.")).toBe(true);
  });

  it("derives next-beat sequence from the Director continuation", () => {
    const planned = applyDirectorPlanToStoryboard(start, {
      beats: [
        { id: "B", intent: "Enter the wardrobe.", visualDescription: "Dark coats." },
        { id: "C", intent: "Enter the forest.", visualDescription: "Trees." },
      ],
    });
    expect(nextStoryboardFrame(planned, "A")?.id).toBe("B");
    expect(nextStoryboardFrame(planned, "C")).toBeUndefined();
  });
});
