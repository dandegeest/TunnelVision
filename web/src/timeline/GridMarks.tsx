import type { TimelineLayout } from "./geometry";
import { BASE_PX_PER_SECOND, timeToX, wholeSecondMarkTimes } from "./geometry";

export function GridMarks({ layout, zoom }: { layout: TimelineLayout; zoom: number }) {
  const boundaryTimes = new Set(layout.occurrences.map((occurrence) => occurrence.timeSeconds));
  const seconds = wholeSecondMarkTimes(layout.totalDuration).filter((time) => !boundaryTimes.has(time));

  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      {seconds.map((time) => (
        <span
          key={`second-${time}`}
          className="absolute top-7 bottom-0 border-l border-dashed border-[#ece7df]/10"
          style={{ left: timeToX(time, zoom, BASE_PX_PER_SECOND, layout.padPx) }}
        />
      ))}
      {layout.occurrences.map((occurrence) => (
        <span
          key={`boundary-${occurrence.occurrenceIndex}`}
          className="absolute top-7 bottom-0 w-px bg-[#ece7df]/25"
          style={{ left: occurrence.xCenter }}
        />
      ))}
    </div>
  );
}
