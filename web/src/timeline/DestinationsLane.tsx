import { useProject } from "../project/ProjectProvider";
import type { Destination, Selection, StoryboardFrame } from "../project/types";
import {
  boundaryContinuityAtSeam,
  type BoundaryContinuity,
} from "../project/boundary-continuity";
import type { LaidOutOccurrence } from "./geometry";
import { occurrenceIsGenerating } from "./shoot-layout";
import { DestinationItem } from "./DestinationItem";

export function DestinationsLane({
  occurrences,
  destinations,
  selection,
  continuities,
  constructingBeatId,
  storyboard,
  onSelect,
}: {
  occurrences: LaidOutOccurrence[];
  destinations: Destination[];
  selection: Selection;
  continuities: readonly BoundaryContinuity[];
  constructingBeatId?: string | null;
  storyboard: readonly StoryboardFrame[];
  onSelect: (occurrenceIndex: number, destinationId: string) => void;
}) {
  const { retryDestination } = useProject();
  return (
    <div className="absolute inset-x-0 top-7 z-[1] h-[100px]">
      {occurrences.map((occurrence) => {
        const destination = destinations.find((item) => item.id === occurrence.destinationId);
        if (!destination && !occurrence.fpo && !occurrence.image) {
          return null;
        }
        const selected =
          selection.kind === "destination" && selection.occurrenceIndex === occurrence.occurrenceIndex;
        const continuity = boundaryContinuityAtSeam(
          continuities,
          occurrence.destinationId,
          occurrence.inboundJourneyId,
          occurrence.outboundJourneyId,
        );
        const frame = storyboard.find(
          (item) => item.id === occurrence.destinationId || (item.destinationId ?? item.id) === occurrence.destinationId,
        );
        const generating = occurrenceIsGenerating(occurrence, constructingBeatId, storyboard);
        return (
          <DestinationItem
            key={occurrence.occurrenceIndex}
            occurrence={occurrence}
            destination={destination}
            selected={selected}
            continuity={continuity}
            generating={generating}
            constructionError={generating ? undefined : frame?.constructionError}
            onRetry={
              frame
                ? () => {
                    void retryDestination(frame.id);
                  }
                : undefined
            }
            onSelect={() => onSelect(occurrence.occurrenceIndex, occurrence.destinationId)}
          />
        );
      })}
    </div>
  );
}
