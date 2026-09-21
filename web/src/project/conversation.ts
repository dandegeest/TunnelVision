import {
  directorPlanRequestFromProject,
  type DirectorEvidence,
  type DirectorPlanRequest,
} from "./director";
import type { CanonicalRepairRecommendation } from "./journey-agent-repair";
import type { JourneyAgentEvent } from "./journey-agent";
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

export type AssemblyConversationEntry = ConversationEntryBase & {
  kind: "assembly";
  status: "complete";
  videoUrl: string;
  filename: string;
  complete: boolean;
};

export type AgentConversationEntry = ConversationEntryBase & {
  kind: "agent";
  status: "evaluating" | "reevaluating" | "evaluated" | "reevaluated" | "repairing" | "repaired";
  destinationIds: string[];
  journeyId: string;
  journeyIds?: string[];
  recommendation?: CanonicalRepairRecommendation;
  instruction?: string;
  setConsistency?: number;
  traversalConfidence?: number;
  afterSetConsistency?: number;
  afterTraversalConfidence?: number;
};

export type ConversationEntry =
  | FilmmakerConversationEntry
  | DirectorConversationEntry
  | ConstructionConversationEntry
  | BlockingConversationEntry
  | ShootingConversationEntry
  | AssemblyConversationEntry
  | AgentConversationEntry;

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

const RESTORED_CONVERSATION_AT = "1970-01-01T00:00:00.000Z";

export type RestoredMovieExport = {
  videoUrl: string;
  filename: string;
  complete: boolean;
};

/** Rebuild a durable Agent journey transcript when events.jsonl is missing or incomplete. */
export function restoreConversationFromProject(
  conversation: readonly ConversationEntry[],
  story: string,
  movieExport?: RestoredMovieExport | null,
): ConversationEntry[] {
  const prompt = story.trim();
  const exportUrl = movieExport?.videoUrl.trim() ?? "";
  let entries = conversation.map((entry) => {
    if (entry.kind === "assembly" && entry.status === "complete" && exportUrl && movieExport) {
      return {
        ...entry,
        videoUrl: exportUrl,
        filename: entry.filename || movieExport.filename,
        complete: movieExport.complete,
      };
    }
    return entry;
  });
  const hasFilmmaker = entries.some((entry) => entry.kind === "filmmaker" && entry.text.trim());
  const hasAssembly = entries.some((entry) => entry.kind === "assembly" && entry.status === "complete");
  if (!hasFilmmaker && prompt) {
    entries = [
      {
        id: "restored-filmmaker",
        createdAt: RESTORED_CONVERSATION_AT,
        kind: "filmmaker",
        text: prompt,
      },
      ...entries,
    ];
  }
  if (!hasAssembly && exportUrl && movieExport) {
    entries = [
      ...entries,
      {
        id: "restored-assembly",
        createdAt: RESTORED_CONVERSATION_AT,
        kind: "assembly",
        status: "complete",
        videoUrl: exportUrl,
        filename: movieExport.filename,
        complete: movieExport.complete,
      },
    ];
  }
  return entries;
}

export function appendFilmmakerStory(
  entries: ConversationEntry[],
  story: string,
  id: string,
  createdAt: string,
): ConversationEntry[] {
  const text = story.trim();
  if (!text) {
    return entries;
  }
  const last = [...entries].reverse().find((entry) => entry.kind === "filmmaker");
  if (last?.kind === "filmmaker" && last.text.trim() === text) {
    return entries;
  }
  return appendConversationEntry(entries, {
    id,
    createdAt,
    kind: "filmmaker",
    text,
  });
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

export function resolveAgentEvaluationEntry(
  entries: ConversationEntry[],
  journeyId: string,
  next: {
    status: "evaluated" | "reevaluated";
    setConsistency?: number;
    traversalConfidence?: number;
  },
): ConversationEntry[] {
  let lastIndex = -1;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (
      entry?.kind === "agent" &&
      entry.journeyId === journeyId &&
      (entry.status === "evaluating" || entry.status === "reevaluating")
    ) {
      lastIndex = index;
      break;
    }
  }
  if (lastIndex < 0) {
    return entries;
  }
  return entries.map((entry, index) => {
    if (index !== lastIndex || entry.kind !== "agent") {
      return entry;
    }
    return {
      ...entry,
      status: next.status,
      ...(next.setConsistency != null ? { setConsistency: next.setConsistency } : {}),
      ...(next.traversalConfidence != null ? { traversalConfidence: next.traversalConfidence } : {}),
    };
  });
}

export function agentConversationEntryFromEvent(
  id: string,
  createdAt: string,
  event: JourneyAgentEvent,
): AgentConversationEntry | undefined {
  if (
    event.kind === "cinematographer-evaluation" ||
    event.kind === "cinematographer-reevaluation"
  ) {
    const journeyIds = event.journeyIds ?? (event.journeyId ? [event.journeyId] : []);
    if (journeyIds.length === 0) {
      return undefined;
    }
    return {
      id,
      createdAt,
      kind: "agent",
      status: event.kind === "cinematographer-reevaluation" ? "reevaluating" : "evaluating",
      destinationIds: event.destinationIds ?? [],
      journeyId: journeyIds[0]!,
      journeyIds,
    };
  }
  if (
    event.kind !== "canonical-repair" &&
    event.kind !== "canonical-repair-complete"
  ) {
    return undefined;
  }
  const destinationIds = event.destinationIds ?? (event.destinationId ? [event.destinationId] : []);
  const journeyId = event.journeyId;
  const recommendation = event.recommendation;
  if (!journeyId || !recommendation || destinationIds.length === 0) {
    return undefined;
  }
  if (event.kind === "canonical-repair") {
    if (event.setConsistency == null || event.traversalConfidence == null) {
      return undefined;
    }
    return {
      id,
      createdAt,
      kind: "agent",
      status: "repairing",
      destinationIds,
      journeyId,
      ...(event.journeyIds ? { journeyIds: event.journeyIds } : {}),
      recommendation,
      ...(event.instruction ? { instruction: event.instruction } : {}),
      setConsistency: event.setConsistency,
      traversalConfidence: event.traversalConfidence,
    };
  }
  if (
    event.setConsistency == null ||
    event.traversalConfidence == null ||
    event.afterSetConsistency == null ||
    event.afterTraversalConfidence == null
  ) {
    return undefined;
  }
  return {
    id,
    createdAt,
    kind: "agent",
    status: "repaired",
    destinationIds,
    journeyId,
    ...(event.journeyIds ? { journeyIds: event.journeyIds } : {}),
    recommendation,
    setConsistency: event.setConsistency,
    traversalConfidence: event.traversalConfidence,
    afterSetConsistency: event.afterSetConsistency,
    afterTraversalConfidence: event.afterTraversalConfidence,
  };
}
