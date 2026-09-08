import {
  directorPlanRequestFromProject,
  type DirectorEvidence,
  type DirectorPlanRequest,
} from "./director";
import type { Project } from "./types";

export type ConversationEntryBase = {
  id: string;
  createdAt: string;
};

export type FilmmakerConversationEntry = ConversationEntryBase & {
  kind: "filmmaker";
  text: string;
};

export type DirectorConversationEntry = ConversationEntryBase & {
  kind: "director";
  status: "planning" | "complete" | "failed";
  evidence?: DirectorEvidence;
  summary?: string;
  error?: string;
};

export type ConstructionConversationEntry = ConversationEntryBase & {
  kind: "construction";
  beatId: string;
  status: "constructing" | "constructed" | "failed";
  error?: string;
  imageUrl?: string;
};

export type ConversationEntry =
  | FilmmakerConversationEntry
  | DirectorConversationEntry
  | ConstructionConversationEntry;

export type PlanSubmission =
  | { ok: true; submitted: string; request: DirectorPlanRequest }
  | { ok: false; reason: "empty" | "invalid"; message?: string };

export function conversationTimestamp(now = new Date()): string {
  return now.toISOString();
}

/** Format a stored entry time. Does not use the current clock. */
export function formatConversationClock(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const hours24 = date.getHours();
  const hour12 = hours24 % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const suffix = hours24 < 12 ? "AM" : "PM";
  return `${hour12}:${minutes} ${suffix}`;
}

export function preparePlanSubmission(draft: string, project: Project): PlanSubmission {
  if (!draft.trim()) {
    return { ok: false, reason: "empty" };
  }
  try {
    return {
      ok: true,
      submitted: draft,
      request: directorPlanRequestFromProject({ ...project, story: draft }),
    };
  } catch (error) {
    return {
      ok: false,
      reason: "invalid",
      message: error instanceof Error ? error.message : "Director planning failed",
    };
  }
}

export function appendConversationEntry(
  entries: ConversationEntry[],
  entry: ConversationEntry,
): ConversationEntry[] {
  return [...entries, entry];
}

export function resolveDirectorEntry(
  entries: ConversationEntry[],
  id: string,
  next:
    | { status: "complete"; evidence: DirectorEvidence; summary: string }
    | { status: "failed"; error: string },
): ConversationEntry[] {
  return entries.map((entry) => {
    if (entry.kind !== "director" || entry.id !== id) {
      return entry;
    }
    if (next.status === "complete") {
      return {
        ...entry,
        status: "complete",
        evidence: next.evidence,
        summary: next.summary,
        error: undefined,
      };
    }
    return {
      ...entry,
      status: "failed",
      error: next.error,
      evidence: undefined,
      summary: undefined,
    };
  });
}

export function resolveConstructionEntry(
  entries: ConversationEntry[],
  id: string,
  next: { status: "constructed"; imageUrl: string } | { status: "failed"; error: string },
): ConversationEntry[] {
  return entries.map((entry) => {
    if (entry.kind !== "construction" || entry.id !== id) {
      return entry;
    }
    if (next.status === "constructed") {
      return {
        ...entry,
        status: "constructed",
        imageUrl: next.imageUrl,
        error: undefined,
      };
    }
    return {
      ...entry,
      status: "failed",
      error: next.error,
    };
  });
}
