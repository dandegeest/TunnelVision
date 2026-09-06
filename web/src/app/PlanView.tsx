import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useProject } from "../project/ProjectProvider";
import { isAuthoritativeStartingFrame, STARTING_FRAME_ACCEPT } from "../project/starting-frame";

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

export function PlanView() {
  const {
    project,
    selection,
    select,
    setStory,
    directorStatus,
    directorError,
    directorEvidence,
    planWithDirector,
    startingFrameError,
    replacingStart,
    replaceStartingImage,
  } = useProject();
  const selectedId = selection.kind === "storyboard" ? selection.frameId : project.storyboard[0]?.id;
  const planning = directorStatus === "planning";
  const canPlan = Boolean(project.story.trim()) && !planning;
  const frameRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [storyWidth, setStoryWidth] = useState(STORY_WIDTH_DEFAULT);

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
        <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
          {startingFrameError ? (
            <p className="mb-3 rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-sm text-[#f0c2a8]">
              {startingFrameError}
            </p>
          ) : null}
          {directorError ? (
            <p className="rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-sm text-[#f0c2a8]">
              {directorError}
            </p>
          ) : null}
          {directorEvidence ? (
            <details className="border-t border-[#2a2620] pt-3 text-xs text-[#9a8f7e]">
              <summary className="cursor-pointer tracking-[0.16em] uppercase">Director</summary>
              <div className="mt-2 space-y-2 leading-relaxed">
                {directorEvidence.model ? <p>Model: {directorEvidence.model}</p> : null}
                {directorEvidence.predictionId ? (
                  <p>Prediction: {directorEvidence.predictionId}</p>
                ) : null}
                <p>Elapsed: {directorEvidence.elapsedMs}ms</p>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-[#cfc6b8]">
                  {JSON.stringify(
                    {
                      request: directorEvidence.request,
                      rawText: directorEvidence.rawText,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            </details>
          ) : null}
        </div>
        <div className="flex-none border-t border-[#2a2620] px-4 py-3">
          <label className="sr-only" htmlFor="plan-composer">
            Movie
          </label>
          <div className="flex items-end gap-2 rounded border border-[#3a342c] bg-[#161410] px-3 py-2">
            <textarea
              id="plan-composer"
              rows={7}
              value={project.story}
              placeholder="Describe the movie…"
              aria-label="Movie"
              className="h-[10.5rem] min-h-[8.75rem] max-h-[12.5rem] min-w-0 flex-1 resize-y overflow-auto bg-transparent text-[15px] leading-relaxed text-[#ece7df] placeholder:text-[#9a8f7e]"
              onChange={(event) => setStory(event.target.value)}
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
            const frameBorder = selectedCard
              ? "border-2 border-[#ece7df]"
              : "border-2 border-[#3a342c]";
            return (
              <li key={frame.id} className="min-w-0">
                <button
                  type="button"
                  className={`w-full text-left outline-none ${selectedCard ? "" : "opacity-90"}`}
                  onClick={() => select({ kind: "storyboard", frameId: frame.id })}
                  aria-label={`Storyboard ${frame.label}`}
                  aria-pressed={selectedCard}
                >
                  <span className={`block aspect-video w-full overflow-hidden ${frameBorder}`}>
                    {frame.image ? (
                      <img src={frame.image} alt="" className="block h-full w-full object-cover" />
                    ) : (
                      <span className="storyboard-fpo" aria-hidden />
                    )}
                  </span>
                  <span className="mt-2 flex items-baseline justify-between gap-2">
                    <span className="text-sm tracking-[0.22em]">{frame.label}</span>
                    {frame.imageOrigin === "user" ? (
                      <span className="text-[10px] font-medium tracking-[0.14em] text-[#d4cdc2] uppercase">
                        Uploaded
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-sm leading-snug text-[#cfc6b8]">{frame.intent}</span>
                </button>
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
