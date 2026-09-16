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
import {
  cutPlaybackSlotFromClip,
  nextCurrentCutClip,
  reconcileCutPlaybackSlots,
  type CutPlaybackSlot,
} from "../project/current-cut";

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

function DestinationCamotionPreview({
  destination,
  records,
  arrivalBlocked,
  title,
  aspect,
}: {
  destination: Destination;
  records: readonly DestinationCamotionRecord[];
  arrivalBlocked: boolean;
  title: string;
  aspect?: ImageAspectRatio;
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

function CutPlaybackVideos({
  currentKey,
  currentUrl,
  nextClip,
  startOffset,
  playing,
  poster,
  journeyId,
  startTime,
  onEnded,
  onTimeUpdate,
  onDuration,
}: {
  currentKey: string;
  currentUrl: string;
  nextClip: ReturnType<typeof nextCurrentCutClip>;
  startOffset: number;
  playing: boolean;
  poster?: string;
  journeyId: string;
  startTime: number;
  onEnded: () => void;
  onTimeUpdate: (time: number) => void;
  onDuration: (duration: number) => void;
}) {
  const slot0Ref = useRef<HTMLVideoElement>(null);
  const slot1Ref = useRef<HTMLVideoElement>(null);
  const refs = [slot0Ref, slot1Ref] as const;
  const [front, setFront] = useState<0 | 1>(0);
  const [slots, setSlots] = useState<[CutPlaybackSlot, CutPlaybackSlot]>([
    { key: currentKey, url: currentUrl },
    cutPlaybackSlotFromClip(nextClip),
  ]);
  const nextSlot = cutPlaybackSlotFromClip(nextClip);

  useEffect(() => {
    const reconciled = reconcileCutPlaybackSlots(front, slots, { key: currentKey, url: currentUrl }, nextSlot);
    if (reconciled.front !== front) {
      setFront(reconciled.front);
    }
    if (reconciled.slots[0].key !== slots[0].key || reconciled.slots[1].key !== slots[1].key) {
      setSlots(reconciled.slots);
    }
  }, [currentKey, currentUrl, front, nextSlot.key, nextSlot.url, slots]);

  useEffect(() => {
    const visible = refs[front].current;
    if (!visible) {
      return;
    }
    visible.muted = false;
    if (playing) {
      void visible.play().catch(() => undefined);
    } else {
      visible.pause();
    }
  }, [front, playing, currentKey]);

  useEffect(() => {
    const hidden = refs[front === 0 ? 1 : 0].current;
    const standby = slots[front === 0 ? 1 : 0];
    if (!hidden || !standby.url) {
      return;
    }
    hidden.muted = true;
    hidden.preload = "auto";
    const warm = hidden.play();
    if (warm) {
      void warm
        .then(() => {
          hidden.pause();
          hidden.currentTime = 0;
        })
        .catch(() => undefined);
    }
  }, [front, slots]);

  return (
    <div className="relative h-full w-full">
      {slots.map((slot, index) => {
        const visible = index === front;
        return (
          <video
            key={slot.key || `empty-${index}`}
            ref={refs[index]}
            className={visible ? "rounded bg-black" : "pointer-events-none absolute h-0 w-0 opacity-0"}
            src={slot.url || undefined}
            poster={visible ? poster : undefined}
            controls={false}
            preload="auto"
            playsInline
            muted={!visible}
            data-cut-slot={visible ? "current" : "next"}
            data-cut-key={slot.key}
            onEnded={() => {
              if (visible) {
                onEnded();
              }
            }}
            onLoadedMetadata={(event) => {
              if (visible) {
                onDuration(event.currentTarget.duration);
                if (startOffset > 0) {
                  event.currentTarget.currentTime = startOffset;
                }
              }
            }}
            onTimeUpdate={(event) => {
              if (visible) {
                onTimeUpdate(startTime + event.currentTarget.currentTime);
              }
            }}
          />
        );
      })}
      <span className="sr-only">{`Cut playback ${journeyId}`}</span>
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
    cutPlaybackJourneyId,
    cutStartOffset,
    advanceCutClip,
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
  }, [playing, showVideo, playbackJourney?.id, videoUrl]);

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
      <PreviewMonitor
        pair={showStills}
        aspect={
          showVideo
            ? GENERATED_OPENING_ASPECT_RATIO
            : previewFrameAspectRatio(
                project,
                showStills && selectedJourney ? selectedJourney.startDestinationId : destination?.id,
              )
        }
      >
        {showVideo && videoUrl && playbackJourney && cutPlaybackJourneyId ? (
          <CutPlaybackVideos
            currentKey={`${playbackJourney.id}:${currentTake?.id ?? currentTake?.number ?? "clip"}`}
            currentUrl={videoUrl}
            nextClip={nextCurrentCutClip(project, cutPlaybackJourneyId)}
            startOffset={cutStartOffset}
            playing={playing}
            poster={destinationById(project.destinations, playbackJourney.startDestinationId)?.image}
            journeyId={playbackJourney.id}
            startTime={layout.journeys.find((item) => item.journeyId === playbackJourney.id)?.startTime ?? 0}
            onEnded={advanceCutClip}
            onTimeUpdate={setPlayheadTime}
            onDuration={(duration) => syncJourneyClipDuration(playbackJourney.id, duration)}
          />
        ) : showVideo && videoUrl && playbackJourney ? (
          <video
            ref={videoRef}
            key={`${playbackJourney.id}:${currentTake?.id ?? currentTake?.number ?? "clip"}:${cutStartOffset}`}
            className="rounded bg-black"
            src={videoUrl}
            poster={destinationById(project.destinations, playbackJourney.startDestinationId)?.image}
            controls
            preload="auto"
            onPlay={() => setPlaying(true)}
            onPause={() => {
              setPlaying(false);
            }}
            onEnded={() => {
              setPlaying(false);
            }}
            onLoadedMetadata={(event) => {
              syncJourneyClipDuration(playbackJourney.id, event.currentTarget.duration);
              if (cutStartOffset > 0) {
                event.currentTarget.currentTime = cutStartOffset;
              }
            }}
            onTimeUpdate={(event) => {
              const laid = layout.journeys.find((item) => item.journeyId === playbackJourney.id);
              if (!laid) {
                return;
              }
              setPlayheadTime(laid.startTime + event.currentTarget.currentTime);
            }}
          />
        ) : showFootage && playbackJourney ? (
          <p className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-[#9a8f7e]">
            No take selected for this traversal.
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
