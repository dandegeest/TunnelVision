import { useEffect, useRef, useState, type ReactNode } from "react";
import { ARRIVAL_BLOCKED_COPY, journeyIsPlayable } from "../project/policy";
import { useProject } from "../project/ProjectProvider";
import { destinationById, type CameraMotionPlanV1, type Destination } from "../project/types";
import { layoutShootTimeline } from "../timeline/shoot-layout";
import {
  camotionRecordKey,
  camotionRecordsForDestination,
  camotionSourceLabel,
  preferredCamotionRecord,
  type DestinationCamotionRecord,
} from "../project/camotion-diagnostics";
import { CamotionEmptyState, CamotionFrameSwitch, CamotionSourceSwitch } from "./CamotionDiagnostic";
import {
  CamotionOverlayToggles,
  DEFAULT_OVERLAY_LAYERS,
  DiagnosticStill,
} from "./CamotionOverlay";
import type { OverlayLayers } from "../project/camotion-overlay";

function PreviewMonitor({ children, pair = false }: { children: ReactNode; pair?: boolean }) {
  return (
    <div className="preview-stage">
      <div className={pair ? "preview-monitor preview-monitor-pair" : "preview-monitor"}>{children}</div>
    </div>
  );
}

function PreviewHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <div className="flex h-7 shrink-0 items-center justify-between gap-3">
      <p className="min-w-0 truncate text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">{title}</p>
      {trailing}
    </div>
  );
}

function DestinationCamotionPreview({
  destination,
  records,
  arrivalBlocked,
  title,
}: {
  destination: Destination;
  records: readonly DestinationCamotionRecord[];
  arrivalBlocked: boolean;
  title: string;
}) {
  const [mode, setMode] = useState<"canonical" | "primed">("canonical");
  const [recordKey, setRecordKey] = useState<string | null>(null);
  const [overlay, setOverlay] = useState(true);
  const [layers, setLayers] = useState<OverlayLayers>(DEFAULT_OVERLAY_LAYERS);
  const active =
    records.find((record) => camotionRecordKey(record) === recordKey) ?? preferredCamotionRecord(records);
  const primed = mode === "primed";
  const primedCaption = active
    ? `${active.primedLabel} · ${camotionSourceLabel(active)}`
    : `${destination.label}′`;
  const caption = arrivalBlocked
    ? ARRIVAL_BLOCKED_COPY
    : primed
      ? primedCaption
      : `Canonical ${destination.label}`;
  const plan = active?.plan ?? null;
  const showOverlay = overlay && Boolean(plan);
  const stillSrc = primed && active ? active.shootingFrame.imageUrl : destination.image;
  const stillAlt = primed && active ? primedCaption : `Destination ${destination.label}`;
  const stillCaption = primed && active ? primedCaption : undefined;

  return (
    <section className="flex h-full min-h-0 flex-col gap-1.5 overflow-hidden bg-black p-2">
      <PreviewHeader
        title={title}
        trailing={
          <CamotionFrameSwitch
            destinationLabel={destination.label}
            primedLabel={`${destination.label}′`}
            mode={mode}
            onChange={setMode}
          />
        }
      />
      <PreviewMonitor>
        {primed && !active ? (
          <CamotionEmptyState />
        ) : (
          <DiagnosticStill
            src={stillSrc}
            alt={stillAlt}
            plan={plan}
            overlay={showOverlay}
            layers={layers}
            caption={stillCaption}
          />
        )}
      </PreviewMonitor>
      <div className="flex min-h-5 flex-none flex-wrap items-center gap-2">
        {plan ? (
          <CamotionOverlayToggles
            overlay={overlay}
            layers={layers}
            onOverlayChange={setOverlay}
            onLayersChange={setLayers}
          />
        ) : null}
        <CamotionSourceSwitch
          records={records}
          activeKey={active ? camotionRecordKey(active) : ""}
          onChange={setRecordKey}
        />
        <p className={`min-w-0 truncate text-sm ${arrivalBlocked ? "text-[#f0c2a8]" : "text-[#9a8f7e]"}`}>
          {caption}
        </p>
      </div>
    </section>
  );
}

export function JourneyCanonicalPair({
  journeyId,
  startLabel,
  startImage,
  endLabel,
  endImage,
  startPlan = null,
  endPlan = null,
  overlay = false,
  layers,
}: {
  journeyId: string;
  startLabel: string;
  startImage: string;
  endLabel: string;
  endImage: string;
  startPlan?: CameraMotionPlanV1 | null;
  endPlan?: CameraMotionPlanV1 | null;
  overlay?: boolean;
  layers?: OverlayLayers;
}) {
  const overlayLayers = layers ?? DEFAULT_OVERLAY_LAYERS;
  return (
    <div className="preview-leg">
      {overlay && (startPlan || endPlan) ? (
        <>
          <DiagnosticStill
            src={startImage}
            alt={`${journeyId} start ${startLabel}`}
            plan={startPlan}
            overlay={overlay && Boolean(startPlan)}
            layers={overlayLayers}
          />
          <DiagnosticStill
            src={endImage}
            alt={`${journeyId} end ${endLabel}`}
            plan={endPlan}
            overlay={overlay && Boolean(endPlan)}
            layers={overlayLayers}
          />
        </>
      ) : (
        <>
          <img src={startImage} alt={`${journeyId} start ${startLabel}`} />
          <img src={endImage} alt={`${journeyId} end ${endLabel}`} />
        </>
      )}
    </div>
  );
}

export function Preview() {
  const {
    project,
    selection,
    playing,
    setPlaying,
    playheadTime,
    setPlayheadTime,
    syncJourneyClipDuration,
  } = useProject();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [overlay, setOverlay] = useState(true);
  const [layers, setLayers] = useState<OverlayLayers>(DEFAULT_OVERLAY_LAYERS);
  const [motionMode, setMotionMode] = useState<"canonical" | "primed">("canonical");
  const layout = layoutShootTimeline(project, 1);

  const selectedJourney =
    selection.kind === "journey"
      ? project.journeys.find((journey) => journey.id === selection.journeyId)
      : null;
  const journeyBand = selection.kind === "journey" ? selection.band : null;
  const occurrence =
    selection.kind === "destination"
      ? layout.occurrences.find((item) => item.occurrenceIndex === selection.occurrenceIndex)
      : null;
  const startDestination = destinationById(
    project.destinations,
    selection.kind === "destination"
      ? selection.destinationId
      : selectedJourney?.startDestinationId ?? "A",
  );
  const endDestination = selectedJourney?.endDestinationId
    ? destinationById(project.destinations, selectedJourney.endDestinationId)
    : undefined;
  const playable = selectedJourney ? journeyIsPlayable(selectedJourney) : false;
  const canShowStills = Boolean(selectedJourney && startDestination && endDestination);
  const showMotion = Boolean(selectedJourney && journeyBand === "motion");
  const showFootage = Boolean(selectedJourney && journeyBand === "footage");
  const showVideo = showFootage && playable && Boolean(selectedJourney?.videoUrl);
  const showStills = showMotion && canShowStills;
  const destination = startDestination;
  const shootEmpty = layout.occurrences.length === 0;
  const camotionRecords =
    selection.kind === "destination"
      ? camotionRecordsForDestination(
          project,
          selection.destinationId,
          occurrence?.inboundJourneyId ?? null,
          occurrence?.outboundJourneyId ?? null,
        )
      : [];
  const showCamotionToggle =
    project.journeys.length > 0 && selection.kind === "destination" && Boolean(destination);
  const destinationKey =
    selection.kind === "destination" ? `${selection.destinationId}:${selection.occurrenceIndex}` : "";
  const take = selectedJourney?.take;
  const motionSource = selectedJourney?.motionPlan ?? take;
  const showMotionOverlay = showMotion && Boolean(motionSource);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showVideo) {
      video?.pause();
      return;
    }
    if (playing) {
      void video.play();
    } else {
      video.pause();
    }
  }, [playing, showVideo, selectedJourney?.id]);

  const title = shootEmpty
    ? "Preview"
    : showMotion && selectedJourney
      ? `Preview · Motion ${selectedJourney.id}`
      : showFootage && selectedJourney
        ? `Preview · Footage ${selectedJourney.id}`
        : destination
          ? `Preview · Destination ${destination.label}${occurrence?.arrivalBlocked ? " · arrival blocked" : ""}`
          : "Preview";

  let caption = destination ? `Destination ${destination.label}` : "";
  if (shootEmpty) {
    caption = "Nothing is ready to shoot until the journey has actual adjacent destinations.";
  } else if (occurrence?.arrivalBlocked) {
    caption = ARRIVAL_BLOCKED_COPY;
  }

  if (showCamotionToggle && destination) {
    return (
      <DestinationCamotionPreview
        key={destinationKey}
        destination={destination}
        records={camotionRecords}
        arrivalBlocked={Boolean(occurrence?.arrivalBlocked)}
        title={title}
      />
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-1.5 overflow-hidden bg-black p-2">
      <PreviewHeader
        title={title}
        trailing={
          showMotion && selectedJourney && startDestination && endDestination && motionSource ? (
            <CamotionFrameSwitch
              destinationLabel={`${startDestination.label}|${endDestination.label}`}
              primedLabel={`${startDestination.label}′|${endDestination.label}′`}
              mode={motionMode}
              onChange={setMotionMode}
            />
          ) : undefined
        }
      />
      <PreviewMonitor pair={showStills}>
        {showVideo && selectedJourney?.videoUrl ? (
          <video
            ref={videoRef}
            key={selectedJourney.id}
            className="rounded bg-black"
            src={selectedJourney.videoUrl}
            poster={destinationById(project.destinations, selectedJourney.startDestinationId)?.image}
            controls
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onLoadedMetadata={(event) => {
              syncJourneyClipDuration(selectedJourney.id, event.currentTarget.duration);
            }}
            onTimeUpdate={(event) => {
              const laid = layout.journeys.find((item) => item.journeyId === selectedJourney.id);
              if (!laid) {
                return;
              }
              setPlayheadTime(laid.startTime + event.currentTarget.currentTime);
            }}
          />
        ) : showFootage && selectedJourney ? (
          <p className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-[#9a8f7e]">
            No footage for this traversal.
          </p>
        ) : showStills && selectedJourney && startDestination && endDestination ? (
          <JourneyCanonicalPair
            journeyId={selectedJourney.id}
            startLabel={startDestination.label}
            startImage={
              motionMode === "primed" && motionSource
                ? motionSource.startShootingFrame.imageUrl
                : startDestination.image
            }
            endLabel={endDestination.label}
            endImage={
              motionMode === "primed" && motionSource
                ? motionSource.endShootingFrame.imageUrl
                : endDestination.image
            }
            startPlan={motionSource?.startPlan ?? null}
            endPlan={motionSource?.endPlan ?? null}
            overlay={overlay && showMotionOverlay}
            layers={layers}
          />
        ) : destination ? (
          <img src={destination.image} alt={`Destination ${destination.label}`} />
        ) : null}
      </PreviewMonitor>
      {showMotion && selectedJourney && showMotionOverlay ? (
        <div className="flex min-h-5 flex-none flex-wrap items-center gap-2">
          <CamotionOverlayToggles
            overlay={overlay}
            layers={layers}
            onOverlayChange={setOverlay}
            onLayersChange={setLayers}
          />
        </div>
      ) : showFootage && selectedJourney && playable ? (
        <p className="h-5 flex-none truncate text-sm text-[#9a8f7e]">Rendered · {playheadTime.toFixed(1)}s</p>
      ) : (
        <p
          className={`h-5 flex-none truncate text-sm ${occurrence?.arrivalBlocked ? "text-[#f0c2a8]" : "text-[#9a8f7e]"}`}
        >
          {caption}
        </p>
      )}
    </section>
  );
}
