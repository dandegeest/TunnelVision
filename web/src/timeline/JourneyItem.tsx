import type { JourneyShot } from "../project/types";
import {
  cinematographerShootabilityLabel,
  journeyLegStatusLabel,
} from "../project/cinematographer";
import type { LaidOutJourney } from "./geometry";

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
  const tone = "border-[#3f5a3a] bg-[#142014] text-[#d7e7cf]";
  const ring = selected
    ? "ring-2 ring-[#ece7df]"
    : "hover:ring-1 hover:ring-[#7a7266] focus-visible:ring-1 focus-visible:ring-[#7a7266]";
  const operational = journeyLegStatusLabel(journey);
  const cm = journey.cinematographer
    ? cinematographerShootabilityLabel(journey.cinematographer.shootability)
    : undefined;
  const caption = cm ? `${operational} · CM ${cm}` : operational;
  const ariaLabel = cm
    ? `Journey ${journey.id}, ${operational}, CM ${cm}`
    : `Journey ${journey.id}, ${operational}`;

  return (
    <button
      type="button"
      className={`absolute top-1 box-border h-12 overflow-hidden rounded border px-2 text-left text-xs tracking-[0.12em] outline-none ${tone} ${ring}`}
      style={{ left: laid.left, width: Math.max(laid.width, 8) }}
      onClick={onSelect}
      aria-label={ariaLabel}
      title={journey.cinematographer?.summary}
    >
      <span className="block truncate pt-1">{journey.id}</span>
      <span className="block truncate text-[10px] opacity-80">{caption}</span>
    </button>
  );
}
