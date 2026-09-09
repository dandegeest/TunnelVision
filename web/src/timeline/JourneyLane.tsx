import type { JourneyShot, Selection } from "../project/types";
import type { LaidOutJourney } from "./geometry";
import { JourneyItem } from "./JourneyItem";

export function JourneyLane({
  journeys,
  projectJourneys,
  selection,
  preparingJourneyId,
  onSelect,
}: {
  journeys: LaidOutJourney[];
  projectJourneys: JourneyShot[];
  selection: Selection;
  preparingJourneyId?: string | null;
  onSelect: (journeyId: string) => void;
}) {
  return (
    <div className="absolute inset-x-0 top-[128px] z-[1] h-[56px]">
      {journeys.map((laid) => {
        const journey = projectJourneys.find((item) => item.id === laid.journeyId);
        if (!journey) {
          return null;
        }
        const selected = selection.kind === "journey" && selection.journeyId === laid.journeyId;
        return (
          <JourneyItem
            key={laid.journeyId}
            laid={laid}
            journey={journey}
            selected={selected}
            preparing={preparingJourneyId === laid.journeyId}
            onSelect={() => onSelect(laid.journeyId)}
          />
        );
      })}
    </div>
  );
}
