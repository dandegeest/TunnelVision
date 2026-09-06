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

  it("treats B–E as planned storyboard beats without imagery", () => {
    const planned = project.storyboard.filter((frame) => frame.id !== "A");
    expect(planned.map((frame) => frame.id)).toEqual(["B", "C", "D", "E"]);
    expect(planned.every((frame) => frame.imageOrigin === "none")).toBe(true);
    expect(planned.every((frame) => frame.image === undefined)).toBe(true);
  });

  it("keeps Plan storyboard intent separate from Shoot destination stills", () => {
    expect(project.storyboard).toHaveLength(5);
    expect(project.destinations).toHaveLength(5);
    const planE = project.storyboard.find((frame) => frame.id === "E");
    const shootE = project.destinations.find((destination) => destination.id === "E");
    expect(planE?.intent).toMatch(/stone arch/i);
    expect(shootE?.image).toMatch(/vision\/E\.jpg/i);
    expect(planE?.image).not.toBe(shootE?.image);
  });
});
