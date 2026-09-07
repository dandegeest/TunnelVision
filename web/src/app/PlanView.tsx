import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useProject } from "../project/ProjectProvider";
import type { ConversationEntry } from "../project/conversation";
import type { DirectorEvidence } from "../project/director";
import { canConstructDestinationFrame } from "../project/destination";
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

export function StoryboardFrameMedia({
  frame,
  selected,
  constructing,
  canConstruct,
  constructDisabled,
  onSelect,
  onConstruct,
}: {
  frame: StoryboardFrame;
  selected: boolean;
  constructing: boolean;
  canConstruct: boolean;
  constructDisabled: boolean;
  onSelect?: () => void;
  onConstruct: () => void;
}) {
  const frameBorder = selected
    ? "border-2 border-[#ece7df]"
    : "border-2 border-[#3a342c]";

  return (
    <span className={`block aspect-video w-full overflow-hidden ${frameBorder}`}>
      {frame.image ? (
        <img src={frame.image} alt="" className="block h-full w-full object-cover" />
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
            <span className="storyboard-fpo-label">{frame.label}</span>
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

export function PlanView() {
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
  } = useProject();
  const selectedId = selection.kind === "storyboard" ? selection.frameId : project.storyboard[0]?.id;
  const planning = directorStatus === "planning";
  const canPlan = Boolean(composerDraft.trim()) && !planning;
  const frameRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [storyWidth, setStoryWidth] = useState(STORY_WIDTH_DEFAULT);

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

  return (
    <div ref={frameRef} className="flex h-full min-h-0 overflow-hidden">
      <aside
        className="flex min-h-0 shrink-0 flex-col bg-[#12100d]"
        style={{ width: storyWidth }}
      >
        <p className="flex-none px-4 pt-5 text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">
          Story
        </p>
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
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize story panel"
        aria-valuemin={STORY_WIDTH_MIN}
        aria-valuemax={STORY_WIDTH_MAX}
        aria-valuenow={storyWidth}
        tabIndex={0}
        className="w-1.5 shrink-0 cursor-col-resize touch-none bg-[#2a2620] hover:bg-[#3a342c] focus:bg-[#ece7df] focus:outline-none"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
        onKeyDown={onResizeKeyDown}
      />
      <section className="min-h-0 min-w-0 flex-1 overflow-auto px-6 py-5">
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
        <p className="text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Storyboard</p>
        <ol className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-x-5 gap-y-7">
          {project.storyboard.map((frame) => {
            const selectedCard = frame.id === selectedId;
            const canConstruct = canConstructDestinationFrame(project, frame);
            const constructing = constructingBeatId === frame.id;
            const frameMedia = (
              <StoryboardFrameMedia
                frame={frame}
                selected={selectedCard}
                constructing={constructing}
                canConstruct={canConstruct}
                constructDisabled={Boolean(constructingBeatId) || planning}
                onSelect={() => select({ kind: "storyboard", frameId: frame.id })}
                onConstruct={() => {
                  select({ kind: "storyboard", frameId: frame.id });
                  void constructDestination(frame.id);
                }}
              />
            );
            const frameCopy = (
              <>
                <span className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="text-sm tracking-[0.22em]">{frame.label}</span>
                  {frame.imageOrigin === "user" ? (
                    <span className="text-[10px] font-medium tracking-[0.14em] text-[#d4cdc2] uppercase">
                      Uploaded
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-sm leading-snug text-[#cfc6b8]">{frame.intent}</span>
              </>
            );
            return (
              <li key={frame.id} className="min-w-0">
                {frame.image ? (
                  <button
                    type="button"
                    className={`w-full text-left outline-none ${selectedCard ? "" : "opacity-90"}`}
                    onClick={() => select({ kind: "storyboard", frameId: frame.id })}
                    aria-label={`Storyboard ${frame.label}`}
                    aria-pressed={selectedCard}
                  >
                    {frameMedia}
                    {frameCopy}
                  </button>
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
