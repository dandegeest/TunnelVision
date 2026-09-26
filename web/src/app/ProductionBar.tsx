import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  canShootJourney,
  journeysForTakeBatch,
  TAKE_BATCH_SCOPE_LABEL,
  TAKE_BATCH_SCOPES,
  type TakeBatchScope,
} from "../project/shoot";
import {
  canDownloadCurrentCut,
  currentCutClips,
  currentCutDurationSeconds,
  downloadCurrentCutUnavailableReason,
  formatCutClock,
} from "../project/current-cut";
import {
  defaultTakeIntentFromProject,
  GENERATION_INTENT_LABEL,
  GENERATION_INTENT_MARK,
  GENERATION_INTENTS,
  type GenerationIntent,
} from "../project/generation-intent";
import { useProject } from "../project/ProjectProvider";
import { useDismissableMenu } from "../ui/dismissable-menu";

const transportButtonClass =
  "flex h-8 w-8 items-center justify-center rounded border border-[#3a342c] text-[#ece7df] outline-none hover:border-[#7a7266] disabled:cursor-not-allowed disabled:text-[#9a8f7e]";
const batchButtonClass =
  "h-8 shrink-0 cursor-pointer rounded border border-[#3a342c] text-[11px] tracking-[0.12em] text-[#ece7df] hover:border-[#7a7266]";
const menuItemClass =
  "flex w-full items-center gap-2 px-2.5 py-1 text-left text-[11px] tracking-[0.12em] text-[#ece7df] hover:bg-[#2a2620]";

function TakeBatchScopeMenu({
  scope,
  intent,
  runDisabled,
  chooserDisabled,
  onScopeChange,
  onRun,
}: {
  scope: TakeBatchScope;
  intent: GenerationIntent;
  runDisabled: boolean;
  chooserDisabled: boolean;
  onScopeChange: (scope: TakeBatchScope) => void;
  onRun: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useDismissableMenu(open && !chooserDisabled, () => setOpen(false), rootRef);
  const stop = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };
  return (
    <div
      ref={rootRef}
      className={`relative z-30 inline-flex w-max max-w-full shrink-0 items-center self-start ${batchButtonClass}`}
      onClick={stop}
      onPointerDown={stop}
    >
      <button
        type="button"
        aria-label={TAKE_BATCH_SCOPE_LABEL[scope]}
        title={
          runDisabled
            ? "No matching segments for this take scope and quality"
            : `${TAKE_BATCH_SCOPE_LABEL[scope]} at ${GENERATION_INTENT_LABEL[intent]} quality`
        }
        disabled={runDisabled}
        className="inline-flex h-full shrink-0 items-center px-2.5 outline-none disabled:cursor-not-allowed disabled:opacity-40"
        onClick={(event) => {
          stop(event);
          if (!runDisabled) {
            onRun();
          }
        }}
      >
        {TAKE_BATCH_SCOPE_LABEL[scope]}
      </button>
      {chooserDisabled ? (
        <span className="flex h-full shrink-0 items-center border-l border-[#3a342c] px-1.5 opacity-40" aria-hidden>
          ▾
        </span>
      ) : (
        <span className="relative flex h-full shrink-0 items-center">
          <button
            type="button"
            className="flex h-full cursor-pointer items-center border-l border-[#3a342c] px-1.5 outline-none"
            aria-label="Take batch scope"
            aria-haspopup="menu"
            aria-expanded={open}
            title="Take All, Take Selected, or Take Missing for the chosen quality"
            onClick={(event) => {
              stop(event);
              setOpen((current) => !current);
            }}
          >
            ▾
          </button>
          {open ? (
            <div
              role="menu"
              className="absolute bottom-full left-0 z-40 mb-1 min-w-[9.5rem] rounded border border-[#3a342c] bg-[#161410] py-1"
            >
              {TAKE_BATCH_SCOPES.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="menuitem"
                  className={menuItemClass}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(false);
                    onScopeChange(item);
                  }}
                >
                  {TAKE_BATCH_SCOPE_LABEL[item]}
                  {item === scope ? " ·" : ""}
                </button>
              ))}
            </div>
          ) : null}
        </span>
      )}
    </div>
  );
}

function TakeBatchIntentMenu({
  intent,
  disabled,
  onIntentChange,
}: {
  intent: GenerationIntent;
  disabled: boolean;
  onIntentChange: (intent: GenerationIntent) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useDismissableMenu(open && !disabled, () => setOpen(false), rootRef);
  const stop = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };
  return (
    <div
      ref={rootRef}
      className={`relative z-30 inline-flex w-max max-w-full shrink-0 items-center self-start ${batchButtonClass}${
        disabled ? " cursor-not-allowed opacity-40" : ""
      }`}
      onClick={stop}
      onPointerDown={stop}
    >
      <button
        type="button"
        aria-label={`Take quality ${GENERATION_INTENT_LABEL[intent]}`}
        title="Quality for Take All / Selected / Missing"
        disabled={disabled}
        className="inline-flex h-full shrink-0 items-center gap-1.5 px-2.5 outline-none disabled:cursor-not-allowed"
        onClick={(event) => {
          stop(event);
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
      >
        <span aria-hidden>{GENERATION_INTENT_MARK[intent]}</span>
        {GENERATION_INTENT_LABEL[intent]}
      </button>
      {disabled ? (
        <span className="flex h-full shrink-0 items-center border-l border-[#3a342c] px-1.5" aria-hidden>
          ▾
        </span>
      ) : (
        <span className="relative flex h-full shrink-0 items-center">
          <button
            type="button"
            className="flex h-full cursor-pointer items-center border-l border-[#3a342c] px-1.5 outline-none"
            aria-label="Take quality chooser"
            aria-haspopup="menu"
            aria-expanded={open}
            title="Choose Fast, Balanced, or Quality"
            onClick={(event) => {
              stop(event);
              setOpen((current) => !current);
            }}
          >
            ▾
          </button>
          {open ? (
            <div
              role="menu"
              className="absolute bottom-full right-0 z-40 mb-1 min-w-[8.5rem] rounded border border-[#3a342c] bg-[#161410] py-1"
            >
              {GENERATION_INTENTS.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="menuitem"
                  className={menuItemClass}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(false);
                    onIntentChange(item);
                  }}
                >
                  <span aria-hidden>{GENERATION_INTENT_MARK[item]}</span>
                  {GENERATION_INTENT_LABEL[item]}
                  {item === intent ? " ·" : ""}
                </button>
              ))}
            </div>
          ) : null}
        </span>
      )}
    </div>
  );
}

export function ProductionBar() {
  const {
    project,
    selection,
    zoom,
    setZoom,
    playing,
    playheadTime,
    shootingJourneyIds,
    shootAllJourneys,
    playCurrentCut,
    pauseCurrentCut,
    seekCutStart,
    seekCutPrevious,
    seekCutNext,
    downloadCurrentCut,
    downloadingCut,
    exportMovieError,
  } = useProject();
  const clips = currentCutClips(project);
  const total = currentCutDurationSeconds(project);
  const canPlay = clips.length > 0;
  const canDownload = canDownloadCurrentCut(project) && !downloadingCut;
  const downloadReason = downloadCurrentCutUnavailableReason(project);
  const shootable = project.journeys.some((journey) => canShootJourney(project, journey));
  const shooting = shootingJourneyIds.length > 0;
  const projectIntent = defaultTakeIntentFromProject(project);
  const [batchIntent, setBatchIntent] = useState(projectIntent);
  const [batchScope, setBatchScope] = useState<TakeBatchScope>("all");
  useEffect(() => {
    setBatchIntent(projectIntent);
  }, [projectIntent]);
  const batchTargets = journeysForTakeBatch(project, batchScope, batchIntent, selection);
  const batchDisabled = !shootable || shooting || batchTargets.length === 0;

  return (
    <footer className="relative z-30 flex flex-none items-center justify-between gap-3 border-t border-[#2a2620] bg-[#0c0b0a] px-5 py-3 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className="rounded border border-[#3a342c] px-2 py-1"
          onClick={() => setZoom(zoom / 1.25)}
        >
          −
        </button>
        <span className="w-16 text-center text-[#9a8f7e]">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="rounded border border-[#3a342c] px-2 py-1"
          onClick={() => setZoom(zoom * 1.25)}
        >
          +
        </button>
        <TakeBatchScopeMenu
          scope={batchScope}
          intent={batchIntent}
          runDisabled={batchDisabled}
          chooserDisabled={shooting}
          onScopeChange={setBatchScope}
          onRun={() => {
            void shootAllJourneys(batchIntent, batchScope);
          }}
        />
        <TakeBatchIntentMenu
          intent={batchIntent}
          disabled={shooting}
          onIntentChange={setBatchIntent}
        />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        <button
          type="button"
          className={`${transportButtonClass} min-w-10 w-10`}
          disabled={!canPlay}
          aria-label="Current cut start"
          title="Start of sequence"
          onClick={seekCutStart}
        >
          |◀◀
        </button>
        <button
          type="button"
          className={transportButtonClass}
          disabled={!canPlay}
          aria-label="Current cut previous"
          title="Previous take"
          onClick={seekCutPrevious}
        >
          |◀
        </button>
        <button
          type="button"
          className={transportButtonClass}
          disabled={!canPlay}
          aria-label={playing ? "Pause current cut" : "Play current cut"}
          title={playing ? "Pause" : "Play current cut"}
          onClick={() => {
            if (playing) {
              pauseCurrentCut();
            } else {
              playCurrentCut();
            }
          }}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button
          type="button"
          className={transportButtonClass}
          disabled={!canPlay}
          aria-label="Current cut next"
          title="Next take"
          onClick={seekCutNext}
        >
          ▶|
        </button>
        <span className="min-w-[5.5rem] text-center text-[11px] tracking-[0.12em] text-[#9a8f7e]">
          {formatCutClock(playheadTime)} / {formatCutClock(total)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`rounded border border-[#3a342c] px-3 py-1 ${canDownload ? "text-[#ece7df]" : "opacity-50"}`}
          disabled={!canDownload}
          title={downloadReason || exportMovieError || "Assemble and download the selected Takes."}
          aria-label="Download"
          onClick={() => {
            void downloadCurrentCut();
          }}
        >
          {downloadingCut ? "ASSEMBLING…" : "DOWNLOAD"}
        </button>
      </div>
      <p className="sr-only">
        Agency {project.agency}. Construction {project.construction}.
      </p>
    </footer>
  );
}
