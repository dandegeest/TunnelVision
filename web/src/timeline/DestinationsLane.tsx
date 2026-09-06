import type { Destination, Selection } from "../project/types";
import type { LaidOutOccurrence } from "./geometry";
import { DestinationItem } from "./DestinationItem";

export function DestinationsLane({
  occurrences,
  destinations,
  selection,
  onSelect,
}: {
  occurrences: LaidOutOccurrence[];
  destinations: Destination[];
  selection: Selection;
  onSelect: (occurrenceIndex: number, destinationId: string) => void;
}) {
  return (
    <div className="absolute inset-x-0 top-7 z-[1] h-[100px]">
      {occurrences.map((occurrence) => {
        const destination = destinations.find((item) => item.id === occurrence.destinationId);
        if (!destination) {
          return null;
        }
        const selected =
          selection.kind === "destination" && selection.occurrenceIndex === occurrence.occurrenceIndex;
        return (
          <DestinationItem
            key={occurrence.occurrenceIndex}
            occurrence={occurrence}
            destination={destination}
            selected={selected}
            onSelect={() => onSelect(occurrence.occurrenceIndex, occurrence.destinationId)}
          />
        );
      })}
    </div>
  );
}
