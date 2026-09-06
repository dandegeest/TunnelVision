import { describe, expect, it } from "vitest";
import type { Destination, JourneyShot } from "../project/types";
import { layoutTimeline } from "./geometry";

const destinations: Destination[] = ["A", "B", "C", "D", "E"].map((id) => ({
  id,
  label: id,
  image: `${id}.jpg`,
  status: "ready",
}));

const journeys: JourneyShot[] = [
  { id: "A-B", startDestinationId: "A", endDestinationId: "B", durationSeconds: 6, status: "rendered" },
  { id: "B-C", startDestinationId: "B", endDestinationId: "C", durationSeconds: 6, status: "rendered" },
  { id: "C-D", startDestinationId: "C", endDestinationId: "D", durationSeconds: 6, status: "needs_review" },
  { id: "D-E", startDestinationId: "D", endDestinationId: "E", durationSeconds: 6, status: "rendered" },
  { id: "E-A", startDestinationId: "E", endDestinationId: "A", durationSeconds: 6, status: "not_shootable" },
];

describe("timeline geometry", () => {
  it("places each destination center on the shared journey boundary", () => {
    const layout = layoutTimeline(destinations, journeys, 1, 40, 10);

    expect(layout.occurrences).toHaveLength(6);
    expect(layout.journeys).toHaveLength(5);

    for (let index = 0; index < layout.journeys.length; index += 1) {
      const journey = layout.journeys[index];
      const start = layout.occurrences[index];
      const end = layout.occurrences[index + 1];
      expect(start.xCenter).toBe(journey.left);
      expect(end.xCenter).toBe(journey.left + journey.width);
    }
  });

  it("treats the final tick as another occurrence of destination A, not a sixth destination", () => {
    const layout = layoutTimeline(destinations, journeys, 1);
    const last = layout.occurrences.at(-1);
    const first = layout.occurrences[0];

    expect(destinations.map((destination) => destination.id)).toEqual(["A", "B", "C", "D", "E"]);
    expect(first?.destinationId).toBe("A");
    expect(last?.destinationId).toBe("A");
    expect(last?.occurrenceIndex).not.toBe(first?.occurrenceIndex);
    expect(last?.inboundJourneyId).toBe("E-A");
    expect(last?.arrivalBlocked).toBe(true);
    expect(first?.arrivalBlocked).toBe(false);
  });

  it("uses 38 px per second at default zoom without changing six-second durations", () => {
    const layout = layoutTimeline(destinations, journeys, 1);
    expect(layout.journeys.every((journey) => journey.endTime - journey.startTime === 6)).toBe(true);
    expect(layout.journeys[0]?.width).toBe(6 * 38);
    expect(layout.totalDuration).toBe(30);
  });

  it("keeps destination E ready while marking only the E-A route blocked", () => {
    const layout = layoutTimeline(destinations, journeys, 1);
    const e = layout.occurrences.find((occurrence) => occurrence.destinationId === "E");
    const ea = layout.journeys.find((journey) => journey.journeyId === "E-A");

    expect(destinations.find((destination) => destination.id === "E")?.status).toBe("ready");
    expect(e?.arrivalBlocked).toBe(false);
    expect(ea?.status).toBe("not_shootable");
  });
});
