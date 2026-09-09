import { shootActionReason } from "../project/policy";
import {
  canExportMovie,
  describeMovieExport,
  exportMovieUnavailableReason,
} from "../project/export-movie";
import { useProject } from "../project/ProjectProvider";

export function ProductionBar() {
  const {
    project,
    selectedJourney,
    zoom,
    setZoom,
    movieExport,
    exportingMovie,
    exportMovieError,
    exportMovie,
  } = useProject();
  const shootReason = shootActionReason(selectedJourney);
  const canExport = canExportMovie(project) && !exportingMovie;
  const exportReason = exportMovieUnavailableReason(project);
  const status =
    exportingMovie
      ? "Exporting movie…"
      : exportMovieError
        ? exportMovieError
        : movieExport
          ? describeMovieExport(movieExport)
          : shootReason || exportReason;

  return (
    <footer className="relative z-10 flex flex-none items-center justify-between gap-3 overflow-hidden border-t border-[#2a2620] bg-[#0c0b0a] px-5 py-3 text-sm">
      <div className="flex items-center gap-2">
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
      </div>
      <p className="min-w-0 flex-1 truncate text-center text-[#9a8f7e]">{status}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`rounded border border-[#3a342c] px-3 py-1 ${canExport ? "" : "opacity-50"}`}
          disabled={!canExport}
          title={exportReason || "Concatenate rendered journey clips in storyboard order."}
          aria-label="Export movie"
          onClick={() => {
            void exportMovie();
          }}
        >
          {exportingMovie ? "Exporting…" : "Export Movie"}
        </button>
        {movieExport ? (
          <a
            href={movieExport.videoUrl}
            download={movieExport.filename}
            className="rounded border border-[#3a342c] px-3 py-1 text-[#ece7df]"
          >
            Download
          </a>
        ) : null}
      </div>
      <p className="sr-only">
        Agency {project.agency}. Construction {project.construction}.
      </p>
    </footer>
  );
}
