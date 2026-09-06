import type { Destination } from "../project/types";
import type { LaidOutOccurrence } from "./geometry";

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
      : "ring-1 ring-[#3a342c]";

  return (
    <button
      type="button"
      className="absolute top-3 w-[120px] -translate-x-1/2 text-left"
      style={{ left: occurrence.xCenter }}
      onClick={onSelect}
      aria-label={
        loopReturn
          ? `Destination ${destination.label} again`
          : `Destination ${destination.label}`
      }
    >
      <img
        src={destination.image}
        alt=""
        className={`aspect-video w-full rounded object-cover ${ring}`}
      />
      <span className="mt-1 flex items-center justify-center gap-1 text-xs tracking-[0.16em]">
        {destination.label}
        {loopReturn ? <span className="text-[#9a8f7e]">(loop)</span> : null}
      </span>
    </button>
  );
}
