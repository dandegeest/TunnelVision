import { formatConversationClock, type ConversationEntry } from "../project/conversation";
import type { DirectorEvidence } from "../project/director";
import { currentCutClips, currentCutDurationSeconds, formatCutClock } from "../project/current-cut";
import { humanRepairRecommendation } from "../project/journey-agent-repair";
import type { JourneyAgentSnapshot } from "../project/journey-agent";
import { isProductionEndpoint } from "../project/production-legs";
import { selectedTakeVideoUrl } from "../project/takes";
import type {
  CinematographerAssessment,
  JourneyShot,
  JourneyShotTake,
  Project,
  StoryboardFrame,
} from "../project/types";

export type JourneyProgressStatus = "complete" | "active" | "pending";

export type JourneyProgressNode = {
  id: string;
  letter: string;
  caption?: string;
  status: JourneyProgressStatus;
};

export type JourneyProgressSegment = {
  journeyId: string;
  from: string;
  to: string;
  label: string;
  status: JourneyProgressStatus;
};

export type JourneyProgress = {
  nodes: JourneyProgressNode[];
  segments: JourneyProgressSegment[];
};

export type JourneyProgressLive = {
  constructingBeatId?: string | null;
  assessingJourneyIds?: readonly string[];
  shootingJourneyIds?: readonly string[];
  journeyAgent?: JourneyAgentSnapshot | null;
};

export type CinematographerBlock = {
  kind: "cinematographer";
  id: string;
  createdAt: string;
  evaluation?: Extract<ConversationEntry, { kind: "agent" }>;
  blocking?: Extract<ConversationEntry, { kind: "blocking" }>;
};

export type ConversationBlock =
  | { kind: "entry"; entry: ConversationEntry }
  | CinematographerBlock;

const EVALUATION_STATUSES = new Set([
  "evaluating",
  "reevaluating",
  "evaluated",
  "reevaluated",
]);

export function formatJourneyArrow(journeyId: string): string {
  return journeyId.replaceAll("-", " → ");
}

export function formatJourneyCompact(journeyId: string): string {
  return journeyId.replaceAll("-", "→");
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function destinationLocationLabel(project: Project, id: string): string | undefined {
  const frame = project.storyboard.find((item) => item.id === id);
  const destination = project.destinations.find((item) => item.id === id);
  const label = frame?.label?.trim() || destination?.label?.trim();
  if (!label || label === id) {
    return undefined;
  }
  return label;
}

export function destinationDescription(project: Project, beatId: string): string | undefined {
  const frame = project.storyboard.find((item) => item.id === beatId);
  const intent = frame?.intent?.trim();
  if (intent) {
    return intent;
  }
  const visual = frame?.visualDescription?.trim();
  if (visual) {
    return visual;
  }
  return destinationLocationLabel(project, beatId);
}

function journeyByPair(project: Project, from: string, to: string): JourneyShot | undefined {
  const id = `${from}-${to}`;
  return (
    project.journeys.find((journey) => journey.id === id) ??
    project.journeys.find(
      (journey) => journey.startDestinationId === from && journey.endDestinationId === to,
    )
  );
}

function frameForDestination(project: Project, id: string): StoryboardFrame | undefined {
  return (
    project.storyboard.find((frame) => frame.id === id) ??
    project.storyboard.find((frame) => frame.destinationId === id)
  );
}

function canonicalHasStill(project: Project, id: string): boolean {
  const frame = frameForDestination(project, id);
  if (frame) {
    return isProductionEndpoint(frame);
  }
  const destination = project.destinations.find((item) => item.id === id);
  return Boolean(destination?.image);
}

function liveTouchesCanonical(id: string, live: JourneyProgressLive | undefined): boolean {
  if (live?.constructingBeatId === id) {
    return true;
  }
  const snapshot = live?.journeyAgent;
  const activity = snapshot?.activity;
  if (!activity) {
    return false;
  }
  const touches = activity.destinationId === id || activity.destinationIds?.includes(id);
  if (!touches) {
    return false;
  }
  return (
    snapshot?.phase === "ESTABLISHING_START" ||
    snapshot?.phase === "CONSTRUCTING" ||
    snapshot?.phase === "REPAIRING_CANONICALS"
  );
}

function liveTouchesSegment(
  journeyId: string,
  live: JourneyProgressLive | undefined,
): boolean {
  if (live?.shootingJourneyIds?.includes(journeyId)) {
    return true;
  }
  if (live?.assessingJourneyIds?.includes(journeyId)) {
    return true;
  }
  const activity = live?.journeyAgent?.activity;
  if (!activity) {
    return false;
  }
  return activity.journeyId === journeyId || Boolean(activity.journeyIds?.includes(journeyId));
}

function canonicalStatus(
  project: Project,
  id: string,
  live: JourneyProgressLive | undefined,
): JourneyProgressStatus {
  if (liveTouchesCanonical(id, live)) {
    return "active";
  }
  if (canonicalHasStill(project, id)) {
    return "complete";
  }
  return "pending";
}

function segmentStatus(
  project: Project,
  from: string,
  to: string,
  live: JourneyProgressLive | undefined,
): JourneyProgressStatus {
  const journeyId = `${from}-${to}`;
  const journey = journeyByPair(project, from, to);
  const id = journey?.id ?? journeyId;
  if (liveTouchesSegment(id, live) || journey?.status === "shooting") {
    return "active";
  }
  if (journey && (journey.status === "rendered" || selectedTakeVideoUrl(journey))) {
    return "complete";
  }
  return "pending";
}

function nodesFromStoryboard(frames: StoryboardFrame[]): string[] {
  return frames.map((frame) => frame.id);
}

function nodesFromJourneys(project: Project): string[] {
  const journeys = project.journeys.filter((journey) => Boolean(journey.endDestinationId));
  if (journeys.length === 0) {
    return [];
  }
  const nodes: string[] = [];
  for (const journey of journeys) {
    if (nodes.length === 0) {
      nodes.push(journey.startDestinationId);
    }
    const last = nodes[nodes.length - 1];
    if (last !== journey.startDestinationId && !nodes.includes(journey.startDestinationId)) {
      nodes.push(journey.startDestinationId);
    }
    if (journey.endDestinationId && !nodes.includes(journey.endDestinationId)) {
      nodes.push(journey.endDestinationId);
    }
  }
  return nodes;
}

export function journeyProgressFromProject(
  project: Project,
  live?: JourneyProgressLive,
): JourneyProgress | null {
  const ids =
    project.storyboard.length >= 2 ? nodesFromStoryboard(project.storyboard) : nodesFromJourneys(project);
  if (ids.length < 2) {
    return null;
  }
  const nodes: JourneyProgressNode[] = ids.map((id) => {
    const caption = destinationLocationLabel(project, id);
    return {
      id,
      letter: id,
      status: canonicalStatus(project, id, live),
      ...(caption ? { caption } : {}),
    };
  });
  const segments: JourneyProgressSegment[] = [];
  for (let index = 0; index < ids.length - 1; index += 1) {
    const from = ids[index]!;
    const to = ids[index + 1]!;
    const journeyId = journeyByPair(project, from, to)?.id ?? `${from}-${to}`;
    segments.push({
      journeyId,
      from,
      to,
      label: formatJourneyCompact(journeyId),
      status: segmentStatus(project, from, to, live),
    });
  }
  return { nodes, segments };
}

function isEvaluationEntry(
  entry: ConversationEntry,
): entry is Extract<ConversationEntry, { kind: "agent" }> {
  return entry.kind === "agent" && EVALUATION_STATUSES.has(entry.status);
}

function evaluationJourneyIds(entry: Extract<ConversationEntry, { kind: "agent" }>): string[] {
  return entry.journeyIds ?? [entry.journeyId];
}

function sameCinematographerSegment(
  evaluation: Extract<ConversationEntry, { kind: "agent" }>,
  blocking: Extract<ConversationEntry, { kind: "blocking" }>,
): boolean {
  return evaluationJourneyIds(evaluation).includes(blocking.journeyId);
}

export function groupConversationEntries(entries: ConversationEntry[]): ConversationBlock[] {
  const blocks: ConversationBlock[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    if (isEvaluationEntry(entry)) {
      const next = entries[index + 1];
      if (next?.kind === "blocking" && sameCinematographerSegment(entry, next)) {
        blocks.push({
          kind: "cinematographer",
          id: entry.id,
          createdAt: entry.createdAt,
          evaluation: entry,
          blocking: next,
        });
        index += 1;
        continue;
      }
      blocks.push({
        kind: "cinematographer",
        id: entry.id,
        createdAt: entry.createdAt,
        evaluation: entry,
      });
      continue;
    }
    if (entry.kind === "blocking") {
      blocks.push({
        kind: "cinematographer",
        id: entry.id,
        createdAt: entry.createdAt,
        blocking: entry,
      });
      continue;
    }
    blocks.push({ kind: "entry", entry });
  }
  return blocks;
}

export function formatDirectorEvidenceJson(evidence: DirectorEvidence): string {
  let rawText: unknown = evidence.rawText;
  try {
    rawText = JSON.parse(evidence.rawText);
  } catch {
    rawText = evidence.rawText;
  }
  return JSON.stringify(
    {
      request: evidence.request,
      rawText,
    },
    null,
    2,
  );
}

function withClock(createdAt: string, body: string): string {
  const clock = formatConversationClock(createdAt);
  return clock ? `${body}\n${clock}` : body;
}

function assessmentCopy(assessment: CinematographerAssessment): string {
  const lines = [
    `Set Consistency ${clampScore(assessment.setConsistency)}`,
    `Traversal Confidence ${clampScore(assessment.traversalConfidence)}`,
    assessment.summary,
    assessment.shootability,
    assessment.camera,
    assessment.pace,
    assessment.route,
    assessment.threshold,
    assessment.parallax,
    assessment.transitionStrategy,
    assessment.segmentPromptAddition,
    ...assessment.concerns,
  ];
  return lines.filter((line) => Boolean(line && String(line).trim())).join("\n");
}

export function filmmakerCardCopy(text: string, createdAt: string): string {
  return withClock(createdAt, `FILMMAKER\n${text}`);
}

export function directorCardCopy(entry: Extract<ConversationEntry, { kind: "director" }>): string {
  const lines = ["DIRECTOR"];
  if (entry.status === "planning") {
    lines.push(entry.phase === "story" ? "Writing story…" : "Planning…");
  }
  if (entry.status === "failed" && entry.error) {
    lines.push(entry.error);
  }
  if (entry.summary) {
    lines.push(entry.summary);
  }
  if (entry.evidence) {
    lines.push(formatDirectorEvidenceJson(entry.evidence));
  }
  return withClock(entry.createdAt, lines.join("\n"));
}

export function destinationCardCopy(
  beatId: string,
  status: "constructing" | "constructed" | "failed",
  createdAt: string,
  extras?: { description?: string; error?: string; imageUrl?: string },
): string {
  const lines = [`DESTINATION ${beatId}`];
  if (status === "constructing") {
    lines.push(`Constructing ${beatId}…`);
  }
  if (status === "constructed") {
    lines.push(`Constructed ${beatId}`);
  }
  if (extras?.description) {
    lines.push(extras.description);
  }
  if (extras?.imageUrl) {
    lines.push(extras.imageUrl);
  }
  if (extras?.error) {
    lines.push(extras.error);
  }
  return withClock(createdAt, lines.join("\n"));
}

export function cinematographerCardCopy(block: CinematographerBlock): string {
  const journeyId = block.blocking?.journeyId ?? block.evaluation?.journeyId ?? "";
  const segment = journeyId ? formatJourneyArrow(journeyId) : "";
  const reevaluating =
    block.evaluation?.status === "reevaluating" || block.evaluation?.status === "reevaluated";
  const lines = [
    reevaluating ? `CINEMATOGRAPHER REEVALUATION${segment ? ` · ${segment}` : ""}` : `CINEMATOGRAPHER${segment ? ` · ${segment}` : ""}`,
  ];
  const setConsistency =
    block.blocking?.assessment?.setConsistency ?? block.evaluation?.setConsistency;
  const traversalConfidence =
    block.blocking?.assessment?.traversalConfidence ?? block.evaluation?.traversalConfidence;
  if (setConsistency != null) {
    lines.push(`Set Consistency ${clampScore(setConsistency)}`);
  }
  if (traversalConfidence != null) {
    lines.push(`Traversal Confidence ${clampScore(traversalConfidence)}`);
  }
  if (block.blocking?.status === "blocking") {
    lines.push(`Blocking ${formatJourneyCompact(block.blocking.journeyId)}…`);
  }
  if (block.evaluation && (block.evaluation.status === "evaluating" || block.evaluation.status === "reevaluating")) {
    lines.push(
      block.evaluation.status === "reevaluating"
        ? `Cinematographer reevaluation · ${formatJourneyCompact(block.evaluation.journeyId)}`
        : `Cinematographer evaluation · ${formatJourneyCompact(block.evaluation.journeyId)}`,
    );
  }
  if (block.blocking?.status === "failed" && block.blocking.error) {
    lines.push(block.blocking.error);
  }
  if (block.blocking?.assessment) {
    lines.push(assessmentCopy(block.blocking.assessment));
  }
  return withClock(block.createdAt, lines.join("\n"));
}

export function repairCardCopy(entry: Extract<ConversationEntry, { kind: "agent" }>): string {
  const letters = entry.destinationIds.join(" & ");
  const segment = formatJourneyArrow(entry.journeyId);
  const lines =
    entry.status === "repaired"
      ? [
          `RESHOOT COMPLETE · ${letters}`,
          segment,
          `Set Consistency ${entry.setConsistency} → ${entry.afterSetConsistency}`,
          `Traversal Confidence ${entry.traversalConfidence} → ${entry.afterTraversalConfidence}`,
        ]
      : [
          `RESHOOT · ${letters}`,
          `${formatJourneyCompact(entry.journeyId)} needs a stronger spatial connection.`,
          `Set Consistency ${entry.setConsistency} · Traversal Confidence ${entry.traversalConfidence}`,
        ];
  if (entry.recommendation) {
    lines.push(humanRepairRecommendation(entry.recommendation));
  }
  if (entry.instruction) {
    lines.push(`Brief reason: ${entry.instruction}`);
  }
  return withClock(entry.createdAt, lines.join("\n"));
}

function takeCopy(take: JourneyShotTake): string {
  return [
    take.effectivePrompt,
    `${take.provider} · ${take.model}${take.modelVersion ? ` · ${take.modelVersion}` : ""}`,
    `${take.durationSeconds}s`,
    take.startShootingFrame.imageUrl,
    take.endShootingFrame.imageUrl,
  ]
    .filter(Boolean)
    .join("\n");
}

export function shootingCardCopy(entry: Extract<ConversationEntry, { kind: "shooting" }>): string {
  const segment = formatJourneyArrow(entry.journeyId);
  const lines = [
    entry.status === "shooting"
      ? `SHOOTING ${segment}...`
      : entry.status === "shot"
        ? `SHOT ${segment} ACCEPTED`
        : `SHOT ${segment}`,
  ];
  if (entry.status === "failed" && entry.error) {
    lines.push(entry.error);
  }
  if (entry.take) {
    lines.push(takeCopy(entry.take));
  }
  if (entry.videoUrl) {
    lines.push(entry.videoUrl);
  }
  return withClock(entry.createdAt, lines.join("\n"));
}

export function journeyCompleteCardCopy(
  entry: Extract<ConversationEntry, { kind: "assembly" }>,
  project: Project,
): string {
  const clips = currentCutClips(project);
  const duration = currentCutDurationSeconds(project);
  const lines = [
    "JOURNEY COMPLETE",
    `${clips.length} ${clips.length === 1 ? "SHOT" : "SHOTS"}`,
    "FULL JOURNEY READY",
  ];
  if (duration > 0) {
    lines.push(formatCutClock(duration));
  }
  if (entry.videoUrl) {
    lines.push(entry.videoUrl);
  }
  if (entry.filename) {
    lines.push(entry.filename);
  }
  return withClock(entry.createdAt, lines.join("\n"));
}

export function cinematographerSegmentLabel(block: CinematographerBlock): string {
  const journeyId = block.blocking?.journeyId ?? block.evaluation?.journeyId;
  if (!journeyId) {
    return "";
  }
  if (block.evaluation?.journeyIds && block.evaluation.journeyIds.length > 1) {
    return block.evaluation.journeyIds.map((id) => formatJourneyArrow(id)).join(" · ");
  }
  return formatJourneyArrow(journeyId);
}

export function cinematographerScores(block: CinematographerBlock): {
  setConsistency?: number;
  traversalConfidence?: number;
} {
  return {
    setConsistency: block.blocking?.assessment?.setConsistency ?? block.evaluation?.setConsistency,
    traversalConfidence:
      block.blocking?.assessment?.traversalConfidence ?? block.evaluation?.traversalConfidence,
  };
}
