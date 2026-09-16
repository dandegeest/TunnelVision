import { describe, expect, it } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { createNewProject } from "../project/new-project";
import { projectWithDirectorPlan } from "../project/storyboard";
import { currentCutDurationSeconds } from "../project/current-cut";
import { projectWithAppendedTake, projectWithSelectedTake, takeId, journeyTakes } from "../project/takes";
import { journeyPlayheadStart, layoutShootTimeline, occurrenceForJourneyEndpoint, occurrenceIsGenerating, playheadStartForSelection, selectShootOccurrence, shootTimelineSlots, trailingFpoSlots } from "./shoot-layout";

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

  it("places the playhead at the selected segment item", () => {
    const forest = createForestProject();
    const layout = layoutShootTimeline(forest, 1);
    expect(journeyPlayheadStart(forest, "A-B")).toBe(layout.journeys[0]?.startTime);
    expect(journeyPlayheadStart(forest, "B-C")).toBe(layout.journeys[1]?.startTime);
    expect(journeyPlayheadStart(forest, "B-C")).toBeGreaterThan(0);
    expect(journeyPlayheadStart(forest, "missing")).toBeUndefined();
    expect(playheadStartForSelection(forest, { kind: "journey", journeyId: "B-C", band: "motion" })).toBe(
      layout.journeys[1]?.startTime,
    );
    expect(playheadStartForSelection(forest, { kind: "journey", journeyId: "B-C", band: "footage" })).toBe(
      layout.journeys[1]?.startTime,
    );
    expect(playheadStartForSelection(forest, { kind: "destination", destinationId: "B", occurrenceIndex: 1 })).toBe(
      layout.occurrences[1]?.timeSeconds,
    );
  });

  it("lays Fast 6s Takes at 18s and Kling 5s Takes at 15s on a three-leg cut", () => {
    const three = threeLegForest();
    expect(layoutShootTimeline(three, 1).totalDuration).toBe(18);
    expect(currentCutDurationSeconds(three)).toBe(18);
    const kling = withKlingPass(three);
    expect(layoutShootTimeline(kling, 1).totalDuration).toBe(15);
    expect(currentCutDurationSeconds(kling)).toBe(15);
    expect(layoutShootTimeline(kling, 1).journeys.map((item) => item.endTime - item.startTime)).toEqual([5, 5, 5]);
    const fastCut = ["A-B", "B-C", "C-D"].reduce(
      (project, journeyId) => projectWithSelectedTake(project, journeyId, takeId(journeyId, 1)),
      kling,
    );
    expect(layoutShootTimeline(fastCut, 1).totalDuration).toBe(18);
    expect(currentCutDurationSeconds(fastCut)).toBe(18);
    expect(layoutShootTimeline(fastCut, 1).journeys.map((item) => item.endTime - item.startTime)).toEqual([6, 6, 6]);
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

function threeLegForest() {
  const forest = createForestProject();
  return {
    ...forest,
    destinations: forest.destinations.filter((destination) => ["A", "B", "C", "D"].includes(destination.id)),
    storyboard: forest.storyboard.filter((frame) => ["A", "B", "C", "D"].includes(frame.id)),
    journeys: forest.journeys.filter((journey) => ["A-B", "B-C", "C-D"].includes(journey.id)),
  };
}

function withKlingPass(project: ReturnType<typeof threeLegForest>) {
  return project.journeys.reduce((next, journey) => {
    const first = journeyTakes(next.journeys.find((item) => item.id === journey.id)!)[0];
    if (!first) {
      throw new Error(`${journey.id} needs a Fast take`);
    }
    return projectWithAppendedTake(next, journey.id, {
      take: {
        ...first,
        id: undefined,
        number: undefined,
        model: "kwaivgi/kling-v2.5-turbo-pro",
        durationSeconds: 5,
        generationIntent: "quality",
      },
      videoUrl: `/${journey.id}-kling.mp4`,
    });
  }, project);
}
