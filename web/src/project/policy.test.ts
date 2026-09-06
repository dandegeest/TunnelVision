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
  it("plays rendered and needs-review clips that have a video", () => {
    expect(journeyIsPlayable(journey({ status: "rendered", videoUrl: "/a-b.mp4" }))).toBe(true);
    expect(journeyIsPlayable(journey({ status: "needs_review", videoUrl: "/c-d.mp4" }))).toBe(true);
  });

  it("does not play a blocked journey even if a research clip exists", () => {
    expect(
      journeyIsPlayable(
        journey({
          id: "E-A",
          startDestinationId: "E",
          endDestinationId: "A",
          status: "not_shootable",
          videoUrl: "/E-A.mp4",
        }),
      ),
    ).toBe(false);
    expect(
      journeyIsPlayable(
        journey({
          id: "E-A",
          startDestinationId: "E",
          endDestinationId: "A",
          status: "not_shootable",
        }),
      ),
    ).toBe(false);
  });
});

describe("production bar copy", () => {
  it("explains that generation is not connected", () => {
    expect(productionUnavailableReason(null)).toMatch(/generation is not connected/i);
  });

  it("calls out a blocked journey before the generic generation note", () => {
    expect(
      productionUnavailableReason(
        journey({
          id: "E-A",
          status: "not_shootable",
        }),
      ),
    ).toMatch(/not shootable/i);
  });
});
