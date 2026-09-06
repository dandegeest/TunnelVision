import { useProject } from "../project/ProjectProvider";
import { PlanView } from "./PlanView";
import { ProductionBar } from "./ProductionBar";
import { TimelineView } from "./TimelineView";

export function Shell() {
  const { project, view, setView, setAgency } = useProject();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0c0b0a] text-[#ece7df]">
      <header className="flex flex-none items-center justify-between gap-4 border-b border-[#2a2620] px-5 py-3">
        <div>
          <p className="text-[11px] tracking-[0.28em] text-[#9a8f7e] uppercase">TunnelVision</p>
          <button
            type="button"
            disabled
            aria-haspopup="listbox"
            aria-expanded={false}
            aria-label={`Current project: ${project.title}`}
            title="Project switching is not available in this slice."
            className="flex items-baseline gap-2 text-left text-[#ece7df] disabled:cursor-not-allowed disabled:opacity-100"
          >
            <span className="text-lg leading-tight">{project.title}</span>
            <svg
              className="relative top-px h-2.5 w-2.5 shrink-0 text-[#9a8f7e]"
              viewBox="0 0 12 8"
              aria-hidden
            >
              <path
                d="M1.5 1.75 6 6.25 10.5 1.75"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <nav className="flex items-center gap-1 rounded-full border border-[#3a342c] p-1 text-sm">
          <button
            type="button"
            className={`rounded-full px-4 py-1 ${view === "plan" ? "bg-[#ece7df] text-[#0c0b0a]" : "text-[#cfc6b8]"}`}
            onClick={() => setView("plan")}
          >
            Plan
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-1 ${view === "shoot" ? "bg-[#ece7df] text-[#0c0b0a]" : "text-[#cfc6b8]"}`}
            onClick={() => setView("shoot")}
          >
            Shoot
          </button>
        </nav>
        <label className="flex items-center gap-2 text-sm text-[#cfc6b8]">
          <span className="text-[11px] tracking-[0.18em] uppercase">
            {project.agency === "directed" ? "You are supervising" : "Live production monitor"}
          </span>
          <select
            className="rounded border border-[#3a342c] bg-[#161410] px-2 py-1 text-[#ece7df]"
            value={project.agency}
            onChange={(event) => setAgency(event.target.value as "directed" | "autonomous")}
          >
            <option value="directed">Directed</option>
            <option value="autonomous">Autonomous</option>
          </select>
        </label>
      </header>
      <main className="min-h-0 flex-1 overflow-hidden">
        {view === "plan" ? <PlanView /> : <TimelineView />}
      </main>
      {view === "shoot" ? <ProductionBar /> : null}
    </div>
  );
}
