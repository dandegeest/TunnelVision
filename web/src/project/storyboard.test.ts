import { describe, expect, it } from "vitest";
import {
  createForestPartialAnchorProject,
  FOREST_STORYBOARD_INTENTS,
} from "../fixtures/forest-a-to-f";
import { createWardrobeProject, STORYBOARD_INTENTS } from "../fixtures/wardrobe-loop";
import { createNewProject } from "./new-project";
import {
  generatedStoryboardReusesProductionCanonical,
  provenanceIsStoredNotInferred,
  selectionForWorkspaceView,
  nextStoryboardFrame,
  applyDirectorPlanToStoryboard,
  isSpecifiedStoryboardDestination,
  canAddStoryboardDestination,
  nextStoryboardSlot,
  projectWithAddedDestination,
  projectWithDirectorPlan,
} from "./storyboard";
import { projectWithConstructedDestination } from "./destination";
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
    const planned = applyDirectorPlanToStoryboard(project.storyboard, {
      summary: "A planned journey.",
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
      kind: "journey",
      journeyId: "A-B",
    });
  });

  it("keeps Shoot on the storyboard selection when a new project has no destinations", () => {
    const project = createNewProject();
    expect(
      selectionForWorkspaceView("shoot", { kind: "storyboard", frameId: "A" }, project),
    ).toEqual({ kind: "storyboard", frameId: "A" });
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
    const next = applyDirectorPlanToStoryboard(project.storyboard, {
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
    const next = applyDirectorPlanToStoryboard(project.storyboard, {
      summary: "A planned journey.",
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
    const next = applyDirectorPlanToStoryboard(project.storyboard, {
      summary: "A planned journey.",
      beats: [
        { id: "B", intent: "Enter the wardrobe.", visualDescription: "Dark coats." },
        { id: "C", intent: "Enter the forest.", visualDescription: "Trees." },
      ],
    });
    expect(next.map((frame) => frame.id)).toEqual(["A", "B", "C"]);
    expect(next.some((frame) => frame.id === "E")).toBe(false);
  });

  it("drops a Director beat that repeats the starting frame id", () => {
    const next = applyDirectorPlanToStoryboard(project.storyboard, {
      summary: "A planned journey.",
      beats: [
        { id: "A", intent: "Remain in the attic.", visualDescription: "The supplied bedroom." },
        { id: "B", intent: "Enter the wardrobe.", visualDescription: "Dark coats." },
      ],
    });
    expect(next.map((frame) => frame.id)).toEqual(["A", "B"]);
  });

  it("fails instead of replacing the opening if Director returns only the start beat", () => {
    expect(() =>
      applyDirectorPlanToStoryboard(project.storyboard, {
        summary: "Opening only.",
        beats: [{ id: "A", intent: "The attic.", visualDescription: "Opening still." }],
      }),
    ).toThrow(/no subsequent beats/i);
  });

  it("replaces a previous planned continuation on re-run without changing A", () => {
    const first = projectWithDirectorPlan(project, {
      summary: "A planned journey.",
      beats: [
        { id: "B", intent: "Old wardrobe beat.", visualDescription: "Old coats." },
        { id: "C", intent: "Old forest beat.", visualDescription: "Old trees." },
        { id: "D", intent: "Old ruins beat.", visualDescription: "Old stone." },
        { id: "E", intent: "Old arch beat.", visualDescription: "Old return." },
      ],
    });
    const second = projectWithDirectorPlan(first, {
      summary: "A revised journey.",
      beats: [
        { id: "B", intent: "New wardrobe beat.", visualDescription: "New coats." },
        { id: "C", intent: "New forest beat.", visualDescription: "New trees." },
        { id: "D", intent: "New ruins beat.", visualDescription: "New stone." },
        { id: "E", intent: "New cavern beat.", visualDescription: "New glow." },
      ],
    });
    expect(second.storyboard[0]).toEqual(first.storyboard[0]);
    expect(second.storyboard[0]).toEqual(project.storyboard[0]);
    expect(second.storyboard.map((frame) => frame.id)).toEqual(["A", "B", "C", "D", "E"]);
    expect(second.storyboard.slice(1).map((frame) => frame.intent)).toEqual([
      "New wardrobe beat.",
      "New forest beat.",
      "New ruins beat.",
      "New cavern beat.",
    ]);
    expect(second.storyboard.some((frame) => frame.intent?.startsWith("Old "))).toBe(false);
  });

  it("applies Director beats to Plan without changing Shoot destinations or journeys", () => {
    const updated = projectWithDirectorPlan(project, {
      summary: "A planned journey.",
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
    const planned = applyDirectorPlanToStoryboard(project.storyboard, {
      summary: "A planned journey.",
      beats: [
        { id: "B", intent: "Enter the wardrobe.", visualDescription: "Dark coats." },
        { id: "C", intent: "Enter the forest.", visualDescription: "Trees." },
      ],
    });
    expect(nextStoryboardFrame(planned, "A")?.id).toBe("B");
    expect(nextStoryboardFrame(planned, "C")).toBeUndefined();
  });

  it("appends the next unused letter as an empty planned destination", () => {
    const added = projectWithAddedDestination(project);
    expect(nextStoryboardSlot(project.storyboard)).toEqual({ id: "B", label: "B" });
    expect(added.storyboard.map((frame) => frame.id)).toEqual(["A", "B"]);
    expect(added.storyboard[1]).toMatchObject({ id: "B", label: "B", imageOrigin: "none" });
    expect(added.storyboard[1]?.image).toBeUndefined();
    expect(added.storyboard[0]).toEqual(project.storyboard[0]);
    expect(added.destinations).toEqual(project.destinations);
  });
});

describe("Add Destination is structural after actual A", () => {
  const constructedB = {
    beatId: "B",
    mediaId: "upload-11111111111111111111111111111111",
    imageUrl: "/api/runtime-media/upload-11111111111111111111111111111111",
  };

  it("stays hidden on an empty project without inventing B or a journey", () => {
    const empty = createNewProject();
    expect(canAddStoryboardDestination(empty)).toBe(false);
    expect(empty.storyboard.map((frame) => frame.id)).toEqual(["A"]);
    expect(empty.destinations).toEqual([]);
    expect(empty.journeys).toEqual([]);
  });

  it("becomes available once A is an actual canonical still", () => {
    const wardrobe = createWardrobeProject();
    expect(isSpecifiedStoryboardDestination(wardrobe.storyboard[0]!)).toBe(true);
    expect(wardrobe.storyboard.find((frame) => frame.id === "B")).toBeUndefined();
    expect(canAddStoryboardDestination(wardrobe)).toBe(true);
  });

  it("remains available while later slots are still unresolved", () => {
    const planned = projectWithDirectorPlan(createWardrobeProject(), {
      summary: "A planned journey.",
      beats: [
        { id: "B", intent: "Enter the wardrobe.", visualDescription: "Dark coats." },
        { id: "C", intent: "Enter the forest.", visualDescription: "Trees." },
      ],
    });
    expect(planned.storyboard[1]?.id).toBe("B");
    expect(isSpecifiedStoryboardDestination(planned.storyboard[1]!)).toBe(false);
    expect(canAddStoryboardDestination(planned)).toBe(true);
    const actual = projectWithConstructedDestination(planned, constructedB);
    expect(canAddStoryboardDestination(actual)).toBe(true);
  });
});

const ADF_CONNECTIVE_PLAN = {
  summary: "Connect the forest path through the crystal toward the void.",
  beats: [
    { id: "B", intent: "Approach the root-tunnel mouth.", visualDescription: "A dark opening in the roots." },
    { id: "C", intent: "Enter the circular root tunnel.", visualDescription: "A centered wooden tube." },
    { id: "D", intent: "Director rewrite of the crystal.", visualDescription: "A restyled crystal cluster." },
    { id: "E", intent: "Continue toward the portal corridor.", visualDescription: "A dark reflective hall." },
    { id: "F", intent: "Director rewrite of the void.", visualDescription: "A restyled debris field." },
  ],
};

describe("Director preserves specified destinations", () => {
  it("keeps A, D, and F unchanged while filling unresolved B, C, and E", () => {
    const project = createForestPartialAnchorProject();
    const [start, crystal, voidFrame] = project.storyboard;
    const next = projectWithDirectorPlan(project, ADF_CONNECTIVE_PLAN);
    expect(next.storyboard.map((frame) => frame.id)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(next.storyboard[0]).toEqual(start);
    expect(next.storyboard.find((frame) => frame.id === "D")).toEqual(crystal);
    expect(next.storyboard.find((frame) => frame.id === "F")).toEqual(voidFrame);
    expect(next.storyboard[1]).toMatchObject({
      id: "B",
      imageOrigin: "none",
      intent: "Approach the root-tunnel mouth.",
    });
    expect(next.storyboard[2]).toMatchObject({
      id: "C",
      imageOrigin: "none",
      intent: "Enter the circular root tunnel.",
    });
    expect(next.storyboard[4]).toMatchObject({
      id: "E",
      imageOrigin: "none",
      intent: "Continue toward the portal corridor.",
    });
    expect(next.storyboard[1]?.image).toBeUndefined();
    expect(next.storyboard[3]?.intent).toBe(FOREST_STORYBOARD_INTENTS.D);
    expect(next.storyboard[5]?.intent).toBe(FOREST_STORYBOARD_INTENTS.F);
    expect(next.storyboard[3]?.image).toBe(crystal?.image);
    expect(next.storyboard[3]?.mediaId).toBe(crystal?.mediaId);
    expect(next.storyboard[3]?.imageOrigin).toBe(crystal?.imageOrigin);
  });

  it("preserves relative order of specified destinations", () => {
    const project = createForestPartialAnchorProject();
    const next = applyDirectorPlanToStoryboard(project.storyboard, ADF_CONNECTIVE_PLAN);
    const specified = next.filter(isSpecifiedStoryboardDestination).map((frame) => frame.id);
    expect(specified).toEqual(["A", "D", "F"]);
  });

  it("still plans a generated-only continuation from A plus a prompt", () => {
    const project = createWardrobeProject();
    const next = applyDirectorPlanToStoryboard(project.storyboard, {
      summary: "Leave through the wardrobe.",
      beats: [
        { id: "B", intent: "Pass through the wardrobe.", visualDescription: "Coats and a snowy opening." },
        { id: "C", intent: "Enter the winter forest.", visualDescription: "Trees beyond the threshold." },
      ],
    });
    expect(next.map((frame) => frame.id)).toEqual(["A", "B", "C"]);
    expect(next[0]).toEqual(project.storyboard[0]);
    expect(next.slice(1).every((frame) => frame.imageOrigin === "none")).toBe(true);
  });

  it("does not replace specified anchors when the Director is run again", () => {
    const project = createForestPartialAnchorProject();
    const first = projectWithDirectorPlan(project, ADF_CONNECTIVE_PLAN);
    const second = projectWithDirectorPlan(first, {
      summary: "A revised connective journey.",
      beats: [
        { id: "B", intent: "New mouth beat.", visualDescription: "New opening." },
        { id: "C", intent: "New tunnel beat.", visualDescription: "New tube." },
        { id: "D", intent: "Another crystal rewrite.", visualDescription: "Another restyle." },
        { id: "E", intent: "New corridor beat.", visualDescription: "New hall." },
        { id: "F", intent: "Another void rewrite.", visualDescription: "Another restyle." },
      ],
    });
    expect(second.storyboard.map((frame) => frame.id)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(second.storyboard[0]).toEqual(project.storyboard[0]);
    expect(second.storyboard[3]).toEqual(project.storyboard[1]);
    expect(second.storyboard[5]).toEqual(project.storyboard[2]);
    expect(second.storyboard[1]?.intent).toBe("New mouth beat.");
    expect(second.storyboard[2]?.intent).toBe("New tunnel beat.");
    expect(second.storyboard[4]?.intent).toBe("New corridor beat.");
    expect(second.storyboard.some((frame) => frame.intent?.includes("rewrite"))).toBe(false);
  });

  it("does not apply Director rewrites of D or F to the stored frames", () => {
    const project = createForestPartialAnchorProject();
    const crystal = project.storyboard[1];
    const voidFrame = project.storyboard[2];
    const next = applyDirectorPlanToStoryboard(project.storyboard, ADF_CONNECTIVE_PLAN);
    expect(next.find((frame) => frame.id === "D")).toEqual(crystal);
    expect(next.find((frame) => frame.id === "F")).toEqual(voidFrame);
    expect(next.find((frame) => frame.id === "D")?.intent).not.toBe("Director rewrite of the crystal.");
    expect(next.find((frame) => frame.id === "F")?.visualDescription).not.toBe(
      "A restyled debris field.",
    );
  });

  it("fails when the Director omits authoritative destination D", () => {
    const project = createForestPartialAnchorProject();
    const before = project.storyboard.map((frame) => ({ ...frame }));
    expect(() =>
      applyDirectorPlanToStoryboard(project.storyboard, {
        summary: "Missing the crystal.",
        beats: [
          { id: "B", intent: "Approach the mouth.", visualDescription: "Root opening." },
          { id: "C", intent: "Enter the tunnel.", visualDescription: "Wooden tube." },
          { id: "E", intent: "A later corridor.", visualDescription: "Dark hall." },
          { id: "F", intent: "Reach the void.", visualDescription: "Debris field." },
        ],
      }),
    ).toThrow(/omitted authoritative destination D/i);
    expect(project.storyboard).toEqual(before);
  });

  it("fails when the Director omits authoritative destination F", () => {
    const project = createForestPartialAnchorProject();
    expect(() =>
      applyDirectorPlanToStoryboard(project.storyboard, {
        summary: "Missing the void.",
        beats: [
          { id: "B", intent: "Approach the mouth.", visualDescription: "Root opening." },
          { id: "C", intent: "Enter the tunnel.", visualDescription: "Wooden tube." },
          { id: "D", intent: "Pass the crystal.", visualDescription: "Glowing cluster." },
          { id: "E", intent: "A later corridor.", visualDescription: "Dark hall." },
        ],
      }),
    ).toThrow(/omitted authoritative destination F/i);
  });

  it("fails when the Director reorders F before D", () => {
    const project = createForestPartialAnchorProject();
    expect(() =>
      applyDirectorPlanToStoryboard(project.storyboard, {
        summary: "Reversed crystal and void.",
        beats: [
          { id: "B", intent: "Approach the mouth.", visualDescription: "Root opening." },
          { id: "C", intent: "Enter the tunnel.", visualDescription: "Wooden tube." },
          { id: "F", intent: "Reach the void first.", visualDescription: "Debris field." },
          { id: "E", intent: "A later corridor.", visualDescription: "Dark hall." },
          { id: "D", intent: "Pass the crystal later.", visualDescription: "Glowing cluster." },
        ],
      }),
    ).toThrow(/reordered authoritative destinations/i);
  });

  it("fails when the Director duplicates authoritative destination D", () => {
    const project = createForestPartialAnchorProject();
    expect(() =>
      applyDirectorPlanToStoryboard(project.storyboard, {
        summary: "Two crystal markers.",
        beats: [
          { id: "B", intent: "Approach the mouth.", visualDescription: "Root opening." },
          { id: "D", intent: "First crystal marker.", visualDescription: "Glowing cluster." },
          { id: "E", intent: "A later corridor.", visualDescription: "Dark hall." },
          { id: "D", intent: "Second crystal marker.", visualDescription: "Another cluster." },
          { id: "F", intent: "Reach the void.", visualDescription: "Debris field." },
        ],
      }),
    ).toThrow(/duplicated authoritative destination D/i);
  });

  it("fails when the Director omits D and F instead of guessing their placement", () => {
    const project = createForestPartialAnchorProject();
    expect(() =>
      applyDirectorPlanToStoryboard(project.storyboard, {
        summary: "Fill only some gaps.",
        beats: [
          { id: "B", intent: "Approach the mouth.", visualDescription: "Root opening." },
          { id: "C", intent: "Enter the tunnel.", visualDescription: "Wooden tube." },
          { id: "E", intent: "A later corridor.", visualDescription: "Dark hall." },
        ],
      }),
    ).toThrow(/omitted authoritative destination D/i);
  });

  it("does not replace a constructed destination when the Director replans around it", () => {
    const planned = projectWithDirectorPlan(createWardrobeProject(), {
      summary: "A planned journey.",
      beats: [
        { id: "B", intent: "Enter the wardrobe.", visualDescription: "Dark coats." },
        { id: "C", intent: "Enter the forest.", visualDescription: "Trees." },
      ],
    });
    const constructed = projectWithConstructedDestination(planned, {
      beatId: "B",
      mediaId: "upload-11111111111111111111111111111111",
      imageUrl: "/api/runtime-media/upload-11111111111111111111111111111111",
    });
    const actualB = constructed.storyboard[1];
    const replanned = projectWithDirectorPlan(constructed, {
      summary: "A revised journey.",
      beats: [
        { id: "B", intent: "Rewrite the wardrobe.", visualDescription: "Restyled coats." },
        { id: "C", intent: "New forest beat.", visualDescription: "New trees." },
      ],
    });
    expect(replanned.storyboard.map((frame) => frame.id)).toEqual(["A", "B", "C"]);
    expect(replanned.storyboard[1]).toEqual(actualB);
    expect(replanned.storyboard[2]?.intent).toBe("New forest beat.");
  });
});
