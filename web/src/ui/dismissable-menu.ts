import { useEffect, useRef, type RefObject } from "react";
import { isTextEntryTarget } from "./text-entry";

export type DismissableMenu = {
  contains(target: EventTarget | null): boolean;
  close(): void;
};

const openMenus = new Map<number, DismissableMenu>();
let nextId = 1;
let windowBound = false;

function closeMenu(id: number): void {
  const menu = openMenus.get(id);
  if (!menu) {
    return;
  }
  openMenus.delete(id);
  menu.close();
  unbindWindowIfIdle();
}

export function closeAllDismissableMenus(): void {
  const ids = [...openMenus.keys()];
  for (const id of ids) {
    closeMenu(id);
  }
}

export function registerDismissableMenu(menu: DismissableMenu): number {
  for (const id of [...openMenus.keys()]) {
    closeMenu(id);
  }
  const id = nextId++;
  openMenus.set(id, menu);
  bindWindow();
  return id;
}

export function unregisterDismissableMenu(id: number): void {
  openMenus.delete(id);
  unbindWindowIfIdle();
}

export function dismissMenusForPointer(target: EventTarget | null): void {
  for (const [id, menu] of [...openMenus]) {
    if (!menu.contains(target)) {
      closeMenu(id);
    }
  }
}

export function resetDismissableMenus(): void {
  openMenus.clear();
  unbindWindowIfIdle();
}

function onWindowPointerDown(event: PointerEvent): void {
  dismissMenusForPointer(event.target);
}

function onWindowKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Escape" || openMenus.size === 0) {
    return;
  }
  if (isTextEntryTarget(event.target)) {
    return;
  }
  event.preventDefault();
  closeAllDismissableMenus();
}

function bindWindow(): void {
  if (windowBound || typeof window === "undefined") {
    return;
  }
  windowBound = true;
  window.addEventListener("pointerdown", onWindowPointerDown, true);
  window.addEventListener("keydown", onWindowKeyDown, true);
}

function unbindWindowIfIdle(): void {
  if (!windowBound || openMenus.size > 0 || typeof window === "undefined") {
    return;
  }
  windowBound = false;
  window.removeEventListener("pointerdown", onWindowPointerDown, true);
  window.removeEventListener("keydown", onWindowKeyDown, true);
}

export function useDismissableMenu(
  open: boolean,
  onClose: () => void,
  rootRef: RefObject<Element | null>,
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return;
    }
    const menu: DismissableMenu = {
      contains(target) {
        return Boolean(
          rootRef.current && target instanceof Node && rootRef.current.contains(target),
        );
      },
      close() {
        onCloseRef.current();
      },
    };
    const id = registerDismissableMenu(menu);
    return () => {
      unregisterDismissableMenu(id);
    };
  }, [open, rootRef]);
}
