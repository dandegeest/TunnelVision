import { restoreConversationFromProject, type ConversationEntry } from "../../project/conversation";
import { humanRepairRecommendation } from "../../project/journey-agent-repair";
import type { JourneyAgentSnapshot } from "../../project/journey-agent";
import { canonicalTakes, selectedCanonicalTake } from "../../project/canonical-takes";
import type { CanonicalTake, Project, StoryboardFrame } from "../../project/types";
import {
  cinematographerScores,
  destinationDescription,
  destinationLocationLabel,
  formatJourneyCompact,
  groupConversationEntries,
  type CinematographerBlock,
} from "../conversation-console";

export type JourneyTurn = {
  id: string;
  prompt: string;
  createdAt: string;
  entries: ConversationEntry[];
  complete: boolean;
  videoUrl?: string;
  filename?: string;
};

export type RejectedCanonical = {
  take: CanonicalTake;
  letter: string;
  attempt: number;
  travel?: number;
};

export type TurnReasoningLine = {
  id: string;
  role: string;
  text: string;
};

export function restoreAgentJourneyTurns(
  conversation: readonly ConversationEntry[],
  project: Pick<Project, "story" | "storyboard">,
  movieExport?: { videoUrl?: string; filename?: string; complete?: boolean } | null,
  options?: { idle?: boolean },
): JourneyTurn[] {
  const exportReady =
    movieExport?.videoUrl?.trim() && movieExport.filename
      ? {
          videoUrl: movieExport.videoUrl.trim(),
          filename: movieExport.filename,
          complete: movieExport.complete ?? true,
        }
      : null;
  const turns = journeyTurnsFromConversation(
    restoreConversationFromProject(conversation, project.story, exportReady),
  );
  const exportUrl = exportReady?.videoUrl ?? "";
  const finished = project.storyboard.length > 1;
  const idle = Boolean(options?.idle);
  if (turns.length === 0) {
    if (!project.story.trim() && !finished && !exportUrl) {
      return turns;
    }
    return [
      {
        id: "restored-journey",
        prompt: project.story,
        createdAt: "",
        entries: [],
        complete: idle || Boolean(exportUrl) || finished,
        ...(exportUrl ? { videoUrl: exportUrl, filename: exportReady?.filename } : {}),
      },
    ];
  }
  return turns.map((turn, index) => {
    const last = index === turns.length - 1;
    const videoUrl = (last ? exportUrl : "") || turn.videoUrl || "";
    const complete = turn.complete || (last && (Boolean(exportUrl) || (idle && finished)));
    return {
      ...turn,
      complete,
      ...(videoUrl ? { videoUrl, filename: turn.filename || exportReady?.filename } : {}),
    };
  });
}

export function journeyTurnsFromConversation(entries: ConversationEntry[]): JourneyTurn[] {
  const turns: JourneyTurn[] = [];
  let current: Omit<JourneyTurn, "complete" | "videoUrl" | "filename"> | null = null;
  const flush = () => {
    if (!current) {
      return;
    }
    turns.push(finalizeTurn(current));
    current = null;
  };
  for (const entry of entries) {
    if (entry.kind === "filmmaker") {
      flush();
      current = {
        id: entry.id,
        prompt: entry.text,
        createdAt: entry.createdAt,
        entries: [entry],
      };
      continue;
    }
    if (!current) {
      current = {
        id: entry.id,
        prompt: "",
        createdAt: entry.createdAt,
        entries: [entry],
      };
      continue;
    }
    current.entries.push(entry);
  }
  flush();
  return turns;
}

function finalizeTurn(turn: Omit<JourneyTurn, "complete" | "videoUrl" | "filename">): JourneyTurn {
  const assembly = [...turn.entries]
    .reverse()
    .find((entry): entry is Extract<ConversationEntry, { kind: "assembly" }> => {
      return entry.kind === "assembly" && entry.status === "complete";
    });
  return {
    ...turn,
    complete: Boolean(assembly),
    ...(assembly?.videoUrl ? { videoUrl: assembly.videoUrl } : {}),
    ...(assembly?.filename ? { filename: assembly.filename } : {}),
  };
}

export function compactLettersFromTurn(turn: JourneyTurn): string[] {
  const letters: string[] = [];
  for (const entry of turn.entries) {
    if (entry.kind === "construction" && !letters.includes(entry.beatId)) {
      letters.push(entry.beatId);
    }
  }
  return letters;
}

export function agentGeneratingLabel(
  constructingBeatId?: string | null,
  journeyAgent?: JourneyAgentSnapshot | null,
  live?: {
    assessingJourneyIds?: readonly string[];
    shootingJourneyIds?: readonly string[];
    directorPlanning?: boolean;
    screenwriterWriting?: boolean;
  },
): string | null {
  if (live?.screenwriterWriting) {
    return "Writing story…";
  }
  const activity = journeyAgent?.activity;
  const destinationId = constructingBeatId ?? activity?.destinationId;
  const pair = activity?.journeyId ?? live?.assessingJourneyIds?.[0] ?? live?.shootingJourneyIds?.[0];
  const compact = pair ? formatJourneyCompact(pair) : "";
  const repairing = journeyAgent?.phase === "REPAIRING_CANONICALS";
  const constructing =
    Boolean(constructingBeatId) ||
    journeyAgent?.phase === "CONSTRUCTING" ||
    journeyAgent?.phase === "ESTABLISHING_START" ||
    repairing;
  if (destinationId && constructing) {
    return `Generating ${destinationId}${repairing ? "′" : ""}…`;
  }
  if (journeyAgent?.phase === "DIRECTING" || live?.directorPlanning) {
    return "Directing";
  }
  if (journeyAgent?.phase === "PLANNING_MOTION") {
    return compact ? `Planning ${compact}…` : "Planning…";
  }
  if (journeyAgent?.phase === "SHOOTING") {
    return compact ? `Shooting ${compact}…` : "Shooting…";
  }
  if (journeyAgent?.phase === "ASSEMBLING") {
    return "Assembling…";
  }
  return null;
}

export function directorScanLine(entries: ConversationEntry[], project: Project): string | undefined {
  const director = [...entries].reverse().find((entry) => entry.kind === "director" && entry.status === "complete");
  if (director?.kind === "director" && director.summary?.trim()) {
    return director.summary.trim();
  }
  const constructing = [...entries].reverse().find((entry) => entry.kind === "construction");
  if (constructing?.kind === "construction") {
    return destinationDescription(project, constructing.beatId);
  }
  return undefined;
}

export function cinematographerScanLine(entries: ConversationEntry[]): {
  pair: string;
  summary: string;
  setConsistency?: number;
  traversalConfidence?: number;
} | undefined {
  const blocks = groupConversationEntries(entries);
  const block = [...blocks].reverse().find((item): item is CinematographerBlock => item.kind === "cinematographer");
  if (!block) {
    return undefined;
  }
  const scores = cinematographerScores(block);
  const pair = block.blocking?.journeyId ?? block.evaluation?.journeyId;
  const summary =
    block.blocking?.assessment?.summary?.trim() ||
    block.evaluation?.instruction?.trim() ||
    "";
  if (!pair && !summary) {
    return undefined;
  }
  return {
    pair: pair ? formatJourneyCompact(pair) : "",
    summary,
    ...scores,
  };
}

export function repairScanLine(entries: ConversationEntry[]): {
  letters: string;
  travel?: number;
  reason?: string;
  recommendation?: string;
} | undefined {
  const repair = [...entries].reverse().find(
    (entry) => entry.kind === "agent" && (entry.status === "repairing" || entry.status === "repaired"),
  );
  if (!repair || repair.kind !== "agent") {
    return undefined;
  }
  return {
    letters: repair.destinationIds.join(" & "),
    travel: repair.traversalConfidence,
    reason: repair.instruction?.trim(),
    recommendation: repair.recommendation ? humanRepairRecommendation(repair.recommendation) : undefined,
  };
}

function asRejected(frame: StoryboardFrame, takes: CanonicalTake[], travel?: number): RejectedCanonical[] {
  return takes.map((take) => ({
    take,
    letter: frame.id,
    attempt: take.number ?? 0,
    ...(travel != null ? { travel } : {}),
  }));
}

export function rejectedCanonicals(frame: StoryboardFrame, travel?: number): RejectedCanonical[] {
  const selected = selectedCanonicalTake(frame);
  return asRejected(
    frame,
    canonicalTakes(frame).filter((take) => take.id !== selected?.id),
    travel,
  );
}

export function previousCanonicals(frame: StoryboardFrame, travel?: number): RejectedCanonical[] {
  return asRejected(frame, canonicalTakes(frame), travel);
}

export function locationCaption(project: Project, id: string): string {
  return destinationLocationLabel(project, id) ?? id;
}

export function beatText(project: Project, id: string): string {
  const frame = project.storyboard.find((item) => item.id === id);
  const story = compactCopy(project.story);
  const intent = frame?.intent?.trim() ?? "";
  if (intent && !copyOverlapsStory(intent, story)) {
    return intent;
  }
  const visual = frame?.visualDescription?.trim() ?? "";
  if (visual && !copyOverlapsStory(visual, story)) {
    return visual;
  }
  return "";
}

function compactCopy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function copyOverlapsStory(text: string, story: string): boolean {
  if (!story) {
    return false;
  }
  const compact = compactCopy(text);
  return compact === story || story.includes(compact) || compact.includes(story);
}

export function turnPrompt(turn: JourneyTurn, fallback = ""): string {
  return turn.prompt.trim() || fallback.trim();
}

export function turnReasoningLines(entries: ConversationEntry[], project: Project): TurnReasoningLine[] {
  const lines: TurnReasoningLine[] = [];
  const blocks = groupConversationEntries(entries);
  for (const block of blocks) {
    if (block.kind === "cinematographer") {
      const pair = block.blocking?.journeyId ?? block.evaluation?.journeyId;
      const summary =
        block.blocking?.assessment?.summary?.trim() ||
        block.evaluation?.instruction?.trim() ||
        "";
      if (!pair && !summary) {
        continue;
      }
      lines.push({
        id: block.id,
        role: pair ? `Cinematographer · ${formatJourneyCompact(pair)}` : "Cinematographer",
        text: summary,
      });
      continue;
    }
    const entry = block.entry;
    if (entry.kind === "filmmaker" || entry.kind === "assembly") {
      continue;
    }
    if (entry.kind === "director" && entry.status === "complete" && entry.summary?.trim()) {
      lines.push({ id: entry.id, role: "Director", text: entry.summary.trim() });
      continue;
    }
    if (entry.kind === "construction" && entry.status === "constructed") {
      const description = destinationDescription(project, entry.beatId);
      lines.push({
        id: entry.id,
        role: entry.beatId,
        text: description ?? `Generated ${entry.beatId}`,
      });
      continue;
    }
    if (entry.kind === "agent" && (entry.status === "repairing" || entry.status === "repaired")) {
      const repair = repairScanLine([entry]);
      if (!repair) {
        continue;
      }
      const bits = [
        repair.travel != null ? `Travel ${repair.travel}` : "",
        repair.reason ?? "",
        repair.recommendation ?? "",
      ].filter(Boolean);
      lines.push({
        id: entry.id,
        role: `Reshoot · ${repair.letters}`,
        text: bits.join(" · "),
      });
    }
  }
  return lines;
}
