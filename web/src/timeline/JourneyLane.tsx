import type { MouseEvent } from "react";
import { canShootJourney } from "../project/shoot";
import { useProject } from "../project/ProjectProvider";
import type { JourneyShot, Selection } from "../project/types";
import type { LaidOutJourney } from "./geometry";
import {
  JourneyItem,
  journeyBandSelected,
  journeySegmentIsActive,
  shootActionAriaLabel,
  shootActionLabel,
} from "./JourneyItem";

const shootCtaClass =
  "z-[2] h-[22px] shrink-0 rounded border border-[#3a342c] px-2.5 text-[10px] leading-[16px] tracking-[0.12em] text-[#ece7df] outline-none hover:border-[#7a7266] disabled:cursor-not-allowed disabled:opacity-40";

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
  const { project, shootJourney } = useProject();
  return (
    <div className="absolute inset-x-0 top-[128px] z-[1] h-[96px]">
      {journeys.map((laid) => {
        const journey = projectJourneys.find((item) => item.id === laid.journeyId);
        if (!journey) {
          return null;
        }
        const preparing = preparingJourneyIds?.includes(laid.journeyId) ?? false;
        const shooting =
          (shootingJourneyIds?.includes(laid.journeyId) ?? false) || journey.status === "shooting";
        const showShoot = journeySegmentIsActive(selection, journey) && !shooting;
        const onShoot = (event: MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          onSelect(laid.journeyId, "footage");
          void shootJourney(journey.id);
        };
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
            {showShoot ? (
              <div
                className="absolute z-[2] flex justify-center"
                style={{
                  top: 68,
                  left: laid.left,
                  width: Math.max(laid.width, 8),
                }}
              >
                <button
                  type="button"
                  className={shootCtaClass}
                  disabled={!canShootJourney(project, journey) || preparing}
                  aria-label={shootActionAriaLabel(journey)}
                  onClick={onShoot}
                >
                  {shootActionLabel(journey)}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
