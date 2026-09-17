/** True when a keyboard or pointer event belongs to an editable field. */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") {
    return false;
  }
  const el = target as {
    tagName?: string;
    closest?: (selector: string) => unknown;
    isContentEditable?: boolean;
  };
  if (typeof el.closest === "function") {
    return Boolean(
      el.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"),
    );
  }
  const tag = el.tagName?.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(el.isContentEditable);
}

export type ReelKeyboardAction = "close" | "prev" | "next";

/** Storyboard-reel shortcuts. Typing in an inspector or rail field is never a shortcut. */
export function reelKeyboardAction(event: {
  key: string;
  target: EventTarget | null;
  defaultPrevented?: boolean;
}): ReelKeyboardAction | undefined {
  if (event.defaultPrevented || isTextEntryTarget(event.target)) {
    return undefined;
  }
  if (event.key === "Escape") {
    return "close";
  }
  if (event.key === "ArrowLeft") {
    return "prev";
  }
  if (event.key === "ArrowRight") {
    return "next";
  }
  return undefined;
}

export function pointerOnBackdrop(
  target: EventTarget | null,
  backdrops: readonly (EventTarget | null)[],
): boolean {
  return backdrops.some((backdrop) => backdrop != null && target === backdrop);
}
