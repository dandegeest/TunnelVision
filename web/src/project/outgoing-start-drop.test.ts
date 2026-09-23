import { describe, expect, it } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import {
  currentOutgoingStartDrop,
  formatOutgoingStartDropMae,
  formatOutgoingStartDropSsim,
  measureOutgoingStartDrops,
  outgoingStartDropFingerprint,
  playableOutgoingSeams,
  projectWithOutgoingStartDrop,
  selectedTakeJoinsOutgoingStartDrop,
  selectedTakeShowsOutgoingStartDrop,
} from "./outgoing-start-drop";
import { selectedTake } from "./takes";

describe("outgoing start drop timeline state", () => {
  it("pairs consecutive playable legs", () => {
    const seams = playableOutgoingSeams(createForestProject());
    expect(seams.map((seam) => `${seam.incoming.id}|${seam.outgoing.id}`)).toEqual([
      "A-B|B-C",
      "B-C|C-D",
      "C-D|D-E",
      "D-E|E-F",
    ]);
  });

  it("marks only the selected outgoing take when the lock dropped frame 0", () => {
    const forest = createForestProject();
    const incoming = forest.journeys.find((journey) => journey.id === "A-B")!;
    const outgoing = forest.journeys.find((journey) => journey.id === "B-C")!;
    const incomingTake = selectedTake(incoming)!;
    const outgoingTake = selectedTake(outgoing)!;
    const marked = projectWithOutgoingStartDrop(forest, "B-C", {
      incomingJourneyId: "A-B",
      incomingTakeId: incomingTake.id!,
      outgoingTakeId: outgoingTake.id!,
      dropped: true,
      ssim: 0.94,
      mae: 3.1,
    });
    const next = marked.journeys.find((journey) => journey.id === "B-C")!;
    expect(selectedTakeShowsOutgoingStartDrop(marked, next, outgoingTake)).toBe(true);
    expect(selectedTakeShowsOutgoingStartDrop(marked, incoming, incomingTake)).toBe(false);
    expect(selectedTakeJoinsOutgoingStartDrop(marked, incoming, incomingTake)).toBe(true);
    expect(selectedTakeJoinsOutgoingStartDrop(marked, next, outgoingTake)).toBe(false);
    expect(currentOutgoingStartDrop(marked, next)?.ssim).toBe(0.94);
    expect(currentOutgoingStartDrop(marked, incoming)).toBeUndefined();
    expect(formatOutgoingStartDropSsim(0.939)).toBe("0.94");
    expect(formatOutgoingStartDropMae(3.1)).toBe("3.1");
  });

  it("ignores a stale measurement after the selected take changes", () => {
    const forest = createForestProject();
    const outgoing = forest.journeys.find((journey) => journey.id === "B-C")!;
    const outgoingTake = selectedTake(outgoing)!;
    const marked = projectWithOutgoingStartDrop(forest, "B-C", {
      incomingJourneyId: "A-B",
      incomingTakeId: "old-incoming",
      outgoingTakeId: outgoingTake.id!,
      dropped: true,
      ssim: 0.94,
      mae: 3.1,
    });
    expect(selectedTakeShowsOutgoingStartDrop(marked, marked.journeys.find((journey) => journey.id === "B-C")!, outgoingTake)).toBe(
      false,
    );
    expect(currentOutgoingStartDrop(marked, marked.journeys.find((journey) => journey.id === "B-C")!)).toBeUndefined();
    expect(outgoingStartDropFingerprint(forest).length).toBeGreaterThan(0);
  });

  it("measures only seams that are not already current", async () => {
    const forest = createForestProject();
    const incomingTake = selectedTake(forest.journeys.find((journey) => journey.id === "A-B")!)!;
    const outgoingTake = selectedTake(forest.journeys.find((journey) => journey.id === "B-C")!)!;
    const marked = projectWithOutgoingStartDrop(forest, "B-C", {
      incomingJourneyId: "A-B",
      incomingTakeId: incomingTake.id!,
      outgoingTakeId: outgoingTake.id!,
      dropped: true,
      ssim: 0.94,
      mae: 3.1,
    });
    const requested: string[] = [];
    const measured = await measureOutgoingStartDrops(marked, async (input) => {
      requested.push(`${input.incomingVideoUrl}->${input.outgoingVideoUrl}`);
      return { ssim: 0.91, mae: 2.4, dropped: true };
    });
    expect(requested).toHaveLength(3);
    expect(measured.map((item) => item.journeyId)).toEqual(["C-D", "D-E", "E-F"]);
    expect(measured[0]?.drop.dropped).toBe(true);
  });
});
