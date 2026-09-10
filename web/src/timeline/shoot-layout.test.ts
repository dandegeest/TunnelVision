import { describe, expect, it } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { createNewProject } from "../project/new-project";
import { projectWithDirectorPlan } from "../project/storyboard";
import { layoutShootTimeline, shootTimelineSlots, trailingFpoSlots } from "./shoot-layout";

const A_MEDIA = {
  mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  image: "/api/runtime-media/upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};

describe("shoot timeline slots", () => {
  it("adds an FPO B when only A is actual", () => {
    const project = {
      ...createNewProject(),
      storyboard: [
        {
          id: "A",
          label: "A",
          imageOrigin: "user" as const,
          image: A_MEDIA.image,
          mediaId: A_MEDIA.mediaId,
          destinationId: "A",
        },
      ],
    };
    expect(shootTimelineSlots(project)).toEqual([
      { id: "A", label: "A", fpo: false, image: A_MEDIA.image },
      { id: "B", label: "B", fpo: true },
    ]);
    const layout = layoutShootTimeline(project, 1);
    expect(layout.occurrences.map((occurrence) => occurrence.destinationId)).toEqual(["A", "B"]);
    expect(layout.occurrences[1]?.fpo).toBe(true);
    expect(layout.journeys).toEqual([]);
  });

  it("keeps planned FPO beats after A", () => {
    const withA = {
      ...createNewProject(),
      story: "Travel forward through an imagined interior at night.",
      storyboard: [
        {
          id: "A",
          label: "A",
          imageOrigin: "user" as const,
          image: A_MEDIA.image,
          mediaId: A_MEDIA.mediaId,
          destinationId: "A",
        },
      ],
    };
    const planned = projectWithDirectorPlan(withA, {
      summary: "A continuous interior journey.",
      beats: [
        { id: "B", intent: "Enter the hall.", visualDescription: "A hall." },
        { id: "C", intent: "Enter the chamber.", visualDescription: "A chamber." },
      ],
    });
    expect(shootTimelineSlots(planned).map((slot) => slot.id)).toEqual(["A", "B", "C"]);
    expect(shootTimelineSlots(planned).map((slot) => slot.fpo)).toEqual([false, true, true]);
  });

  it("does not append G onto Forest A–F", () => {
    const forest = createForestProject();
    expect(trailingFpoSlots(forest)).toEqual([]);
    const layout = layoutShootTimeline(forest, 1);
    expect(layout.occurrences.some((occurrence) => occurrence.destinationId === "G")).toBe(false);
    expect(layout.occurrences.some((occurrence) => occurrence.fpo)).toBe(false);
  });
});
