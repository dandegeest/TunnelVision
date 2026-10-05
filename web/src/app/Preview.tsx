import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ARRIVAL_BLOCKED_COPY, journeyIsPlayable } from "../project/policy";
import { selectedTake, selectedTakeVideoUrl, takeDisplayLabel, takeHasShootingFrames } from "../project/takes";
import { useProject } from "../project/ProjectProvider";
import {
  GENERATED_OPENING_ASPECT_RATIO,
  previewFrameAspectRatio,
  previewMonitorAspectRatio,
  type ImageAspectRatio,
} from "../project/canonical-aspect";
import { destinationById, type CameraMotionPlanV1, type Destination } from "../project/types";
import { DestinationChevron } from "./DestinationChevron";
import { layoutShootTimeline, neighboringMotionJourney, neighboringShootOccurrence } from "../timeline/shoot-layout";
import type { LaidOutOccurrence } from "../timeline/geometry";
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
import { useContinuousCut } from "../playback/continuous-cut";
import { mediaTimeForTimeline, timelineTimeForMedia } from "../playback/time-map";

function PreviewMonitor({
  children,
  pair = false,
  aspect,
}: {
  children: ReactNode;
  pair?: boolean;
  aspect?: ImageAspectRatio;
}) {
  const monitor = previewMonitorAspectRatio(aspect ?? GENERATED_OPENING_ASPECT_RATIO, pair);
  return (
    <div className="preview-stage">
      <div
        className={pair ? "preview-monitor preview-monitor-pair" : "preview-monitor"}
        style={
          {
            "--preview-ar-w": monitor.width,
            "--preview-ar-h": monitor.height,
          } as CSSProperties
        }
        data-preview-aspect={`${monitor.width}/${monitor.height}`}
      >
        {children}
      </div>
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

function PreviewChevronFrame({
  previousLabel,
  nextLabel,
  previousDisabled,
  nextDisabled,
  onPrevious,
  onNext,
  children,
}: {
  previousLabel: string;
  nextLabel: string;
  previousDisabled: boolean;
  nextDisabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 items-stretch">
      <DestinationChevron
        direction="prev"
        label={previousLabel}
        disabled={previousDisabled}
        onClick={onPrevious}
      />
      {children}
      <DestinationChevron direction="next" label={nextLabel} disabled={nextDisabled} onClick={onNext} />
    </div>
  );
}

function DestinationCamotionPreview({
  destination,
  records,
  arrivalBlocked,
  title,
  aspect,
  previousOccurrence,
  nextOccurrence,
  onSelectOccurrence,
  mode,
  onModeChange,
}: {
  destination: Destination;
  records: readonly DestinationCamotionRecord[];
  arrivalBlocked: boolean;
  title: string;
  aspect?: ImageAspectRatio;
  previousOccurrence?: LaidOutOccurrence;
  nextOccurrence?: LaidOutOccurrence;
  onSelectOccurrence: (occurrence: LaidOutOccurrence) => void;
  mode: "canonical" | "primed";
  onModeChange: (mode: "canonical" | "primed") => void;
}) {
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
            onChange={onModeChange}
          />
        }
      />
      <PreviewChevronFrame
        previousLabel="Previous destination"
        nextLabel="Next destination"
        previousDisabled={!previousOccurrence}
        nextDisabled={!nextOccurrence}
        onPrevious={() => {
          if (previousOccurrence) {
            onSelectOccurrence(previousOccurrence);
          }
        }}
        onNext={() => {
          if (nextOccurrence) {
            onSelectOccurrence(nextOccurrence);
          }
        }}
      >
        <PreviewMonitor aspect={aspect}>
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
      </PreviewChevronFrame>
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

function ContinuousCutVideo({ poster }: { poster?: string }) {
  const { url, error, spans } = useContinuousCut();
  const { playing, setPlaying, playheadTime, setPlayheadTime } = useProject();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playheadFromVideo = useRef<number | null>(null);
  const suppressPause = useRef(false);
  /** Ignore the new file's time 0 until it has been seeked to the current playhead. */
  const seekedUrl = useRef<string | null>(null);

  const seekToPlayhead = () => {
    const video = videoRef.current;
    if (!video || spans.length === 0) {
      return;
    }
    const target = mediaTimeForTimeline(playheadTime, spans);
    if (Number.isFinite(video.currentTime) && Math.abs(video.currentTime - target) > 0.08) {
      suppressPause.current = true;
      video.currentTime = target;
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) {
      return;
    }
    if (playing) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [playing, url]);

  useEffect(() => {
    if (seekedUrl.current !== url) {
      playheadFromVideo.current = null;
    }
    const echoed = playheadFromVideo.current;
    if (echoed != null && Math.abs(echoed - playheadTime) < 0.05) {
      return;
    }
    seekToPlayhead();
  }, [playheadTime, url, spans]);

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        className="rounded bg-black"
        src={url ?? undefined}
        poster={poster}
        controls
        playsInline
        preload="auto"
        aria-label="Continuous preview"
        onPlay={() => setPlaying(true)}
        onPause={() => {
          const video = videoRef.current;
          if (suppressPause.current || video?.seeking) {
            return;
          }
          setPlaying(false);
        }}
        onSeeked={() => {
          if (!suppressPause.current) {
            return;
          }
          suppressPause.current = false;
          if (playing) {
            void videoRef.current?.play().catch(() => undefined);
          }
        }}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={() => {
          seekToPlayhead();
          seekedUrl.current = url;
          if (playing) {
            void videoRef.current?.play().catch(() => undefined);
          }
        }}
        onTimeUpdate={(event) => {
          if (!url || seekedUrl.current !== url || spans.length === 0) {
            return;
          }
          const next = timelineTimeForMedia(event.currentTarget.currentTime, spans);
          playheadFromVideo.current = next;
          setPlayheadTime(next);
        }}
      />
      {!url ? (
        <p
          className={`pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm ${error ? "text-[#f0c2a8]" : "text-[#9a8f7e]"}`}
        >
          {error ?? "Assembling preview…"}
        </p>
      ) : null}
    </div>
  );
}

export function Preview() {
  const {
    project,
    selection,
    playheadTime,
    cutPlaybackJourneyId,
    select,
  } = useProject();
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
  const playbackJourney = cutPlaybackJourneyId
    ? project.journeys.find((journey) => journey.id === cutPlaybackJourneyId) ?? null
    : selectedJourney;
  const startDestination = destinationById(
    project.destinations,
    selection.kind === "destination" && !cutPlaybackJourneyId
      ? selection.destinationId
      : playbackJourney?.startDestinationId ?? selectedJourney?.startDestinationId ?? "A",
  );
  const endDestination = playbackJourney?.endDestinationId
    ? destinationById(project.destinations, playbackJourney.endDestinationId)
    : selectedJourney?.endDestinationId
      ? destinationById(project.destinations, selectedJourney.endDestinationId)
      : undefined;
  const playable = playbackJourney ? journeyIsPlayable(playbackJourney) : false;
  const canShowStills = Boolean(selectedJourney && startDestination && endDestination);
  const showMotion = Boolean(selectedJourney && journeyBand === "motion" && !cutPlaybackJourneyId);
  const showFootage = Boolean(
    (selectedJourney && journeyBand === "footage" && !cutPlaybackJourneyId) || cutPlaybackJourneyId,
  );
  const currentTake = playbackJourney ? selectedTake(playbackJourney) : undefined;
  const videoUrl = playbackJourney ? selectedTakeVideoUrl(playbackJourney) : undefined;
  const showVideo = Boolean(showFootage && playable && videoUrl && playbackJourney);
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
    !cutPlaybackJourneyId &&
    project.journeys.length > 0 &&
    selection.kind === "destination" &&
    Boolean(destination);
  const destinationKey =
    selection.kind === "destination" ? `${selection.destinationId}:${selection.occurrenceIndex}` : "";
  const take = currentTake;
  const motionSource = selectedJourney?.motionPlan ?? (takeHasShootingFrames(take) ? take : undefined);
  const showMotionOverlay = showMotion && Boolean(motionSource);
  const previousMotion =
    showStills && selectedJourney
      ? neighboringMotionJourney(project.journeys, selectedJourney.id, -1)
      : undefined;
  const nextMotion =
    showStills && selectedJourney
      ? neighboringMotionJourney(project.journeys, selectedJourney.id, 1)
      : undefined;
  const previousDest =
    showCamotionToggle && selection.kind === "destination"
      ? neighboringShootOccurrence(layout.occurrences, selection.occurrenceIndex, -1)
      : undefined;
  const nextDest =
    showCamotionToggle && selection.kind === "destination"
      ? neighboringShootOccurrence(layout.occurrences, selection.occurrenceIndex, 1)
      : undefined;

  const title = shootEmpty
    ? "Preview"
    : showMotion && selectedJourney
      ? `Preview · Motion ${selectedJourney.id}`
      : showFootage && playbackJourney
        ? `Preview · Take ${playbackJourney.id}${currentTake ? ` · ${takeDisplayLabel(currentTake)}` : ""}`
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
        aspect={previewFrameAspectRatio(project, destination.id)}
        previousOccurrence={previousDest}
        nextOccurrence={nextDest}
        mode={motionMode}
        onModeChange={setMotionMode}
        onSelectOccurrence={(item) => {
          select({
            kind: "destination",
            destinationId: item.destinationId,
            occurrenceIndex: item.occurrenceIndex,
          });
        }}
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
      {showStills && selectedJourney ? (
        <PreviewChevronFrame
          previousLabel="Previous motion"
          nextLabel="Next motion"
          previousDisabled={!previousMotion}
          nextDisabled={!nextMotion}
          onPrevious={() => {
            if (previousMotion) {
              select({ kind: "journey", journeyId: previousMotion.id, band: "motion" });
            }
          }}
          onNext={() => {
            if (nextMotion) {
              select({ kind: "journey", journeyId: nextMotion.id, band: "motion" });
            }
          }}
        >
          <PreviewMonitor
            pair={showStills}
            aspect={previewFrameAspectRatio(project, selectedJourney.startDestinationId)}
          >
            {startDestination && endDestination ? (
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
            ) : null}
          </PreviewMonitor>
        </PreviewChevronFrame>
      ) : (
        <PreviewMonitor
          pair={false}
          aspect={
            showVideo ? GENERATED_OPENING_ASPECT_RATIO : previewFrameAspectRatio(project, destination?.id)
          }
        >
        {showVideo && playbackJourney ? (
          <ContinuousCutVideo
            poster={destinationById(project.destinations, playbackJourney.startDestinationId)?.image}
          />
        ) : showFootage && playbackJourney ? (
          <p className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-[#9a8f7e]">
            No take selected for this traversal.
          </p>
        ) : destination ? (
          <img src={destination.image} alt={`Destination ${destination.label}`} />
        ) : null}
        </PreviewMonitor>
      )}
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
