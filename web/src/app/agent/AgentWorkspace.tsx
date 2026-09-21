import { useEffect, useRef, useState, type ReactNode } from "react";
import { cinematographerScoreTone, projectScoreFromProject } from "../../project/cinematographer";
import { currentCutDurationSeconds, formatCutClock } from "../../project/current-cut";
import { journeyAgentIsBusy } from "../../project/journey-agent";
import { useProject } from "../../project/ProjectProvider";
import { canPlanMovie } from "../../project/storyboard";
import { ProgressSpinner } from "../../ui/ProgressSpinner";
import { journeyProgressFromProject } from "../conversation-console";
import { ProjectScoreReadout } from "../JourneyProgressRail";
import { StoryboardReelHost } from "../PlanView";
import { AgentCollapsedStrip, AgentJourneyPath } from "./AgentJourneyPath";
import {
  agentGeneratingLabel,
  beatText,
  restoreAgentJourneyTurns,
  locationCaption,
  repairScanLine,
  turnPrompt,
} from "./journey-turns";

function TurnRule() {
  return <hr className="border-0 border-t border-[#ece7df]/10" />;
}

function DisclosureChevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
      aria-hidden
    >
      <path
        d="M4 2.2 8.6 6 4 9.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HistoryTurn({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? `Collapse ${title}` : `Open ${title}`}
        className="flex items-center gap-1.5 text-left text-[13px] tracking-[0.04em] text-[#9a8f7e] outline-none hover:text-[#ece7df] focus-visible:text-[#ece7df]"
        onClick={onToggle}
      >
        {title}
        <DisclosureChevron open={expanded} />
      </button>
      {expanded ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

function JourneyPrompt({ text }: { text: string }) {
  if (!text.trim()) {
    return null;
  }
  return <p className="max-w-3xl whitespace-pre-wrap text-[15px] leading-relaxed text-[#cfc6b8]">{text}</p>;
}

export function AgentWorkspace() {
  const {
    conversation,
    movieExport,
    project,
    selection,
    select,
    setStoryboardReelId,
    composerDraft,
    agentComposerDraft,
    setAgentComposerDraft,
    planAgentJourney,
    stopJourneyAgent,
    constructingBeatId,
    assessingJourneyIds,
    shootingJourneyIds,
    journeyAgent,
    directorStatus,
  } = useProject();
  const [openIds, setOpenIds] = useState(() => new Set<string>());
  const threadRef = useRef<HTMLDivElement>(null);
  const progress = journeyProgressFromProject(project, {
    constructingBeatId,
    assessingJourneyIds,
    shootingJourneyIds,
    journeyAgent,
  });
  const score = projectScoreFromProject(project);
  const agentBusy = journeyAgentIsBusy(journeyAgent);
  const busy =
    directorStatus === "planning" ||
    agentBusy ||
    Boolean(constructingBeatId) ||
    assessingJourneyIds.length > 0 ||
    shootingJourneyIds.length > 0;
  const journeyStory = agentComposerDraft.trim() || project.story.trim() || composerDraft.trim();
  const canSubmit = canPlanMovie({ ...project, story: journeyStory }) && !busy;
  const generating = agentGeneratingLabel(constructingBeatId, journeyAgent, {
    assessingJourneyIds,
    shootingJourneyIds,
    directorPlanning: directorStatus === "planning",
  });
  const turns = restoreAgentJourneyTurns(conversation, project, movieExport, {
    idle: !busy && !generating,
  });
  const repairingId =
    journeyAgent?.phase === "REPAIRING_CANONICALS" ? journeyAgent.activity?.destinationId : undefined;
  const captions = Object.fromEntries(project.storyboard.map((frame) => [frame.id, locationCaption(project, frame.id)]));
  const beats = Object.fromEntries(project.storyboard.map((frame) => [frame.id, beatText(project, frame.id)]));
  const selectedId = selection.kind === "storyboard" ? selection.frameId : undefined;
  const lastTurn = turns[turns.length - 1];
  const liveTurn = lastTurn && !lastTurn.complete ? lastTurn : null;
  const duration = currentCutDurationSeconds(project);
  const locationCount = project.storyboard.length;
  const traversalCount = Math.max(0, locationCount - 1);

  useEffect(() => {
    if (!busy && !generating) {
      return;
    }
    const thread = threadRef.current;
    if (thread) {
      thread.scrollTop = thread.scrollHeight;
    }
  }, [busy, conversation, generating]);

  const toggle = (id: string) => {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const onSelect = (id: string) => {
    select({ kind: "storyboard", frameId: id });
  };
  const onOpenReel = (id: string) => {
    select({ kind: "storyboard", frameId: id });
    setStoryboardReelId(id);
  };

  const submit = () => {
    if (!canSubmit) {
      return;
    }
    const story = journeyStory;
    setAgentComposerDraft("");
    void planAgentJourney(story);
  };

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-hidden bg-[#0c0b0a]" aria-label="Agent">
      <div ref={threadRef} className="agent-scroll min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-8 pb-48 pt-10">
        <div className="mx-auto flex min-w-0 max-w-5xl flex-col">
          {turns.map((turn, index) => {
            const live = liveTurn?.id === turn.id;
            const currentComplete = Boolean(!liveTurn && lastTurn?.id === turn.id && turn.complete);
            const expanded = openIds.has(turn.id);
            const prompt = turnPrompt(turn, live || currentComplete ? project.story : "");
            return (
              <div key={turn.id}>
                {index > 0 ? <TurnRule /> : null}
                <article className="min-w-0 py-10">
                  <JourneyPrompt text={prompt} />
                  <div className={prompt ? "mt-5" : undefined}>
                    {live ? (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <p className="flex items-center gap-2 text-[15px] text-[#cfc6b8]" aria-busy={busy || undefined}>
                            {busy || generating ? <ProgressSpinner className="h-3.5 w-3.5 text-[#9a8f7e]" /> : null}
                            {generating ?? (busy ? "Planning…" : "Journey")}
                          </p>
                          {score.segments > 0 ? (
                            <div className="flex shrink-0 items-center gap-3 pt-0.5">
                              {score.setConsistency != null ? (
                                <span className="flex items-center gap-1">
                                  <span className="text-[11px] text-[#7a7266]">Set</span>
                                  <span className={cinematographerScoreTone(score.setConsistency, true)}>
                                    {score.setConsistency}
                                  </span>
                                </span>
                              ) : null}
                              {score.traversalConfidence != null ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="text-[13px] text-[#9a8f7e]">Travel</span>
                                  <span
                                    className={cinematographerScoreTone(score.traversalConfidence)}
                                    aria-label={`Traversal confidence ${score.traversalConfidence}`}
                                  >
                                    {score.traversalConfidence}
                                  </span>
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {progress ? (
                          <div className="mt-8 min-w-0">
                            <AgentJourneyPath
                              frames={project.storyboard}
                              progress={progress}
                              captions={captions}
                              beats={beats}
                              selectedId={selectedId}
                              constructingId={constructingBeatId}
                              repairingId={repairingId}
                              repairTravel={repairScanLine(turn.entries)?.travel}
                              onSelect={onSelect}
                              onOpenReel={onOpenReel}
                            />
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <HistoryTurn
                          title={turn.complete ? "Journey complete" : "Journey"}
                          expanded={expanded}
                          onToggle={() => toggle(turn.id)}
                        >
                          {currentComplete ? (
                            <div className="min-w-0">
                              <AgentCollapsedStrip
                                frames={project.storyboard}
                                selectedId={selectedId}
                                onSelect={onSelect}
                                onOpenReel={onOpenReel}
                              />
                              <div className="mt-4 flex items-center justify-between gap-2">
                                <p className="text-[13px] text-[#7a7266]">
                                  {locationCount} locations · {traversalCount} traversals
                                  {duration > 0 ? ` · ${formatCutClock(duration)}` : ""}
                                </p>
                                {score.segments > 0 ? <ProjectScoreReadout score={score} /> : null}
                              </div>
                            </div>
                          ) : null}
                        </HistoryTurn>
                        {turn.videoUrl ? (
                          <div className="mt-4 mb-28">
                            <div className="relative aspect-video overflow-hidden bg-black">
                              <video
                                src={turn.videoUrl}
                                className="block h-full w-full"
                                controls
                                playsInline
                                aria-label="Journey movie"
                              />
                            </div>
                            <a
                              href={turn.videoUrl}
                              download={turn.filename ?? "journey.mp4"}
                              aria-label="Download journey movie"
                              className="mt-2 inline-flex rounded border border-[#3a342c] px-3 py-1 text-[13px] tracking-[0.14em] text-[#ece7df] uppercase"
                            >
                              Download
                            </a>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </article>
              </div>
            );
          })}
          {turns.length === 0 && progress ? (
            <article className="min-w-0 py-10">
              <JourneyPrompt text={project.story} />
              <div className={project.story.trim() ? "mt-5" : undefined}>
                {busy || generating ? (
                  <>
                    <p className="flex items-center gap-2 text-[15px] text-[#cfc6b8]" aria-busy="true">
                      <ProgressSpinner className="h-3.5 w-3.5 text-[#9a8f7e]" />
                      {generating ?? "Planning…"}
                    </p>
                    <div className="mt-8 min-w-0">
                      <AgentJourneyPath
                        frames={project.storyboard}
                        progress={progress}
                        captions={captions}
                        beats={beats}
                        selectedId={selectedId}
                        constructingId={constructingBeatId}
                        repairingId={repairingId}
                        onSelect={onSelect}
                        onOpenReel={onOpenReel}
                      />
                    </div>
                  </>
                ) : (
                  <HistoryTurn
                    title="Journey complete"
                    expanded={openIds.has("current")}
                    onToggle={() => toggle("current")}
                  >
                    <div className="min-w-0">
                      <AgentCollapsedStrip
                        frames={project.storyboard}
                        selectedId={selectedId}
                        onSelect={onSelect}
                        onOpenReel={onOpenReel}
                      />
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <p className="text-[13px] text-[#7a7266]">
                          {locationCount} locations · {traversalCount} traversals
                          {duration > 0 ? ` · ${formatCutClock(duration)}` : ""}
                        </p>
                        {score.segments > 0 ? <ProjectScoreReadout score={score} /> : null}
                      </div>
                    </div>
                  </HistoryTurn>
                )}
              </div>
            </article>
          ) : null}
        </div>
      </div>

      <form
        className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div
          className="pointer-events-auto mx-auto flex max-w-3xl items-end gap-3 rounded-2xl border border-[#3a342c] px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.65)]"
          style={{ backgroundColor: "#161410" }}
        >
          <label className="sr-only" htmlFor="agent-composer">
            Where should we go next?
          </label>
          <textarea
            id="agent-composer"
            rows={4}
            value={agentComposerDraft}
            placeholder="Where should we go next?"
            aria-label="Where should we go next?"
            className="max-h-[40vh] min-h-[7rem] flex-1 resize-y bg-[#161410] py-1 text-[15px] leading-relaxed text-[#ece7df] placeholder:text-[#7a7266] outline-none"
            onChange={(event) => setAgentComposerDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                submit();
              }
            }}
          />
          {agentBusy ? (
            <button
              type="button"
              aria-label="Stop agent"
              title="Stop JourneyAgent. Destinations and Takes already made stay."
              className="shrink-0 px-2 text-[12px] text-[#9a8f7e] hover:text-[#ece7df]"
              onClick={stopJourneyAgent}
            >
              Stop
            </button>
          ) : null}
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label="Create journey"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ece7df] text-[#0c0b0a] disabled:bg-[#2a2620] disabled:text-[#7a7266]"
          >
            <span className="sr-only">Create journey</span>
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
              <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </form>
      <StoryboardReelHost />
    </div>
  );
}
