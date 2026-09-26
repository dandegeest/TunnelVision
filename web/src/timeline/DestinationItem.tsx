import type { Destination } from "../project/types";
import {
  boundaryContinuityLabel,
  type BoundaryContinuity,
} from "../project/boundary-continuity";
import { DESTINATION_THUMB_PX, type LaidOutOccurrence } from "./geometry";

function seamTone(continuity: BoundaryContinuity): string {
  switch (continuity.classification) {
    case "strong":
      return "text-[#9a8f7e]";
    case "good":
      return "text-[#b8c9a8]";
    case "review":
      return "text-[#d4b36a]";
    case "mismatch":
      return "text-[#c45c38]";
  }
}

export function DestinationItem({
  occurrence,
  destination,
  selected,
  continuity,
  generating = false,
  planning = false,
  constructionError,
  onRetry,
  onSelect,
}: {
  occurrence: LaidOutOccurrence;
  destination?: Destination;
  selected: boolean;
  continuity?: BoundaryContinuity;
  generating?: boolean;
  /** Director PLAN JOURNEY is filling this empty FPO beat. */
  planning?: boolean;
  constructionError?: string;
  onRetry?: () => void;
  onSelect: () => void;
}) {
  const image = destination?.image ?? occurrence.image;
  const fpo = Boolean(occurrence.fpo) || !image;
  const label = destination?.label ?? occurrence.label;
  const loopReturn = occurrence.destinationId === "A" && occurrence.occurrenceIndex > 0;
  const failed = Boolean(constructionError) && !generating;
  const planningEmpty = planning && fpo && !generating;
  const live = generating || planningEmpty;
  const ring = failed || occurrence.arrivalBlocked
    ? "ring-2 ring-[#c45c38]"
    : selected
      ? "ring-2 ring-[#ece7df]"
      : "ring-1 ring-[#3a342c] group-hover:ring-[#7a7266] group-focus-visible:ring-[#7a7266]";
  const matchLabel = continuity ? boundaryContinuityLabel(continuity.classification) : null;
  const ariaBits = [
    loopReturn ? `Destination ${label} again` : fpo ? `Plan destination ${label}` : `Destination ${label}`,
    continuity ? `boundary match ${matchLabel}` : null,
    continuity?.rasterMismatch ? "output raster mismatch" : null,
  ].filter(Boolean);

  return (
    <div
      className="group absolute top-0 -translate-x-1/2 text-left"
      style={{ left: occurrence.xCenter, width: DESTINATION_THUMB_PX }}
    >
      <button
        type="button"
        className="block w-full text-left outline-none"
        onClick={onSelect}
        aria-label={ariaBits.join(", ")}
        aria-busy={live || undefined}
      >
      <span className="mb-1 flex h-5 items-baseline justify-center gap-1 border-b border-[#3a342c]">
        <span
          className={`truncate text-center text-[11px] tracking-[0.2em] text-[#ece7df]${
            live ? " storyboard-generating-label" : ""
          }`}
        >
          {label}
        </span>
        {loopReturn ? (
          <span className="shrink-0 text-[10px] tracking-[0.08em] text-[#9a8f7e]">(loop)</span>
        ) : null}
      </span>
      <span className="relative block">
        {fpo ? (
          <span
            className={`storyboard-fpo relative block aspect-video w-full overflow-hidden rounded ${ring}${
              planningEmpty ? " storyboard-generating" : ""
            }`}
          />
        ) : (
          <img
            src={image}
            alt=""
            className={`media-contain aspect-video w-full rounded ${ring}`}
          />
        )}
        {generating ? (
          <span className="storyboard-generating pointer-events-none absolute inset-0 overflow-hidden rounded" aria-hidden />
        ) : null}
        {failed ? (
          <span className="pointer-events-none absolute inset-0 rounded bg-[#2a1610]/72" aria-hidden />
        ) : null}
        {continuity && matchLabel ? (
          <span
            className={`pointer-events-none absolute inset-x-0 bottom-0 rounded-b bg-[#0c0b0a]/75 px-1 py-0.5 text-center text-[8px] tracking-[0.12em] uppercase ${seamTone(continuity)}`}
          >
            {matchLabel}
            {continuity.rasterMismatch ? " · raster" : ""}
          </span>
        ) : null}
      </span>
      </button>
      {failed && onRetry ? (
        <button
          type="button"
          className="absolute bottom-1 left-1/2 z-[2] -translate-x-1/2 rounded border border-[#f0c2a8] bg-[#2a1610] px-1.5 py-0.5 text-[9px] tracking-[0.14em] text-[#f0c2a8] uppercase outline-none hover:bg-[#3a2018] focus-visible:ring-1 focus-visible:ring-[#f0c2a8]"
          aria-label={`Retry destination ${occurrence.destinationId}`}
          title={constructionError}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRetry();
          }}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
