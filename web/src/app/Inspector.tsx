import { useMemo, useState } from "react";
import {
  boundaryContinuitiesForProject,
  boundaryContinuityAtSeam,
  boundaryContinuityLabel,
  formatRaster,
  type BoundaryContinuity,
} from "../project/boundary-continuity";
import { ARRIVAL_BLOCKED_COPY, journeyIsPlayable, showApprovalChrome } from "../project/policy";
import {
  canAssessJourney,
  cinematographerShootabilityLabel,
} from "../project/cinematographer";
import { useProject } from "../project/ProjectProvider";
import { destinationById, type CinematographerAssessment } from "../project/types";
import { layoutTimeline } from "../timeline/geometry";

export function Inspector() {
  const {
    project,
    selection,
    assessJourney,
    assessingJourneyId,
    cinematographerError,
  } = useProject();
  const layout = useMemo(
    () => layoutTimeline(project.destinations, project.journeys, 1),
    [project.destinations, project.journeys],
  );
  const continuities = useMemo(() => boundaryContinuitiesForProject(project), [project]);
  const shootEmpty = project.destinations.length === 0 && project.journeys.length === 0;

  if (shootEmpty) {
    return (
      <aside className="flex min-h-0 flex-col gap-3 overflow-auto border-l border-[#2a2620] bg-[#12100d] p-4 text-sm">
        <p className="text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Journey</p>
        <p className="text-[#cfc6b8]">
          Nothing is ready to shoot until the journey has actual adjacent destinations.
        </p>
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
    const showApprovals = showApprovalChrome(project.agency, blockedArrival);

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
          <img src={destination.image} alt="" className="aspect-video w-full rounded object-cover" />
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
        ) : (
          <p className="text-[#cfc6b8]">
            This is what the generated world actually gave us. The Cinematographer judges how to shoot the journeys that leave or arrive here.
          </p>
        )}
        {continuity ? <BoundaryContinuityDetail continuity={continuity} /> : null}
        {showApprovals ? (
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-[#3a342c] px-3 py-1 disabled:opacity-40"
              disabled
              title="Generation is not connected in this slice."
            >
              Redo
            </button>
          </div>
        ) : null}
        <TechnicalSeam />
      </aside>
    );
  }

  const journey = project.journeys.find((item) => item.id === selection.journeyId);
  if (!journey) {
    return <aside className="border-l border-[#2a2620] bg-[#12100d] p-4">Nothing selected.</aside>;
  }

  const showApprovals = showApprovalChrome(project.agency, false);
  const playable = journeyIsPlayable(journey);
  const assessment = journey.cinematographer;
  const canAssess = canAssessJourney(project, journey);
  const assessing = assessingJourneyId === journey.id;

  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-auto border-l border-[#2a2620] bg-[#12100d] p-4 text-sm">
      <p className="text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Journey</p>
      <h2 className="text-2xl">{journey.id}</h2>
      <p>
        {journey.startDestinationId} → {journey.endDestinationId ?? "?"}
      </p>
      <p>Status: {journey.status.replaceAll("_", " ")}</p>
      {assessment ? (
        <CinematographerLegDetail assessment={assessment} />
      ) : (
        <p className="text-[#cfc6b8]">
          The Cinematographer inspects the actual adjacent sets and determines how the camera should move through their geography.
        </p>
      )}
      {canAssess ? (
        <button
          type="button"
          className="self-start rounded border border-[#3a342c] px-3 py-1 disabled:opacity-40"
          disabled={assessing}
          onClick={() => void assessJourney(journey.id)}
        >
          {assessing ? "Assessing…" : assessment ? "Reassess shot" : "Assess shot"}
        </button>
      ) : (
        <p className="text-[#9a8f7e]">Cinematographer needs two actual destinations.</p>
      )}
      {cinematographerError ? (
        <p className="rounded border border-[#8a4a32] bg-[#2a1610] px-3 py-2 text-[#f0c2a8]">
          {cinematographerError}
        </p>
      ) : null}
      {playable ? <p className="text-[#cfc6b8]">This shot is available in the preview.</p> : null}
      {showApprovals ? (
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-[#3a342c] px-3 py-1 disabled:opacity-40"
            disabled
            title="Generation is not connected in this slice."
          >
            Redo
          </button>
        </div>
      ) : null}
      <TechnicalSeam />
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

function TechnicalSeam() {
  const [open, setOpen] = useState(false);

  return (
    <details
      className="mt-auto border-t border-[#2a2620] pt-3 text-xs text-[#9a8f7e]"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer tracking-[0.16em] uppercase">Technical</summary>
      <div className="mt-2 space-y-1 leading-relaxed">
        <p>Construction: planned. Discovery is not implemented.</p>
        <p>Development fixture references committed research media. Camotion plans appear later.</p>
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
