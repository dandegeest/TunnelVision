import { useEffect, useState } from "react";
import { useProject } from "../project/ProjectProvider";
import {
  canPlanMovie,
  MAX_STORYBOARD_DESTINATIONS,
  parseStoryDurationInput,
  projectWithNudgedStoryDuration,
  projectWithStoryDuration,
  storyDurationFieldValue,
} from "../project/storyboard";
import { hasAuthoritativeStartingFrame } from "../project/starting-frame";
import type { Project } from "../project/types";
import {
  VIDEO_MODELS,
  isVideoModelId,
  videoModelMenuLabel,
} from "../../../media/src/replicate/video-models.ts";

export function ProjectRailToggle({ compact = false }: { compact?: boolean } = {}) {
  const { projectRailOpen, setProjectRailOpen } = useProject();
  const label = projectRailOpen ? "Hide project" : "Show project";
  return (
    <button
      type="button"
      aria-pressed={projectRailOpen}
      aria-controls="project-panel"
      aria-label="Project"
      title={label}
      onClick={() => setProjectRailOpen(!projectRailOpen)}
      className={
        compact
          ? "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#9a8f7e] outline-none hover:text-[#cfc6b8] focus-visible:text-[#ece7df] focus-visible:ring-1 focus-visible:ring-[#7a7266]"
          : `flex h-7 w-7 shrink-0 items-center justify-center rounded border outline-none ${
              projectRailOpen
                ? "border-[#ece7df] text-[#ece7df]"
                : "border-[#3a342c] text-[#9a8f7e] hover:border-[#7a7266] hover:text-[#cfc6b8]"
            }`
      }
    >
      <svg viewBox="0 0 12 12" className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden>
        <rect
          x="1.6"
          y="2.1"
          width="8.8"
          height="7.8"
          rx="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <path d="M7.3 2.1v7.8" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    </button>
  );
}

function StoryDurationField({
  project,
  disabled,
  onCommit,
  onNudge,
}: {
  project: Project;
  disabled: boolean;
  onCommit: (raw: string) => void;
  onNudge: (delta: 1 | -1) => void;
}) {
  const locked = project.storyDurationLocked;
  const committed = storyDurationFieldValue(project);
  const [draft, setDraft] = useState(committed);
  const [focused, setFocused] = useState(false);
  const stepperDisabled = disabled || locked;
  const atMax =
    project.storyDuration !== "auto" && project.storyboard.length >= MAX_STORYBOARD_DESTINATIONS;
  const atAuto = committed === "AUTO";

  useEffect(() => {
    if (!focused) {
      setDraft(committed);
    }
  }, [committed, focused]);

  const commitValue = (raw: string) => {
    onCommit(raw);
    setFocused(false);
  };

  const applyNudge = (delta: 1 | -1) => {
    if (stepperDisabled) {
      return;
    }
    let next = project;
    if (focused) {
      const parsed = parseStoryDurationInput(draft);
      if (parsed.ok) {
        next = projectWithStoryDuration(next, parsed.duration);
      }
      onCommit(draft);
    }
    next = projectWithNudgedStoryDuration(next, delta);
    onNudge(delta);
    setDraft(storyDurationFieldValue(next));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">Destinations</span>
      <div className="flex min-w-0 items-stretch">
        <input
          id="project-story-duration"
          value={focused ? draft : committed}
          readOnly={locked}
          disabled={disabled}
          aria-label="Story destinations"
          aria-readonly={locked || undefined}
          title={
            locked
              ? "Destination count follows the storyboard after DIRECT."
              : "AUTO lets the Director choose how many destinations. Type a number or use the stepper."
          }
          placeholder="AUTO"
          className="min-w-0 flex-1 rounded-l border border-r-0 border-[#3a342c] bg-[#161410] px-2.5 py-1.5 text-[11px] tracking-[0.08em] text-[#ece7df] uppercase outline-none placeholder:text-[#9a8f7e] focus-visible:border-[#ece7df] disabled:cursor-not-allowed disabled:text-[#9a8f7e] read-only:cursor-default read-only:text-[#cfc6b8]"
          onFocus={() => {
            if (!locked) {
              setDraft(committed);
              setFocused(true);
            }
          }}
          onChange={(event) => {
            if (!locked) {
              setDraft(event.target.value);
            }
          }}
          onBlur={(event) => {
            if (!locked) {
              commitValue(event.currentTarget.value);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              applyNudge(1);
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              applyNudge(-1);
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              commitValue(event.currentTarget.value);
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setDraft(committed);
              setFocused(false);
              event.currentTarget.blur();
            }
          }}
        />
        <div className="flex w-7 shrink-0 flex-col overflow-hidden rounded-r border border-[#3a342c]">
          <button
            type="button"
            disabled={stepperDisabled || atMax}
            aria-label="Increase destinations"
            title="Increase destinations"
            className="flex h-1/2 items-center justify-center border-b border-[#3a342c] text-[#9a8f7e] outline-none hover:bg-[#1c1a16] hover:text-[#ece7df] focus-visible:text-[#ece7df] disabled:cursor-not-allowed disabled:text-[#5c564c]"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              applyNudge(1);
            }}
          >
            <svg viewBox="0 0 12 8" className="h-2 w-2.5" aria-hidden>
              <path d="M6 1.5 10.5 6.5H1.5Z" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            disabled={stepperDisabled || atAuto}
            aria-label="Decrease destinations"
            title="Decrease destinations"
            className="flex h-1/2 items-center justify-center text-[#9a8f7e] outline-none hover:bg-[#1c1a16] hover:text-[#ece7df] focus-visible:text-[#ece7df] disabled:cursor-not-allowed disabled:text-[#5c564c]"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              applyNudge(-1);
            }}
          >
            <svg viewBox="0 0 12 8" className="h-2 w-2.5" aria-hidden>
              <path d="M6 6.5 1.5 1.5h9Z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function DebugButton() {
  const { debugOn, setDebugOn } = useProject();
  return (
    <button
      type="button"
      aria-pressed={debugOn}
      aria-label="Debug"
      title={
        debugOn
          ? "Debug is on. Camotion work dirs are kept. Asset paths are under Technical in the Shoot inspector."
          : "Show session asset paths under Technical in the Shoot inspector and keep Camotion work dirs."
      }
      onClick={() => setDebugOn(!debugOn)}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border outline-none ${
        debugOn
          ? "border-[#ece7df] text-[#ece7df]"
          : "border-[#3a342c] text-[#9a8f7e] hover:border-[#7a7266] hover:text-[#cfc6b8]"
      }`}
    >
      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
        <circle cx="6" cy="6" r="1.7" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M6 1.15v1.45M6 9.4v1.45M1.15 6h1.45M9.4 6h1.45M2.55 2.55l1.05 1.05M8.4 8.4l1.05 1.05M2.55 9.45l1.05-1.05M8.4 3.6l1.05-1.05"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

function AgencySelect() {
  const { project, setAgency } = useProject();
  const optionClass = (selected: boolean) =>
    `h-full flex-1 rounded px-2 text-[11px] tracking-[0.16em] uppercase outline-none ${
      selected ? "bg-[#ece7df] text-[#0c0b0a]" : "text-[#9a8f7e] hover:text-[#cfc6b8]"
    }`;
  return (
    <nav aria-label="Agency" className="flex h-7 w-full items-center rounded border border-[#3a342c] p-0.5">
      <button
        type="button"
        aria-pressed={project.agency === "directed"}
        className={optionClass(project.agency === "directed")}
        onClick={() => setAgency("directed")}
      >
        Directed
      </button>
      <button
        type="button"
        aria-pressed={project.agency === "autonomous"}
        className={optionClass(project.agency === "autonomous")}
        onClick={() => setAgency("autonomous")}
      >
        Autonomous
      </button>
    </nav>
  );
}

function VideoModelSelect({ disabled }: { disabled: boolean }) {
  const { project, setVideoModel } = useProject();
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">Video</span>
      <select
        aria-label="Video model"
        title="Used for every SHOOT in this project. Pruna is the development default."
        disabled={disabled}
        className="h-8 w-full rounded border border-[#3a342c] bg-[#161410] px-2.5 text-[11px] tracking-[0.08em] text-[#ece7df] outline-none focus-visible:border-[#ece7df] disabled:cursor-not-allowed disabled:text-[#9a8f7e]"
        value={project.videoModel}
        onChange={(event) => {
          const next = event.target.value;
          if (isVideoModelId(next)) {
            setVideoModel(next);
          }
        }}
      >
        {VIDEO_MODELS.map((option) => (
          <option key={option.id} value={option.id}>
            {videoModelMenuLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function journeyStageLabel(journeyId: string): string {
  return journeyId.replaceAll("-", "→");
}

export function planActionLabel(state: {
  constructingBeatId: string | null;
  assessingJourneyIds?: readonly string[];
  shootingJourneyIds?: readonly string[];
  planning: boolean;
}): string {
  if (state.constructingBeatId) {
    return `Generating ${state.constructingBeatId}…`;
  }
  const assessing = state.assessingJourneyIds?.[0];
  if (assessing) {
    return `Planning ${journeyStageLabel(assessing)}…`;
  }
  const shooting = state.shootingJourneyIds?.[0];
  if (shooting) {
    return `Generating ${journeyStageLabel(shooting)}…`;
  }
  if (state.planning) {
    return "Planning Destinations…";
  }
  return "DIRECT";
}

export function ProjectRail() {
  const {
    composerDraft,
    setComposerDraft,
    setStoryDurationInput,
    nudgeStoryDuration,
    setAutoGenerateOpening,
    setAutoGenerateAllDestinations,
    setAutoBlockShots,
    setAutoShoot,
    directorStatus,
    planStartError,
    startingFrameError,
    replacingStart,
    constructingBeatId,
    assessingJourneyIds,
    shootingJourneyIds,
    project,
    planWithDirector,
  } = useProject();
  const planning = directorStatus === "planning";
  const busy =
    planning || Boolean(constructingBeatId) || assessingJourneyIds.length > 0 || shootingJourneyIds.length > 0;
  const canPlan = canPlanMovie(project) && !busy;
  const hasOpeningFrame = hasAuthoritativeStartingFrame(project);
  const openingLocked = hasOpeningFrame;
  const actionLabel = planActionLabel({
    constructingBeatId,
    assessingJourneyIds,
    shootingJourneyIds,
    planning,
  });
  const planTitle = canPlanMovie(project)
    ? !project.story.trim()
      ? "Write a journey story from starting frame A, then ask the Director to plan."
      : project.autoGenerateAllDestinations
        ? "Ask the Director to plan, then generate each remaining destination in order."
        : project.autoGenerateOpening && !hasOpeningFrame
          ? "Generate starting destination A from the story, then ask the Director to plan."
          : "Ask the Director to plan unresolved directing decisions."
    : project.story.trim()
      ? "Add starting frame A before directing, or enable auto generate starting destination."
      : "Enter a journey story or upload starting frame A.";

  return (
    <aside
      id="project-panel"
      className="project-rail flex h-full min-h-0 min-w-0 flex-col bg-[#12100d]"
      aria-label="Project"
    >
      <div className="project-rail-header flex h-9 shrink-0 items-center justify-start border-b border-[#2a2620] bg-[#0c0b0a] px-2">
        <ProjectRailToggle />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-3 py-3">
        {startingFrameError ? (
          <p className="rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-sm text-[#f0c2a8]">
            {startingFrameError}
          </p>
        ) : null}
        {planStartError ? (
          <p className="rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-sm text-[#f0c2a8]">
            {planStartError}
          </p>
        ) : null}
        <AgencySelect />
        <label className="sr-only" htmlFor="project-story">
          Journey story
        </label>
        <textarea
          id="project-story"
          rows={8}
          value={composerDraft}
          placeholder="Describe the journey…"
          aria-label="Journey story"
          className="min-h-[10rem] w-full resize-y overflow-auto rounded border border-[#3a342c] bg-[#161410] px-2.5 py-2 text-[11px] leading-relaxed text-[#ece7df] placeholder:text-[#9a8f7e]"
          onChange={(event) => setComposerDraft(event.target.value)}
        />
        <StoryDurationField
          project={project}
          disabled={busy}
          onCommit={setStoryDurationInput}
          onNudge={nudgeStoryDuration}
        />
        <VideoModelSelect disabled={busy} />
        <label className="flex items-start gap-2 text-[11px] leading-snug tracking-[0.08em] text-[#9a8f7e] uppercase">
          <input
            type="checkbox"
            checked={openingLocked ? false : project.autoGenerateOpening}
            disabled={busy || openingLocked}
            aria-label="Auto generate starting destination"
            title={
              openingLocked
                ? "Starting destination A is already actual."
                : "Generate unresolved A from the journey story before directing."
            }
            className="mt-0.5 accent-[#ece7df]"
            onChange={(event) => setAutoGenerateOpening(event.target.checked)}
          />
          Auto generate starting destination
        </label>
        <label className="flex items-start gap-2 text-[11px] leading-snug tracking-[0.08em] text-[#9a8f7e] uppercase">
          <input
            type="checkbox"
            checked={project.autoGenerateAllDestinations}
            disabled={busy}
            aria-label="Auto generate all destinations"
            className="mt-0.5 accent-[#ece7df]"
            onChange={(event) => setAutoGenerateAllDestinations(event.target.checked)}
          />
          Auto generate all destinations
        </label>
        <label className="flex items-start gap-2 text-[11px] leading-snug tracking-[0.08em] text-[#9a8f7e] uppercase">
          <input
            type="checkbox"
            checked={project.autoBlockShots}
            disabled={busy}
            aria-label="Auto blocking"
            className="mt-0.5 accent-[#ece7df]"
            onChange={(event) => setAutoBlockShots(event.target.checked)}
          />
          Auto blocking
        </label>
        <label className="flex items-start gap-2 text-[11px] leading-snug tracking-[0.08em] text-[#9a8f7e] uppercase">
          <input
            type="checkbox"
            checked={project.autoShoot}
            disabled={busy}
            aria-label="Auto shoot"
            className="mt-0.5 accent-[#ece7df]"
            onChange={(event) => setAutoShoot(event.target.checked)}
          />
          Auto shoot
        </label>
        <button
          type="button"
          aria-label="Direct movie"
          aria-busy={busy || undefined}
          disabled={!canPlan}
          title={planTitle}
          onClick={() => {
            void planWithDirector();
          }}
          className={`relative w-full overflow-hidden rounded border border-[#3a342c] px-3 py-2 text-[11px] tracking-[0.16em] uppercase text-[#ece7df] disabled:cursor-not-allowed disabled:text-[#9a8f7e]${
            busy ? " storyboard-generating" : ""
          }`}
        >
          <span className={`relative z-[1]${busy ? " storyboard-generating-label" : ""}`}>
            {actionLabel}
          </span>
        </button>
        {replacingStart || !busy ? (
          <p className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">
            {replacingStart
              ? "Uploading…"
              : !project.story.trim() && hasOpeningFrame
                ? "Create a journey starting at A, then ask the Director to plan the shots."
                : !project.story.trim()
                  ? "Enter a journey story or upload starting frame A."
                  : !hasOpeningFrame && project.autoGenerateOpening
                    ? project.autoGenerateAllDestinations
                      ? "DIRECT generates A, plans the journey, then generates each remaining destination in order."
                      : "DIRECT generates A from the story, then asks the Director to plan."
                    : !hasOpeningFrame
                      ? "Upload A or generate A from the story."
                      : project.autoGenerateAllDestinations
                        ? "DIRECT then generates each remaining destination in order from the previous frame."
                        : "DIRECT asks the Director to fill unspecified beats."}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center justify-end px-3 pb-3">
        <DebugButton />
      </div>
    </aside>
  );
}
