import { cinematographerScoreTone, type ProjectScore } from "../project/cinematographer";
import {
  type JourneyProgress,
  type JourneyProgressSegment,
} from "./conversation-console";

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
  if (status === "active") {
    return "shooting";
  }
  return "pending";
}

function CanonicalBadge({
  letter,
  status,
}: {
  letter: string;
  status: JourneyProgressSegment["status"];
}) {
  const done = status === "complete";
  const active = status === "active";
  return (
    <span
      className={`inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tracking-[0.06em] ${
        done
          ? "bg-[#5c6b3d] text-[#ece7df]"
          : "border border-[#3a342c] bg-transparent text-[#7a7266]"
      } ${active ? "animate-pulse ring-1 ring-[#ece7df]" : ""}`}
      aria-label={`Canonical ${letter} ${progressStatusLabel("canonical", status)}`}
    >
      {letter}
    </span>
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
  const active = status === "active";
  return (
    <span
      aria-label={`Footage ${from} to ${to} ${progressStatusLabel("footage", status)}`}
      data-progress-line={status}
      className={`mx-1 h-0.5 w-4 shrink-0 ${
        active
          ? "journey-progress-line-active"
          : done
            ? "bg-[#8fa36a]"
            : "journey-progress-line-pending"
      }`}
    />
  );
}

export function JourneyProgressRail({ progress }: { progress: JourneyProgress }) {
  return (
    <nav aria-label="Journey progress" className="min-w-0 py-1">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {progress.nodes.map((node, index) => {
          const segment = progress.segments[index];
          return (
            <div key={node.id} className="flex shrink-0 items-center gap-0.5">
              <CanonicalBadge letter={node.letter} status={node.status} />
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

export function ProjectScoreReadout({ score }: { score: ProjectScore }) {
  const pending = score.score == null;
  const title = pending
    ? "No assessed segments yet."
    : `Average Set Consistency ${score.setConsistency} and Traversal Confidence ${score.traversalConfidence} across ${score.segments} ${score.segments === 1 ? "segment" : "segments"}.`;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] tracking-[0.14em] text-[#9a8f7e] uppercase">Score</span>
      <span
        className={
          pending
            ? "rounded-full px-1.5 py-0 text-[9px] leading-[14px] tabular-nums tracking-[0.08em] text-[#7a7266]"
            : cinematographerScoreTone(score.score, true)
        }
        aria-label={pending ? "Project score pending" : `Project score ${score.score}`}
        title={title}
      >
        {pending ? "—" : score.score}
      </span>
    </div>
  );
}
