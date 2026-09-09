import type { JourneyShot } from "../project/types";
import {
  journeySegmentAriaLabel,
  journeySegmentCaption,
  locomotionPaceLabel,
} from "../project/cinematographer";
import type { LaidOutJourney } from "./geometry";

export function journeySegmentTone(journey: JourneyShot): string {
  const fill = journey.status === "rendered" ? "bg-[#142014]" : "bg-transparent";
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
      return `border-2 border-[#d4b36a] border-dashed ${fill} text-[#e4d2a4]`;
    case "not_shootable":
      return `border-2 border-[#c45c38] ${fill} text-[#f0c2a8]`;
  }
}

export function JourneyItem({
  laid,
  journey,
  selected,
  preparing = false,
  shooting = false,
  onSelect,
}: {
  laid: LaidOutJourney;
  journey: JourneyShot;
  selected: boolean;
  preparing?: boolean;
  shooting?: boolean;
  onSelect: () => void;
}) {
  const tone = journeySegmentTone(journey);
  const ring = selected
    ? "ring-2 ring-[#ece7df]"
    : "hover:ring-1 hover:ring-[#7a7266] focus-visible:ring-1 focus-visible:ring-[#7a7266]";
  const caption = journeySegmentCaption(journey);
  const ariaLabel = journeySegmentAriaLabel(journey);
  const busy = preparing || shooting;

  return (
    <div
      className={`absolute top-1 box-border h-12 overflow-hidden rounded ${tone} ${ring}${
        busy ? " storyboard-generating" : ""
      }`}
      style={{ left: laid.left, width: Math.max(laid.width, 8) }}
      aria-busy={busy || undefined}
      title={
        journey.cinematographer
          ? `${journey.cinematographer.summary} · ${locomotionPaceLabel(journey.cinematographer.pace)}`
          : undefined
      }
    >
      <button
        type="button"
        className="absolute inset-0 z-[1] px-2 text-left text-xs tracking-[0.12em] outline-none"
        onClick={onSelect}
        aria-label={ariaLabel}
        aria-pressed={selected}
      >
        <span className="relative z-[1] block truncate pt-1">
          <span className="truncate">{journey.id}</span>
        </span>
        <span
          className={`relative z-[1] block truncate text-[10px] opacity-80${
            busy ? " storyboard-generating-label" : ""
          }`}
        >
          {caption}
        </span>
      </button>
    </div>
  );
}
