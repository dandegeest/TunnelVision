import type { MouseEvent } from "react";
import { canShootJourney } from "../project/shoot";
import {
  journeyTakes,
  selectedTake,
  takeDisplayLabel,
  takeHasShootingFrames,
} from "../project/takes";
import { useProject } from "../project/ProjectProvider";
import { destinationById, type JourneyShot, type JourneyShotTake, type Selection } from "../project/types";
import type { LaidOutJourney } from "./geometry";
import {
  JourneyItem,
  journeyBandSelected,
  newTakeActionAriaLabel,
  newTakeActionLabel,
} from "./JourneyItem";
import {
  JOURNEY_LANE_TOP,
  NEW_TAKE_HEIGHT,
  TAKE_ROW_HEIGHT,
  TAKES_HEADER_HEIGHT,
  TAKES_HEADER_TOP,
  journeyLaneHeight,
  newTakeTop,
  showNewTakeControl,
  takeRowTop,
} from "./takes-layout";

const takeCtaClass =
  "z-[2] h-[22px] shrink-0 rounded border border-[#3a342c] px-2.5 text-[10px] leading-[16px] tracking-[0.12em] text-[#ece7df] outline-none hover:border-[#7a7266] disabled:cursor-not-allowed disabled:opacity-40";

function takeThumbnailUrl(take: JourneyShotTake, fallback?: string): string | undefined {
  return takeHasShootingFrames(take) ? take.startShootingFrame.imageUrl : fallback;
}

function TakeRow({
  laid,
  journey,
  take,
  selected,
  thumbSrc,
  onSelectTake,
}: {
  laid: LaidOutJourney;
  journey: JourneyShot;
  take: JourneyShotTake;
  selected: boolean;
  thumbSrc?: string;
  onSelectTake: () => void;
}) {
  const number = take.number ?? 1;
  const ring = selected
    ? "z-[3] ring-2 ring-inset ring-[#ece7df]"
    : "z-[2] hover:ring-1 hover:ring-inset hover:ring-[#7a7266] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#7a7266]";
  return (
    <button
      type="button"
      className={`absolute box-border flex items-center gap-1 rounded border border-[#3a342c] bg-[#10100c] px-1.5 text-left text-[#cfc6b8] outline-none ${ring}`}
      style={{
        top: takeRowTop(number - 1),
        left: laid.left,
        width: Math.max(laid.width, 8),
        height: TAKE_ROW_HEIGHT,
      }}
      aria-label={`Take ${number} ${journey.id}`}
      aria-pressed={selected}
      onClick={onSelectTake}
    >
      {thumbSrc ? (
        <img src={thumbSrc} alt="" className="media-contain h-[18px] w-[32px] shrink-0 rounded" />
      ) : (
        <span className="h-[18px] w-[32px] shrink-0 rounded border border-[#3a342c] bg-[#142014]" />
      )}
      <span className="truncate text-[9px] tracking-[0.16em] opacity-70">{takeDisplayLabel({ number })}</span>
    </button>
  );
}

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
  const { project, shootJourney, selectTake } = useProject();
  const laneHeight = journeyLaneHeight(projectJourneys, selection, shootingJourneyIds ?? []);
  return (
    <div className="absolute inset-x-0 z-[1]" style={{ top: JOURNEY_LANE_TOP, height: laneHeight }}>
      {journeys.map((laid) => {
        const journey = projectJourneys.find((item) => item.id === laid.journeyId);
        if (!journey) {
          return null;
        }
        const preparing = preparingJourneyIds?.includes(laid.journeyId) ?? false;
        const shooting =
          (shootingJourneyIds?.includes(laid.journeyId) ?? false) || journey.status === "shooting";
        const takes = journeyTakes(journey);
        const current = selectedTake(journey);
        const showTakes = takes.length > 0;
        const showNewTake = showNewTakeControl(selection, journey, shooting);
        const startImage = destinationById(project.destinations, journey.startDestinationId)?.image;
        const onNewTake = (event: MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
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
            {showTakes || showNewTake ? (
              <div
                className="absolute flex items-center px-1.5 text-[9px] tracking-[0.16em] text-[#7d7466]"
                style={{
                  top: TAKES_HEADER_TOP,
                  left: laid.left,
                  width: Math.max(laid.width, 8),
                  height: TAKES_HEADER_HEIGHT,
                }}
              >
                TAKES
              </div>
            ) : null}
            {takes.map((take) => (
              <TakeRow
                key={take.id ?? take.number}
                laid={laid}
                journey={journey}
                take={take}
                selected={take.id === current?.id}
                thumbSrc={takeThumbnailUrl(take, startImage)}
                onSelectTake={() => {
                  onSelect(laid.journeyId, "footage");
                  if (take.id) {
                    selectTake(journey.id, take.id);
                  }
                }}
              />
            ))}
            {showNewTake ? (
              <div
                className="absolute z-[2] flex justify-center"
                style={{
                  top: newTakeTop(takes.length),
                  left: laid.left,
                  width: Math.max(laid.width, 8),
                  height: NEW_TAKE_HEIGHT,
                }}
              >
                <button
                  type="button"
                  className={takeCtaClass}
                  disabled={!canShootJourney(project, journey) || preparing}
                  aria-label={newTakeActionAriaLabel(journey)}
                  onClick={onNewTake}
                >
                  {newTakeActionLabel()}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
