import type { MouseEvent } from "react";
import { locomotionPaceLabel, motionBandAriaLabel, footageBandAriaLabel } from "../project/cinematographer";
import { canShootJourney } from "../project/shoot";
import { useProject } from "../project/ProjectProvider";
import type { JourneyBand, JourneyShot, Selection } from "../project/types";
import type { LaidOutJourney } from "./geometry";

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

function footageBandTone(journey: JourneyShot): string {
  if (journey.status === "rendered") {
    return "border border-[#3f5a3a] bg-[#142014] text-[#d7e7cf]";
  }
  if (journey.status === "failed") {
    return "border border-[#c45c38] bg-transparent text-[#f0c2a8]";
  }
  return "border border-[#3a342c] bg-transparent text-[#cfc6b8]";
}

const ctaClass =
  "relative z-[2] shrink-0 rounded border border-[#3a342c] px-1.5 py-0 text-[10px] leading-[16px] text-[#ece7df] outline-none hover:border-[#7a7266] disabled:cursor-not-allowed disabled:opacity-40";

export function JourneyItem({
  laid,
  journey,
  band,
  selected,
  preparing = false,
  shooting = false,
  onSelect,
}: {
  laid: LaidOutJourney;
  journey: JourneyShot;
  band: JourneyBand;
  selected: boolean;
  preparing?: boolean;
  shooting?: boolean;
  onSelect: () => void;
}) {
  const { project, shootJourney, retryMotionPlan } = useProject();
  const motion = band === "motion";
  const tone = motion ? journeySegmentTone(journey) : footageBandTone(journey);
  const ring = selected
    ? "ring-2 ring-[#ece7df]"
    : "hover:ring-1 hover:ring-[#7a7266] focus-visible:ring-1 focus-visible:ring-[#7a7266]";
  const ariaLabel = motion ? motionBandAriaLabel(journey) : footageBandAriaLabel(journey);
  const busy = motion ? preparing : shooting;
  const actionsBusy = preparing || shooting;
  const label = motion ? "MOTION" : "FOOTAGE";

  const onGenerate = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onSelect();
    void shootJourney(journey.id);
  };

  const onRetry = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onSelect();
    void retryMotionPlan(journey.id);
  };

  return (
    <div
      className={`absolute box-border overflow-hidden rounded ${tone} ${ring}${
        busy ? " storyboard-generating" : ""
      }`}
      style={{
        top: motion ? 0 : 30,
        left: laid.left,
        width: Math.max(laid.width, 8),
        height: 26,
      }}
      aria-busy={busy || undefined}
      title={
        motion && journey.cinematographer
          ? `${journey.cinematographer.summary} · ${locomotionPaceLabel(journey.cinematographer.pace)}`
          : undefined
      }
    >
      <div className="flex h-full items-center gap-1 px-1.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center text-left outline-none"
          onClick={onSelect}
          aria-label={ariaLabel}
          aria-pressed={selected}
        >
          <span
            className={`truncate text-[9px] tracking-[0.16em] opacity-70${
              busy ? " storyboard-generating-label" : ""
            }`}
          >
            {label}
          </span>
        </button>
        {motion ? (
          preparing ? (
            <span className="relative z-[2] shrink-0 text-[10px] leading-[16px] text-[#ece7df] storyboard-generating-label">
              Planning…
            </span>
          ) : journey.motionPlanError ? (
            <button
              type="button"
              className={ctaClass}
              disabled={actionsBusy}
              aria-label={`Retry ${journey.id}`}
              onClick={onRetry}
            >
              Retry
            </button>
          ) : null
        ) : (
          <button
            type="button"
            className={ctaClass}
            disabled={!canShootJourney(project, journey) || actionsBusy}
            aria-label={`Generate ${journey.id}`}
            onClick={onGenerate}
          >
            {shooting ? "Generating…" : "Generate"}
          </button>
        )}
      </div>
    </div>
  );
}

export function journeyBandSelected(selection: Selection, journeyId: string, band: JourneyBand): boolean {
  return selection.kind === "journey" && selection.journeyId === journeyId && selection.band === band;
}
