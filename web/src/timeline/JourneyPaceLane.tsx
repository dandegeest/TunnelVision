import type { JourneyShot } from "../project/types";
import { locomotionPaceLabel } from "../project/cinematographer";
import { effectiveJourneyPace } from "../project/journey-overrides";
import { useProject } from "../project/ProjectProvider";
import { intentDurationSeconds } from "../project/shot-duration";
import { journeyThumbGutter, type LaidOutJourney } from "./geometry";
import { JourneyPaceMark } from "./JourneyPaceMark";

export function JourneyPaceLane({
  journeys,
  projectJourneys,
}: {
  journeys: LaidOutJourney[];
  projectJourneys: JourneyShot[];
}) {
  const { project } = useProject();
  return (
    <div className="pointer-events-none absolute inset-x-0 top-7 z-[2] h-[100px]">
      {journeys.map((laid) => {
        const journey = projectJourneys.find((item) => item.id === laid.journeyId);
        const pace = journey ? effectiveJourneyPace(journey, project) : undefined;
        const gutter = journeyThumbGutter(laid);
        if (!journey || !pace || !gutter) {
          return null;
        }
        const intentSeconds = intentDurationSeconds(project, journey);
        const title = intentSeconds === undefined
          ? locomotionPaceLabel(pace)
          : `${locomotionPaceLabel(pace)} · ${intentSeconds}`;
        return (
          <span
            key={laid.journeyId}
            className="pointer-events-auto absolute top-6 bottom-0 flex items-center justify-center text-[#cfc6b8]"
            style={{ left: gutter.left, width: gutter.width }}
            data-journey-pace={pace}
            data-pace-gutter={journey.id}
            data-pace-desired-duration={intentSeconds}
            title={title}
            aria-hidden
          >
            <span className="inline-flex flex-col items-center gap-0.5">
              {intentSeconds !== undefined ? (
                <span
                  className="inline-flex h-[13px] min-w-[13px] items-center justify-center rounded-full bg-[#1c1810] px-[4px] text-[8px] leading-none tabular-nums text-[#d4b36a] ring-1 ring-[#d4b36a]"
                  data-pace-duration-mark={intentSeconds}
                >
                  {intentSeconds}
                </span>
              ) : null}
              <JourneyPaceMark pace={pace} />
            </span>
          </span>
        );
      })}
    </div>
  );
}
