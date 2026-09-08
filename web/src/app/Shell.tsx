import type { ReactNode } from "react";
import { useProject } from "../project/ProjectProvider";
import { FilmmakingFrame } from "./FilmmakingFrame";
import { PlanView } from "./PlanView";
import { ProductionBar } from "./ProductionBar";
import { TimelineView } from "./TimelineView";

function MediaInfoToolIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
      <circle cx="6" cy="6" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 5.35v3.1" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="6" cy="3.85" r="0.55" fill="currentColor" />
    </svg>
  );
}

function Brand() {
  const { project } = useProject();
  return (
    <div className="min-w-0">
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
        <span className="truncate text-lg leading-tight">{project.title}</span>
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
  );
}

function ViewSwitch() {
  const { view, setView } = useProject();
  return (
    <nav className="flex shrink-0 items-center gap-1 rounded-full border border-[#3a342c] p-1 text-sm">
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
  );
}

function MediaInfoButton() {
  const { mediaInfoOn, setMediaInfoOn } = useProject();
  return (
    <button
      type="button"
      aria-pressed={mediaInfoOn}
      aria-label="Media info"
      title="Media info"
      onClick={() => setMediaInfoOn(!mediaInfoOn)}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border outline-none ${
        mediaInfoOn
          ? "border-[#ece7df] text-[#ece7df]"
          : "border-[#3a342c] text-[#9a8f7e] hover:border-[#7a7266] hover:text-[#cfc6b8]"
      }`}
    >
      <MediaInfoToolIcon />
    </button>
  );
}

function AgencySelect() {
  const { project, setAgency } = useProject();
  return (
    <select
      aria-label="Agency"
      className="h-7 shrink-0 rounded border border-[#3a342c] bg-[#161410] px-2 text-sm text-[#ece7df]"
      value={project.agency}
      onChange={(event) => setAgency(event.target.value as "directed" | "autonomous")}
    >
      <option value="directed">Directed</option>
      <option value="autonomous">Autonomous</option>
    </select>
  );
}

export function WorkspaceToolbar({ leading }: { leading?: ReactNode } = {}) {
  return (
    <div className="workspace-toolbar grid min-w-0 w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
      <div className="min-w-0">{leading}</div>
      <ViewSwitch />
      <div className="flex min-w-0 items-center justify-end gap-2">
        <MediaInfoButton />
        <AgencySelect />
      </div>
    </div>
  );
}

function HeaderFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-w-0 items-center border-b border-[#2a2620] bg-[#0c0b0a] px-5 py-3">
      {children}
    </div>
  );
}

export function Shell() {
  const { view, conversationRailOpen } = useProject();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0c0b0a] text-[#ece7df]">
      <FilmmakingFrame
        brand={
          conversationRailOpen ? (
            <HeaderFrame>
              <Brand />
            </HeaderFrame>
          ) : undefined
        }
        workspaceHeader={
          <HeaderFrame>
            <WorkspaceToolbar leading={conversationRailOpen ? undefined : <Brand />} />
          </HeaderFrame>
        }
      >
        {view === "plan" ? (
          <PlanView />
        ) : (
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-hidden">
              <TimelineView />
            </div>
            <ProductionBar />
          </div>
        )}
      </FilmmakingFrame>
    </div>
  );
}
