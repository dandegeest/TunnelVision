import { describe, expect, it } from "vitest";
import { isTextEntryTarget, pointerOnBackdrop, reelKeyboardAction } from "./text-entry";

describe("isTextEntryTarget", () => {
  it("treats inputs and textareas as text entry", () => {
    expect(isTextEntryTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTextEntryTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTextEntryTarget({ tagName: "SELECT" })).toBe(true);
    expect(isTextEntryTarget({ tagName: "DIV" })).toBe(false);
    expect(isTextEntryTarget(null)).toBe(false);
  });

  it("uses closest when the event target is inside a field", () => {
    expect(isTextEntryTarget({ closest: () => ({}) })).toBe(true);
    expect(isTextEntryTarget({ closest: () => null, tagName: "SPAN" })).toBe(false);
  });
});

describe("reelKeyboardAction", () => {
  it("does not steal keys from editable text", () => {
    expect(reelKeyboardAction({ key: "Backspace", target: { tagName: "TEXTAREA" } })).toBeUndefined();
    expect(reelKeyboardAction({ key: "Escape", target: { tagName: "TEXTAREA" } })).toBeUndefined();
    expect(reelKeyboardAction({ key: "ArrowLeft", target: { tagName: "INPUT" } })).toBeUndefined();
    expect(reelKeyboardAction({ key: "ArrowRight", target: { tagName: "TEXTAREA" } })).toBeUndefined();
  });

  it("closes or steps the reel only when a field is not focused", () => {
    expect(reelKeyboardAction({ key: "Escape", target: { tagName: "DIV" } })).toBe("close");
    expect(reelKeyboardAction({ key: "ArrowLeft", target: { tagName: "BUTTON" } })).toBe("prev");
    expect(reelKeyboardAction({ key: "ArrowRight", target: { tagName: "BUTTON" } })).toBe("next");
    expect(reelKeyboardAction({ key: "Backspace", target: { tagName: "BUTTON" } })).toBeUndefined();
  });

  it("yields to a shortcut that already handled the event", () => {
    expect(
      reelKeyboardAction({ key: "Escape", target: { tagName: "DIV" }, defaultPrevented: true }),
    ).toBeUndefined();
  });
});

describe("pointerOnBackdrop", () => {
  it("requires the event target to be one of the backdrop nodes", () => {
    const backdrop = { id: "reel" };
    const gutter = { id: "gutter" };
    expect(pointerOnBackdrop(backdrop, [backdrop, gutter])).toBe(true);
    expect(pointerOnBackdrop(gutter, [backdrop, gutter])).toBe(true);
    expect(pointerOnBackdrop({ id: "textarea" }, [backdrop, gutter])).toBe(false);
  });
});
