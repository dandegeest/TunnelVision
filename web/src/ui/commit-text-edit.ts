/** Blur the focused text field so its last keystroke or IME composition is committed. */
export function commitActiveTextEdit(): void {
  const active = globalThis.document?.activeElement;
  if (
    active &&
    "blur" in active &&
    typeof active.blur === "function" &&
    (active.tagName === "TEXTAREA" || active.tagName === "INPUT")
  ) {
    active.blur();
  }
}
