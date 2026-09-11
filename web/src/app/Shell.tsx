import type { ReactNode } from "react";
import { useProject } from "../project/ProjectProvider";
import { hasAuthoritativeStartingFrame } from "../project/starting-frame";
import { FilmmakingFrame } from "./FilmmakingFrame";
import { PlanView } from "./PlanView";
import { ProductionBar } from "./ProductionBar";
import { TimelineView } from "./TimelineView";

function Wordmark() {
  return (
    <p className="min-w-0 truncate text-sm font-semibold tracking-[0.2em] text-[#cfc6b8] uppercase">
      TunnelVision
    </p>
  );
}

function ViewSwitch() {
  const { view, setView, project } = useProject();
  const canOpenShoot = hasAuthoritativeStartingFrame(project);
  return (
    <nav className="relative z-10 flex shrink-0 items-center gap-1 rounded-full border border-[#3a342c] p-1 text-sm">
      <button
        type="button"
        className={`rounded-full px-4 py-1 ${view === "plan" ? "bg-[#ece7df] text-[#0c0b0a]" : "text-[#cfc6b8]"}`}
        onClick={() => setView("plan")}
      >
        Plan
      </button>
      <button
        type="button"
        className={`rounded-full px-4 py-1 ${view === "shoot" ? "bg-[#ece7df] text-[#0c0b0a]" : "text-[#cfc6b8]"} disabled:cursor-not-allowed disabled:opacity-50`}
        disabled={!canOpenShoot}
        title={canOpenShoot ? "Shoot the current production legs." : "Add starting frame A before shooting."}
        onClick={() => setView("shoot")}
      >
        Shoot
      </button>
    </nav>
  );
}

export function WorkspaceToolbar() {
  return (
    <div className="workspace-toolbar grid min-w-0 w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
      <div className="min-w-0">
        <Wordmark />
      </div>
      <ViewSwitch />
      <div className="min-w-0" />
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
  const { view } = useProject();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0c0b0a] text-[#ece7df]">
      <FilmmakingFrame
        workspaceHeader={
          <HeaderFrame>
            <WorkspaceToolbar />
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
