import { afterEach, describe, expect, it } from "vitest";
import {
  closeAllDismissableMenus,
  dismissMenusForPointer,
  registerDismissableMenu,
  resetDismissableMenus,
  unregisterDismissableMenu,
} from "./dismissable-menu";

afterEach(() => {
  resetDismissableMenus();
});

describe("dismissable menus", () => {
  it("closes any open menu when another menu registers", () => {
    const closed: string[] = [];
    registerDismissableMenu({
      contains: () => true,
      close: () => {
        closed.push("a");
      },
    });
    registerDismissableMenu({
      contains: () => true,
      close: () => {
        closed.push("b");
      },
    });
    expect(closed).toEqual(["a"]);
  });

  it("closes a menu whose root does not contain the pointer target", () => {
    const closed: string[] = [];
    const inside = { id: "inside" };
    registerDismissableMenu({
      contains: (target) => target === inside,
      close: () => {
        closed.push("a");
      },
    });
    dismissMenusForPointer(inside);
    expect(closed).toEqual([]);
    dismissMenusForPointer({ id: "outside" });
    expect(closed).toEqual(["a"]);
  });

  it("closes every open menu at once", () => {
    const closed: string[] = [];
    const a = registerDismissableMenu({
      contains: () => true,
      close: () => {
        closed.push("a");
      },
    });
    registerDismissableMenu({
      contains: () => true,
      close: () => {
        closed.push("b");
      },
    });
    expect(closed).toEqual(["a"]);
    closeAllDismissableMenus();
    expect(closed).toEqual(["a", "b"]);
    unregisterDismissableMenu(a);
  });
});
