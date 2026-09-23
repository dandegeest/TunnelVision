import { describe, expect, it } from "vitest";
import { shouldDropOutgoingStart } from "./drop-outgoing-start";

describe("shouldDropOutgoingStart", () => {
  it("drops a LongWayDown-class lock", () => {
    expect(shouldDropOutgoingStart({ ssim: 0.917, mae: 3.33 })).toBe(true);
    expect(shouldDropOutgoingStart({ ssim: 0.96, mae: 2.47 })).toBe(true);
    expect(shouldDropOutgoingStart({ ssim: 0.972, mae: 1.3 })).toBe(true);
  });

  it("keeps outgoing frame 0 when the lock is weak or a subject already jumped", () => {
    expect(shouldDropOutgoingStart({ ssim: 0.631, mae: 12.2 })).toBe(false);
    expect(shouldDropOutgoingStart({ ssim: 0.857, mae: 5.0 })).toBe(false);
    expect(shouldDropOutgoingStart({ ssim: 0.744, mae: 9.3 })).toBe(false);
    expect(shouldDropOutgoingStart({ ssim: 0.789, mae: 10.6 })).toBe(false);
  });

  it("drops a tight Kling lock that is not quite a still", () => {
    expect(shouldDropOutgoingStart({ ssim: 0.892, mae: 4.75 })).toBe(true);
    expect(shouldDropOutgoingStart({ ssim: 0.9, mae: 4.11 })).toBe(true);
  });

  it("still prefers a hold when the subject already remapped", () => {
    expect(shouldDropOutgoingStart({ ssim: 0.889, mae: 3.0 })).toBe(false);
    expect(shouldDropOutgoingStart({ ssim: 0.9, mae: 5.01 })).toBe(false);
  });
});
