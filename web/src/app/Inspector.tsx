import { useMemo } from "react";
import {
  boundaryContinuitiesForProject,
  boundaryContinuityAtSeam,
  boundaryContinuityLabel,
  formatRaster,
  type BoundaryContinuity,
} from "../project/boundary-continuity";
import { ARRIVAL_BLOCKED_COPY, journeyIsPlayable } from "../project/policy";
import { canAssessJourney, cinematographerShootabilityLabel, journeyLegStatusLabel } from "../project/cinematographer";
import { canShootJourney } from "../project/shoot";
import { canReshootDestinationFrame } from "../project/destination";
import { useProject } from "../project/ProjectProvider";
import { destinationById, storyboardFrameForDestination, type CinematographerAssessment, type JourneyShotTake } from "../project/types";
import { layoutTimeline } from "../timeline/geometry";
import { DestinationPlanFields } from "./PlanView";
import { TechnicalPanel } from "./TechnicalPanel";

export function Inspector() {
  const {
    project,
    selection,
    assessJourney,
    assessingJourneyIds,
    cinematographerError,
    shootJourney,
    shootingJourneyIds,
    shootError,
    constructingBeatId,
    setDestinationPlan,
    reshootDestination,
  } = useProject();
  const layout = useMemo(
    () => layoutTimeline(project.destinations, project.journeys, 1),
    [project.destinations, project.journeys],
  );
  const continuities = useMemo(() => boundaryContinuitiesForProject(project), [project]);
  const shootEmpty = project.journeys.length === 0;

  if (shootEmpty) {
    return (
      <aside className="flex min-h-0 flex-col gap-3 overflow-auto border-l border-[#2a2620] bg-[#12100d] p-4 text-sm">
        <p className="text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Journey</p>
        <p className="text-[#cfc6b8]">
          Nothing is ready to shoot until the journey has actual adjacent destinations.
        </p>
        <TechnicalPanel />
      </aside>
    );
  }

  if (selection.kind === "storyboard") {
    return <aside className="border-l border-[#2a2620] bg-[#12100d] p-4">Nothing selected.</aside>;
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

    return (
      <aside className="flex min-h-0 flex-col gap-3 overflow-auto border-l border-[#2a2620] bg-[#12100d] p-4 text-sm">
        <p className="text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Destination</p>
        <h2 className="text-2xl">
          {destination?.label}
          {occurrence && occurrence.occurrenceIndex > 0 && occurrence.destinationId === "A"
            ? " again"
            : ""}
        </h2>
        {destination ? (
          <img src={destination.image} alt="" className="media-contain aspect-video w-full rounded" />
        ) : null}
        <p>Status: {destination?.status?.replaceAll("_", " ")}</p>
        {occurrence?.occurrenceIndex === 0 ? (
          <p>This is the opening destination.</p>
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
              aria-label={`Redo destination ${frame.label}`}
              title="Regenerate this destination from its current prompt."
              onClick={() => {
                void reshootDestination(frame.id);
              }}
            >
              {reshooting ? "Reshooting…" : "Redo"}
            </button>
          </div>
        ) : null}
        <TechnicalPanel />
      </aside>
    );
  }

  const journey = project.journeys.find((item) => item.id === selection.journeyId);
  if (!journey) {
    return <aside className="border-l border-[#2a2620] bg-[#12100d] p-4">Nothing selected.</aside>;
  }

  const playable = journeyIsPlayable(journey);
  const assessment = journey.cinematographer;
  const canAssess = canAssessJourney(project, journey);
  const assessing = assessingJourneyIds.includes(journey.id);
  const canShoot = canShootJourney(project, journey);
  const shooting = shootingJourneyIds.includes(journey.id) || journey.status === "shooting";
  const take = journey.take;
  const startDestination = destinationById(project.destinations, journey.startDestinationId);
  const endDestination = journey.endDestinationId
    ? destinationById(project.destinations, journey.endDestinationId)
    : undefined;

  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-auto border-l border-[#2a2620] bg-[#12100d] p-4 text-sm">
      <p className="text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Journey</p>
      <h2 className="text-2xl">{journey.id}</h2>
      <p>
        {journey.startDestinationId} → {journey.endDestinationId ?? "?"}
      </p>
      {startDestination || endDestination ? (
        <div className="grid grid-cols-2 gap-2">
          {startDestination ? (
            <figure className="min-w-0">
              <img
                src={startDestination.image}
                alt={`${journey.id} start ${startDestination.label}`}
                className="media-contain aspect-video w-full rounded"
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
                className="media-contain aspect-video w-full rounded"
              />
              <figcaption className="mt-1 text-[11px] tracking-[0.16em] text-[#9a8f7e] uppercase">
                {endDestination.label}
              </figcaption>
            </figure>
          ) : null}
        </div>
      ) : null}
      <p>Status: {journeyLegStatusLabel(journey)}</p>
      {assessment ? (
        <>
          <p className="text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Blocked</p>
          <CinematographerLegDetail assessment={assessment} />
        </>
      ) : (
        <p className="text-[#cfc6b8]">
          The Cinematographer inspects the actual adjacent sets and determines how the camera should move through their geography.
        </p>
      )}
      {canAssess ? (
        <button
          type="button"
          className="self-start rounded border border-[#3a342c] px-3 py-1 disabled:opacity-40"
          disabled={assessing || shooting}
          aria-label={`Block ${journey.id}`}
          onClick={() => void assessJourney(journey.id)}
        >
          {assessing ? "Blocking…" : "Block"}
        </button>
      ) : (
        <p className="text-[#9a8f7e]">Cinematographer needs two actual destinations.</p>
      )}
      {cinematographerError ? (
        <p className="rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-[#f0c2a8]">
          {cinematographerError}
        </p>
      ) : null}
      {assessment ? (
        <button
          type="button"
          className="self-start rounded border border-[#3a342c] px-3 py-1 disabled:opacity-40"
          disabled={!canShoot || shooting}
          aria-label={`Shoot ${journey.id}`}
          onClick={() => void shootJourney(journey.id)}
        >
          {shooting ? "Shooting…" : "Shoot"}
        </button>
      ) : canAssess ? (
        <p className="text-[#9a8f7e]">Block this journey before shooting.</p>
      ) : null}
      {shootError || journey.shootError ? (
        <p className="rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-[#f0c2a8]">
          {shootError ?? journey.shootError}
        </p>
      ) : null}
      {take ? <TakeEvidence take={take} journeyId={journey.id} /> : null}
      {playable ? <p className="text-[#cfc6b8]">This shot is available in the preview.</p> : null}
      <TechnicalPanel />
    </aside>
  );
}

function CinematographerLegDetail({
  assessment,
}: {
  assessment: CinematographerAssessment;
}) {
  const suitability =
    assessment.camotionSuitability === "appropriate"
      ? "Appropriate"
      : assessment.camotionSuitability === "poor_fit"
        ? "Poor fit"
        : "Uncertain";
  return (
    <div className="space-y-2 text-[#cfc6b8]">
      <p className="text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Cinematographer</p>
      <p>{cinematographerShootabilityLabel(assessment.shootability)}</p>
      <p>{assessment.summary}</p>
      <p>
        <span className="text-[#9a8f7e]">Camera path. </span>
        {assessment.camera}
      </p>
      <details className="border-t border-[#2a2620] pt-2 text-xs">
        <summary className="cursor-pointer tracking-[0.16em] text-[#9a8f7e] uppercase">
          Shot
        </summary>
        <div className="mt-2 space-y-2 leading-relaxed">
          <p>
            <span className="text-[#9a8f7e]">Route. </span>
            {assessment.route}
          </p>
          <p>
            <span className="text-[#9a8f7e]">Transition. </span>
            {assessment.transitionStrategy}
          </p>
          <p>
            <span className="text-[#9a8f7e]">Prompt addition. </span>
            {assessment.segmentPromptAddition}
          </p>
          <p>
            <span className="text-[#9a8f7e]">Threshold. </span>
            {assessment.threshold}
          </p>
          <p>
            <span className="text-[#9a8f7e]">Geometry. </span>
            {assessment.parallax}
          </p>
          <p>
            <span className="text-[#9a8f7e]">Camotion. </span>
            {suitability}
          </p>
          {assessment.concerns.length > 0 ? (
            <div>
              <p className="text-[#9a8f7e]">Concerns</p>
              {assessment.concerns.map((concern) => (
                <p key={concern}>{concern}</p>
              ))}
            </div>
          ) : (
            <p>
              <span className="text-[#9a8f7e]">Concerns. </span>
              None noted.
            </p>
          )}
          <p className="text-[#9a8f7e]">
            Advisory set analysis. Does not block this journey.
          </p>
        </div>
      </details>
    </div>
  );
}

function TakeEvidence({ take, journeyId }: { take: JourneyShotTake; journeyId: string }) {
  return (
    <details className="border-t border-[#2a2620] pt-2 text-xs text-[#cfc6b8]">
      <summary className="cursor-pointer tracking-[0.16em] text-[#9a8f7e] uppercase">Take</summary>
      <div className="mt-2 space-y-2 leading-relaxed">
        <div className="grid grid-cols-2 gap-2">
          <figure className="min-w-0">
            <img
              src={take.startShootingFrame.imageUrl}
              alt={`${journeyId} start shooting frame`}
              className="media-contain aspect-video w-full rounded"
            />
            <figcaption className="mt-1 text-[11px] tracking-[0.16em] text-[#9a8f7e] uppercase">
              Start′
            </figcaption>
          </figure>
          <figure className="min-w-0">
            <img
              src={take.endShootingFrame.imageUrl}
              alt={`${journeyId} end shooting frame`}
              className="media-contain aspect-video w-full rounded"
            />
            <figcaption className="mt-1 text-[11px] tracking-[0.16em] text-[#9a8f7e] uppercase">
              End′
            </figcaption>
          </figure>
        </div>
        <p>
          <span className="text-[#9a8f7e]">Prompt. </span>
          {take.effectivePrompt}
        </p>
        <p>
          <span className="text-[#9a8f7e]">Prompt addition. </span>
          {take.segmentPromptAddition || "None"}
        </p>
        <p>
          <span className="text-[#9a8f7e]">Model. </span>
          {take.provider} · {take.model}
          {take.modelVersion ? ` · ${take.modelVersion}` : ""}
        </p>
        <p>
          <span className="text-[#9a8f7e]">Duration. </span>
          {take.durationSeconds}s
          {take.seed !== undefined ? ` · seed ${take.seed}` : ""}
        </p>
        <p className="text-[#9a8f7e]">
          {take.videoInputs.endShootingFrame
            ? "Start shooting frame A′ and end shooting frame B′ were sent as the video start and last-frame conditions."
            : "Start shooting frame A′ was sent to the video model. End shooting frame B′ was not used as last-frame conditioning."}
        </p>
      </div>
    </details>
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
