import { describe, expect, it } from "vitest";
import { mediaTimeForTimeline, timelineTimeForMedia, type CutSpan } from "./time-map";

const spans: CutSpan[] = [
  { journeyId: "A-B", mediaStart: 0, mediaEnd: 5.083, timelineStart: 0, timelineEnd: 5 },
  { journeyId: "B-C", mediaStart: 5.083, mediaEnd: 10.166, timelineStart: 5, timelineEnd: 10 },
  { journeyId: "C-D", mediaStart: 10.166, mediaEnd: 15.25, timelineStart: 10, timelineEnd: 15 },
];

describe("continuous preview time map", () => {
  it("rewinds a timeline segment to the start of that clip in the file", () => {
    expect(mediaTimeForTimeline(0, spans)).toBe(0);
    expect(mediaTimeForTimeline(5, spans)).toBe(5.083);
    expect(mediaTimeForTimeline(10, spans)).toBe(10.166);
  });

  it("maps playback back onto the timeline segment", () => {
    expect(timelineTimeForMedia(0, spans)).toBe(0);
    expect(timelineTimeForMedia(5.083, spans)).toBeCloseTo(5, 5);
    expect(timelineTimeForMedia(10.166, spans)).toBeCloseTo(10, 5);
    expect(timelineTimeForMedia(7.6245, spans)).toBeCloseTo(7.5, 4);
  });

  it("snaps a gap before the next selected clip to that clip's first sample", () => {
    const gapped: CutSpan[] = [
      { journeyId: "A-B", mediaStart: 0, mediaEnd: 5, timelineStart: 0, timelineEnd: 5 },
      { journeyId: "C-D", mediaStart: 5, mediaEnd: 10, timelineStart: 11, timelineEnd: 16 },
    ];
    expect(mediaTimeForTimeline(8, gapped)).toBe(5);
    expect(mediaTimeForTimeline(11, gapped)).toBe(5);
  });
});
