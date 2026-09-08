import { shootActionReason } from "../project/policy";
import { canShootJourney } from "../project/shoot";
import { useProject } from "../project/ProjectProvider";

export function ProductionBar() {
  const { project, selectedJourney, zoom, setZoom, shootJourney, shootingJourneyId } = useProject();
  const shooting = selectedJourney
    ? shootingJourneyId === selectedJourney.id || selectedJourney.status === "shooting"
    : false;
  const canShoot = selectedJourney ? canShootJourney(project, selectedJourney) : false;
  const shootReason = shootActionReason(selectedJourney);
  const movieReason = "Shoot Movie is not connected in this slice.";

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
      <p className="min-w-0 flex-1 truncate text-center text-[#9a8f7e]">
        {shootReason || movieReason}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded border border-[#3a342c] px-3 py-1 ${canShoot && !shooting ? "" : "opacity-50"}`}
          disabled={!canShoot || shooting}
          title={shootReason || "Shoot this journey"}
          onClick={() => {
            if (selectedJourney && canShoot) {
              void shootJourney(selectedJourney.id);
            }
          }}
        >
          {shooting ? "Shooting…" : "Shoot This Shot"}
        </button>
        <button
          type="button"
          className="rounded border border-[#3a342c] px-3 py-1 opacity-50"
          disabled
          title={movieReason}
        >
          Shoot Movie
        </button>
      </div>
      <p className="sr-only">
        Agency {project.agency}. Construction {project.construction}.
      </p>
    </footer>
  );
}
