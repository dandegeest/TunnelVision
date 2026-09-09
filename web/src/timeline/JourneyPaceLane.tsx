import type { JourneyShot } from "../project/types";
import { locomotionPaceLabel } from "../project/cinematographer";
import { journeyThumbGutter, type LaidOutJourney } from "./geometry";
import { JourneyPaceMark } from "./JourneyPaceMark";

export function JourneyPaceLane({
  journeys,
  projectJourneys,
}: {
  journeys: LaidOutJourney[];
  projectJourneys: JourneyShot[];
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-7 z-[2] h-[100px]">
      {journeys.map((laid) => {
        const journey = projectJourneys.find((item) => item.id === laid.journeyId);
        const pace = journey?.cinematographer?.pace;
        const gutter = journeyThumbGutter(laid);
        if (!journey || !pace || !gutter) {
          return null;
        }
        return (
          <span
            key={laid.journeyId}
            className="pointer-events-auto absolute top-6 bottom-0 flex items-center justify-center text-[#cfc6b8]"
            style={{ left: gutter.left, width: gutter.width }}
            data-journey-pace={pace}
            data-pace-gutter={journey.id}
            title={locomotionPaceLabel(pace)}
            aria-hidden
          >
            <JourneyPaceMark pace={pace} />
          </span>
        );
      })}
    </div>
  );
}
