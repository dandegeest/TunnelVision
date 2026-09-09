import type { JourneyShot } from "../project/types";
import {
  journeySegmentAriaLabel,
  journeySegmentCaption,
} from "../project/cinematographer";
import type { LaidOutJourney } from "./geometry";

export function journeySegmentTone(journey: JourneyShot): string {
  const fill = journey.status === "rendered" ? "bg-[#142014]" : "bg-transparent";
  const shootability = journey.cinematographer?.shootability;
  if (!shootability) {
    return journey.status === "rendered"
      ? `border-[#3f5a3a] ${fill} text-[#d7e7cf]`
      : `border-[#3a342c] ${fill} text-[#cfc6b8]`;
  }
  switch (shootability) {
    case "shootable":
      return `border-[#3f5a3a] ${fill} text-[#d7e7cf]`;
    case "needs_review":
      return `border-[#d4b36a] border-dashed ${fill} text-[#e4d2a4]`;
    case "not_shootable":
      return `border-[#c45c38] ${fill} text-[#f0c2a8]`;
  }
}

export function JourneyItem({
  laid,
  journey,
  selected,
  onSelect,
}: {
  laid: LaidOutJourney;
  journey: JourneyShot;
  selected: boolean;
  onSelect: () => void;
}) {
  const tone = journeySegmentTone(journey);
  const ring = selected
    ? "ring-2 ring-[#ece7df]"
    : "hover:ring-1 hover:ring-[#7a7266] focus-visible:ring-1 focus-visible:ring-[#7a7266]";
  const caption = journeySegmentCaption(journey);

  return (
    <button
      type="button"
      className={`absolute top-1 box-border h-12 overflow-hidden rounded border px-2 text-left text-xs tracking-[0.12em] outline-none ${tone} ${ring}`}
      style={{ left: laid.left, width: Math.max(laid.width, 8) }}
      onClick={onSelect}
      aria-label={journeySegmentAriaLabel(journey)}
      title={journey.cinematographer?.summary}
    >
      <span className="block truncate pt-1">{journey.id}</span>
      <span className="block truncate text-[10px] opacity-80">{caption}</span>
    </button>
  );
}
