import type { Destination } from "../project/types";
import { DESTINATION_THUMB_PX, type LaidOutOccurrence } from "./geometry";

export function DestinationItem({
  occurrence,
  destination,
  selected,
  onSelect,
}: {
  occurrence: LaidOutOccurrence;
  destination: Destination;
  selected: boolean;
  onSelect: () => void;
}) {
  const loopReturn = occurrence.destinationId === "A" && occurrence.occurrenceIndex > 0;
  const ring = occurrence.arrivalBlocked
    ? "ring-2 ring-[#c45c38]"
    : selected
      ? "ring-2 ring-[#ece7df]"
      : "ring-1 ring-[#3a342c] group-hover:ring-[#7a7266] group-focus-visible:ring-[#7a7266]";

  return (
    <button
      type="button"
      className="group absolute top-0 -translate-x-1/2 text-left outline-none"
      style={{ left: occurrence.xCenter, width: DESTINATION_THUMB_PX }}
      onClick={onSelect}
      aria-label={
        loopReturn
          ? `Destination ${destination.label} again`
          : `Destination ${destination.label}`
      }
    >
      <span className="mb-1 flex h-5 items-baseline justify-center gap-1 border-b border-[#3a342c]">
        <span className="truncate text-center text-[11px] tracking-[0.2em] text-[#ece7df]">
          {destination.label}
        </span>
        {loopReturn ? (
          <span className="shrink-0 text-[10px] tracking-[0.08em] text-[#9a8f7e]">(loop)</span>
        ) : null}
      </span>
      <img
        src={destination.image}
        alt=""
        className={`aspect-video w-full rounded object-cover ${ring}`}
      />
    </button>
  );
}
