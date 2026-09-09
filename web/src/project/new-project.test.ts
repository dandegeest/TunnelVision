import { describe, expect, it } from "vitest";
import { createNewProject } from "./new-project";
import { canProvideStartingFrame, hasAuthoritativeStartingFrame } from "./starting-frame";

describe("new product project", () => {
  it("starts as a partially specified movie with an unresolved opening slot", () => {
    const project = createNewProject();
    expect(project.id).toBe("untitled");
    expect(project.title).toBe("UNTITLED");
    expect(project.story).toBe("");
    expect(project.agency).toBe("directed");
    expect(project.construction).toBe("planned");
    expect(project.storyboard).toEqual([{ id: "A", label: "A", imageOrigin: "none" }]);
    expect(project.destinations).toEqual([]);
    expect(project.journeys).toEqual([]);
    expect(project.boundaryAnalysis).toBeUndefined();
    expect(project.storyDuration).toBe("auto");
    expect(project.autoGenerateOpening).toBe(true);
    expect(project.autoGenerateAllDestinations).toBe(false);
    expect(project.autoBlockShots).toBe(false);
    expect(project.autoShoot).toBe(false);
    expect(project.storyDurationLocked).toBe(false);
    expect(canProvideStartingFrame(project.storyboard[0]!)).toBe(true);
    expect(hasAuthoritativeStartingFrame(project)).toBe(false);
  });

  it("does not invent Forest destinations, journeys, media, or story", () => {
    const project = createNewProject();
    expect(project.story).not.toMatch(/forest/i);
    expect(JSON.stringify(project)).not.toMatch(/forest-a-to-f/i);
    expect(project.storyboard.every((frame) => !frame.image && !frame.mediaId)).toBe(true);
  });
});
