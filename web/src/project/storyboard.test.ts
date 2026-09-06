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

  it("keeps storyboard order A–E as Director intent, not production Destinations", () => {
    expect(project.storyboard.map((frame) => frame.id)).toEqual(["A", "B", "C", "D", "E"]);
    expect(project.storyboard.map((frame) => frame.intent)).toEqual([
      STORYBOARD_INTENTS.A,
      STORYBOARD_INTENTS.B,
      STORYBOARD_INTENTS.C,
      STORYBOARD_INTENTS.D,
      STORYBOARD_INTENTS.E,
    ]);
    expect(project.storyboard[0]).not.toHaveProperty("status");
    expect(project.destinations[0]).toHaveProperty("status", "ready");
  });

  it("stores image origin explicitly; uploaded A is user, planned B–E have no drawing yet", () => {
    const byId = Object.fromEntries(project.storyboard.map((frame) => [frame.id, frame]));
    expect(byId.A.imageOrigin).toBe("user");
    expect(byId.A.mediaId).toBe("wardrobe-loop-vision-a");
    expect(byId.B.imageOrigin).toBe("none");
    expect(byId.C.imageOrigin).toBe("none");
    expect(byId.D.imageOrigin).toBe("none");
    expect(byId.E.imageOrigin).toBe("none");
    expect(byId.E.image).toBeUndefined();
    expect(byId.B.mediaId).toBeUndefined();
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

  it("allows a storyboard frame with no image", () => {
    const empty = project.storyboard.filter((frame) => !frame.image);
    expect(empty.map((frame) => frame.id)).toEqual(["B", "C", "D", "E"]);
    expect(empty.every((frame) => frame.imageOrigin === "none")).toBe(true);
    expect(empty.every((frame) => frame.intent.length > 0)).toBe(true);
  });

  it("does not reuse production canonicals as generated storyboard drawings", () => {
    const generated: StoryboardFrame = {
      id: "B",
      label: "B",
      intent: STORYBOARD_INTENTS.B,
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

  it("lets intended E differ from production E without changing Shoot data", () => {
    const planE = project.storyboard.find((frame) => frame.id === "E")!;
    const shootE = project.destinations.find((destination) => destination.id === "E")!;
    expect(planE.intent).toMatch(/open stone arch/i);
    expect(planE.intent).not.toMatch(/closed/i);
    expect(shootE.image).toMatch(/canonical\/vision\/E\.jpg/i);
    expect(shootE.status).toBe("ready");
    expect(planE.image).toBeUndefined();
  });

  it("maps Plan ↔ Shoot selection without collapsing the two models", () => {
    const planSelection = selectionForWorkspaceView(
      "plan",
      { kind: "destination", destinationId: "E", occurrenceIndex: 0 },
      project,
    );
    expect(planSelection).toEqual({ kind: "storyboard", frameId: "E" });

    const shootSelection = selectionForWorkspaceView(
      "shoot",
      { kind: "storyboard", frameId: "E" },
      project,
    );
    expect(shootSelection).toEqual({
      kind: "destination",
      destinationId: "E",
      occurrenceIndex: 4,
    });

    const afterRoundTrip = selectionForWorkspaceView("shoot", planSelection, project);
    expect(afterRoundTrip.kind).toBe("destination");
    if (afterRoundTrip.kind === "destination") {
      expect(afterRoundTrip.destinationId).toBe("E");
      expect(afterRoundTrip.occurrenceIndex).toBe(4);
    }
    const planE = project.storyboard.find((frame) => frame.id === "E");
    const shootE = project.destinations.find((destination) => destination.id === "E");
    expect(planE?.intent).not.toBe(shootE?.image);
  });

  it("derives next-beat intent from sequence order", () => {
    const next = nextStoryboardFrame(project.storyboard, "A");
    expect(next?.id).toBe("B");
    expect(nextStoryboardFrame(project.storyboard, "E")).toBeUndefined();
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

  it("preserves the uploaded starting frame and fills later beats from Director output", () => {
    const start = project.storyboard[0]!;
    const next = applyDirectorPlanToStoryboard(start, {
      summary: "Leave through the wardrobe.",
      beats: [
        { id: "B", intent: "Pass through the wardrobe.", visualDescription: "Coats and a snowy opening." },
        { id: "C", intent: "Enter the winter forest.", visualDescription: "Trees beyond the threshold." },
      ],
    });
    expect(next[0]).toEqual(start);
    expect(next[0]?.imageOrigin).toBe("user");
    expect(next[0]?.image).toBe(start.image);
    expect(next[0]?.mediaId).toBe(start.mediaId);
    expect(next.slice(1).map((frame) => frame.intent)).toEqual([
      "Pass through the wardrobe.",
      "Enter the winter forest.",
    ]);
    expect(next.slice(1).every((frame) => frame.imageOrigin === "none")).toBe(true);
    expect(next.slice(1).every((frame) => frame.image === undefined)).toBe(true);
  });

  it("drops a Director beat that repeats the starting frame id", () => {
    const next = applyDirectorPlanToStoryboard(project.storyboard[0]!, {
      beats: [
        { id: "A", intent: "Remain in the attic.", visualDescription: "The supplied bedroom." },
        { id: "B", intent: "Enter the wardrobe.", visualDescription: "Dark coats." },
      ],
    });
    expect(next.map((frame) => frame.id)).toEqual(["A", "B"]);
  });

  it("fails instead of replacing the opening if Director returns only the start beat", () => {
    expect(() =>
      applyDirectorPlanToStoryboard(project.storyboard[0]!, {
        beats: [{ id: "A", intent: "The attic.", visualDescription: "Opening still." }],
      }),
    ).toThrow(/no subsequent beats/i);
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
});
