import { useEffect, useRef, type ReactNode } from "react";
import { formatConversationClock, type ConversationEntry } from "../project/conversation";
import type { DirectorEvidence } from "../project/director";
import { humanRepairRecommendation } from "../project/journey-agent-repair";
import { currentCutClips, currentCutDurationSeconds, formatCutClock } from "../project/current-cut";
import { useProject } from "../project/ProjectProvider";
import { CopyToClipboardButton } from "../ui/CopyToClipboardButton";
import { ProgressSpinner } from "../ui/ProgressSpinner";
import {
  cinematographerCardCopy,
  cinematographerScores,
  cinematographerSegmentLabel,
  clampScore,
  destinationCardCopy,
  destinationDescription,
  directorCardCopy,
  filmmakerCardCopy,
  formatDirectorEvidenceJson,
  formatJourneyArrow,
  formatJourneyCompact,
  groupConversationEntries,
  journeyCompleteCardCopy,
  repairCardCopy,
  shootingCardCopy,
  type CinematographerBlock,
  type ConversationBlock,
} from "./conversation-console";
import { PanelHeader } from "./PanelHeader";
import { ShootingPromptText } from "./ShootingPromptText";

export { formatDirectorEvidenceJson };

export function ConversationRailToggle({ compact = false }: { compact?: boolean } = {}) {
  const { conversationRailOpen, setConversationRailOpen } = useProject();
  const label = conversationRailOpen ? "Hide director" : "Show director";
  return (
    <button
      type="button"
      aria-pressed={conversationRailOpen}
      aria-controls="filmmaking-conversation"
      aria-label="Director"
      title={label}
      onClick={() => setConversationRailOpen(!conversationRailOpen)}
      className={
        compact
          ? "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#9a8f7e] outline-none hover:text-[#cfc6b8] focus-visible:text-[#ece7df] focus-visible:ring-1 focus-visible:ring-[#7a7266]"
          : `flex h-7 w-7 shrink-0 items-center justify-center rounded border outline-none ${
              conversationRailOpen
                ? "border-[#ece7df] text-[#ece7df]"
                : "border-[#3a342c] text-[#9a8f7e] hover:border-[#7a7266] hover:text-[#cfc6b8]"
            }`
      }
    >
      <svg viewBox="0 0 12 12" className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden>
        <rect
          x="1.6"
          y="2.1"
          width="8.8"
          height="7.8"
          rx="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <path d="M4.7 2.1v7.8" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    </button>
  );
}

function ConversationBusyStatus({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <p className={`flex items-center gap-2 ${className}`} aria-busy="true">
      <ProgressSpinner className="h-3 w-3" />
      <span>{children}</span>
    </p>
  );
}

function ConversationCard({
  className,
  title,
  createdAt,
  copyText,
  copyLabel,
  active = false,
  children,
}: {
  className: string;
  title: ReactNode;
  createdAt: string;
  copyText: string;
  copyLabel: string;
  active?: boolean;
  children?: ReactNode;
}) {
  const clock = formatConversationClock(createdAt);
  return (
    <article
      className={`rounded border border-[#3a342c] bg-[#161410] px-3 py-2.5 ${className}`.trim()}
      aria-busy={active || undefined}
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-[11px] font-semibold tracking-[0.14em] text-[#ece7df] uppercase">
          {active ? <ProgressSpinner className="mr-1.5 inline-block h-3 w-3 align-[-2px]" /> : null}
          {title}
          {clock ? (
            <span className="font-normal tracking-[0.08em] text-[#7a7266]">{` · ${clock}`}</span>
          ) : null}
        </p>
        <CopyToClipboardButton text={copyText} label={copyLabel} />
      </div>
      {children ? <div className="mt-2">{children}</div> : null}
    </article>
  );
}

function ScoreMeter({ label, value }: { label: string; value: number }) {
  const score = clampScore(value);
  return (
    <div>
      <p className="text-[10px] tracking-[0.16em] text-[#9a8f7e] uppercase">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#2a2620]"
          role="meter"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={score}
        >
          <div className="h-full rounded-full bg-[#ece7df]" style={{ width: `${score}%` }} />
        </div>
        <span className="w-7 text-right text-[12px] tabular-nums text-[#ece7df]">{score}</span>
      </div>
    </div>
  );
}

function DirectorEvidenceDetails({ evidence }: { evidence: DirectorEvidence }) {
  return (
    <details className="text-xs text-[#9a8f7e]">
      <summary className="cursor-pointer tracking-[0.16em] uppercase">Evidence</summary>
      <div className="mt-2 space-y-2 leading-relaxed">
        {evidence.model ? <p>Model: {evidence.model}</p> : null}
        {evidence.predictionId ? <p>Prediction: {evidence.predictionId}</p> : null}
        <p>Elapsed: {evidence.elapsedMs}ms</p>
        <pre className="director-evidence-json max-h-64 overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-snug text-[#cfc6b8]">
          {formatDirectorEvidenceJson(evidence)}
        </pre>
      </div>
    </details>
  );
}

function FilmmakerEntryView({ entry }: { entry: Extract<ConversationEntry, { kind: "filmmaker" }> }) {
  return (
    <ConversationCard
      className="conversation-filmmaker"
      title="Filmmaker"
      createdAt={entry.createdAt}
      copyText={filmmakerCardCopy(entry.text, entry.createdAt)}
      copyLabel="Copy filmmaker"
    >
      <div className="border-l border-[#3a342c] pl-3">
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#cfc6b8]">{entry.text}</p>
      </div>
    </ConversationCard>
  );
}

function DirectorEntryView({ entry }: { entry: Extract<ConversationEntry, { kind: "director" }> }) {
  const busyLabel = entry.phase === "story" ? "Writing story…" : "Planning…";
  return (
    <ConversationCard
      className="conversation-director"
      title="Director"
      createdAt={entry.createdAt}
      copyText={directorCardCopy(entry)}
      copyLabel="Copy director"
      active={entry.status === "planning"}
    >
      {entry.status === "planning" ? (
        <ConversationBusyStatus className="text-[13px] tracking-[0.14em] text-[#9a8f7e] uppercase">
          {busyLabel}
        </ConversationBusyStatus>
      ) : null}
      {entry.status === "failed" ? (
        <p className="rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-sm text-[#f0c2a8]">
          {entry.error}
        </p>
      ) : null}
      {entry.status === "complete" && entry.evidence ? (
        <div className="space-y-3">
          {entry.summary ? (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#ece7df]">{entry.summary}</p>
          ) : null}
          <DirectorEvidenceDetails evidence={entry.evidence} />
        </div>
      ) : null}
    </ConversationCard>
  );
}

function DestinationEntryView({
  entry,
  description,
}: {
  entry: Extract<ConversationEntry, { kind: "construction" }>;
  description?: string;
}) {
  return (
    <ConversationCard
      className="conversation-destination"
      title={`Destination ${entry.beatId}`}
      createdAt={entry.createdAt}
      copyText={destinationCardCopy(entry.beatId, entry.status, entry.createdAt, {
        description,
        error: entry.error,
        imageUrl: entry.imageUrl,
      })}
      copyLabel={`Copy destination ${entry.beatId}`}
      active={entry.status === "constructing"}
    >
      {entry.status === "constructing" ? (
        <ConversationBusyStatus className="text-[13px] tracking-[0.14em] text-[#9a8f7e] uppercase">
          Constructing {entry.beatId}…
        </ConversationBusyStatus>
      ) : null}
      {description ? (
        <p className="mb-2 text-[12px] leading-relaxed text-[#9a8f7e]">{description}</p>
      ) : null}
      {entry.status === "constructed" && entry.imageUrl ? (
        <img src={entry.imageUrl} alt="" className="media-contain aspect-video w-full rounded" />
      ) : null}
      {entry.status === "failed" ? (
        <p className="rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-sm text-[#f0c2a8]">
          {entry.error}
        </p>
      ) : null}
    </ConversationCard>
  );
}

function CinematographerBlockView({ block }: { block: CinematographerBlock }) {
  const segment = cinematographerSegmentLabel(block);
  const scores = cinematographerScores(block);
  const reevaluating =
    block.evaluation?.status === "reevaluating" || block.evaluation?.status === "reevaluated";
  const evaluating =
    block.evaluation?.status === "evaluating" || block.evaluation?.status === "reevaluating";
  const blockingBusy = block.blocking?.status === "blocking";
  const assessment = block.blocking?.assessment;
  const title = (
    <>
      Cinematographer
      {segment ? ` · ${segment}` : ""}
      {reevaluating ? " · Reevaluation" : ""}
    </>
  );
  return (
    <ConversationCard
      className={`conversation-cinematographer${block.blocking ? " conversation-blocking" : " conversation-agent"}`}
      title={title}
      createdAt={block.createdAt}
      copyText={cinematographerCardCopy(block)}
      copyLabel={segment ? `Copy cinematographer ${segment}` : "Copy cinematographer"}
      active={evaluating || blockingBusy}
    >
      {block.blocking?.status === "failed" ? (
        <p className="mb-2 rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-sm text-[#f0c2a8]">
          {block.blocking.error}
        </p>
      ) : null}
      {scores.setConsistency != null || scores.traversalConfidence != null ? (
        <div className="space-y-2">
          {scores.setConsistency != null ? (
            <ScoreMeter label="Set Consistency" value={scores.setConsistency} />
          ) : null}
          {scores.traversalConfidence != null ? (
            <ScoreMeter label="Traversal Confidence" value={scores.traversalConfidence} />
          ) : null}
        </div>
      ) : null}
      {assessment ? (
        <div className="mt-3 space-y-3">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#ece7df]">{assessment.summary}</p>
          <details className="text-xs text-[#9a8f7e]">
            <summary className="cursor-pointer tracking-[0.16em] uppercase">Traversal</summary>
            <div className="mt-2 space-y-2 leading-relaxed text-[#cfc6b8]">
              <p>{assessment.shootability}</p>
              <p>{assessment.camera}</p>
              <p>{assessment.pace}</p>
              <p>{assessment.route}</p>
              <ShootingPromptText
                effectivePrompt={assessment.segmentPromptAddition}
                segmentPromptAddition={assessment.segmentPromptAddition}
              />
              {assessment.concerns.length > 0 ? (
                <div>
                  {assessment.concerns.map((concern) => (
                    <p key={concern}>{concern}</p>
                  ))}
                </div>
              ) : null}
            </div>
          </details>
        </div>
      ) : null}
    </ConversationCard>
  );
}

function RepairEntryView({ entry }: { entry: Extract<ConversationEntry, { kind: "agent" }> }) {
  const letters = entry.destinationIds.join(" & ");
  const repaired = entry.status === "repaired";
  return (
    <ConversationCard
      className="conversation-agent"
      title={repaired ? `Reshoot complete · ${letters}` : `Reshoot · ${letters}`}
      createdAt={entry.createdAt}
      copyText={repairCardCopy(entry)}
      copyLabel={`Copy reshoot ${letters}`}
      active={entry.status === "repairing"}
    >
      {repaired ? (
        <div className="space-y-2">
          {entry.setConsistency != null && entry.afterSetConsistency != null ? (
            <ScoreMeter
              label={`Set Consistency ${entry.setConsistency} → ${entry.afterSetConsistency}`}
              value={entry.afterSetConsistency}
            />
          ) : null}
          {entry.traversalConfidence != null && entry.afterTraversalConfidence != null ? (
            <ScoreMeter
              label={`Traversal Confidence ${entry.traversalConfidence} → ${entry.afterTraversalConfidence}`}
              value={entry.afterTraversalConfidence}
            />
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[13px] leading-relaxed text-[#cfc6b8]">
            {formatJourneyCompact(entry.journeyId)} needs a stronger spatial connection.
          </p>
          {entry.setConsistency != null ? <ScoreMeter label="Set Consistency" value={entry.setConsistency} /> : null}
          {entry.traversalConfidence != null ? (
            <ScoreMeter label="Traversal Confidence" value={entry.traversalConfidence} />
          ) : null}
          {entry.recommendation ? (
            <p className="text-[11px] tracking-[0.14em] text-[#9a8f7e] uppercase">
              {humanRepairRecommendation(entry.recommendation)}
            </p>
          ) : null}
          {entry.instruction ? (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#ece7df]">
              Brief reason: {entry.instruction}
            </p>
          ) : null}
        </div>
      )}
    </ConversationCard>
  );
}

function ShootingEntryView({ entry }: { entry: Extract<ConversationEntry, { kind: "shooting" }> }) {
  const segment = formatJourneyArrow(entry.journeyId);
  const title =
    entry.status === "shooting"
      ? `● Shooting ${segment}...`
      : entry.status === "shot"
        ? `✓ Shot ${segment} accepted`
        : `Shot ${segment}`;
  return (
    <ConversationCard
      className="conversation-shooting"
      title={title}
      createdAt={entry.createdAt}
      copyText={shootingCardCopy(entry)}
      copyLabel={`Copy shot ${segment}`}
      active={entry.status === "shooting"}
    >
      {entry.status === "failed" ? (
        <p className="rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-sm text-[#f0c2a8]">
          {entry.error}
        </p>
      ) : null}
      {entry.status === "shot" && entry.take ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <img
              src={entry.take.startShootingFrame.imageUrl}
              alt=""
              className="media-contain aspect-video w-full rounded"
            />
            <img
              src={entry.take.endShootingFrame.imageUrl}
              alt=""
              className="media-contain aspect-video w-full rounded"
            />
          </div>
          {entry.take.segmentPromptAddition.trim() ? (
            <p
              className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#e6c36a]"
              data-prompt-role="cm"
            >
              {entry.take.segmentPromptAddition}
            </p>
          ) : null}
          <details className="text-xs text-[#9a8f7e]">
            <summary className="cursor-pointer tracking-[0.16em] uppercase">Take</summary>
            <div className="mt-2 space-y-2 leading-relaxed text-[#cfc6b8]">
              <ShootingPromptText
                effectivePrompt={entry.take.effectivePrompt}
                segmentPromptAddition={entry.take.segmentPromptAddition}
              />
              <p>
                {entry.take.provider} · {entry.take.model}
                {entry.take.modelVersion ? ` · ${entry.take.modelVersion}` : ""}
              </p>
              <p>{entry.take.durationSeconds}s</p>
            </div>
          </details>
        </div>
      ) : null}
    </ConversationCard>
  );
}

function JourneyCompleteEntryView({
  entry,
}: {
  entry: Extract<ConversationEntry, { kind: "assembly" }>;
}) {
  const { project, playCurrentCutFromStart, playing, pauseCurrentCut } = useProject();
  const clips = currentCutClips(project);
  const duration = currentCutDurationSeconds(project);
  const canPlay = clips.length > 0;
  return (
    <ConversationCard
      className="conversation-assembly"
      title="✓ Journey complete"
      createdAt={entry.createdAt}
      copyText={journeyCompleteCardCopy(entry, project)}
      copyLabel="Copy journey complete"
    >
      <div className="space-y-3">
        <p className="text-[13px] tracking-[0.16em] text-[#ece7df] uppercase">
          {clips.length} {clips.length === 1 ? "shot" : "shots"}
        </p>
        <p className="text-[12px] tracking-[0.14em] text-[#9a8f7e] uppercase">Full journey ready</p>
        {duration > 0 ? (
          <p className="text-[12px] tabular-nums tracking-[0.12em] text-[#9a8f7e]">{formatCutClock(duration)}</p>
        ) : null}
        <p className="sr-only">The journey is ready.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canPlay}
            aria-label={playing ? "Pause journey" : "Play journey"}
            className="inline-flex items-center rounded border border-[#ece7df] px-3 py-1 text-[13px] tracking-[0.14em] text-[#ece7df] uppercase disabled:cursor-not-allowed disabled:border-[#3a342c] disabled:text-[#7a7266]"
            onClick={() => {
              if (playing) {
                pauseCurrentCut();
              } else {
                playCurrentCutFromStart();
              }
            }}
          >
            {playing ? "Pause" : "▶ Play journey"}
          </button>
          <a
            href={entry.videoUrl}
            download={entry.filename}
            aria-label="Download journey movie"
            className="inline-flex rounded border border-[#3a342c] px-3 py-1 text-[13px] tracking-[0.14em] text-[#ece7df] uppercase"
          >
            Download
          </a>
        </div>
      </div>
    </ConversationCard>
  );
}

function ConversationBlockView({
  block,
  descriptionFor,
}: {
  block: ConversationBlock;
  descriptionFor: (beatId: string) => string | undefined;
}) {
  if (block.kind === "cinematographer") {
    return <CinematographerBlockView block={block} />;
  }
  const entry = block.entry;
  if (entry.kind === "filmmaker") {
    return <FilmmakerEntryView entry={entry} />;
  }
  if (entry.kind === "director") {
    return <DirectorEntryView entry={entry} />;
  }
  if (entry.kind === "construction") {
    return <DestinationEntryView entry={entry} description={descriptionFor(entry.beatId)} />;
  }
  if (entry.kind === "shooting") {
    return <ShootingEntryView entry={entry} />;
  }
  if (entry.kind === "assembly") {
    return <JourneyCompleteEntryView entry={entry} />;
  }
  if (entry.kind === "agent") {
    return <RepairEntryView entry={entry} />;
  }
  return null;
}

export function ConversationRail() {
  const { conversation, project } = useProject();
  const threadRef = useRef<HTMLDivElement>(null);
  const followThread = useRef(true);
  const blocks = groupConversationEntries(conversation);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread || !followThread.current) {
      return;
    }
    thread.scrollTop = thread.scrollHeight;
  }, [conversation]);

  return (
    <aside
      id="filmmaking-conversation"
      className="conversation-rail flex h-full min-h-0 min-w-0 flex-col bg-[#12100d]"
      aria-label="Director"
    >
      <PanelHeader className="conversation-rail-header" title="Director">
        <ConversationRailToggle />
      </PanelHeader>
      <div
        ref={threadRef}
        className="min-h-0 flex-1 overflow-auto px-4 py-3"
        onScroll={(event) => {
          const thread = event.currentTarget;
          followThread.current =
            thread.scrollHeight - thread.scrollTop - thread.clientHeight < 48;
        }}
      >
        <div className="flex flex-col">
          {blocks.map((block, index) => {
            const previous = blocks[index - 1];
            const entryKind = block.kind === "entry" ? block.entry.kind : "cinematographer";
            const previousKind = previous?.kind === "entry" ? previous.entry.kind : previous?.kind;
            const spacing =
              index === 0
                ? ""
                : entryKind === "director" && previousKind === "filmmaker"
                  ? "mt-3"
                  : entryKind === "filmmaker"
                    ? "mt-8"
                    : "mt-4";
            return (
              <div key={block.kind === "entry" ? block.entry.id : block.id} className={spacing}>
                <ConversationBlockView
                  block={block}
                  descriptionFor={(beatId) => destinationDescription(project, beatId)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
