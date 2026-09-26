import type { MouseEvent } from "react";
import {
  canAssessJourney,
  cinematographerScoreTone,
  locomotionPaceLabel,
  motionBandAriaLabel,
  motionPlanNeedsRebuild,
} from "../project/cinematographer";
import { useProject } from "../project/ProjectProvider";
import type { CinematographerAssessment, JourneyShot, Selection } from "../project/types";
import type { LaidOutJourney } from "./geometry";

export { journeySegmentIsActive } from "./takes-layout";

export function journeySegmentTone(journey: JourneyShot): string {
  const planned = Boolean(journey.cinematographer) || journey.status === "rendered";
  const fill = planned ? "bg-[#142014]" : "bg-transparent";
  const shootability = journey.cinematographer?.shootability;
  if (!shootability) {
    return journey.status === "rendered"
      ? `border border-[#3f5a3a] ${fill} text-[#d7e7cf]`
      : `border border-[#3a342c] ${fill} text-[#cfc6b8]`;
  }
  switch (shootability) {
    case "shootable":
      return `border-2 border-[#3f5a3a] ${fill} text-[#d7e7cf]`;
    case "needs_review":
      return "border-2 border-[#d4b36a] bg-[#443922] text-[#e4d2a4]";
    case "not_shootable":
      return `border-2 border-[#c45c38] ${fill} text-[#f0c2a8]`;
  }
}

export function newTakeActionLabel(): string {
  return "+ NEW TAKE";
}

export function newTakeAllActionLabel(): string {
  return "Take All";
}

export function newTakeBusyLabel(): string {
  return "Generating…";
}

export function newTakeActionAriaLabel(journey: JourneyShot): string {
  return `New take ${journey.id}`;
}

export function JourneyItem({
  laid,
  journey,
  selected,
  preparing = false,
  onSelect,
}: {
  laid: LaidOutJourney;
  journey: JourneyShot;
  selected: boolean;
  preparing?: boolean;
  onSelect: () => void;
}) {
  const { project, retryMotionPlan } = useProject();
  const tone = journeySegmentTone(journey);
  const ring = selected
    ? "ring-2 ring-[#ece7df]"
    : "hover:ring-1 hover:ring-[#7a7266] focus-visible:ring-1 focus-visible:ring-[#7a7266]";
  const ctaClass =
    "relative z-[2] flex h-[18px] shrink-0 items-center justify-center rounded border border-[#3a342c] px-1.5 text-[10px] leading-[16px] text-[#ece7df] outline-none hover:border-[#7a7266] disabled:cursor-not-allowed disabled:opacity-40";
  const needsRebuild = motionPlanNeedsRebuild(journey) && canAssessJourney(project, journey);

  const onRetry = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onSelect();
    void retryMotionPlan(journey.id);
  };

  return (
    <div
      className={`absolute box-border overflow-hidden rounded ${tone} ${ring}${
        preparing ? " storyboard-generating" : ""
      }`}
      style={{
        top: 0,
        left: laid.left,
        width: Math.max(laid.width, 8),
        height: 26,
      }}
      aria-busy={preparing || undefined}
      title={
        journey.cinematographer
          ? `${journey.cinematographer.summary} · ${locomotionPaceLabel(journey.cinematographer.pace)}`
          : undefined
      }
    >
      <div className="flex h-full items-center gap-1 px-1.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 text-left outline-none"
          onClick={onSelect}
          aria-label={motionBandAriaLabel(journey)}
          aria-pressed={selected}
        >
          <span
            className={`min-w-0 truncate text-[9px] tracking-[0.16em] opacity-70${
              preparing ? " storyboard-generating-label" : ""
            }`}
          >
            MOTION
          </span>
          {!preparing && journey.cinematographer ? (
            <MotionBandScores assessment={journey.cinematographer} />
          ) : null}
        </button>
        {preparing ? (
          <span className="relative z-[2] shrink-0 text-[10px] leading-[16px] text-[#ece7df] storyboard-generating-label">
            Planning…
          </span>
        ) : journey.motionPlanError ? (
          <button
            type="button"
            className={ctaClass}
            disabled={preparing}
            aria-label={`Retry ${journey.id}`}
            title={journey.motionPlanError}
            onClick={onRetry}
          >
            Retry
          </button>
        ) : needsRebuild ? (
          <button
            type="button"
            className={ctaClass}
            disabled={preparing}
            aria-label={`Rebuild Camotion ${journey.id}`}
            title="Regenerate Camotion shooting frames for this segment"
            onClick={onRetry}
          >
            Rebuild
          </button>
        ) : null}
      </div>
    </div>
  );
}

function MotionBandScores({ assessment }: { assessment: CinematographerAssessment }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-0.5">
      <span
        className={cinematographerScoreTone(assessment.setConsistency, true)}
        aria-label={`Set consistency ${assessment.setConsistency}`}
        title="Set consistency"
      >
        {assessment.setConsistency}
      </span>
      <span
        className={cinematographerScoreTone(assessment.traversalConfidence, true)}
        aria-label={`Traversal confidence ${assessment.traversalConfidence}`}
        title="Traversal confidence"
      >
        {assessment.traversalConfidence}
      </span>
    </span>
  );
}

export function journeyBandSelected(selection: Selection, journeyId: string, band: "motion" | "footage"): boolean {
  return selection.kind === "journey" && selection.journeyId === journeyId && selection.band === band;
}
