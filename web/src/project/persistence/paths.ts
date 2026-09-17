/** Filesystem helpers for durable project directories. No I/O. */

export const PROJECT_MANIFEST_NAME = "project.json";
export const CONVERSATION_DIR = "conversation";
export const CONVERSATION_EVENTS_NAME = "events.jsonl";
export const CANONICALS_DIR = "canonicals";
export const TRAVERSALS_DIR = "traversals";
export const SHOOTING_FRAMES_DIR = "shooting-frames";
export const EXPORTS_DIR = "exports";
export const GENERATED_DIR = "generated";

const UNSAFE = /[<>:"/\\|?*\u0000-\u001f]/g;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function sanitizeProjectFolderName(name: string): string {
  const trimmed = name.trim().replace(UNSAFE, " ").replace(/\s+/g, "").replace(/^[.]+|[.]+$/g, "");
  const clipped = trimmed.slice(0, 80);
  if (!clipped || WINDOWS_RESERVED.test(clipped)) {
    return "Untitled";
  }
  return clipped;
}

export function uniqueProjectFolderName(base: string, existingNames: readonly string[]): string {
  const sanitized = sanitizeProjectFolderName(base);
  const taken = new Set(existingNames.map((item) => item.toLowerCase()));
  if (!taken.has(sanitized.toLowerCase())) {
    return sanitized;
  }
  for (let n = 2; n < 10_000; n += 1) {
    const candidate = `${sanitized}${n}`;
    if (!taken.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  throw new Error("Could not allocate a unique project folder name.");
}

export function takeAssetName(number: number, extension: string): string {
  const padded = String(number).padStart(2, "0");
  const ext = extension.replace(/^\./, "").toLowerCase();
  return `take-${padded}.${ext}`;
}

export function canonicalEntityPath(frameId: string): string {
  return `${CANONICALS_DIR}/${frameId}/canonical.json`;
}

export function traversalEntityPath(journeyId: string): string {
  return `${TRAVERSALS_DIR}/${journeyId}/traversal.json`;
}

export function shootingFramesDir(journeyId: string): string {
  return `${SHOOTING_FRAMES_DIR}/${journeyId}`;
}

export function conversationEventsPath(): string {
  return `${CONVERSATION_DIR}/${CONVERSATION_EVENTS_NAME}`;
}

export function relativePosix(...parts: string[]): string {
  return parts.join("/").replaceAll("\\", "/");
}

/** Reject `..` and absolute paths so a project cannot escape its root. */
export function isSafeProjectRelativePath(value: string): boolean {
  if (!value || value.startsWith("/") || value.startsWith("\\") || /^[a-zA-Z]:/.test(value)) {
    return false;
  }
  const parts = value.replaceAll("\\", "/").split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}
