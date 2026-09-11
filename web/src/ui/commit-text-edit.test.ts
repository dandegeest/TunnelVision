import { describe, expect, it } from "vitest";
import { commitActiveTextEdit } from "./commit-text-edit";

describe("commitActiveTextEdit", () => {
  it("is a no-op when no document is focused", () => {
    expect(() => commitActiveTextEdit()).not.toThrow();
  });
});
