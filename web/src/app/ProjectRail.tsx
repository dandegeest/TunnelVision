import { useEffect, useState } from "react";
import { useProject } from "../project/ProjectProvider";
import { ClickToEditTextarea } from "../ui/ClickToEditTextarea";
import {
  canPlanMovie,
  MAX_STORYBOARD_DESTINATIONS,
  parseStoryDurationInput,
  projectWithNudgedStoryDuration,
  projectWithStoryDuration,
  storyDurationFieldValue,
} from "../project/storyboard";
import { hasAuthoritativeStartingFrame } from "../project/starting-frame";
import { formatJourneyAgentButtonLabel, journeyAgentIsBusy } from "../project/journey-agent";
import type { Project } from "../project/types";
import {
  IMAGE_MODELS,
  imageModelHasFormatChoice,
  imageModelHasResolutionChoice,
  imageModelMenuLabel,
  imageModelOutputFormats,
  imageModelResolutions,
  isImageModelId,
  isImageOutputFormat,
  isImageResolution,
} from "../../../media/src/replicate/image-models.ts";
import {
  KLING_V3_MODE_LABEL,
  KLING_V3_MODES,
  VIDEO_MODELS,
  isKlingV3Mode,
  isVideoModelId,
} from "../../../media/src/replicate/video-models.ts";
import {
  defaultTakeIntentFromProject,
  GENERATION_INTENT_LABEL,
  GENERATION_INTENT_MARK,
  GENERATION_INTENTS,
  projectShowsVideoModeChoice,
  videoModelsByIntentFromProject,
} from "../project/generation-intent";
import { klingV3ModeFromProject } from "../project/shoot";
import { PanelHeader } from "./PanelHeader";
import { OptionMenu } from "../ui/OptionMenu";

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

function SettingsButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-label="Project settings"
      title="Project settings"
      onClick={onOpen}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#3a342c] text-[#9a8f7e] outline-none hover:border-[#7a7266] hover:text-[#cfc6b8]"
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

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      aria-label="Back to project"
      title="Back to project"
      onClick={onBack}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#3a342c] text-[#9a8f7e] outline-none hover:border-[#7a7266] hover:text-[#cfc6b8]"
    >
      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
        <path
          d="M7.5 2.5 3.5 6l4 3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function ProjectChooser() {
  const { project } = useProject();
  return (
    <button
      type="button"
      disabled
      aria-haspopup="listbox"
      aria-expanded={false}
      aria-label={`Current project: ${project.title}`}
      title="Project switching is not available in this slice."
      className="flex min-w-0 w-full items-baseline gap-2 text-left text-[#ece7df] disabled:cursor-not-allowed disabled:opacity-100"
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
  );
}

function AgencySelect({ disabled = false }: { disabled?: boolean }) {
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
        disabled={disabled}
        className={optionClass(project.agency === "directed")}
        onClick={() => setAgency("directed")}
      >
        Directed
      </button>
      <button
        type="button"
        aria-pressed={project.agency === "autonomous"}
        disabled={disabled}
        className={optionClass(project.agency === "autonomous")}
        onClick={() => setAgency("autonomous")}
      >
        Agent
      </button>
    </nav>
  );
}

function DebugModeToggle() {
  const { debugOn, setDebugOn } = useProject();
  return (
    <label className="flex items-start gap-2 text-[11px] leading-snug tracking-[0.08em] text-[#9a8f7e] uppercase">
      <input
        type="checkbox"
        checked={debugOn}
        aria-label="Debug mode"
        title={
          debugOn
            ? "Debug is on. Camotion work dirs are kept."
            : "Keep Camotion work dirs after A′/B′ are copied into the session store."
        }
        className="mt-0.5 accent-[#ece7df]"
        onChange={(event) => setDebugOn(event.target.checked)}
      />
      Debug mode
    </label>
  );
}

function ProjectSettingsView({ busy }: { busy: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-3 py-3">
      <ImageModelSelect disabled={busy} />
      <VideoModelSelect disabled={busy} />
      <DebugModeToggle />
    </div>
  );
}

function ImageModelSelect({ disabled }: { disabled: boolean }) {
  const { project, setImageModel, setImageOutputFormat, setImageResolution } = useProject();
  const fieldClass =
    "h-8 w-full rounded border border-[#3a342c] bg-[#161410] px-2.5 text-[11px] tracking-[0.08em] text-[#ece7df] outline-none focus-visible:border-[#ece7df]";
  const showFormat = imageModelHasFormatChoice(project.imageModel);
  const showResolution = imageModelHasResolutionChoice(project.imageModel);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">Image</span>
        <OptionMenu
          ariaLabel="Image model"
          title="Used for opening A and every later still in this project. Nano Banana 2 Lite is the development default."
          disabled={disabled}
          triggerClassName={fieldClass}
          value={project.imageModel}
          options={IMAGE_MODELS.map((option) => ({
            value: option.id,
            label: imageModelMenuLabel(option),
          }))}
          onChange={(next) => {
            if (isImageModelId(next)) {
              setImageModel(next);
            }
          }}
        />
      </div>
      {showFormat ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">Format</span>
          <OptionMenu
            ariaLabel="Image format"
            title="Output file format for generated stills. PNG is the development default."
            disabled={disabled}
            triggerClassName={fieldClass}
            value={project.imageOutputFormat}
            options={imageModelOutputFormats(project.imageModel).map((format) => ({
              value: format,
              label: format.toUpperCase(),
            }))}
            onChange={(next) => {
              if (isImageOutputFormat(next)) {
                setImageOutputFormat(next);
              }
            }}
          />
        </div>
      ) : null}
      {showResolution ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">Resolution</span>
          <OptionMenu
            ariaLabel="Image resolution"
            title="Output resolution for generated stills. 1K is the development default."
            disabled={disabled}
            triggerClassName={fieldClass}
            value={project.imageResolution}
            options={imageModelResolutions(project.imageModel).map((resolution) => ({
              value: resolution,
              label: resolution,
            }))}
            onChange={(next) => {
              if (isImageResolution(next)) {
                setImageResolution(next);
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function VideoModelSelect({ disabled }: { disabled: boolean }) {
  const { project, setDefaultTakeIntent, setKlingV3Mode, setVideoModelForIntent } = useProject();
  const mappings = videoModelsByIntentFromProject(project);
  const defaultTakeIntent = defaultTakeIntentFromProject(project);
  const fieldClass =
    "h-8 w-full rounded border border-[#3a342c] bg-[#161410] px-2.5 text-[11px] tracking-[0.08em] text-[#ece7df] outline-none focus-visible:border-[#ece7df]";
  const intentOptionClass = (selected: boolean) =>
    `flex h-full min-w-0 flex-col items-center justify-center gap-0 rounded px-0.5 text-[9px] leading-tight tracking-[0.08em] uppercase outline-none ${
      selected ? "bg-[#ece7df] text-[#0c0b0a]" : "text-[#9a8f7e] hover:text-[#cfc6b8]"
    }`;
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">Generation</span>
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">Default Take Intent</span>
        <nav
          aria-label="Default take intent"
          title="CREATE JOURNEY and Agent NEW TAKE use this intent's mapped model. Filmmaker NEW TAKE can still pick Fast, Balanced, or Quality per Take."
          className="grid h-11 w-full grid-cols-3 items-stretch rounded border border-[#3a342c] p-0.5"
        >
          {GENERATION_INTENTS.map((intent) => (
            <button
              key={intent}
              type="button"
              aria-label={`Default take intent ${GENERATION_INTENT_LABEL[intent]}`}
              aria-pressed={defaultTakeIntent === intent}
              disabled={disabled}
              className={intentOptionClass(defaultTakeIntent === intent)}
              onClick={() => setDefaultTakeIntent(intent)}
            >
              <span aria-hidden="true" className="text-[10px] leading-none">
                {GENERATION_INTENT_MARK[intent]}
              </span>
              {GENERATION_INTENT_LABEL[intent]}
            </button>
          ))}
        </nav>
      </div>
      {GENERATION_INTENTS.map((intent) => (
        <div key={intent} className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">
            {GENERATION_INTENT_MARK[intent]} {GENERATION_INTENT_LABEL[intent]}
          </span>
          <OptionMenu
            ariaLabel={`${GENERATION_INTENT_LABEL[intent]} video model`}
            title={`${GENERATION_INTENT_LABEL[intent]} generation intent. Maps onto a catalog model until a router fulfills the intent.`}
            disabled={disabled}
            triggerClassName={fieldClass}
            value={mappings[intent]}
            options={VIDEO_MODELS.map((option) => ({
              value: option.id,
              label: option.label,
            }))}
            onChange={(next) => {
              if (isVideoModelId(next)) {
                setVideoModelForIntent(intent, next);
              }
            }}
          />
        </div>
      ))}
      {projectShowsVideoModeChoice(project) ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">Resolution</span>
          <OptionMenu
            ariaLabel="Kling 3 resolution"
            title="Kling 3 output. Standard is 720p, Pro is 1080p, 4K is 4K. Product shots stay 6s."
            disabled={disabled}
            triggerClassName={fieldClass}
            value={klingV3ModeFromProject(project)}
            options={KLING_V3_MODES.map((mode) => ({
              value: mode,
              label: KLING_V3_MODE_LABEL[mode],
            }))}
            onChange={(next) => {
              if (isKlingV3Mode(next)) {
                setKlingV3Mode(next);
              }
            }}
          />
        </div>
      ) : null}
    </div>
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
  agentLabel?: string | null;
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
  if (state.agentLabel) {
    return state.agentLabel;
  }
  return "CREATE JOURNEY";
}

export function ProjectRail({ initialSettingsOpen = false }: { initialSettingsOpen?: boolean } = {}) {
  const {
    composerDraft,
    setComposerDraft,
    setStoryDurationInput,
    nudgeStoryDuration,
    setAutoGenerateAllDestinations,
    setAutoShoot,
    directorStatus,
    planStartError,
    journeyAgent,
    startingFrameError,
    constructingBeatId,
    assessingJourneyIds,
    shootingJourneyIds,
    project,
    planWithDirector,
  } = useProject();
  const [settingsOpen, setSettingsOpen] = useState(initialSettingsOpen);
  const planning = directorStatus === "planning";
  const agentBusy = journeyAgentIsBusy(journeyAgent);
  const busy =
    planning ||
    agentBusy ||
    Boolean(constructingBeatId) ||
    assessingJourneyIds.length > 0 ||
    shootingJourneyIds.length > 0;
  const canPlan = canPlanMovie(project) && !busy;
  const hasOpeningFrame = hasAuthoritativeStartingFrame(project);
  const directed = project.agency === "directed";
  const actionLabel = planActionLabel({
    constructingBeatId,
    assessingJourneyIds,
    shootingJourneyIds,
    planning,
    agentLabel: formatJourneyAgentButtonLabel(journeyAgent),
  });
  const planTitle = canPlanMovie(project)
    ? project.agency === "autonomous"
      ? "Run JourneyAgent: resolve the journey, construct unresolved destinations, shoot missing takes, and assemble the movie."
      : !project.story.trim()
        ? "Write a journey story from starting frame A, then ask the Director to plan."
        : project.autoGenerateAllDestinations
          ? "Ask the Director to plan, then generate each remaining destination in order."
          : !hasOpeningFrame
            ? "Generate starting destination A from the story, then ask the Director to plan."
            : "Ask the Director to plan unresolved directing decisions."
    : "Enter a journey story or upload starting frame A.";
  const agentFailure =
    journeyAgent.phase === "FAILED" && journeyAgent.failureReason && journeyAgent.failureReason !== planStartError
      ? journeyAgent.failureReason
      : null;

  return (
    <aside
      id="project-panel"
      className="project-rail flex h-full min-h-0 min-w-0 flex-col bg-[#12100d]"
      aria-label={settingsOpen ? "Project settings" : "Project"}
    >
      <PanelHeader
        className="project-rail-header"
        title={settingsOpen ? "Project settings" : "Project"}
      >
        <ProjectRailToggle />
      </PanelHeader>
      {settingsOpen ? (
        <>
          <ProjectSettingsView busy={busy} />
          <div className="flex shrink-0 items-center justify-end px-3 pb-3">
            <BackButton onBack={() => setSettingsOpen(false)} />
          </div>
        </>
      ) : (
        <>
          <div className="flex shrink-0 px-3 pt-3">
            <ProjectChooser />
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
            ) : agentFailure ? (
              <p className="rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-sm text-[#f0c2a8]">
                {agentFailure}
              </p>
            ) : null}
            <AgencySelect disabled={busy} />
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">Journey prompt</span>
              <ClickToEditTextarea
                id="project-story"
                rows={8}
                value={composerDraft}
                placeholder="Describe the journey…"
                aria-label="Journey story"
                className="min-h-[10rem] w-full overflow-auto text-[11px] leading-relaxed text-[#ece7df] placeholder:text-[#9a8f7e]"
                onChange={setComposerDraft}
              />
            </label>
            <StoryDurationField
              project={project}
              disabled={busy}
              onCommit={setStoryDurationInput}
              onNudge={nudgeStoryDuration}
            />
            {directed ? (
              <div className="flex flex-col gap-3">
                <span className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">Options</span>
                <label className="flex items-start gap-2 text-[11px] leading-snug tracking-[0.08em] text-[#9a8f7e] uppercase">
                  <input
                    type="checkbox"
                    checked={project.autoGenerateAllDestinations}
                    disabled={busy}
                    aria-label="Generate all destinations"
                    title={
                      project.storyDurationLocked
                        ? "Generate remaining unfilled destinations from the existing plan. Does not ask the Director again."
                        : "After CREATE JOURNEY plans the journey, generate each remaining destination in order."
                    }
                    className="mt-0.5 accent-[#ece7df]"
                    onChange={(event) => setAutoGenerateAllDestinations(event.target.checked)}
                  />
                  Generate all destinations
                </label>
                <label className="flex items-start gap-2 text-[11px] leading-snug tracking-[0.08em] text-[#9a8f7e] uppercase">
                  <input
                    type="checkbox"
                    checked={project.autoShoot}
                    disabled={busy}
                    aria-label="Shoot"
                    className="mt-0.5 accent-[#ece7df]"
                    onChange={(event) => setAutoShoot(event.target.checked)}
                  />
                  Shoot
                </label>
              </div>
            ) : null}
            <button
              type="button"
              aria-label="Create journey"
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
          </div>
          <div className="flex shrink-0 items-center justify-end px-3 pb-3">
            <SettingsButton onOpen={() => setSettingsOpen(true)} />
          </div>
        </>
      )}
    </aside>
  );
}
