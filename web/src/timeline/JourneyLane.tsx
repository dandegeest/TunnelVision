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
  unshotClipDurationSeconds,
} from "../project/takes";
import { useProject } from "../project/ProjectProvider";
import { destinationById, type JourneyShot, type JourneyShotTake, type Project, type Selection } from "../project/types";
import { GenerationIntentMenu } from "../ui/GenerationIntentMenu";
import { durationBarWidth, type LaidOutJourney } from "./geometry";
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

function TakeRow({
  laid,
  project,
  journey,
  take,
  selected,
  thumbSrc,
  zoom,
  rowIndex,
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
  onSelectTake: () => void;
  onDeleteTake?: () => void;
}) {
  const number = take.number ?? 1;
  const stale = takeMatchesCurrentCanonicals(project, journey, take) === false;
  const intentMark = take.generationIntent ? GENERATION_INTENT_MARK[take.generationIntent] : undefined;
  const durationSeconds = takeClipDurationSeconds(take, laid.endTime - laid.startTime);
  const ring = selected
    ? "z-[3] border-[#ece7df] bg-[#1c2418] ring-2 ring-inset ring-[#ece7df] text-[#ece7df]"
    : stale
      ? "z-[2] border-dashed border-[#d4b36a] bg-[#10100c] hover:ring-1 hover:ring-inset hover:ring-[#7a7266] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#7a7266]"
      : "z-[2] border-[#3a342c] bg-[#10100c] hover:ring-1 hover:ring-inset hover:ring-[#7a7266] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#7a7266]";
  const titleParts = [
    take.generationIntent ? takeIntentTooltip(take) : undefined,
    `${durationSeconds}s`,
    stale ? TAKE_PREVIOUS_CANONICALS_COPY : undefined,
  ].filter(Boolean);
  return (
    <div
      className={`group absolute box-border flex items-center gap-1 rounded border px-1.5 text-[#cfc6b8] ${ring}`}
      style={{
        top: takeRowTop(rowIndex),
        left: laid.left,
        width: durationBarWidth(durationSeconds, zoom),
        height: TAKE_ROW_HEIGHT,
      }}
      data-canonical-stale={stale || undefined}
      data-take-duration={durationSeconds}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-1 text-left outline-none"
        aria-label={`Take ${number} ${journey.id}${stale ? " previous canonicals" : ""}`}
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
    </div>
  );
}

export function DeleteTakeDialog({
  journeyId,
  takeNumber,
  onCancel,
  onConfirm,
}: {
  journeyId: string;
  takeNumber: number;
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
          Delete take
        </p>
        <p id="delete-take-copy" className="mt-2 text-sm leading-6 text-[#ece7df]">
          Delete TAKE {takeNumber} on {journeyId}? This removes the take and its clip from the
          project.
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
}: {
  laid: LaidOutJourney;
  journey: JourneyShot;
  number: number;
  zoom: number;
  durationSeconds: number;
  rowIndex: number;
}) {
  return (
    <div
      className="absolute z-[2] box-border flex items-center gap-1 rounded border border-[#3a342c] bg-[#10100c] px-1.5 storyboard-generating"
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
  const { project, shootJourney, selectTake, deleteTake, zoom } = useProject();
  const [pendingDelete, setPendingDelete] = useState<{
    journeyId: string;
    takeId: string;
    number: number;
  } | null>(null);
  const laneHeight = journeyLaneHeight(projectJourneys, selection, shootingJourneyIds ?? []);
  const generatingDuration = unshotClipDurationSeconds(project);
  return (
    <>
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
                durationSeconds={generatingDuration}
                rowIndex={takes.length}
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
    {pendingDelete ? (
      <DeleteTakeDialog
        journeyId={pendingDelete.journeyId}
        takeNumber={pendingDelete.number}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          deleteTake(pendingDelete.journeyId, pendingDelete.takeId);
          setPendingDelete(null);
        }}
      />
    ) : null}
    </>
  );
}
