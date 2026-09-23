import { useEffect, useRef, useState } from "react";
import { cinematographerScoreTone, type ProjectScore } from "../project/cinematographer";
import type { Selection } from "../project/types";
import {
  type JourneyProgress,
  type JourneyProgressSegment,
} from "./conversation-console";

const SCORE_TICK_MS = 480;

function progressStatusLabel(kind: "canonical" | "footage", status: JourneyProgressSegment["status"]): string {
  if (kind === "canonical") {
    if (status === "complete") {
      return "constructed";
    }
    if (status === "active") {
      return "constructing";
    }
    return "planned";
  }
  if (status === "complete") {
    return "accepted";
  }
  if (status === "shooting" || status === "active") {
    return "shooting";
  }
  if (status === "planning") {
    return "planning";
  }
  return "pending";
}

export function progressSelectionId(selection: Selection): string | undefined {
  if (selection.kind === "storyboard") {
    return selection.frameId;
  }
  if (selection.kind === "destination") {
    return selection.destinationId;
  }
  return undefined;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useTickingScore(
  score: number | null,
  segments: number,
): { shown: number | null; ticking: boolean } {
  const [shown, setShown] = useState(score);
  const [ticking, setTicking] = useState(false);
  const shownRef = useRef(score);
  const segmentsRef = useRef(segments);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = shownRef.current;
    const to = score;
    const segmentsChanged = segmentsRef.current !== segments;
    segmentsRef.current = segments;
    if (from === to && !segmentsChanged) {
      return;
    }
    const reduce = prefersReducedMotion();
    const pulseOnly = from === to || from == null || to == null || reduce;
    const finish = (value: number | null) => {
      shownRef.current = value;
      setShown(value);
      setTicking(false);
    };
    if (pulseOnly) {
      shownRef.current = to;
      setShown(to);
      if (to == null || reduce) {
        setTicking(false);
        return;
      }
      setTicking(true);
      const timeout = window.setTimeout(() => setTicking(false), SCORE_TICK_MS);
      return () => window.clearTimeout(timeout);
    }
    setTicking(true);
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / SCORE_TICK_MS);
      const eased = 1 - (1 - t) ** 3;
      const next = Math.round(from + (to - from) * eased);
      shownRef.current = next;
      setShown(next);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      finish(to);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [score, segments]);

  return { shown, ticking };
}

function CanonicalBadge({
  letter,
  status,
  selected,
  onSelect,
}: {
  letter: string;
  status: JourneyProgressSegment["status"];
  selected: boolean;
  onSelect: () => void;
}) {
  const done = status === "complete";
  const active = status === "active";
  return (
    <button
      type="button"
      aria-label={`Canonical ${letter} ${progressStatusLabel("canonical", status)}`}
      aria-pressed={selected}
      title={`Select destination ${letter} in Plan`}
      onClick={onSelect}
      className={`inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tracking-[0.06em] outline-none hover:text-[#ece7df] focus-visible:ring-1 focus-visible:ring-[#ece7df] ${
        done
          ? "bg-[#5c6b3d] text-[#ece7df] hover:bg-[#6a7a4a]"
          : "border border-[#3a342c] bg-transparent text-[#7a7266] hover:border-[#7a7266]"
      } ${active ? "animate-pulse ring-1 ring-[#ece7df]" : selected ? "ring-1 ring-[#ece7df]" : ""}`}
    >
      {letter}
    </button>
  );
}

function FootageLine({
  from,
  to,
  status,
}: {
  from: string;
  to: string;
  status: JourneyProgressSegment["status"];
}) {
  const done = status === "complete";
  const shooting = status === "shooting" || status === "active";
  const planning = status === "planning";
  return (
    <span
      aria-label={`Footage ${from} to ${to} ${progressStatusLabel("footage", status)}`}
      data-progress-line={status}
      className={`mx-1 h-0.5 w-4 shrink-0 ${
        shooting
          ? "journey-progress-line-shooting"
          : planning
            ? "journey-progress-line-planning"
            : done
              ? "bg-[#8fa36a]"
              : "journey-progress-line-pending"
      }`}
    />
  );
}

export function JourneyProgressRail({
  progress,
  selectedId,
  onSelectDestination,
}: {
  progress: JourneyProgress;
  selectedId?: string;
  onSelectDestination: (destinationId: string) => void;
}) {
  return (
    <nav aria-label="Journey progress" className="min-w-0 py-1">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {progress.nodes.map((node, index) => {
          const segment = progress.segments[index];
          return (
            <div key={node.id} className="flex shrink-0 items-center gap-0.5">
              <CanonicalBadge
                letter={node.letter}
                status={node.status}
                selected={selectedId === node.id}
                onSelect={() => onSelectDestination(node.id)}
              />
              {segment ? (
                <FootageLine from={segment.from} to={segment.to} status={segment.status} />
              ) : null}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

const SCORE_CHIP_PENDING =
  "rounded-full px-1.5 py-0 text-[9px] leading-[14px] tabular-nums tracking-[0.08em] text-[#7a7266]";

function ProjectScoreChip({
  label,
  name,
  value,
  shown,
  ticking,
  pendingTitle,
  assessedTitle,
}: {
  label: string;
  name: string;
  value: number | null;
  shown: number | null;
  ticking: boolean;
  pendingTitle: string;
  assessedTitle: string;
}) {
  const pending = value == null;
  return (
    <span className="flex items-center gap-1">
      <span className="text-[10px] tracking-[0.08em] text-[#9a8f7e]">{label}</span>
      <span
        className={`${
          pending ? SCORE_CHIP_PENDING : cinematographerScoreTone(value, true)
        } project-score-value${ticking ? " project-score-value-tick" : ""}`}
        aria-label={pending ? `${name} pending` : `${name} ${value}`}
        title={pending ? pendingTitle : assessedTitle}
        data-score-ticking={ticking || undefined}
      >
        {shown == null ? "—" : shown}
      </span>
    </span>
  );
}

export function ProjectScoreReadout({ score }: { score: ProjectScore }) {
  const setTick = useTickingScore(score.setConsistency, score.segments);
  const traversalTick = useTickingScore(score.traversalConfidence, score.segments);
  const across = `${score.segments} ${score.segments === 1 ? "segment" : "segments"}`;
  return (
    <div className="flex items-center justify-end gap-2" aria-live="polite">
      <ProjectScoreChip
        label="Set"
        name="Set consistency"
        value={score.setConsistency}
        shown={setTick.shown}
        ticking={setTick.ticking}
        pendingTitle="No assessed segments yet."
        assessedTitle={`Average Set Consistency ${score.setConsistency} across ${across}.`}
      />
      <ProjectScoreChip
        label="Travel"
        name="Traversal confidence"
        value={score.traversalConfidence}
        shown={traversalTick.shown}
        ticking={traversalTick.ticking}
        pendingTitle="No assessed segments yet."
        assessedTitle={`Average Traversal Confidence ${score.traversalConfidence} across ${across}.`}
      />
    </div>
  );
}
