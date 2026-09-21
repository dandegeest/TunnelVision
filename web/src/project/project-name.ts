import type { Project } from "./types";

const TITLE_LINE_MAX = 48;

export function isUntitledProjectTitle(title: string): boolean {
  return !title.trim() || /^untitled$/i.test(title.trim());
}

/** First-line title when the prompt follows Title / blank / story; otherwise a short created name. */
export function titleFromJourneyPrompt(story: string): string {
  const normalized = story.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "Untitled";
  }
  const lines = normalized.split("\n");
  const first = lines[0]?.trim() ?? "";
  if (!first) {
    return "Untitled";
  }
  const rest = lines.slice(1).join("\n").trim();
  const wordCount = first.split(/\s+/).filter(Boolean).length;
  const looksLikeTitle =
    first.length <= TITLE_LINE_MAX &&
    !/[.!?]$/.test(first) &&
    (rest.length > 0 || wordCount <= 6);
  if (looksLikeTitle) {
    return first;
  }
  const clause = first.replace(/[.!?].*$/, "").trim();
  const words = clause.split(/\s+/).filter(Boolean).slice(0, 4);
  return words.join(" ") || "Untitled";
}

export function suggestedProjectName(project: Pick<Project, "title" | "story">): string {
  if (!isUntitledProjectTitle(project.title)) {
    return project.title.trim();
  }
  return titleFromJourneyPrompt(project.story);
}
