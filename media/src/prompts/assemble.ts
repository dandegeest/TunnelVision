/** Join prompt sections with a blank line. Empty parts are dropped. */
export function joinPromptSections(...parts: Array<string | undefined | false | null>): string {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join("\n\n");
}

export function countPromptOccurrences(haystack: string, needle: string): number {
  if (!needle) {
    return 0;
  }
  return haystack.split(needle).length - 1;
}
