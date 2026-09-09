import {
  directorPlanRequestFromProject,
  type DirectorEvidence,
  type DirectorPlanRequest,
} from "./director";
import type { CinematographerAssessment, JourneyShotTake, Project } from "./types";

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
  phase?: "story" | "plan";
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

export type BlockingConversationEntry = ConversationEntryBase & {
  kind: "blocking";
  journeyId: string;
  status: "blocking" | "blocked" | "failed";
  assessment?: CinematographerAssessment;
  error?: string;
};

export type ShootingConversationEntry = ConversationEntryBase & {
  kind: "shooting";
  journeyId: string;
  status: "shooting" | "shot" | "failed";
  take?: JourneyShotTake;
  videoUrl?: string;
  error?: string;
};

export type ConversationEntry =
  | FilmmakerConversationEntry
  | DirectorConversationEntry
  | ConstructionConversationEntry
  | BlockingConversationEntry
  | ShootingConversationEntry;

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

export function prepareDirectorPlan(project: Project): PlanSubmission {
  if (!project.story.trim()) {
    return { ok: false, reason: "empty" };
  }
  try {
    return {
      ok: true,
      submitted: project.story,
      request: directorPlanRequestFromProject(project),
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
    | { status: "complete"; evidence: DirectorEvidence; summary: string; phase?: "story" | "plan" }
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
        ...("phase" in next && next.phase ? { phase: next.phase } : {}),
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

export function resolveBlockingEntry(
  entries: ConversationEntry[],
  id: string,
  next: { status: "blocked"; assessment: CinematographerAssessment } | { status: "failed"; error: string },
): ConversationEntry[] {
  return entries.map((entry) => {
    if (entry.kind !== "blocking" || entry.id !== id) {
      return entry;
    }
    if (next.status === "blocked") {
      return {
        ...entry,
        status: "blocked",
        assessment: next.assessment,
        error: undefined,
      };
    }
    return {
      ...entry,
      status: "failed",
      error: next.error,
      assessment: undefined,
    };
  });
}

export function resolveShootingEntry(
  entries: ConversationEntry[],
  id: string,
  next: { status: "shot"; take: JourneyShotTake; videoUrl: string } | { status: "failed"; error: string },
): ConversationEntry[] {
  return entries.map((entry) => {
    if (entry.kind !== "shooting" || entry.id !== id) {
      return entry;
    }
    if (next.status === "shot") {
      return {
        ...entry,
        status: "shot",
        take: next.take,
        videoUrl: next.videoUrl,
        error: undefined,
      };
    }
    return {
      ...entry,
      status: "failed",
      error: next.error,
      take: undefined,
      videoUrl: undefined,
    };
  });
}
