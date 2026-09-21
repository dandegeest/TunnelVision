import { describe, expect, it } from "vitest";
import { progressSelectionId } from "./JourneyProgressRail";

describe("progressSelectionId", () => {
  it("uses the storyboard frame in Plan", () => {
    expect(progressSelectionId({ kind: "storyboard", frameId: "C" })).toBe("C");
  });

  it("uses the destination in Shoot", () => {
    expect(
      progressSelectionId({ kind: "destination", destinationId: "B", occurrenceIndex: 0 }),
    ).toBe("B");
  });

  it("does not highlight a letter from a selected journey", () => {
    expect(
      progressSelectionId({ kind: "journey", journeyId: "A-B", band: "footage" }),
    ).toBeUndefined();
  });
});
