import { useEffect, useMemo, useRef } from "react";
import { boundaryContinuitiesForProject } from "../project/boundary-continuity";
import { useProject } from "../project/ProjectProvider";
import { layoutShootTimeline, selectShootOccurrence } from "./shoot-layout";
import { timeToX } from "./geometry";
import { DestinationsLane } from "./DestinationsLane";
import { GridMarks } from "./GridMarks";
import { JourneyLane } from "./JourneyLane";
import { JourneyPaceLane } from "./JourneyPaceLane";
import { Playhead } from "./Playhead";

export function Timeline() {
  const {
    project,
    zoom,
    playheadTime,
    selection,
    select,
    openStoryboardInPlan,
    setStoryboardReelId,
    assessingJourneyIds,
    shootingJourneyIds,
    constructingBeatId,
  } = useProject();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const layout = useMemo(() => layoutShootTimeline(project, zoom), [project, zoom]);
  const continuities = useMemo(() => boundaryContinuitiesForProject(project), [project]);
  const playheadX = timeToX(playheadTime, zoom);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const x =
      selection.kind === "destination"
        ? layout.occurrences.find((item) => item.occurrenceIndex === selection.occurrenceIndex)?.xCenter
        : selection.kind === "journey"
          ? layout.journeys.find((item) => item.journeyId === selection.journeyId)?.left
          : undefined;
    if (x === undefined) {
      return;
    }
    const target = x - scroller.clientWidth / 2;
    scroller.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [layout.journeys, layout.occurrences, selection]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#10100c]">
      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="relative h-full" style={{ width: layout.trackWidth }}>
          <GridMarks layout={layout} zoom={zoom} />
          <div className="absolute inset-x-0 top-0 z-[1] h-7 border-b border-[#2a2620] text-[10px] tracking-[0.14em] text-[#7d7466]">
            {layout.occurrences.map((occurrence) => (
              <span
                key={`tick-${occurrence.occurrenceIndex}`}
                className="absolute top-1.5 -translate-x-1/2"
                style={{ left: occurrence.xCenter }}
              >
                {occurrence.timeSeconds}s
              </span>
            ))}
          </div>
          <DestinationsLane
            occurrences={layout.occurrences}
            destinations={project.destinations}
            selection={selection}
            continuities={continuities}
            constructingBeatId={constructingBeatId}
            storyboard={project.storyboard}
            onSelect={(occurrenceIndex) => {
              const occurrence = layout.occurrences.find((item) => item.occurrenceIndex === occurrenceIndex);
              selectShootOccurrence(occurrence, {
                select,
                openStoryboardInPlan,
                openStoryboardReel: setStoryboardReelId,
                selected:
                  selection.kind === "destination" &&
                  selection.occurrenceIndex === occurrenceIndex,
              });
            }}
          />
          <JourneyPaceLane journeys={layout.journeys} projectJourneys={project.journeys} />
          <JourneyLane
            journeys={layout.journeys}
            projectJourneys={project.journeys}
            selection={selection}
            preparingJourneyIds={assessingJourneyIds}
            shootingJourneyIds={shootingJourneyIds}
            onSelect={(journeyId, band) => select({ kind: "journey", journeyId, band })}
          />
          <Playhead x={playheadX} />
        </div>
      </div>
    </div>
  );
}
