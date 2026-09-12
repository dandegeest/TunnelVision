import { describe, expect, it } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { createNewProject } from "../project/new-project";
import { projectWithDirectorPlan } from "../project/storyboard";
import { layoutShootTimeline, occurrenceForJourneyEndpoint, occurrenceIsGenerating, selectShootOccurrence, shootTimelineSlots, trailingFpoSlots } from "./shoot-layout";

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

  it("finds the start and end occurrences used by a Forest leg", () => {
    const layout = layoutShootTimeline(createForestProject(), 1);
    expect(occurrenceForJourneyEndpoint(layout.occurrences, "E-F", "start")?.destinationId).toBe("E");
    expect(occurrenceForJourneyEndpoint(layout.occurrences, "E-F", "end")?.destinationId).toBe("F");
    expect(occurrenceForJourneyEndpoint(layout.occurrences, "E-F", "start")?.occurrenceIndex).toBe(4);
    expect(occurrenceForJourneyEndpoint(layout.occurrences, "E-F", "end")?.occurrenceIndex).toBe(5);
  });

  it("selects an actual occurrence the same way the timeline does", () => {
    const layout = layoutShootTimeline(createForestProject(), 1);
    const selected: Array<{ destinationId: string; occurrenceIndex: number }> = [];
    selectShootOccurrence(occurrenceForJourneyEndpoint(layout.occurrences, "A-B", "start"), {
      select: (selection) => {
        if (selection.kind === "destination") {
          selected.push({ destinationId: selection.destinationId, occurrenceIndex: selection.occurrenceIndex });
        }
      },
      openStoryboardInPlan: () => {
        throw new Error("actual A should not open Plan");
      },
    });
    expect(selected).toEqual([{ destinationId: "A", occurrenceIndex: 0 }]);
  });

  it("opens the storyboard reel when the selected actual is clicked again", () => {
    const layout = layoutShootTimeline(createForestProject(), 1);
    const opened: string[] = [];
    const selected: Array<{ destinationId: string; occurrenceIndex: number }> = [];
    selectShootOccurrence(occurrenceForJourneyEndpoint(layout.occurrences, "A-B", "start"), {
      select: (selection) => {
        if (selection.kind === "destination") {
          selected.push({ destinationId: selection.destinationId, occurrenceIndex: selection.occurrenceIndex });
        }
      },
      openStoryboardInPlan: () => {
        throw new Error("actual A should not open Plan");
      },
      openStoryboardReel: (frameId) => {
        opened.push(frameId);
      },
      selected: true,
    });
    expect(opened).toEqual(["A"]);
    expect(selected).toEqual([]);
  });

  it("matches a generating Plan beat to the corresponding Shoot slot", () => {
    const onlyA = {
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
    const fpo = layoutShootTimeline(onlyA, 1);
    expect(occurrenceIsGenerating(fpo.occurrences[1]!, "B", onlyA.storyboard)).toBe(true);
    expect(occurrenceIsGenerating(fpo.occurrences[0]!, "B", onlyA.storyboard)).toBe(false);
    expect(occurrenceIsGenerating(fpo.occurrences[1]!, null, onlyA.storyboard)).toBe(false);
    const forest = createForestProject();
    const layout = layoutShootTimeline(forest, 1);
    const b = layout.occurrences.find((occurrence) => occurrence.destinationId === "B");
    expect(occurrenceIsGenerating(b!, "B", forest.storyboard)).toBe(true);
    expect(occurrenceIsGenerating(b!, "C", forest.storyboard)).toBe(false);
  });
});
