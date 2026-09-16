import { canShootJourney } from "../project/shoot";
import {
  defaultTakeIntentFromProject,
  GENERATION_INTENT_MARK,
  takeIntentTooltip,
} from "../project/generation-intent";
import {
  journeyHasStaleTakes,
  journeyTakes,
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
  onSelectTake,
}: {
  laid: LaidOutJourney;
  project: Project;
  journey: JourneyShot;
  take: JourneyShotTake;
  selected: boolean;
  thumbSrc?: string;
  zoom: number;
  onSelectTake: () => void;
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
    <button
      type="button"
      className={`absolute box-border flex items-center gap-1 rounded border px-1.5 text-left text-[#cfc6b8] outline-none ${ring}`}
      style={{
        top: takeRowTop(number - 1),
        left: laid.left,
        width: durationBarWidth(durationSeconds, zoom),
        height: TAKE_ROW_HEIGHT,
      }}
      aria-label={`Take ${number} ${journey.id}${stale ? " previous canonicals" : ""}`}
      aria-pressed={selected}
      data-canonical-stale={stale || undefined}
      data-take-duration={durationSeconds}
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
  );
}

function GeneratingTakeRow({
  laid,
  journey,
  number,
  zoom,
  durationSeconds,
}: {
  laid: LaidOutJourney;
  journey: JourneyShot;
  number: number;
  zoom: number;
  durationSeconds: number;
}) {
  return (
    <div
      className="absolute z-[2] box-border flex items-center gap-1 rounded border border-[#3a342c] bg-[#10100c] px-1.5 storyboard-generating"
      style={{
        top: takeRowTop(number - 1),
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
  const { project, shootJourney, selectTake, zoom } = useProject();
  const laneHeight = journeyLaneHeight(projectJourneys, selection, shootingJourneyIds ?? []);
  const generatingDuration = unshotClipDurationSeconds(project);
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
            {takes.map((take) => (
              <TakeRow
                key={take.id ?? take.number}
                laid={laid}
                project={project}
                journey={journey}
                take={take}
                selected={take.id === current?.id}
                thumbSrc={takeThumbnailUrl(take, startImage)}
                zoom={zoom}
                onSelectTake={() => {
                  onSelect(laid.journeyId, "footage");
                  if (take.id) {
                    selectTake(journey.id, take.id);
                  }
                }}
              />
            ))}
            {shooting ? (
              <GeneratingTakeRow
                laid={laid}
                journey={journey}
                number={takes.length + 1}
                zoom={zoom}
                durationSeconds={generatingDuration}
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
  );
}
