import {
  directorPlanRequestFromProject,
  type DirectorEvidence,
  type DirectorPlanRequest,
} from "./director";
import type { Project } from "./types";

export type FilmmakerConversationEntry = {
  id: string;
  kind: "filmmaker";
  text: string;
};

export type DirectorConversationEntry = {
  id: string;
  kind: "director";
  evidence?: DirectorEvidence;
  error?: string;
};

export type ConstructionConversationEntry = {
  id: string;
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
