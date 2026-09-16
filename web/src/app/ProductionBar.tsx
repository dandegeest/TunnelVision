import { useEffect, useState } from "react";
import { canShootJourney } from "../project/shoot";
import {
  canDownloadCurrentCut,
  currentCutClips,
  currentCutDurationSeconds,
  downloadCurrentCutUnavailableReason,
  formatCutClock,
} from "../project/current-cut";
import { defaultTakeIntentFromProject } from "../project/generation-intent";
import { useProject } from "../project/ProjectProvider";
import { GenerationIntentMenu } from "../ui/GenerationIntentMenu";
import { newTakeAllActionLabel } from "../timeline/JourneyItem";

const transportButtonClass =
  "flex h-8 w-8 items-center justify-center rounded border border-[#3a342c] text-[#ece7df] outline-none hover:border-[#7a7266] disabled:cursor-not-allowed disabled:text-[#9a8f7e]";
const intentButtonClass =
  "h-8 shrink-0 cursor-pointer rounded border border-[#3a342c] text-[10px] tracking-[0.12em] text-[#ece7df] hover:border-[#7a7266]";

export function ProductionBar() {
  const {
    project,
    zoom,
    setZoom,
    playing,
    playheadTime,
    shootingJourneyIds,
    shootAllJourneys,
    playCurrentCut,
    pauseCurrentCut,
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
  const [allIntent, setAllIntent] = useState(projectIntent);
  useEffect(() => {
    setAllIntent(projectIntent);
  }, [projectIntent]);

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
        <GenerationIntentMenu
          label={newTakeAllActionLabel()}
          ariaLabel="New take all"
          defaultIntent={allIntent}
          disabled={!shootable || shooting}
          buttonClass={intentButtonClass}
          menuPlacement="up"
          onPickIntent={setAllIntent}
          onChoose={(intent) => {
            void shootAllJourneys(intent);
          }}
        />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
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
          title={downloadReason || exportMovieError || "Download the current cut."}
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
