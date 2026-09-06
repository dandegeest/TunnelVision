import { describe, expect, it } from "vitest";
import { createWardrobeProject } from "./wardrobe-loop";
import { journeyIsPlayable } from "../project/policy";

describe("wardrobe loop fixture", () => {
  const project = createWardrobeProject();

  it("has five destinations A–E, all ready, with no intrinsic not-shootable destination", () => {
    expect(project.destinations.map((destination) => destination.id)).toEqual(["A", "B", "C", "D", "E"]);
    expect(project.destinations.every((destination) => destination.status === "ready")).toBe(true);
    expect(project.construction).toBe("planned");
  });

  it("marks shootability on the E-A route, not on destination E", () => {
    const e = project.destinations.find((destination) => destination.id === "E");
    const ea = project.journeys.find((journey) => journey.id === "E-A");
    expect(e?.status).toBe("ready");
    expect(ea?.status).toBe("not_shootable");
    expect(ea?.endDestinationId).toBe("A");
    expect(ea?.videoUrl).toBeUndefined();
    expect(journeyIsPlayable(ea!)).toBe(false);
  });

  it("keeps A-B, B-C, and D-E playable, and C-D rendered with review", () => {
    const byId = Object.fromEntries(project.journeys.map((journey) => [journey.id, journey]));
    expect(byId["A-B"].status).toBe("rendered");
    expect(byId["B-C"].status).toBe("rendered");
    expect(byId["C-D"].status).toBe("needs_review");
    expect(byId["D-E"].status).toBe("rendered");
    expect(journeyIsPlayable(byId["A-B"])).toBe(true);
    expect(journeyIsPlayable(byId["C-D"])).toBe(true);
  });

  it("initializes Plan A with a trusted media identity, not a filesystem path", () => {
    const start = project.storyboard[0];
    expect(start?.id).toBe("A");
    expect(start?.imageOrigin).toBe("user");
    expect(start?.mediaId).toBe("wardrobe-loop-vision-a");
    expect(start?.mediaId).not.toMatch(/[/\\]/);
  });

  it("initializes Plan as authoritative A only, without fixture B–E beats", () => {
    expect(project.storyboard.map((frame) => frame.id)).toEqual(["A"]);
    expect(project.storyboard.some((frame) => ["B", "C", "D", "E"].includes(frame.id))).toBe(false);
  });

  it("keeps historical Shoot evidence independent of the unplanned Plan", () => {
    expect(project.storyboard).toHaveLength(1);
    expect(project.destinations).toHaveLength(5);
    const shootE = project.destinations.find((destination) => destination.id === "E");
    expect(shootE?.image).toMatch(/vision\/E\.jpg/i);
    expect(project.storyboard.find((frame) => frame.id === "E")).toBeUndefined();
  });
});
