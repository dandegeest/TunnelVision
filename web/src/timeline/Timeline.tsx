import { useEffect, useMemo, useRef } from "react";
import { useProject } from "../project/ProjectProvider";
import { layoutTimeline, timeToX } from "./geometry";
import { DestinationsLane } from "./DestinationsLane";
import { GridMarks } from "./GridMarks";
import { JourneyLane } from "./JourneyLane";
import { Playhead } from "./Playhead";

export function Timeline() {
  const { project, zoom, playheadTime, selection, select } = useProject();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const layout = useMemo(
    () => layoutTimeline(project.destinations, project.journeys, zoom),
    [project.destinations, project.journeys, zoom],
  );
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
            onSelect={(occurrenceIndex, destinationId) =>
              select({ kind: "destination", destinationId, occurrenceIndex })
            }
          />
          <JourneyLane
            journeys={layout.journeys}
            projectJourneys={project.journeys}
            selection={selection}
            onSelect={(journeyId) => select({ kind: "journey", journeyId })}
          />
          <Playhead x={playheadX} />
        </div>
      </div>
    </div>
  );
}
