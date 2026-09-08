import { describe, expect, it } from "vitest";
import { journeyIsPlayable, productionUnavailableReason, showApprovalChrome } from "./policy";
import type { JourneyShot } from "./types";

function journey(partial: Partial<JourneyShot>): JourneyShot {
  return {
    id: "A-B",
    startDestinationId: "A",
    endDestinationId: "B",
    durationSeconds: 6,
    status: "rendered",
    ...partial,
  };
}

describe("approval policy", () => {
  it("shows approval chrome in directed mode even when nothing is blocked", () => {
    expect(showApprovalChrome("directed", false)).toBe(true);
  });

  it("hides approval chrome in autonomous mode unless the route is blocked", () => {
    expect(showApprovalChrome("autonomous", false)).toBe(false);
    expect(showApprovalChrome("autonomous", true)).toBe(true);
  });
});

describe("journey playback policy", () => {
  it("plays rendered clips that have a video", () => {
    expect(journeyIsPlayable(journey({ status: "rendered", videoUrl: "/a-b.mp4" }))).toBe(true);
  });

  it("does not play a journey that has no video", () => {
    expect(
      journeyIsPlayable(
        journey({
          id: "E-A",
          startDestinationId: "E",
          endDestinationId: "A",
          status: "ready",
        }),
      ),
    ).toBe(false);
  });
});

describe("production bar copy", () => {
  it("explains that generation is not connected", () => {
    expect(productionUnavailableReason(null)).toMatch(/generation is not connected/i);
    expect(productionUnavailableReason(journey({ status: "ready" }))).toMatch(
      /generation is not connected/i,
    );
  });
});
