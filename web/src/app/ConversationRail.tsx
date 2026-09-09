import { useEffect, useRef, type ReactNode } from "react";
import { formatConversationClock, type ConversationEntry } from "../project/conversation";
import type { DirectorEvidence } from "../project/director";
import { useProject } from "../project/ProjectProvider";
import { ProgressSpinner } from "../ui/ProgressSpinner";

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
    const busyLabel = entry.phase === "story" ? "Writing story…" : "Planning…";
    return (
      <article className="conversation-director">
        <ConversationStamp role="Director" createdAt={entry.createdAt} />
        {entry.status === "planning" ? (
          <ConversationBusyStatus className="mt-3 text-[13px] tracking-[0.14em] text-[#9a8f7e] uppercase">
            {busyLabel}
          </ConversationBusyStatus>
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
  if (entry.kind === "blocking") {
    return (
      <article className="conversation-blocking">
        <ConversationStamp role="Cinematographer" createdAt={entry.createdAt} />
        {entry.status === "blocking" ? (
          <ConversationBusyStatus className="mt-3 text-[13px] tracking-[0.14em] text-[#9a8f7e] uppercase">
            Blocking {entry.journeyId}…
          </ConversationBusyStatus>
        ) : null}
        {entry.status === "failed" ? (
          <p className="mt-3 rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-sm text-[#f0c2a8]">
            {entry.error}
          </p>
        ) : null}
        {entry.status === "blocked" && entry.assessment ? (
          <div className="mt-3 space-y-4">
            <details className="text-xs text-[#9a8f7e]">
              <summary className="cursor-pointer tracking-[0.16em] uppercase">Cinematographer</summary>
              <div className="mt-2 space-y-2 leading-relaxed text-[#cfc6b8]">
                <p>{entry.assessment.shootability}</p>
                <p>{entry.assessment.camera}</p>
                <p>{entry.assessment.route}</p>
                <p>{entry.assessment.segmentPromptAddition}</p>
                {entry.assessment.concerns.length > 0 ? (
                  <div>
                    {entry.assessment.concerns.map((concern) => (
                      <p key={concern}>{concern}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            </details>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#ece7df]">
              {entry.assessment.summary}
            </p>
          </div>
        ) : null}
      </article>
    );
  }
  if (entry.kind === "shooting") {
    return (
      <article className="conversation-shooting">
        <ConversationStamp role="Shoot" createdAt={entry.createdAt} />
        {entry.status === "shooting" ? (
          <ConversationBusyStatus className="mt-3 text-[13px] tracking-[0.14em] text-[#9a8f7e] uppercase">
            Shooting {entry.journeyId}…
          </ConversationBusyStatus>
        ) : null}
        {entry.status === "failed" ? (
          <p className="mt-3 rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-sm text-[#f0c2a8]">
            {entry.error}
          </p>
        ) : null}
        {entry.status === "shot" && entry.take ? (
          <div className="mt-3 space-y-4">
            <details className="text-xs text-[#9a8f7e]">
              <summary className="cursor-pointer tracking-[0.16em] uppercase">Take</summary>
              <div className="mt-2 space-y-2 leading-relaxed text-[#cfc6b8]">
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
                <p>{entry.take.effectivePrompt}</p>
                <p>
                  {entry.take.provider} · {entry.take.model}
                  {entry.take.modelVersion ? ` · ${entry.take.modelVersion}` : ""}
                </p>
                <p>{entry.take.durationSeconds}s</p>
              </div>
            </details>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#ece7df]">
              Shot {entry.journeyId}.
            </p>
          </div>
        ) : null}
      </article>
    );
  }
  return (
    <article>
      {entry.status === "constructing" ? (
        <ConversationBusyStatus className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">
          Constructing {entry.beatId}…
        </ConversationBusyStatus>
      ) : null}
      {entry.status === "constructed" ? (
        <>
          <p className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">
            Constructed {entry.beatId}
          </p>
          {entry.imageUrl ? (
            <img src={entry.imageUrl} alt="" className="media-contain mt-2 aspect-video w-full" />
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
  const { conversation } = useProject();
  const threadRef = useRef<HTMLDivElement>(null);
  const followThread = useRef(true);

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
    </aside>
  );
}
