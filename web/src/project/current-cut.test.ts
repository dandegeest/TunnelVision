import { describe, expect, it } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { createNewProject } from "./new-project";
import {
  canDownloadCurrentCut,
  currentCutClips,
  currentCutFingerprint,
  cutPlaybackSlotFromClip,
  downloadCurrentCutUnavailableReason,
  emptyCutPlaybackSlot,
  formatCutClock,
  nextCurrentCutClip,
  reconcileCutPlaybackSlots,
} from "./current-cut";
import { journeyTakes, projectWithSelectedTake } from "./takes";
import { projectWithSyncedProductionLegs } from "./production-legs";

describe("current cut", () => {
  it("can download Forest when every required segment has a selected Take", () => {
    const forest = createForestProject();
    expect(currentCutClips(forest).map((clip) => clip.journeyId)).toEqual([
      "A-B",
      "B-C",
      "C-D",
      "D-E",
      "E-F",
    ]);
    expect(canDownloadCurrentCut(forest)).toBe(true);
    expect(downloadCurrentCutUnavailableReason(forest)).toBe("");
  });

  it("does not download a partial cut", () => {
    const forest = createForestProject();
    const incomplete = {
      ...forest,
      journeys: forest.journeys.map((journey) =>
        journey.id === "B-C"
          ? { ...journey, status: "ready" as const, videoUrl: undefined, takes: [], take: undefined, selectedTakeId: undefined }
          : journey,
      ),
    };
    expect(canDownloadCurrentCut(incomplete)).toBe(false);
    expect(downloadCurrentCutUnavailableReason(incomplete)).toMatch(/every required segment/i);
    expect(currentCutClips(incomplete).map((clip) => clip.journeyId)).toEqual(["A-B", "C-D", "D-E", "E-F"]);
  });

  it("changes the cut fingerprint when a different Take is selected", () => {
    const forest = createForestProject();
    const first = currentCutFingerprint(forest);
    const withSecond = projectWithJourneySecondTake(forest);
    const selectedFirst = projectWithSelectedTake(withSecond, "A-B", "A-B:take:1");
    const selectedSecond = projectWithSelectedTake(withSecond, "A-B", "A-B:take:2");
    expect(currentCutFingerprint(selectedFirst)).not.toBe(currentCutFingerprint(selectedSecond));
    expect(first).not.toBe(currentCutFingerprint(selectedSecond));
  });

  it("names the next selected Take for cut prebuffer", () => {
    const forest = createForestProject();
    expect(nextCurrentCutClip(forest, "A-B")?.journeyId).toBe("B-C");
    expect(nextCurrentCutClip(forest, "E-F")).toBeUndefined();
    expect(nextCurrentCutClip(forest, null)).toBeUndefined();
  });

  it("keeps the upcoming clip on the hidden slot when the cut advances", () => {
    const forest = createForestProject();
    const first = cutPlaybackSlotFromClip(currentCutClips(forest)[0]);
    const second = cutPlaybackSlotFromClip(currentCutClips(forest)[1]);
    const third = cutPlaybackSlotFromClip(currentCutClips(forest)[2]);
    const loaded = reconcileCutPlaybackSlots(0, [emptyCutPlaybackSlot(), emptyCutPlaybackSlot()], first, second);
    expect(loaded.front).toBe(0);
    expect(loaded.slots[0]).toEqual(first);
    expect(loaded.slots[1]).toEqual(second);
    const advanced = reconcileCutPlaybackSlots(loaded.front, loaded.slots, second, third);
    expect(advanced.front).toBe(1);
    expect(advanced.slots[1]).toEqual(second);
    const filled = reconcileCutPlaybackSlots(advanced.front, advanced.slots, second, third);
    expect(filled.front).toBe(1);
    expect(filled.slots[0]).toEqual(third);
  });

  it("formats a compact cut clock", () => {
    expect(formatCutClock(0)).toBe("0:00");
    expect(formatCutClock(75)).toBe("1:15");
  });

  it("sums the selected Take clip lengths, so Fast 6s and Kling 5s do not share one duration", () => {
    const forest = createForestProject();
    expect(currentCutClips(forest).every((clip) => clip.durationSeconds === 6)).toBe(true);
    const withKling = projectWithJourneySecondTake(forest);
    const klingSelected = {
      ...withKling,
      journeys: withKling.journeys.map((journey) =>
        journey.id === "A-B"
          ? {
              ...journey,
              takes: journeyTakes(journey).map((take, index) =>
                index === 1 ? { ...take, durationSeconds: 5, model: "kwaivgi/kling-v2.5-turbo-pro" } : take,
              ),
              durationSeconds: 5,
            }
          : journey,
      ),
    };
    const clips = currentCutClips(klingSelected);
    expect(clips[0]?.durationSeconds).toBe(5);
    expect(clips.slice(1).every((clip) => clip.durationSeconds === 6)).toBe(true);
    const fastSelected = projectWithSelectedTake(klingSelected, "A-B", "A-B:take:1");
    expect(currentCutClips(fastSelected)[0]?.durationSeconds).toBe(6);
  });

  it("cannot download a new project", () => {
    expect(canDownloadCurrentCut(createNewProject())).toBe(false);
    expect(canDownloadCurrentCut(projectWithSyncedProductionLegs(createNewProject()))).toBe(false);
  });
});

function projectWithJourneySecondTake(project: ReturnType<typeof createForestProject>) {
  const journey = project.journeys.find((item) => item.id === "A-B");
  if (!journey) {
    throw new Error("Forest A-B needs a take");
  }
  const take = journeyTakes(journey)[0];
  if (!take) {
    throw new Error("Forest A-B needs a take");
  }
  return {
    ...project,
    journeys: project.journeys.map((item) =>
      item.id === "A-B"
        ? {
            ...item,
            takes: [
              { ...take, id: "A-B:take:1", number: 1 },
              { ...take, id: "A-B:take:2", number: 2, videoUrl: "/a-b-take-2.mp4" },
            ],
            selectedTakeId: "A-B:take:2",
            videoUrl: "/a-b-take-2.mp4",
          }
        : item,
    ),
  };
}
