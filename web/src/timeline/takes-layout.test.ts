import { describe, expect, it } from "vitest";
import { newTakeTop, takeRowTop } from "./takes-layout";

describe("newTakeTop", () => {
  it("sits under a failed or generating pending row", () => {
    expect(newTakeTop(0)).toBeLessThan(newTakeTop(0, true));
    expect(newTakeTop(2, true)).toBe(takeRowTop(3));
    expect(newTakeTop(2, false)).toBe(takeRowTop(2));
  });
});
