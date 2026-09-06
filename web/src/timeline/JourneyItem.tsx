import type { JourneyShot } from "../project/types";
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
  const tone =
    journey.status === "not_shootable"
      ? "border-[#8a4a32] bg-[#2a1610] text-[#f0c2a8]"
      : journey.status === "needs_review"
        ? "border-[#8a7032] bg-[#261e10] text-[#f0d9a8]"
        : "border-[#3f5a3a] bg-[#142014] text-[#d7e7cf]";
  const ring = selected ? "ring-2 ring-[#ece7df]" : "";

  return (
    <button
      type="button"
      className={`absolute top-2 box-border h-12 overflow-hidden rounded border px-2 text-left text-xs tracking-[0.12em] ${tone} ${ring}`}
      style={{ left: laid.left, width: Math.max(laid.width, 8) }}
      onClick={onSelect}
      aria-label={`Journey ${journey.id}`}
    >
      <span className="block truncate pt-1">{journey.id}</span>
      <span className="block truncate text-[10px] opacity-80">
        {journey.status === "not_shootable"
          ? "blocked"
          : journey.status === "needs_review"
            ? "needs review"
            : "rendered"}
      </span>
    </button>
  );
}
