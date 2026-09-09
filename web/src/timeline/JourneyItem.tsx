import type { JourneyShot } from "../project/types";
import {
  journeySegmentAriaLabel,
  journeySegmentCaption,
  journeyTileAction,
  locomotionPaceLabel,
} from "../project/cinematographer";
import type { LaidOutJourney } from "./geometry";

export function journeySegmentTone(journey: JourneyShot): string {
  const fill = journey.status === "rendered" ? "bg-[#142014]" : "bg-transparent";
  const shootability = journey.cinematographer?.shootability;
  if (!shootability) {
    return journey.status === "rendered"
      ? `border border-[#3f5a3a] ${fill} text-[#d7e7cf]`
      : `border border-[#3a342c] ${fill} text-[#cfc6b8]`;
  }
  switch (shootability) {
    case "shootable":
      return `border-2 border-[#3f5a3a] ${fill} text-[#d7e7cf]`;
    case "needs_review":
      return `border-2 border-[#d4b36a] border-dashed ${fill} text-[#e4d2a4]`;
    case "not_shootable":
      return `border-2 border-[#c45c38] ${fill} text-[#f0c2a8]`;
  }
}

export function JourneyItem({
  laid,
  journey,
  selected,
  preparing = false,
  shooting = false,
  canBlock = false,
  canShoot = false,
  onSelect,
  onBlock,
  onShoot,
}: {
  laid: LaidOutJourney;
  journey: JourneyShot;
  selected: boolean;
  preparing?: boolean;
  shooting?: boolean;
  canBlock?: boolean;
  canShoot?: boolean;
  onSelect: () => void;
  onBlock?: () => void;
  onShoot?: () => void;
}) {
  const tone = journeySegmentTone(journey);
  const ring = selected
    ? "ring-2 ring-[#ece7df]"
    : "hover:ring-1 hover:ring-[#7a7266] focus-visible:ring-1 focus-visible:ring-[#7a7266]";
  const caption = journeySegmentCaption(journey);
  const ariaLabel = journeySegmentAriaLabel(journey);
  const busy = preparing || shooting;
  const next = selected ? journeyTileAction(journey) : null;
  const showBlock = next === "block" && canBlock;
  const showShoot = next === "shoot";
  const actionDisabled = showBlock
    ? preparing || shooting
    : showShoot
      ? !canShoot || shooting
      : true;

  return (
    <div
      className={`absolute top-1 box-border h-12 overflow-hidden rounded ${tone} ${ring}${
        busy ? " storyboard-generating" : ""
      }`}
      style={{ left: laid.left, width: Math.max(laid.width, 8) }}
      aria-busy={busy || undefined}
      title={
        journey.cinematographer
          ? `${journey.cinematographer.summary} · ${locomotionPaceLabel(journey.cinematographer.pace)}`
          : undefined
      }
    >
      <button
        type="button"
        className="absolute inset-0 z-[1] px-2 text-left text-xs tracking-[0.12em] outline-none"
        onClick={onSelect}
        aria-label={ariaLabel}
        aria-pressed={selected}
      >
        <span className="relative z-[1] block truncate pt-1 pr-14">
          <span className="truncate">{journey.id}</span>
        </span>
        <span
          className={`relative z-[1] block truncate pr-14 text-[10px] opacity-80${
            busy ? " storyboard-generating-label" : ""
          }`}
        >
          {caption}
        </span>
      </button>
      {showBlock || showShoot ? (
        <button
          type="button"
          className="absolute top-1 right-1 z-[2] h-6 rounded border border-[#3a342c] bg-[#12100d]/80 px-1.5 text-[10px] tracking-[0.14em] text-[#ece7df] uppercase outline-none hover:border-[#7a7266] focus-visible:border-[#ece7df] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={actionDisabled}
          aria-label={showBlock ? `Block ${journey.id}` : `Shoot ${journey.id}`}
          onClick={(event) => {
            event.stopPropagation();
            if (showBlock) {
              onBlock?.();
              return;
            }
            onShoot?.();
          }}
        >
          {showBlock ? (preparing ? "Blocking…" : "Block") : shooting ? "Shooting…" : "Shoot"}
        </button>
      ) : null}
    </div>
  );
}
