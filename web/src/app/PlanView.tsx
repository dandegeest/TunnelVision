import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useProject } from "../project/ProjectProvider";
import type { ConversationEntry } from "../project/conversation";
import type { DirectorEvidence } from "../project/director";
import { canConstructDestinationFrame } from "../project/destination";
import {
  displayProvenanceForFrame,
  formatMediaInfoLine,
  mediaPreflightForProject,
  preflightWarningsForFrame,
  provenanceAccessibleLabel,
  type DisplayProvenance,
  type FramePreflightWarning,
} from "../project/media-preflight";
import { isAuthoritativeStartingFrame, STARTING_FRAME_ACCEPT } from "../project/starting-frame";
import type { StoryboardFrame } from "../project/types";

const STORY_WIDTH_DEFAULT = 328;
const STORY_WIDTH_MIN = 260;
const STORY_WIDTH_MAX = 480;
const STORYBOARD_MIN = 420;

function clampStoryWidth(width: number, containerWidth: number) {
  const max = Math.max(
    STORY_WIDTH_MIN,
    Math.min(STORY_WIDTH_MAX, containerWidth - STORYBOARD_MIN),
  );
  return Math.min(max, Math.max(STORY_WIDTH_MIN, width));
}

function ProvenanceIcon({ provenance }: { provenance: DisplayProvenance }) {
  const label = provenanceAccessibleLabel(provenance);
  const icon =
    provenance === "uploaded" ? (
      <path
        d="M6 2.5v6.5M3.75 6.25 6 4l2.25 2.25M2.5 9.5h7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ) : provenance === "generated" ? (
      <path
        d="M6 1.75 6.7 4.6 9.5 5.25 6.7 5.9 6 8.75 5.3 5.9 2.5 5.25 5.3 4.6Z"
        fill="currentColor"
      />
    ) : provenance === "derived" ? (
      <path
        d="M3.25 3.25h2.25v2.25H3.25Zm3.25 3.25h2.25v2.25H6.5M5.5 4.5 7.6 6.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ) : (
      <>
        <circle cx="6" cy="6" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M6 2.75v6.5M2.75 6h6.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </>
    );
  return (
    <span className="inline-flex shrink-0" title={label}>
      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-label={label} role="img">
        {icon}
      </svg>
    </span>
  );
}

function WarningGlyph() {
  return (
    <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden>
      <path
        d="M6 1.35 10.85 10.4H1.15Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M6 4.55v2.35" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="6" cy="8.55" r="0.5" fill="currentColor" />
    </svg>
  );
}

export function PreflightWarningControl({
  warnings,
  initiallyOpen = false,
}: {
  warnings: FramePreflightWarning[];
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  if (warnings.length === 0) {
    return null;
  }
  const title =
    warnings.length === 1 ? warnings[0]!.title : `${warnings.length} media warnings`;
  const description = warnings.map((warning) => `${warning.title}. ${warning.detail}`).join(" ");
  return (
    <span className="storyboard-preflight-warning absolute right-0.5 bottom-0.5 z-10 flex h-6 items-center">
      <button
        type="button"
        aria-expanded={open}
        aria-label={title}
        title={title}
        className="flex h-6 w-8 items-center justify-end pr-1.5 text-[#d4b36a] outline-none hover:text-[#ece7df] focus-visible:ring-1 focus-visible:ring-[#d4b36a]"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <WarningGlyph />
      </button>
      <span className="sr-only">{description}</span>
      {open ? (
        <span
          role="tooltip"
          className="absolute right-1.5 bottom-full z-20 mb-1 w-56 rounded border border-[#3a342c] bg-[#12100d] px-2.5 py-2 text-left text-[11px] leading-snug font-normal tracking-normal text-[#cfc6b8] shadow-lg"
        >
          {warnings.map((warning) => (
            <span key={warning.kind} className="block whitespace-pre-wrap">
              <span className="block text-[#ece7df]">{warning.title}</span>
              {warning.detail}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

export function StoryboardFrameMedia({
  frame,
  selected,
  constructing,
  canConstruct,
  constructDisabled,
  showMediaInfo = false,
  hasWarning = false,
  onSelect,
  onConstruct,
}: {
  frame: StoryboardFrame;
  selected: boolean;
  constructing: boolean;
  canConstruct: boolean;
  constructDisabled: boolean;
  showMediaInfo?: boolean;
  hasWarning?: boolean;
  onSelect?: () => void;
  onConstruct: () => void;
}) {
  const frameBorder = selected
    ? "border-2 border-[#ece7df]"
    : "border-2 border-[#3a342c]";
  const provenance = displayProvenanceForFrame(frame);
  const labelTracking = frame.label.length <= 2 ? "tracking-[0.22em]" : "tracking-normal";

  return (
    <span className={`relative block aspect-video w-full overflow-hidden ${frameBorder}`}>
      {frame.image ? (
        <>
          <img src={frame.image} alt="" className="block h-full w-full object-cover" />
          <span className="storyboard-frame-label pointer-events-none absolute inset-x-0 top-0 flex h-6 items-center bg-[#0c0b0a]/72 px-1.5">
            <span className={`min-w-0 truncate text-[11px] text-[#ece7df] ${labelTracking}`} title={frame.label}>
              {frame.label}
            </span>
          </span>
          {showMediaInfo && frame.mediaInfo ? (
            <span
              className={`storyboard-media-info pointer-events-none absolute inset-x-0 bottom-0 flex h-6 items-center gap-1.5 bg-[#0c0b0a]/72 px-1.5 text-[9px] leading-none tracking-[0.08em] text-[#d4cdc2] ${
                hasWarning ? "pr-8" : ""
              }`}
            >
              {provenance ? <ProvenanceIcon provenance={provenance} /> : null}
              <span className="min-w-0 truncate">{formatMediaInfoLine(frame.mediaInfo)}</span>
            </span>
          ) : null}
        </>
      ) : (
        <span
          className={`storyboard-fpo storyboard-fpo-planned${canConstruct && !constructing ? " storyboard-fpo-cta" : ""}${constructing ? " storyboard-generating" : ""}`}
          aria-busy={constructing || undefined}
        >
          <button
            type="button"
            className="storyboard-fpo-copy outline-none"
            onClick={onSelect}
            aria-label={`Storyboard ${frame.label}`}
            aria-pressed={selected}
          >
            <span className="storyboard-fpo-label max-w-full truncate" title={frame.label}>
              {frame.label}
            </span>
            {frame.intent ? <span className="storyboard-fpo-intent">{frame.intent}</span> : null}
          </button>
          {constructing ? (
            <span
              className="storyboard-fpo-action"
              role="status"
              aria-label={`Generating destination ${frame.id}`}
            >
              <span className="storyboard-generating-label">Generating…</span>
            </span>
          ) : canConstruct ? (
            <span className="storyboard-fpo-action">
              <button
                type="button"
                disabled={constructDisabled}
                aria-label={`Construct destination ${frame.id}`}
                title="Construct this destination from the previous actual frame."
                onClick={onConstruct}
                className="rounded bg-[#ece7df] px-3 py-1.5 text-[11px] tracking-[0.22em] text-[#0c0b0a] disabled:cursor-not-allowed disabled:opacity-40"
              >
                CONSTRUCT
              </button>
            </span>
          ) : null}
        </span>
      )}
    </span>
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
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-[#cfc6b8]">
          {JSON.stringify(
            {
              request: evidence.request,
              rawText: evidence.rawText,
            },
            null,
            2,
          )}
        </pre>
      </div>
    </details>
  );
}

function ConversationEntryView({ entry }: { entry: ConversationEntry }) {
  if (entry.kind === "filmmaker") {
    return (
      <article>
        <p className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">Filmmaker</p>
        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-[#ece7df]">{entry.text}</p>
      </article>
    );
  }
  if (entry.kind === "director") {
    return (
      <article>
        {entry.error ? (
          <>
            <p className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">Director</p>
            <p className="mt-2 rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-sm text-[#f0c2a8]">
              {entry.error}
            </p>
          </>
        ) : entry.evidence ? (
          <DirectorEvidenceDetails evidence={entry.evidence} />
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

export function PlanView({
  brand,
  workspaceHeader,
}: {
  brand?: ReactNode;
  workspaceHeader?: ReactNode;
} = {}) {
  const {
    project,
    selection,
    select,
    composerDraft,
    setComposerDraft,
    conversation,
    directorStatus,
    planStartError,
    planWithDirector,
    startingFrameError,
    replacingStart,
    replaceStartingImage,
    constructingBeatId,
    constructDestination,
    mediaInfoOn,
  } = useProject();
  const selectedId = selection.kind === "storyboard" ? selection.frameId : project.storyboard[0]?.id;
  const planning = directorStatus === "planning";
  const canPlan = Boolean(composerDraft.trim()) && !planning;
  const mediaPreflight = mediaPreflightForProject(project);
  const frameRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [storyWidth, setStoryWidth] = useState(STORY_WIDTH_DEFAULT);
  const hasChrome = Boolean(brand || workspaceHeader);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) {
      return;
    }
    thread.scrollTop = thread.scrollHeight;
  }, [conversation]);

  const containerWidth = () => frameRef.current?.getBoundingClientRect().width ?? 1200;

  const onResizePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startWidth: storyWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [storyWidth]);

  const onResizePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    setStoryWidth(clampStoryWidth(drag.startWidth + event.clientX - drag.startX, containerWidth()));
  }, []);

  const onResizePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onResizeKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 24 : 12;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setStoryWidth((width) => clampStoryWidth(width - step, containerWidth()));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setStoryWidth((width) => clampStoryWidth(width + step, containerWidth()));
    }
  }, []);

  const bodyRow = hasChrome ? 2 : 1;

  return (
    <div
      ref={frameRef}
      className="grid h-full min-h-0 overflow-hidden"
      style={{
        gridTemplateColumns: `${storyWidth}px 0.375rem minmax(0, 1fr)`,
        gridTemplateRows: hasChrome ? "auto minmax(0, 1fr)" : "minmax(0, 1fr)",
      }}
    >
      {hasChrome ? (
        <div className="min-w-0" style={{ gridColumn: 1, gridRow: 1 }}>
          {brand}
        </div>
      ) : null}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize story panel"
        aria-valuemin={STORY_WIDTH_MIN}
        aria-valuemax={STORY_WIDTH_MAX}
        aria-valuenow={storyWidth}
        tabIndex={0}
        className="h-full cursor-col-resize touch-none bg-[#2a2620] hover:bg-[#3a342c] focus:bg-[#ece7df] focus:outline-none"
        style={{ gridColumn: 2, gridRow: hasChrome ? "1 / span 2" : 1 }}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
        onKeyDown={onResizeKeyDown}
      />
      {hasChrome ? (
        <div className="min-w-0" style={{ gridColumn: 3, gridRow: 1 }}>
          {workspaceHeader}
        </div>
      ) : null}
      <aside
        className="flex min-h-0 min-w-0 flex-col bg-[#12100d]"
        style={{ gridColumn: 1, gridRow: bodyRow }}
        aria-label="Story"
      >
        <div ref={threadRef} className="min-h-0 flex-1 overflow-auto px-4 py-4">
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
          <div className="flex flex-col gap-4">
            {conversation.map((entry) => (
              <ConversationEntryView key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
        <div className="flex-none border-t border-[#2a2620] px-4 py-3">
          <label className="sr-only" htmlFor="plan-composer">
            Movie
          </label>
          <div className="flex items-end gap-2 rounded border border-[#3a342c] bg-[#161410] px-3 py-2">
            <textarea
              id="plan-composer"
              rows={7}
              value={composerDraft}
              placeholder="Describe the movie…"
              aria-label="Movie"
              className="h-[10.5rem] min-h-[8.75rem] max-h-[12.5rem] min-w-0 flex-1 resize-y overflow-auto bg-transparent text-[15px] leading-relaxed text-[#ece7df] placeholder:text-[#9a8f7e]"
              onChange={(event) => setComposerDraft(event.target.value)}
            />
            <button
              type="button"
              disabled={!canPlan}
              aria-label="Plan movie"
              title="Plan the movie from this story and starting frame."
              onClick={() => {
                void planWithDirector();
              }}
              className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#3a342c] text-[#ece7df] disabled:cursor-not-allowed disabled:text-[#9a8f7e]"
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
          {planning ? (
            <p className="mt-2 text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">
              Director planning…
            </p>
          ) : null}
          {replacingStart ? (
            <p className="mt-2 text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">
              Uploading…
            </p>
          ) : null}
        </div>
      </aside>
      <section
        className="min-h-0 min-w-0 overflow-auto px-6 py-5"
        style={{ gridColumn: 3, gridRow: bodyRow }}
        aria-label="Storyboard"
      >
        <input
          ref={fileInputRef}
          id="replace-starting-image"
          type="file"
          accept={STARTING_FRAME_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              void replaceStartingImage(file);
            }
          }}
        />
        <ol className="grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-x-5 gap-y-7">
          {project.storyboard.map((frame) => {
            const selectedCard = frame.id === selectedId;
            const canConstruct = canConstructDestinationFrame(project, frame);
            const constructing = constructingBeatId === frame.id;
            const warnings = preflightWarningsForFrame(mediaPreflight, frame.id);
            const frameMedia = (
              <StoryboardFrameMedia
                frame={frame}
                selected={selectedCard}
                constructing={constructing}
                canConstruct={canConstruct}
                constructDisabled={Boolean(constructingBeatId) || planning}
                showMediaInfo={mediaInfoOn}
                hasWarning={warnings.length > 0}
                onSelect={() => select({ kind: "storyboard", frameId: frame.id })}
                onConstruct={() => {
                  select({ kind: "storyboard", frameId: frame.id });
                  void constructDestination(frame.id);
                }}
              />
            );
            const frameCopy = frame.intent ? (
              <span className="mt-2 block text-sm leading-snug text-[#cfc6b8]">{frame.intent}</span>
            ) : null;
            return (
              <li key={frame.id} className="min-w-0">
                {frame.image ? (
                  <div>
                    <div className="relative">
                      <button
                        type="button"
                        className={`block w-full p-0 text-left outline-none ${selectedCard ? "" : "opacity-90"}`}
                        onClick={() => select({ kind: "storyboard", frameId: frame.id })}
                        aria-label={`Storyboard ${frame.label}`}
                        aria-pressed={selectedCard}
                      >
                        {frameMedia}
                      </button>
                      <PreflightWarningControl warnings={warnings} />
                    </div>
                    {frameCopy}
                  </div>
                ) : (
                  <div className={`w-full text-left ${selectedCard ? "" : "opacity-90"}`}>
                    {frameMedia}
                  </div>
                )}
                {isAuthoritativeStartingFrame(frame) ? (
                  <button
                    type="button"
                    disabled={replacingStart}
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase disabled:cursor-not-allowed"
                  >
                    Replace image
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
        {project.storyboard.length === 1 ? (
          <p className="mt-6 text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Not yet planned</p>
        ) : null}
      </section>
    </div>
  );
}
