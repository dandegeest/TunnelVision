import { useEffect, useRef } from "react";
import { formatConversationClock, type ConversationEntry } from "../project/conversation";
import type { DirectorEvidence } from "../project/director";
import { useProject } from "../project/ProjectProvider";
import { hasAuthoritativeStartingFrame } from "../project/starting-frame";

export function ConversationRailToggle({ compact = false }: { compact?: boolean } = {}) {
  const { conversationRailOpen, setConversationRailOpen } = useProject();
  const label = conversationRailOpen ? "Hide filmmaking conversation" : "Show filmmaking conversation";
  return (
    <button
      type="button"
      aria-pressed={conversationRailOpen}
      aria-controls="filmmaking-conversation"
      aria-label="Filmmaking conversation"
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

function ConversationStamp({
  role,
  createdAt,
}: {
  role: string;
  createdAt: string;
}) {
  const clock = formatConversationClock(createdAt);
  return (
    <p className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">
      {role}
      {clock ? ` · ${clock}` : ""}
    </p>
  );
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

function DirectorEvidenceDetails({ evidence }: { evidence: DirectorEvidence }) {
  return (
    <details className="text-xs text-[#9a8f7e]">
      <summary className="cursor-pointer tracking-[0.16em] uppercase">Director</summary>
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

function ConversationEntryView({ entry }: { entry: ConversationEntry }) {
  if (entry.kind === "filmmaker") {
    return (
      <article className="conversation-filmmaker">
        <ConversationStamp role="Filmmaker" createdAt={entry.createdAt} />
        <div className="mt-2 border-l border-[#3a342c] pl-3">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#cfc6b8]">{entry.text}</p>
        </div>
      </article>
    );
  }
  if (entry.kind === "director") {
    return (
      <article className="conversation-director">
        <ConversationStamp role="Director" createdAt={entry.createdAt} />
        {entry.status === "planning" ? (
          <p className="mt-3 text-[13px] tracking-[0.14em] text-[#9a8f7e] uppercase">Planning…</p>
        ) : null}
        {entry.status === "failed" ? (
          <p className="mt-3 rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-sm text-[#f0c2a8]">
            {entry.error}
          </p>
        ) : null}
        {entry.status === "complete" && entry.evidence ? (
          <div className="mt-3 space-y-4">
            <DirectorEvidenceDetails evidence={entry.evidence} />
            {entry.summary ? (
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#ece7df]">{entry.summary}</p>
            ) : null}
          </div>
        ) : null}
      </article>
    );
  }
  return (
    <article>
      {entry.status === "constructing" ? (
        <p className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">
          Constructing {entry.beatId}…
        </p>
      ) : null}
      {entry.status === "constructed" ? (
        <>
          <p className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">
            Constructed {entry.beatId}
          </p>
          {entry.imageUrl ? (
            <img src={entry.imageUrl} alt="" className="mt-2 aspect-video w-full object-cover" />
          ) : null}
        </>
      ) : null}
      {entry.status === "failed" ? (
        <p className="rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-sm text-[#f0c2a8]">
          {entry.error}
        </p>
      ) : null}
    </article>
  );
}

export function ConversationRail() {
  const {
    composerDraft,
    setComposerDraft,
    conversation,
    directorStatus,
    planStartError,
    startingFrameError,
    replacingStart,
    project,
  } = useProject();
  const threadRef = useRef<HTMLDivElement>(null);
  const followThread = useRef(true);
  const planning = directorStatus === "planning";
  const hasOpeningFrame = hasAuthoritativeStartingFrame(project);

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
      aria-label="Story"
    >
      <div className="conversation-rail-header flex h-9 shrink-0 items-center justify-end border-b border-[#2a2620] bg-[#0c0b0a] px-2">
        <ConversationRailToggle />
      </div>
      <div
        ref={threadRef}
        className="min-h-0 flex-1 overflow-auto px-4 py-3"
        onScroll={(event) => {
          const thread = event.currentTarget;
          followThread.current =
            thread.scrollHeight - thread.scrollTop - thread.clientHeight < 48;
        }}
      >
        {startingFrameError ? (
          <p className="mb-3 rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-sm text-[#f0c2a8]">
            {startingFrameError}
          </p>
        ) : null}
        {planStartError ? (
          <p className="mb-3 rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-sm text-[#f0c2a8]">
            {planStartError}
          </p>
        ) : null}
        <div className="flex flex-col">
          {conversation.map((entry, index) => {
            const previous = conversation[index - 1];
            const spacing =
              index === 0
                ? ""
                : entry.kind === "director" && previous?.kind === "filmmaker"
                  ? "mt-3"
                  : entry.kind === "filmmaker"
                    ? "mt-8"
                    : "mt-5";
            return (
              <div key={entry.id} className={spacing}>
                <ConversationEntryView entry={entry} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex-none border-t border-[#2a2620] px-3 py-2">
        <label className="sr-only" htmlFor="plan-composer">
          Movie
        </label>
        <div className="flex items-end gap-2 rounded border border-[#3a342c] bg-[#161410] px-2.5 py-1.5">
          <textarea
            id="plan-composer"
            rows={5}
            value={composerDraft}
            placeholder="Describe the movie…"
            aria-label="Movie"
            className="h-[8.25rem] min-h-[6.75rem] max-h-[12.5rem] min-w-0 flex-1 resize-y overflow-auto bg-transparent text-[13px] leading-relaxed text-[#ece7df] placeholder:text-[#9a8f7e]"
            onChange={(event) => setComposerDraft(event.target.value)}
          />
          <button
            type="button"
            disabled
            aria-label="Send"
            title="Send is not a filmmaking command yet. Use PLAN in the Plan workspace."
            className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#3a342c] text-[#9a8f7e] disabled:cursor-not-allowed"
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
              <path
                d="M2 6h8M6.5 2.5 10 6 6.5 9.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">
          {hasOpeningFrame
            ? planning
              ? "Director is planning…"
              : "Send is inactive. Use PLAN to ask the Director."
            : "Upload starting frame A before planning."}
        </p>
        {replacingStart ? (
          <p className="mt-2 text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">
            Uploading…
          </p>
        ) : null}
      </div>
    </aside>
  );
}
