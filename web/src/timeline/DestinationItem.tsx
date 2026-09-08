import type { Destination } from "../project/types";
import {
  boundaryContinuityLabel,
  type BoundaryContinuity,
} from "../project/boundary-continuity";
import { DESTINATION_THUMB_PX, type LaidOutOccurrence } from "./geometry";

function seamTone(continuity: BoundaryContinuity): string {
  switch (continuity.classification) {
    case "strong":
      return "text-[#9a8f7e]";
    case "good":
      return "text-[#b8c9a8]";
    case "review":
      return "text-[#d4b36a]";
    case "mismatch":
      return "text-[#c45c38]";
  }
}

export function DestinationItem({
  occurrence,
  destination,
  selected,
  continuity,
  onSelect,
}: {
  occurrence: LaidOutOccurrence;
  destination: Destination;
  selected: boolean;
  continuity?: BoundaryContinuity;
  onSelect: () => void;
}) {
  const loopReturn = occurrence.destinationId === "A" && occurrence.occurrenceIndex > 0;
  const ring = occurrence.arrivalBlocked
    ? "ring-2 ring-[#c45c38]"
    : selected
      ? "ring-2 ring-[#ece7df]"
      : "ring-1 ring-[#3a342c] group-hover:ring-[#7a7266] group-focus-visible:ring-[#7a7266]";
  const matchLabel = continuity ? boundaryContinuityLabel(continuity.classification) : null;
  const ariaBits = [
    loopReturn ? `Destination ${destination.label} again` : `Destination ${destination.label}`,
    continuity ? `boundary match ${matchLabel}` : null,
    continuity?.rasterMismatch ? "output raster mismatch" : null,
  ].filter(Boolean);

  return (
    <button
      type="button"
      className="group absolute top-0 -translate-x-1/2 text-left outline-none"
      style={{ left: occurrence.xCenter, width: DESTINATION_THUMB_PX }}
      onClick={onSelect}
      aria-label={ariaBits.join(", ")}
    >
      <span className="mb-1 flex h-5 items-baseline justify-center gap-1 border-b border-[#3a342c]">
        <span className="truncate text-center text-[11px] tracking-[0.2em] text-[#ece7df]">
          {destination.label}
        </span>
        {loopReturn ? (
          <span className="shrink-0 text-[10px] tracking-[0.08em] text-[#9a8f7e]">(loop)</span>
        ) : null}
      </span>
      <span className="relative block">
        <img
          src={destination.image}
          alt=""
          className={`aspect-video w-full rounded object-cover ${ring}`}
        />
        {continuity && matchLabel ? (
          <span
            className={`pointer-events-none absolute inset-x-0 bottom-0 rounded-b bg-[#0c0b0a]/75 px-1 py-0.5 text-center text-[8px] tracking-[0.12em] uppercase ${seamTone(continuity)}`}
          >
            {matchLabel}
            {continuity.rasterMismatch ? " · raster" : ""}
          </span>
        ) : null}
      </span>
    </button>
  );
}
