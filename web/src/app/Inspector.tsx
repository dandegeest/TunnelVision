import { useMemo, useState, type ReactNode } from "react";
import {
  boundaryContinuitiesForProject,
  boundaryContinuityAtSeam,
  boundaryContinuityLabel,
  formatRaster,
  type BoundaryContinuity,
} from "../project/boundary-continuity";
import { ARRIVAL_BLOCKED_COPY, journeyIsPlayable } from "../project/policy";
import { canAssessJourney, cinematographerScoreTone, locomotionPaceLabel } from "../project/cinematographer";
import { effectiveJourneyPace } from "../project/journey-overrides";
import { LOCOMOTION_PACES, type LocomotionPace } from "../../../media/src/cinematographer/shooting-prompt.ts";
import { OptionMenu } from "../ui/OptionMenu";
import { canReshootDestinationFrame } from "../project/destination";
import { defaultTakeIntentFromProject, takeIntentTooltip, type GenerationIntent } from "../project/generation-intent";
import { canShootJourney } from "../project/shoot";
import {
  durationModeFromProject,
  intentDurationSeconds,
  MAX_FIXED_DURATION_SECONDS,
  MIN_FIXED_DURATION_SECONDS,
  unshotDurationSeconds,
} from "../project/shot-duration";
import {
  selectedTake,
  TAKE_PREVIOUS_CANONICALS_COPY,
  takeDisplayLabel,
  takeHasShootingFrames,
  takeMatchesCurrentCanonicals,
} from "../project/takes";
import { useProject } from "../project/ProjectProvider";
import { destinationById, storyboardFrameForDestination, type CinematographerAssessment, type JourneyShotTake, type Project, type ShootingFrameRef } from "../project/types";
import { layoutShootTimeline, occurrenceForJourneyEndpoint, selectShootOccurrence } from "../timeline/shoot-layout";
import { videoModelDisplayLabel } from "../../../media/src/replicate/video-models.ts";
import { DestinationInspectorFields, type DestinationInspectorPane } from "./DestinationInspector";
import { ShootingPromptText } from "./ShootingPromptText";
import { CamotionDiagnosticPanel } from "./CamotionDiagnostic";
import { camotionRecordsCopyText, camotionRecordsForDestination, camotionRecordsForJourney } from "../project/camotion-diagnostics";
import { PanelHeader } from "./PanelHeader";
import { InspectorCopyDisclosure, InspectorPaneNav } from "./InspectorPanes";
import { GenerationIntentMenu } from "../ui/GenerationIntentMenu";
import { JourneyPaceMark } from "../timeline/JourneyPaceMark";
import { newTakeActionLabel } from "../timeline/JourneyItem";

export function InspectorToggle({ compact = false }: { compact?: boolean } = {}) {
  const { inspectorOpen, setInspectorOpen } = useProject();
  const label = inspectorOpen ? "Hide inspector" : "Show inspector";
  return (
    <button
      type="button"
      aria-pressed={inspectorOpen}
      aria-controls="shoot-inspector"
      aria-label="Inspector"
      title={label}
      onClick={() => setInspectorOpen(!inspectorOpen)}
      className={
        compact
          ? "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#9a8f7e] outline-none hover:text-[#cfc6b8] focus-visible:text-[#ece7df] focus-visible:ring-1 focus-visible:ring-[#7a7266]"
          : `flex h-7 w-7 shrink-0 items-center justify-center rounded border outline-none ${
              inspectorOpen
                ? "border-[#ece7df] text-[#ece7df]"
                : "border-[#3a342c] text-[#9a8f7e] hover:border-[#7a7266] hover:text-[#cfc6b8]"
            }`
      }
    >
      <svg viewBox="0 0 12 12" className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden>
        <rect
          x="1.6"
          y="2.1"
          width="8.8"
          height="7.8"
          rx="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <path d="M7.3 2.1v7.8" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    </button>
  );
}

function InspectorShell({ title = "Inspector", children }: { title?: string; children: ReactNode }) {
  return (
    <aside
      id="shoot-inspector"
      className="flex h-full min-h-0 flex-col border-l border-[#2a2620] bg-[#12100d] text-sm"
      aria-label="Inspector"
    >
      <PanelHeader className="inspector-header" title={title}>
        <InspectorToggle />
      </PanelHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">{children}</div>
    </aside>
  );
}

export function Inspector() {
  const {
    project,
    selection,
    cinematographerError,
    retryMotionPlan,
    shootJourney,
    shootError,
    constructingBeatId,
    assessingJourneyIds,
    shootingJourneyIds,
    debugOn,
    setDestinationPlan,
    setComposerDraft,
    reshootDestination,
    setStoryboardReelId,
    select,
    openStoryboardInPlan,
  } = useProject();
  const layout = useMemo(() => layoutShootTimeline(project, 1), [project]);
  const continuities = useMemo(() => boundaryContinuitiesForProject(project), [project]);
  const [destinationPane, setDestinationPane] = useState<DestinationInspectorPane>("source");
  const [motionPane, setMotionPane] = useState<"motion" | "details">("motion");
  const destSelectionKey =
    selection.kind === "destination" ? `${selection.destinationId}:${selection.occurrenceIndex}` : "";
  const shootEmpty = layout.occurrences.length === 0;

  if (shootEmpty) {
    return (
      <InspectorShell>
        <p className="text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Journey</p>
        <p className="text-[#cfc6b8]">
          Nothing is ready to shoot until the journey has actual adjacent destinations.
        </p>
      </InspectorShell>
    );
  }

  if (selection.kind === "storyboard") {
    return <InspectorShell>Nothing selected.</InspectorShell>;
  }

  if (selection.kind === "destination") {
    const destination = destinationById(project.destinations, selection.destinationId);
    const occurrence = layout.occurrences.find(
      (item) => item.occurrenceIndex === selection.occurrenceIndex,
    );
    const inbound = occurrence?.inboundJourneyId
      ? project.journeys.find((journey) => journey.id === occurrence.inboundJourneyId)
      : null;
    const continuity = occurrence
      ? boundaryContinuityAtSeam(
          continuities,
          occurrence.destinationId,
          occurrence.inboundJourneyId,
          occurrence.outboundJourneyId,
        )
      : undefined;
    const blockedArrival = Boolean(occurrence?.arrivalBlocked);
    const frame = destination
      ? storyboardFrameForDestination(project.storyboard, destination.id)
      : undefined;
    const canReshoot = frame ? canReshootDestinationFrame(project, frame) : false;
    const reshooting = Boolean(frame && constructingBeatId === frame.id);
    const camotionRecords = camotionRecordsForDestination(
      project,
      selection.destinationId,
      occurrence?.inboundJourneyId ?? null,
      occurrence?.outboundJourneyId ?? null,
    );

    return (
      <InspectorShell title="Inspector - Destination">
        {frame ? (
          <DestinationInspectorFields
            key={destSelectionKey}
            frame={frame}
            project={project}
            image={destination?.image}
            label={destination?.label ?? selection.destinationId}
            banner={
              blockedArrival ? (
                <p className="rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-[#f0c2a8]">
                  {ARRIVAL_BLOCKED_COPY} The problem is the inbound journey
                  {inbound ? ` ${inbound.id}` : ""}, not destination {destination?.label} itself.
                </p>
              ) : null
            }
            afterFields={continuity ? <BoundaryContinuityDetail continuity={continuity} /> : null}
            onPlanChange={(next) => setDestinationPlan(frame.id, next)}
            onStoryChange={setComposerDraft}
            camotionRecords={camotionRecords}
            canReshoot={canReshoot}
            reshooting={reshooting}
            debugOn={debugOn}
            pane={destinationPane}
            onPaneChange={setDestinationPane}
            onOpenReel={frame.image ? () => setStoryboardReelId(frame.id) : undefined}
            onReshoot={() => {
              void reshootDestination(frame.id);
            }}
          />
        ) : (
          <>
            <h2 className="text-2xl">{destination?.label ?? selection.destinationId}</h2>
            {destination ? (
              <img src={destination.image} alt="" className="media-contain aspect-video w-full rounded" />
            ) : null}
          </>
        )}
      </InspectorShell>
    );
  }

  const journey = project.journeys.find((item) => item.id === selection.journeyId);
  if (!journey || selection.kind !== "journey") {
    return <InspectorShell>Nothing selected.</InspectorShell>;
  }

  const playable = journeyIsPlayable(journey);
  const assessment = journey.motionPlan?.cinematographer ?? journey.cinematographer;
  const canAssess = canAssessJourney(project, journey);
  const assessing = assessingJourneyIds.includes(journey.id);
  const motionPlanError = journey.motionPlanError ?? (canAssess && !assessment ? cinematographerError : null);
  const take = selectedTake(journey);
  const motionSource = journey.motionPlan ?? (takeHasShootingFrames(take) ? take : undefined);
  const startDestination = destinationById(project.destinations, journey.startDestinationId);
  const endDestination = journey.endDestinationId
    ? destinationById(project.destinations, journey.endDestinationId)
    : undefined;
  const motion = selection.band === "motion";
  const motionRecords = camotionRecordsForJourney(project, journey.id);
  const segmentHeading = `${startDestination?.label ?? journey.startDestinationId}→${endDestination?.label ?? journey.endDestinationId ?? "?"}`;
  const footageHeading = take ? `${segmentHeading} · ${takeDisplayLabel(take)}` : segmentHeading;
  const effectivePrompt = take?.effectivePrompt ?? motionSource?.effectivePrompt;
  const segmentPromptAddition =
    take?.segmentPromptAddition ?? motionSource?.segmentPromptAddition ?? assessment?.segmentPromptAddition;
  const startLabel = startDestination?.label ?? journey.startDestinationId;
  const endLabel = endDestination?.label ?? journey.endDestinationId ?? "?";
  const selectEndpoint = (endpoint: "start" | "end", pane: DestinationInspectorPane) => {
    setDestinationPane(pane);
    const occurrence = occurrenceForJourneyEndpoint(layout.occurrences, journey.id, endpoint);
    selectShootOccurrence(occurrence, {
      select,
      openStoryboardInPlan,
    });
  };
  return (
    <InspectorShell title={motion ? "Inspector - Motion" : "Inspector - Take"}>
      <h2 className="text-2xl">{motion ? segmentHeading : footageHeading}</h2>
      {motion ? (
        <MotionInspectorFields
          journeyId={journey.id}
          startDestination={startDestination}
          endDestination={endDestination}
          assessment={assessment}
          assessing={assessing}
          canAssess={canAssess}
          motionPlanError={motionPlanError}
          onRetry={() => {
            void retryMotionPlan(journey.id);
          }}
          motionSource={motionSource}
          motionRecords={motionRecords}
          effectivePrompt={effectivePrompt}
          segmentPromptAddition={segmentPromptAddition}
          project={project}
          debugOn={debugOn}
          startLabel={startLabel}
          endLabel={endLabel}
          pane={motionPane}
          onPaneChange={setMotionPane}
          onSelectStart={() => selectEndpoint("start", "motion")}
          onSelectEnd={() => selectEndpoint("end", "motion")}
          onSelectCanonicalStart={() => selectEndpoint("start", "source")}
          onSelectCanonicalEnd={() => selectEndpoint("end", "source")}
        />
      ) : (
        <TakeInspector
          journeyId={journey.id}
          take={take}
          shootingFrames={takeHasShootingFrames(take) ? take : !take && journey.motionPlan ? journey.motionPlan : undefined}
          assessment={assessment}
          effectivePrompt={effectivePrompt}
          segmentPromptAddition={segmentPromptAddition}
          pace={take?.pace ?? assessment?.pace}
          shootError={shootError ?? journey.shootError}
          canShoot={canShootJourney(project, journey)}
          shooting={shootingJourneyIds.includes(journey.id)}
          debugOn={debugOn}
          playable={playable}
          startLabel={startLabel}
          endLabel={endLabel}
          onSelectStart={() => selectEndpoint("start", "motion")}
          onSelectEnd={() => selectEndpoint("end", "motion")}
          onNewTake={(intent) => {
            void shootJourney(journey.id, intent);
          }}
        />
      )}
    </InspectorShell>
  );
}

const motionPanes = [
  { id: "motion" as const, label: "Motion" },
  { id: "details" as const, label: "Details" },
];

function MotionInspectorFields({
  journeyId,
  startDestination,
  endDestination,
  assessment,
  assessing,
  canAssess,
  motionPlanError,
  onRetry,
  motionSource,
  motionRecords,
  effectivePrompt,
  segmentPromptAddition,
  project,
  debugOn,
  startLabel,
  endLabel,
  onSelectStart,
  onSelectEnd,
  onSelectCanonicalStart,
  onSelectCanonicalEnd,
  pane: paneProp,
  onPaneChange,
}: {
  journeyId: string;
  startDestination?: { label: string; image?: string };
  endDestination?: { label: string; image?: string };
  assessment?: CinematographerAssessment;
  assessing: boolean;
  canAssess: boolean;
  motionPlanError?: string | null;
  onRetry: () => void;
  motionSource?: { startShootingFrame: ShootingFrameRef; endShootingFrame: ShootingFrameRef };
  motionRecords: ReturnType<typeof camotionRecordsForJourney>;
  effectivePrompt?: string;
  segmentPromptAddition?: string;
  project: Pick<Project, "destinations" | "journeys">;
  debugOn: boolean;
  startLabel: string;
  endLabel: string;
  onSelectStart: () => void;
  onSelectEnd: () => void;
  onSelectCanonicalStart: () => void;
  onSelectCanonicalEnd: () => void;
  pane?: "motion" | "details";
  onPaneChange?: (pane: "motion" | "details") => void;
}) {
  const [localPane, setLocalPane] = useState<"motion" | "details">("motion");
  const pane = paneProp ?? localPane;
  const setPane = (next: "motion" | "details") => {
    if (paneProp === undefined) {
      setLocalPane(next);
    }
    onPaneChange?.(next);
  };
  const camotionCopy = camotionRecordsCopyText(motionRecords, project, debugOn);

  return (
    <>
      <InspectorPaneNav pane={pane} onChange={setPane} panes={motionPanes} />
      <div hidden={pane === "details"} className="flex flex-col gap-3">
        {startDestination || endDestination ? (
          <div className="grid grid-cols-2 gap-1">
            {startDestination ? (
              <ShootingFrameThumb
                imageUrl={startDestination.image}
                alt={`${journeyId} start ${startDestination.label}`}
                caption={startDestination.label}
                selectLabel={`Select destination ${startDestination.label}`}
                onSelect={onSelectCanonicalStart}
                imageClassName="w-full rounded"
              />
            ) : null}
            {endDestination ? (
              <ShootingFrameThumb
                imageUrl={endDestination.image}
                alt={`${journeyId} end ${endDestination.label}`}
                caption={endDestination.label}
                selectLabel={`Select destination ${endDestination.label}`}
                onSelect={onSelectCanonicalEnd}
                imageClassName="w-full rounded"
              />
            ) : null}
          </div>
        ) : null}
        {assessment ? (
          <CinematographerLegDetail assessment={assessment} />
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-[11px] tracking-[0.16em] text-[#9a8f7e] uppercase">
              <span>Pace</span>
              <PaceControl pace="moderate" />
              <ShotDurationReadout layout="grid" />
            </div>
            {assessing ? (
              <p className="text-[#cfc6b8]">Planning this traversal…</p>
            ) : canAssess ? (
              <p className="text-[#cfc6b8]">
                Motion Plan is created automatically from this actual adjacent pair.
              </p>
            ) : (
              <p className="text-[#9a8f7e]">Cinematographer needs two actual destinations.</p>
            )}
          </>
        )}
        {motionPlanError ? (
          <p className="rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-[#f0c2a8]">
            {motionPlanError}
          </p>
        ) : null}
        {motionPlanError && canAssess ? (
          <button
            type="button"
            className="rounded border border-[#3a342c] px-3 py-1 disabled:opacity-40"
            disabled={assessing}
            aria-label={`Retry ${journeyId}`}
            onClick={onRetry}
          >
            {assessing ? "Planning…" : "Retry"}
          </button>
        ) : null}
      </div>
      <div hidden={pane !== "details"} className="space-y-3">
        <InspectorCopyDisclosure
          label="Camotion"
          copyLabel="Copy camotion"
          copyText={camotionCopy}
        >
          <div className="space-y-3">
            {motionSource ? (
              <ShootingFrameThumbs
                journeyId={journeyId}
                frames={motionSource}
                startLabel={startLabel}
                endLabel={endLabel}
                onSelectStart={onSelectStart}
                onSelectEnd={onSelectEnd}
              />
            ) : null}
            <CamotionDiagnosticPanel
              records={motionRecords}
              emptyCopy="No Camotion data for this traversal."
              showHeading={false}
              debugOn={debugOn}
              project={project}
            />
          </div>
        </InspectorCopyDisclosure>
        {effectivePrompt ? (
          <InspectorCopyDisclosure
            label="Prompt"
            copyLabel="Copy prompt"
            copyText={effectivePrompt}
          >
            <ShootingPromptText
              effectivePrompt={effectivePrompt}
              segmentPromptAddition={segmentPromptAddition}
            />
          </InspectorCopyDisclosure>
        ) : null}
      </div>
    </>
  );
}

function ShootingFrameThumbs({
  journeyId,
  frames,
  startLabel,
  endLabel,
  onSelectStart,
  onSelectEnd,
}: {
  journeyId: string;
  frames: { startShootingFrame: ShootingFrameRef; endShootingFrame: ShootingFrameRef };
  startLabel?: string;
  endLabel?: string;
  onSelectStart?: () => void;
  onSelectEnd?: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <ShootingFrameThumb
        imageUrl={frames.startShootingFrame.imageUrl}
        alt={`${journeyId} start shooting frame`}
        caption="Start′"
        selectLabel={startLabel ? `Select destination ${startLabel}′` : undefined}
        onSelect={onSelectStart}
      />
      <ShootingFrameThumb
        imageUrl={frames.endShootingFrame.imageUrl}
        alt={`${journeyId} end shooting frame`}
        caption="End′"
        selectLabel={endLabel ? `Select destination ${endLabel}′` : undefined}
        onSelect={onSelectEnd}
      />
    </div>
  );
}

function ShootingFrameThumb({
  imageUrl,
  alt,
  caption,
  selectLabel,
  onSelect,
  imageClassName = "media-contain aspect-video w-full rounded",
}: {
  imageUrl?: string;
  alt: string;
  caption: string;
  selectLabel?: string;
  onSelect?: () => void;
  imageClassName?: string;
}) {
  if (!imageUrl) {
    return null;
  }
  const image = <img src={imageUrl} alt={alt} className={imageClassName} />;
  return (
    <figure className="min-w-0">
      {onSelect ? (
        <button
          type="button"
          className="block w-full p-0 outline-none focus-visible:ring-1 focus-visible:ring-[#d4b36a]"
          aria-label={selectLabel ?? alt}
          title={selectLabel ?? alt}
          onClick={onSelect}
        >
          {image}
        </button>
      ) : (
        image
      )}
      <figcaption className="mt-1 text-[11px] tracking-[0.16em] text-[#9a8f7e] uppercase">
        {caption}
      </figcaption>
    </figure>
  );
}

function CinematographerLegDetail({
  assessment,
}: {
  assessment: CinematographerAssessment;
}) {
  return (
    <div className="space-y-2 text-[#cfc6b8]">
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-[11px] tracking-[0.16em] text-[#9a8f7e] uppercase">
        <span>Set consistency</span>
        <span className={cinematographerScoreTone(assessment.setConsistency)}>
          {assessment.setConsistency}
        </span>
        <span>Traversal conf.</span>
        <span className={cinematographerScoreTone(assessment.traversalConfidence)}>
          {assessment.traversalConfidence}
        </span>
        <span>Pace</span>
        <PaceControl pace={assessment.pace} />
        <ShotDurationReadout assessment={assessment} layout="grid" />
      </div>
      {assessment.concerns.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Concerns</p>
          {assessment.concerns.map((concern) => (
            <p key={concern}>{concern}</p>
          ))}
        </div>
      ) : null}
      <p>{assessment.summary}</p>
      <p>
        <span className="text-[#9a8f7e]">Camera path. </span>
        {assessment.camera}
      </p>
    </div>
  );
}

function DurationPair({
  intentSeconds,
  resolvedSeconds,
  fixed,
}: {
  intentSeconds?: number;
  resolvedSeconds: number;
  fixed: boolean;
}) {
  const intentTitle = fixed ? "Fixed duration" : "Desired duration";
  const pair = (
    <span className="inline-flex items-center gap-1.5 tabular-nums tracking-[0.12em] text-[#ece7df] uppercase">
      {intentSeconds !== undefined ? (
        <>
          <span
            className="text-[#ece7df]"
            title={intentTitle}
            data-inspector-desired-duration={fixed ? undefined : intentSeconds}
            data-inspector-fixed-duration={fixed ? intentSeconds : undefined}
          >
            {intentSeconds}s
          </span>
          <span className="text-[#5c564c]" aria-hidden>
            |
          </span>
        </>
      ) : null}
      <span className="text-[#9a8f7e]" title="Model duration" data-inspector-resolved-duration={resolvedSeconds}>
        {resolvedSeconds}s
      </span>
    </span>
  );
  return pair;
}

function ShotDurationReadout({
  assessment,
  take,
  layout,
}: {
  assessment?: CinematographerAssessment;
  take?: JourneyShotTake;
  layout: "grid" | "stack";
}) {
  const { project, selectedJourney, setJourneyDurationSeconds, shootingJourneyIds } = useProject();
  const journey = selectedJourney;
  const [draft, setDraft] = useState<string | null>(null);
  const resolved =
    take && Number.isFinite(take.durationSeconds) && take.durationSeconds > 0
      ? take.durationSeconds
      : journey
        ? unshotDurationSeconds(project, journey)
        : unshotDurationSeconds(project);
  const intentSeconds = intentDurationSeconds(project, journey ?? { cinematographer: assessment });
  const disabled = !journey || shootingJourneyIds.includes(journey.id);
  const editableSeconds = journey ? intentSeconds ?? 5 : intentSeconds;
  const commitDraft = () => {
    if (!journey || draft === null) {
      setDraft(null);
      return;
    }
    const next = Number(draft);
    if (Number.isFinite(next)) {
      setJourneyDurationSeconds(journey.id, next);
    }
    setDraft(null);
  };
  const pair = (
    <span className="inline-flex items-center gap-1.5">
      {editableSeconds !== undefined && journey ? (
        <label className="inline-flex items-center gap-1">
          <input
            type="number"
            min={MIN_FIXED_DURATION_SECONDS}
            max={MAX_FIXED_DURATION_SECONDS}
            step={1}
            value={draft ?? String(editableSeconds)}
            disabled={disabled}
            aria-label="Desired duration seconds"
            title="Filmmaker duration for this traversal. Updates the stored plan and the next take."
            className="w-10 rounded border border-[#3a342c] bg-transparent px-1 py-0.5 text-right text-[11px] tabular-nums tracking-[0.12em] text-[#ece7df] outline-none focus-visible:border-[#ece7df] disabled:cursor-not-allowed disabled:opacity-50"
            data-inspector-desired-duration={durationModeFromProject(project) === "fixed" && journey.filmmakerDurationSeconds === undefined ? undefined : editableSeconds}
            data-inspector-fixed-duration={durationModeFromProject(project) === "fixed" && journey.filmmakerDurationSeconds === undefined ? editableSeconds : undefined}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />
          <span className="text-[11px] tracking-[0.12em] text-[#ece7df] uppercase">s</span>
        </label>
      ) : (
        <DurationPair
          intentSeconds={intentSeconds}
          resolvedSeconds={resolved}
          fixed={durationModeFromProject(project) === "fixed"}
        />
      )}
      {editableSeconds !== undefined && journey ? (
        <>
          <span className="text-[#5c564c]" aria-hidden>
            |
          </span>
          <span className="text-[#9a8f7e]" title="Model duration" data-inspector-resolved-duration={resolved}>
            {resolved}s
          </span>
        </>
      ) : null}
    </span>
  );
  if (layout === "stack") {
    return (
      <div>
        <p className="text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Duration</p>
        {pair}
      </div>
    );
  }
  return (
    <>
      <span>Duration</span>
      {pair}
    </>
  );
}

function PaceControl({ pace }: { pace: CinematographerAssessment["pace"] }) {
  const { selectedJourney, setJourneyPace, shootingJourneyIds } = useProject();
  const current = selectedJourney ? effectiveJourneyPace(selectedJourney) ?? pace : pace;
  const disabled = !selectedJourney || shootingJourneyIds.includes(selectedJourney.id);
  return (
    <span className="inline-flex items-center gap-2 text-[#d4b36a]" data-inspector-pace={current}>
      <JourneyPaceMark pace={current} />
      <OptionMenu
        ariaLabel="Pace"
        title="Filmmaker pace for this traversal. Restages the Motion Plan so the stored shooting prompt matches."
        value={current}
        disabled={disabled}
        options={LOCOMOTION_PACES.map((value) => ({
          value,
          label: locomotionPaceLabel(value),
        }))}
        onChange={(next) => {
          if (selectedJourney) {
            void setJourneyPace(selectedJourney.id, next as LocomotionPace);
          }
        }}
        triggerClassName="h-7 min-w-[7.5rem] rounded border border-[#3a342c] bg-[#161410] px-2 text-[11px] tracking-[0.16em] text-[#ece7df] uppercase outline-none focus-visible:border-[#ece7df]"
      />
    </span>
  );
}

function InspectorMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">{label}</p>
      <p className="text-[#cfc6b8]">{value}</p>
    </div>
  );
}

function TakeInspector({
  journeyId,
  take,
  shootingFrames,
  assessment,
  effectivePrompt,
  segmentPromptAddition,
  pace,
  shootError,
  canShoot,
  shooting,
  debugOn,
  playable,
  startLabel,
  endLabel,
  onSelectStart,
  onSelectEnd,
  onNewTake,
}: {
  journeyId: string;
  take?: JourneyShotTake;
  shootingFrames?: { startShootingFrame: ShootingFrameRef; endShootingFrame: ShootingFrameRef };
  assessment?: CinematographerAssessment;
  effectivePrompt?: string;
  segmentPromptAddition?: string;
  pace?: CinematographerAssessment["pace"];
  shootError?: string | null;
  canShoot: boolean;
  shooting: boolean;
  debugOn: boolean;
  playable: boolean;
  startLabel: string;
  endLabel: string;
  onSelectStart: () => void;
  onSelectEnd: () => void;
  onNewTake: (intent: GenerationIntent) => void;
}) {
  const { project } = useProject();
  const journey = project.journeys.find((item) => item.id === journeyId);
  const stale = Boolean(take && journey && takeMatchesCurrentCanonicals(project, journey, take) === false);
  const direction = assessment?.travel?.direction?.trim();
  const modelLabel = take ? videoModelDisplayLabel(take.model) : undefined;
  const intentLabel = take?.generationIntent ? takeIntentTooltip(take) : undefined;
  return (
    <>
      {stale ? (
        <p className="rounded border border-[#d4b36a] bg-[#443922] px-3 py-2 text-[#e4d2a4]">
          {TAKE_PREVIOUS_CANONICALS_COPY}
        </p>
      ) : null}
      {shootError ? (
        <p className="rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-[#f0c2a8]">{shootError}</p>
      ) : null}
      {shootingFrames ? (
        <ShootingFrameThumbs
          journeyId={journeyId}
          frames={shootingFrames}
          startLabel={startLabel}
          endLabel={endLabel}
          onSelectStart={onSelectStart}
          onSelectEnd={onSelectEnd}
        />
      ) : null}
      <div>
        <p className="text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Pace</p>
        <PaceControl pace={pace ?? "moderate"} />
      </div>
      <ShotDurationReadout assessment={assessment} take={take} layout="stack" />
      {direction ? <InspectorMeta label="Shot direction" value={direction} /> : null}
      {intentLabel ? <InspectorMeta label="Generation" value={intentLabel} /> : null}
      {effectivePrompt ? (
        <details>
          <summary className="cursor-pointer text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Prompt</summary>
          <ShootingPromptText
            className="mt-2"
            effectivePrompt={effectivePrompt}
            segmentPromptAddition={segmentPromptAddition}
          />
        </details>
      ) : null}
      {debugOn && modelLabel ? <InspectorMeta label="Model" value={modelLabel} /> : null}
      {!take && !playable ? <p className="text-[#9a8f7e]">No take selected for this traversal.</p> : null}
      <GenerationIntentMenu
        label={newTakeActionLabel()}
        ariaLabel={`New take ${journeyId}`}
        defaultIntent={defaultTakeIntentFromProject(project)}
        disabled={!canShoot}
        busy={shooting}
        buttonClass="h-7 w-max shrink-0 cursor-pointer self-start rounded border border-[#3a342c] text-[11px] tracking-[0.16em] text-[#ece7df] hover:border-[#7a7266] disabled:opacity-40"
        onChoose={onNewTake}
      />
    </>
  );
}

function BoundaryContinuityDetail({ continuity }: { continuity: BoundaryContinuity }) {
  const match = boundaryContinuityLabel(continuity.classification);
  return (
    <div className="space-y-1 border-t border-[#2a2620] pt-3 text-[#cfc6b8]">
      <p className="text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Boundary continuity</p>
      <p>
        {match} match at {continuity.sharedDestinationId}
      </p>
      <p>
        {continuity.previousJourneyId} final ↔ {continuity.nextJourneyId} first
      </p>
      <p>
        MAE {continuity.mae.toFixed(2)}
        {continuity.ssim !== undefined ? ` · SSIM ${continuity.ssim.toFixed(3)}` : ""}
      </p>
      {continuity.rasterMismatch ? (
        <p>
          Output raster mismatch · {formatRaster(continuity.previousRaster)} →{" "}
          {formatRaster(continuity.nextRaster)}
        </p>
      ) : (
        <p>Output raster {formatRaster(continuity.previousRaster)}</p>
      )}
      <p className="text-[#9a8f7e]">
        Visual boundary match only. Not a traversal or shootability judgment.
      </p>
    </div>
  );
}
