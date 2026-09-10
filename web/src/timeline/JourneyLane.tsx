import type { JourneyShot, Selection } from "../project/types";
import type { LaidOutJourney } from "./geometry";
import { JourneyItem, journeyBandSelected } from "./JourneyItem";

export function JourneyLane({
  journeys,
  projectJourneys,
  selection,
  preparingJourneyIds,
  shootingJourneyIds,
  onSelect,
}: {
  journeys: LaidOutJourney[];
  projectJourneys: JourneyShot[];
  selection: Selection;
  preparingJourneyIds?: readonly string[];
  shootingJourneyIds?: readonly string[];
  onSelect: (journeyId: string, band: "motion" | "footage") => void;
}) {
  return (
    <div className="absolute inset-x-0 top-[128px] z-[1] h-[56px]">
      {journeys.map((laid) => {
        const journey = projectJourneys.find((item) => item.id === laid.journeyId);
        if (!journey) {
          return null;
        }
        const preparing = preparingJourneyIds?.includes(laid.journeyId) ?? false;
        const shooting =
          (shootingJourneyIds?.includes(laid.journeyId) ?? false) || journey.status === "shooting";
        return (
          <div key={laid.journeyId}>
            <JourneyItem
              laid={laid}
              journey={journey}
              band="motion"
              selected={journeyBandSelected(selection, laid.journeyId, "motion")}
              preparing={preparing}
              onSelect={() => onSelect(laid.journeyId, "motion")}
            />
            <JourneyItem
              laid={laid}
              journey={journey}
              band="footage"
              selected={journeyBandSelected(selection, laid.journeyId, "footage")}
              shooting={shooting}
              onSelect={() => onSelect(laid.journeyId, "footage")}
            />
          </div>
        );
      })}
    </div>
  );
}
