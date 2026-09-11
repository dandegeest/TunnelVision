import { useMemo, type ReactNode } from "react";
import {
  boundaryContinuitiesForProject,
  boundaryContinuityAtSeam,
  boundaryContinuityLabel,
  formatRaster,
  type BoundaryContinuity,
} from "../project/boundary-continuity";
import { ARRIVAL_BLOCKED_COPY, journeyIsPlayable } from "../project/policy";
import { canAssessJourney, cinematographerScoreTone, locomotionPaceLabel } from "../project/cinematographer";
import { canReshootDestinationFrame } from "../project/destination";
import { canShootJourney } from "../project/shoot";
import { useProject } from "../project/ProjectProvider";
import { destinationById, storyboardFrameForDestination, type CinematographerAssessment, type JourneyShotTake, type ShootingFrameRef } from "../project/types";
import { layoutShootTimeline } from "../timeline/shoot-layout";
import { videoModelDisplayLabel } from "../../../media/src/replicate/video-models.ts";
import { DestinationPlanFields } from "./PlanView";
import { CamotionDiagnosticPanel } from "./CamotionDiagnostic";
import { camotionRecordsForDestination, camotionRecordsForJourney } from "../project/camotion-diagnostics";
import { PanelHeader } from "./PanelHeader";

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
    reshootDestination,
  } = useProject();
  const layout = useMemo(() => layoutShootTimeline(project, 1), [project]);
  const continuities = useMemo(() => boundaryContinuitiesForProject(project), [project]);
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
        <h2 className="text-2xl">{destination?.label ?? selection.destinationId}</h2>
        {destination ? (
          <img src={destination.image} alt="" className="media-contain aspect-video w-full rounded" />
        ) : null}
        {blockedArrival ? (
          <p className="rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-[#f0c2a8]">
            {ARRIVAL_BLOCKED_COPY} The problem is the inbound journey
            {inbound ? ` ${inbound.id}` : ""}, not destination {destination?.label} itself.
          </p>
        ) : null}
        {frame ? (
          <DestinationPlanFields
            frame={frame}
            disabled={reshooting}
            alwaysShowIntent
            intentClickToEdit
            promptClickToEdit
            promptDisclosure
            promptHeading="Generation prompt"
            intentRows={3}
            onPlanChange={(next) => setDestinationPlan(frame.id, next)}
          />
        ) : null}
        {continuity ? <BoundaryContinuityDetail continuity={continuity} /> : null}
        {canReshoot && frame ? (
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-[#3a342c] px-3 py-1 disabled:opacity-40"
              disabled={reshooting}
              aria-label={`Reshoot destination ${frame.label}`}
              title="Regenerate this destination from its current prompt."
              onClick={() => {
                void reshootDestination(frame.id);
              }}
            >
              {reshooting ? "Reshooting…" : "Reshoot"}
            </button>
          </div>
        ) : null}
        <CamotionDiagnosticPanel
          records={camotionRecords}
          emptyCopy="Awaiting next destination"
          filmmaker
          debugOn={debugOn}
          project={project}
        />
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
  const take = journey.take;
  const motionSource = journey.motionPlan ?? journey.take;
  const startDestination = destinationById(project.destinations, journey.startDestinationId);
  const endDestination = journey.endDestinationId
    ? destinationById(project.destinations, journey.endDestinationId)
    : undefined;
  const motion = selection.band === "motion";
  const motionRecords = camotionRecordsForJourney(project, journey.id);
  const segmentHeading = `${startDestination?.label ?? journey.startDestinationId}→${endDestination?.label ?? journey.endDestinationId ?? "?"}`;
  return (
    <InspectorShell title={motion ? "Inspector - Motion" : "Inspector - Footage"}>
      <h2 className="text-2xl">{segmentHeading}</h2>
      {motion && (startDestination || endDestination) ? (
        <div className="grid grid-cols-2 gap-1">
          {startDestination ? (
            <figure className="min-w-0">
              <img
                src={startDestination.image}
                alt={`${journey.id} start ${startDestination.label}`}
                className="w-full rounded"
              />
              <figcaption className="mt-1 text-[11px] tracking-[0.16em] text-[#9a8f7e] uppercase">
                {startDestination.label}
              </figcaption>
            </figure>
          ) : null}
          {endDestination ? (
            <figure className="min-w-0">
              <img
                src={endDestination.image}
                alt={`${journey.id} end ${endDestination.label}`}
                className="w-full rounded"
              />
              <figcaption className="mt-1 text-[11px] tracking-[0.16em] text-[#9a8f7e] uppercase">
                {endDestination.label}
              </figcaption>
            </figure>
          ) : null}
        </div>
      ) : null}
      {motion ? (
        <>
          {assessment ? (
            <>
              <p className="text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">
                Cinematographer Motion Plan
              </p>
              <CinematographerLegDetail assessment={assessment} />
            </>
          ) : assessing ? (
            <p className="text-[#cfc6b8]">Planning this traversal…</p>
          ) : canAssess ? (
            <p className="text-[#cfc6b8]">
              Motion Plan is created automatically from this actual adjacent pair.
            </p>
          ) : (
            <p className="text-[#9a8f7e]">Cinematographer needs two actual destinations.</p>
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
              aria-label={`Retry ${journey.id}`}
              onClick={() => {
                void retryMotionPlan(journey.id);
              }}
            >
              {assessing ? "Planning…" : "Retry"}
            </button>
          ) : null}
          {motionSource ? (
            <div className="grid grid-cols-2 gap-2">
              <figure className="min-w-0">
                <img
                  src={motionSource.startShootingFrame.imageUrl}
                  alt={`${journey.id} start shooting frame`}
                  className="media-contain aspect-video w-full rounded"
                />
                <figcaption className="mt-1 text-[11px] tracking-[0.16em] text-[#9a8f7e] uppercase">
                  Start′
                </figcaption>
              </figure>
              <figure className="min-w-0">
                <img
                  src={motionSource.endShootingFrame.imageUrl}
                  alt={`${journey.id} end shooting frame`}
                  className="media-contain aspect-video w-full rounded"
                />
                <figcaption className="mt-1 text-[11px] tracking-[0.16em] text-[#9a8f7e] uppercase">
                  End′
                </figcaption>
              </figure>
            </div>
          ) : null}
          <CamotionDiagnosticPanel records={motionRecords} emptyCopy="No Camotion data for this traversal." />
        </>
      ) : (
        <FootageInspector
          journeyId={journey.id}
          take={take}
          shootingFrames={motionSource}
          assessment={assessment}
          effectivePrompt={take?.effectivePrompt ?? motionSource?.effectivePrompt}
          pace={take?.pace ?? assessment?.pace}
          shootError={shootError ?? journey.shootError}
          canShoot={canShootJourney(project, journey)}
          shooting={shootingJourneyIds.includes(journey.id)}
          debugOn={debugOn}
          playable={playable}
          onReshoot={() => {
            void shootJourney(journey.id);
          }}
        />
      )}
    </InspectorShell>
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
      <p>
        <span className="text-[#9a8f7e]">Pace. </span>
        {locomotionPaceLabel(assessment.pace)}
      </p>
    </div>
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

function FootageInspector({
  journeyId,
  take,
  shootingFrames,
  assessment,
  effectivePrompt,
  pace,
  shootError,
  canShoot,
  shooting,
  debugOn,
  playable,
  onReshoot,
}: {
  journeyId: string;
  take?: JourneyShotTake;
  shootingFrames?: { startShootingFrame: ShootingFrameRef; endShootingFrame: ShootingFrameRef };
  assessment?: CinematographerAssessment;
  effectivePrompt?: string;
  pace?: CinematographerAssessment["pace"];
  shootError?: string | null;
  canShoot: boolean;
  shooting: boolean;
  debugOn: boolean;
  playable: boolean;
  onReshoot: () => void;
}) {
  const direction = assessment?.travel?.direction?.trim();
  const modelLabel = take ? videoModelDisplayLabel(take.model) : undefined;
  return (
    <>
      {shootError ? (
        <p className="rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-[#f0c2a8]">{shootError}</p>
      ) : null}
      {shootingFrames ? (
        <div className="grid grid-cols-2 gap-2">
          <figure className="min-w-0">
            <img
              src={shootingFrames.startShootingFrame.imageUrl}
              alt={`${journeyId} start shooting frame`}
              className="media-contain aspect-video w-full rounded"
            />
            <figcaption className="mt-1 text-[11px] tracking-[0.16em] text-[#9a8f7e] uppercase">
              Start′
            </figcaption>
          </figure>
          <figure className="min-w-0">
            <img
              src={shootingFrames.endShootingFrame.imageUrl}
              alt={`${journeyId} end shooting frame`}
              className="media-contain aspect-video w-full rounded"
            />
            <figcaption className="mt-1 text-[11px] tracking-[0.16em] text-[#9a8f7e] uppercase">
              End′
            </figcaption>
          </figure>
        </div>
      ) : null}
      {pace ? <InspectorMeta label="Pace" value={locomotionPaceLabel(pace)} /> : null}
      {direction ? <InspectorMeta label="Shot direction" value={direction} /> : null}
      {effectivePrompt ? (
        <details>
          <summary className="cursor-pointer text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Prompt</summary>
          <p className="mt-2 whitespace-pre-wrap text-[#cfc6b8]">{effectivePrompt}</p>
        </details>
      ) : null}
      {debugOn && modelLabel ? <InspectorMeta label="Model" value={modelLabel} /> : null}
      {!take && !playable ? <p className="text-[#9a8f7e]">No footage for this traversal.</p> : null}
      <button
        type="button"
        className="rounded border border-[#3a342c] px-3 py-1 disabled:opacity-40"
        disabled={!canShoot || shooting}
        aria-label={`Reshoot ${journeyId}`}
        onClick={onReshoot}
      >
        {shooting ? "Reshooting…" : "Reshoot"}
      </button>
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
