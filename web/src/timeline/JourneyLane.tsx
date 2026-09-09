import type { JourneyShot, Selection } from "../project/types";
import type { LaidOutJourney } from "./geometry";
import { JourneyItem } from "./JourneyItem";

export function JourneyLane({
  journeys,
  projectJourneys,
  selection,
  preparingJourneyIds,
  shootingJourneyIds,
  canBlockJourney,
  canShootJourney,
  onSelect,
  onBlock,
  onShoot,
}: {
  journeys: LaidOutJourney[];
  projectJourneys: JourneyShot[];
  selection: Selection;
  preparingJourneyIds?: readonly string[];
  shootingJourneyIds?: readonly string[];
  canBlockJourney?: (journey: JourneyShot) => boolean;
  canShootJourney?: (journey: JourneyShot) => boolean;
  onSelect: (journeyId: string) => void;
  onBlock?: (journeyId: string) => void;
  onShoot?: (journeyId: string) => void;
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
            preparing={preparingJourneyIds?.includes(laid.journeyId) ?? false}
            shooting={
              (shootingJourneyIds?.includes(laid.journeyId) ?? false) || journey.status === "shooting"
            }
            canBlock={canBlockJourney?.(journey) ?? false}
            canShoot={canShootJourney?.(journey) ?? false}
            onSelect={() => onSelect(laid.journeyId)}
            onBlock={() => onBlock?.(laid.journeyId)}
            onShoot={() => onShoot?.(laid.journeyId)}
          />
        );
      })}
    </div>
  );
}
