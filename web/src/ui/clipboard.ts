/** Copy plain text for filmmaker-facing UI. Returns whether the clipboard was updated. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = text;
  if (!value) {
    return false;
  }
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to a hidden textarea copy.
  }
  if (typeof document === "undefined") {
    return false;
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.left = "-9999px";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
