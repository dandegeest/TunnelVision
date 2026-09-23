import { useEffect, useState } from "react";
import { canShootJourney } from "../project/shoot";
import {
  defaultTakeIntentFromProject,
  GENERATION_INTENT_MARK,
  takeIntentTooltip,
} from "../project/generation-intent";
import {
  journeyHasStaleTakes,
  journeyTakes,
  nextTakeNumber,
  selectedTake,
  TAKE_PREVIOUS_CANONICALS_COPY,
  takeClipDurationSeconds,
  takeHasShootingFrames,
  takeMatchesCurrentCanonicals,
  takesInRow,
} from "../project/takes";
import {
  currentOutgoingStartDrop,
  formatOutgoingStartDropMae,
  formatOutgoingStartDropSsim,
  selectedTakeJoinsOutgoingStartDrop,
  selectedTakeShowsOutgoingStartDrop,
} from "../project/outgoing-start-drop";
import { requestedDurationSeconds } from "../project/shot-duration";
import { useProject } from "../project/ProjectProvider";
import { destinationById, type JourneyShot, type JourneyShotTake, type OutgoingStartDrop, type Project, type Selection } from "../project/types";
import { GenerationIntentMenu } from "../ui/GenerationIntentMenu";
import { durationBarWidth, visibleTakeBarSeconds, type LaidOutJourney } from "./geometry";
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
  TAKES_STACK_TOP,
  journeyLaneHeight,
  newTakeTop,
  showNewTakeControl,
  showTakesGutter,
  takeRowTop,
} from "./takes-layout";

const takeCtaClass =
  "h-[22px] shrink-0 cursor-pointer rounded border border-[#3a342c] text-[10px] leading-[16px] tracking-[0.12em] text-[#ece7df] hover:border-[#7a7266]";

function takeThumbnailUrl(take: JourneyShotTake, fallback?: string): string | undefined {
  return takeHasShootingFrames(take) ? take.startShootingFrame.imageUrl : fallback;
}

function TakeNumberBadge({
  number,
  stale = false,
}: {
  number: number;
  stale?: boolean;
}) {
  return (
    <span
      data-take-number={number}
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[9px] tabular-nums leading-none ${
        stale
          ? "border-[#d4b36a] bg-[#443922] text-[#e4d2a4]"
          : "border-[#3a342c] bg-[#161410] text-[#cfc6b8]"
      }`}
    >
      {number}
    </span>
  );
}

function TruncatedTakeMark() {
  return (
    <span
      className="pointer-events-none absolute inset-y-[-1px] right-[-1px] z-[1] w-3 text-[#9a8f7e]"
      aria-hidden
    >
      <svg viewBox="0 0 12 24" className="h-full w-full" preserveAspectRatio="none">
        <path d="M12 0 H5 L10 4 L2 8 L10 12 L2 16 L10 20 L5 24 H12 Z" fill="#0c0c0a" />
        <path
          d="M5 0 L10 4 L2 8 L10 12 L2 16 L10 20 L5 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="miter"
        />
      </svg>
    </span>
  );
}

function takeBarRadiusClass(first: boolean, last: boolean, truncated: boolean): string {
  if (truncated) {
    return "rounded-l border-r-0";
  }
  if (first && last) {
    return "rounded";
  }
  if (first) {
    return "rounded-l";
  }
  if (last) {
    return "rounded-r";
  }
  return "";
}

function TakeLockScores({ drop }: { drop: OutgoingStartDrop }) {
  const ssim = formatOutgoingStartDropSsim(drop.ssim);
  const mae = formatOutgoingStartDropMae(drop.mae);
  const chrome = drop.dropped
    ? "rounded-full px-1.5 py-0 text-[9px] leading-[14px] tabular-nums tracking-[0.08em] border border-[#3f5a3a] bg-[#0c140c] text-[#d7e7cf]"
    : "rounded-full px-1.5 py-0 text-[9px] leading-[14px] tabular-nums tracking-[0.08em] border border-[#d4b36a] bg-[#2a2214] text-[#e4d2a4]";
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      <span className={chrome} aria-label={`Lock SSIM ${ssim}`} title={`SSIM ${ssim}`} data-take-lock-ssim={ssim}>
        {ssim}
      </span>
      <span className={chrome} aria-label={`Lock MAE ${mae}`} title={`MAE ${mae}`} data-take-lock-mae={mae}>
        {mae}
      </span>
    </span>
  );
}

function SeamDropEdge({ side }: { side: "start" | "end" }) {
  return (
    <span
      className={`pointer-events-none absolute inset-y-[-1px] z-[4] border-[#c45c38] ${
        side === "start" ? "left-[-1px] border-l-[3px] border-dashed" : "right-[-1px] border-r-[3px] border-dashed"
      }`}
      aria-hidden
    />
  );
}

function TakeRow({
  laid,
  project,
  journey,
  take,
  selected,
  thumbSrc,
  zoom,
  rowIndex,
  first,
  last,
  onSelectTake,
  onDeleteTake,
}: {
  laid: LaidOutJourney;
  project: Project;
  journey: JourneyShot;
  take: JourneyShotTake;
  selected: boolean;
  thumbSrc?: string;
  zoom: number;
  rowIndex: number;
  first: boolean;
  last: boolean;
  onSelectTake: () => void;
  onDeleteTake?: () => void;
}) {
  const number = take.number ?? 1;
  const stale = takeMatchesCurrentCanonicals(project, journey, take) === false;
  const intentMark = take.generationIntent ? GENERATION_INTENT_MARK[take.generationIntent] : undefined;
  const durationSeconds = takeClipDurationSeconds(take, laid.endTime - laid.startTime);
  const segmentDurationSeconds = laid.endTime - laid.startTime;
  const { visibleSeconds, truncated } = visibleTakeBarSeconds(
    durationSeconds,
    segmentDurationSeconds,
    selected,
  );
  const dropStart = selectedTakeShowsOutgoingStartDrop(project, journey, take);
  const dropEnd = selectedTakeJoinsOutgoingStartDrop(project, journey, take);
  const lock = selected ? currentOutgoingStartDrop(project, journey) : undefined;
  const ring = selected
    ? "z-[3] border-[#ece7df] bg-[#1c2418] ring-2 ring-inset ring-[#ece7df] text-[#ece7df]"
    : stale
      ? "z-[2] border-dashed border-[#d4b36a] bg-[#10100c] hover:ring-1 hover:ring-inset hover:ring-[#7a7266] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#7a7266]"
      : "z-[2] border-[#3a342c] bg-[#10100c] hover:ring-1 hover:ring-inset hover:ring-[#7a7266] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#7a7266]";
  const titleParts = [
    take.generationIntent ? takeIntentTooltip(take) : undefined,
    `${durationSeconds}s`,
    truncated ? `clipped to ${visibleSeconds}s cut` : undefined,
    stale ? TAKE_PREVIOUS_CANONICALS_COPY : undefined,
    dropStart ? "starts one frame later" : undefined,
    dropEnd ? "next take starts one frame later" : undefined,
  ].filter(Boolean);
  return (
    <div
      className={`group absolute box-border flex items-center gap-1 border px-1.5 text-[#cfc6b8] ${takeBarRadiusClass(first, last, truncated)} ${ring}`}
      style={{
        top: takeRowTop(rowIndex),
        left: laid.left,
        width: durationBarWidth(visibleSeconds, zoom),
        height: TAKE_ROW_HEIGHT,
      }}
      data-canonical-stale={stale || undefined}
      data-take-duration={durationSeconds}
      data-take-truncated={truncated || undefined}
      data-outgoing-start-drop={dropStart || undefined}
      data-outgoing-start-drop-end={dropEnd || undefined}
    >
      {dropStart ? <SeamDropEdge side="start" /> : null}
      {dropEnd ? <SeamDropEdge side="end" /> : null}
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-1 text-left outline-none"
        aria-label={`Take ${number} ${journey.id}${truncated ? " truncated" : ""}${stale ? " previous canonicals" : ""}${dropStart ? " starts one frame later" : ""}${dropEnd ? " next take starts one frame later" : ""}`}
        aria-pressed={selected}
        title={titleParts.length > 0 ? titleParts.join(" · ") : undefined}
        onClick={onSelectTake}
      >
        <TakeNumberBadge number={number} stale={stale} />
        {thumbSrc ? (
          <img src={thumbSrc} alt="" className="media-contain h-[18px] w-[32px] shrink-0 rounded" />
        ) : (
          <span className="h-[18px] w-[32px] shrink-0 rounded border border-[#3a342c] bg-[#142014]" />
        )}
        {intentMark ? <span className="truncate text-[9px] tracking-[0.16em] opacity-80">{intentMark}</span> : null}
      </button>
      {lock ? <TakeLockScores drop={lock} /> : null}
      {onDeleteTake ? (
        <button
          type="button"
          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded text-[12px] leading-none text-[#9a8f7e] hover:bg-[#2a2620] hover:text-[#ece7df] ${
            selected
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          }`}
          aria-label={`Delete take ${number} ${journey.id}`}
          title="Delete this take from the project"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDeleteTake();
          }}
        >
          ×
        </button>
      ) : null}
      {truncated ? <TruncatedTakeMark /> : null}
    </div>
  );
}

export function DeleteTakeDialog({
  journeyId,
  takeNumber,
  title = "Delete take",
  copy,
  onCancel,
  onConfirm,
}: {
  journeyId?: string;
  takeNumber?: number;
  title?: string;
  copy?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const body =
    copy ??
    `Delete TAKE ${takeNumber} on ${journeyId}? This removes the take and its clip from the project.`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-take-title"
      aria-describedby="delete-take-copy"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded border border-[#3a342c] bg-[#141210] px-5 py-4 shadow-[0_18px_48px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <p
          id="delete-take-title"
          className="text-[11px] tracking-[0.16em] text-[#9a8f7e] uppercase"
        >
          {title}
        </p>
        <p id="delete-take-copy" className="mt-2 text-sm leading-6 text-[#ece7df]">
          {body}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-[#3a342c] px-3 py-1.5 text-[11px] tracking-[0.14em] text-[#9a8f7e] uppercase outline-none hover:border-[#7a7266] hover:text-[#ece7df] focus-visible:ring-1 focus-visible:ring-[#7a7266]"
            onClick={onCancel}
            autoFocus
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded border border-[#ece7df] bg-[#ece7df] px-3 py-1.5 text-[11px] tracking-[0.14em] text-[#141210] uppercase outline-none hover:bg-[#fff] focus-visible:ring-1 focus-visible:ring-[#d4b36a]"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function GeneratingTakeRow({
  laid,
  journey,
  number,
  zoom,
  durationSeconds,
  rowIndex,
  first,
  last,
}: {
  laid: LaidOutJourney;
  journey: JourneyShot;
  number: number;
  zoom: number;
  durationSeconds: number;
  rowIndex: number;
  first: boolean;
  last: boolean;
}) {
  return (
    <div
      className={`absolute z-[2] box-border flex items-center gap-1 border border-[#3a342c] bg-[#10100c] px-1.5 storyboard-generating ${takeBarRadiusClass(first, last, false)}`}
      style={{
        top: takeRowTop(rowIndex),
        left: laid.left,
        width: durationBarWidth(durationSeconds, zoom),
        height: TAKE_ROW_HEIGHT,
      }}
      aria-busy="true"
      aria-label={`Generating take ${number} ${journey.id}`}
      data-take-duration={durationSeconds}
    >
      <TakeNumberBadge number={number} />
      <span className="h-[18px] w-[32px] shrink-0 rounded border border-[#3a342c] bg-[#142014]" />
      <span className="truncate text-[9px] tracking-[0.16em] text-[#ece7df] storyboard-generating-label">
        Generating…
      </span>
    </div>
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
  const { project, shootJourney, selectTake, selectTakeRow, deleteTake, deleteTakeRow, zoom, shootingIntents } =
    useProject();
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: "take"; journeyId: string; takeId: string; number: number }
    | { kind: "row"; rowIndex: number; count: number }
    | null
  >(null);
  const laneHeight = journeyLaneHeight(projectJourneys, selection, shootingJourneyIds ?? []);
  const takeRowCount = projectJourneys.reduce(
    (max, journey) => Math.max(max, journeyTakes(journey).length),
    0,
  );
  const firstJourneyId = journeys[0]?.journeyId;
  const lastJourneyId = journeys[journeys.length - 1]?.journeyId;
  return (
    <>
    <div className="absolute inset-x-0 z-[1]" style={{ top: JOURNEY_LANE_TOP, height: laneHeight }}>
      {Array.from({ length: takeRowCount }, (_, rowIndex) => (
        <div
          key={`take-row-${rowIndex}`}
          className="absolute z-[4] flex h-7 items-center"
          style={{ top: takeRowTop(rowIndex), left: 4 }}
        >
          <button
            type="button"
            className="flex h-7 w-3.5 items-center justify-center rounded text-[#7d7466] outline-none hover:bg-[#1c1a16] hover:text-[#ece7df] focus-visible:ring-1 focus-visible:ring-[#7a7266]"
            aria-label={`Select take ${rowIndex + 1} on every segment`}
            title="Select this take on every segment"
            onClick={() => selectTakeRow(rowIndex)}
          >
            <span aria-hidden className="grid grid-cols-2 gap-[2px]">
              <span className="h-[3px] w-[3px] rounded-full bg-current" />
              <span className="h-[3px] w-[3px] rounded-full bg-current" />
              <span className="h-[3px] w-[3px] rounded-full bg-current" />
              <span className="h-[3px] w-[3px] rounded-full bg-current" />
              <span className="h-[3px] w-[3px] rounded-full bg-current" />
              <span className="h-[3px] w-[3px] rounded-full bg-current" />
            </span>
          </button>
          <button
            type="button"
            className="flex h-[18px] w-[18px] items-center justify-center rounded text-[12px] leading-none text-[#9a8f7e] outline-none hover:bg-[#2a2620] hover:text-[#ece7df] focus-visible:ring-1 focus-visible:ring-[#7a7266]"
            aria-label={`Delete take ${rowIndex + 1} on every segment`}
            title="Delete this take on every segment"
            onClick={() => {
              const count = takesInRow(project, rowIndex).length;
              if (count === 0) {
                return;
              }
              setPendingDelete({ kind: "row", rowIndex, count });
            }}
          >
            ×
          </button>
        </div>
      ))}
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
        const showTakes = showTakesGutter(takes.length, shooting);
        const showNewTake = showNewTakeControl(selection, journey, shooting);
        const startImage = destinationById(project.destinations, journey.startDestinationId)?.image;
        return (
          <div key={laid.journeyId}>
            <JourneyItem
              laid={laid}
              journey={journey}
              selected={journeyBandSelected(selection, laid.journeyId, "motion")}
              preparing={preparing}
              onSelect={() => onSelect(laid.journeyId, "motion")}
            />
            {showTakes ? (
              <div
                className="absolute flex items-center px-1.5 text-[9px] tracking-[0.16em] text-[#7d7466]"
                style={{
                  top: TAKES_STACK_TOP,
                  left: laid.left,
                  width: Math.max(laid.width, 8),
                  height: TAKES_HEADER_HEIGHT,
                }}
              >
                TAKES
                {journeyHasStaleTakes(project, journey) ? (
                  <span
                    className="ml-1 text-[#e4d2a4]"
                    title={TAKE_PREVIOUS_CANONICALS_COPY}
                    aria-label={TAKE_PREVIOUS_CANONICALS_COPY}
                  >
                    ≠
                  </span>
                ) : null}
              </div>
            ) : null}
            {takes.map((take, rowIndex) => (
              <TakeRow
                key={take.id ?? take.number}
                laid={laid}
                project={project}
                journey={journey}
                take={take}
                selected={take.id === current?.id}
                thumbSrc={takeThumbnailUrl(take, startImage)}
                zoom={zoom}
                rowIndex={rowIndex}
                first={laid.journeyId === firstJourneyId}
                last={laid.journeyId === lastJourneyId}
                onSelectTake={() => {
                  onSelect(laid.journeyId, "footage");
                  if (take.id) {
                    selectTake(journey.id, take.id);
                  }
                }}
                onDeleteTake={
                  take.id
                    ? () => {
                        if (take.id === current?.id) {
                          setPendingDelete({
                            kind: "take",
                            journeyId: journey.id,
                            takeId: take.id!,
                            number: take.number ?? 1,
                          });
                          return;
                        }
                        deleteTake(journey.id, take.id!);
                      }
                    : undefined
                }
              />
            ))}
            {shooting ? (
              <GeneratingTakeRow
                laid={laid}
                journey={journey}
                number={nextTakeNumber(takes)}
                zoom={zoom}
                durationSeconds={requestedDurationSeconds(
                  project,
                  journey,
                  shootingIntents[journey.id] ?? defaultTakeIntentFromProject(project),
                )}
                rowIndex={takes.length}
                first={laid.journeyId === firstJourneyId}
                last={laid.journeyId === lastJourneyId}
              />
            ) : null}
            {showNewTake ? (
              <div
                className="absolute z-[2] flex items-center justify-center"
                style={{
                  top: newTakeTop(takes.length),
                  left: laid.left,
                  width: Math.max(laid.width, 8),
                  height: NEW_TAKE_HEIGHT,
                }}
              >
                <GenerationIntentMenu
                  label={newTakeActionLabel()}
                  ariaLabel={newTakeActionAriaLabel(journey)}
                  defaultIntent={defaultTakeIntentFromProject(project)}
                  disabled={!canShootJourney(project, journey) || preparing}
                  buttonClass={takeCtaClass}
                  onChoose={(intent) => {
                    void shootJourney(journey.id, intent);
                  }}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
    {pendingDelete?.kind === "take" ? (
      <DeleteTakeDialog
        journeyId={pendingDelete.journeyId}
        takeNumber={pendingDelete.number}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          deleteTake(pendingDelete.journeyId, pendingDelete.takeId);
          setPendingDelete(null);
        }}
      />
    ) : pendingDelete?.kind === "row" ? (
      <DeleteTakeDialog
        title="Delete take"
        copy={`Delete this take on every segment? This removes ${pendingDelete.count} take${pendingDelete.count === 1 ? "" : "s"} and ${pendingDelete.count === 1 ? "its clip" : "their clips"} from the project.`}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          deleteTakeRow(pendingDelete.rowIndex);
          setPendingDelete(null);
        }}
      />
    ) : null}
    </>
  );
}
