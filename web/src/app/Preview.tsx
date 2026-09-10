import { useEffect, useRef, useState, type ReactNode } from "react";
import { ARRIVAL_BLOCKED_COPY, journeyIsPlayable } from "../project/policy";
import { canAssessJourney } from "../project/cinematographer";
import { canShootJourney } from "../project/shoot";
import { useProject } from "../project/ProjectProvider";
import { destinationById, type Destination, type JourneyShot } from "../project/types";
import { layoutTimeline } from "../timeline/geometry";
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

function PreviewMonitor({ children }: { children: ReactNode }) {
  return (
    <div className="preview-stage">
      <div className="preview-monitor">{children}</div>
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
    <section className="flex h-full min-h-0 flex-col gap-2 overflow-hidden bg-black p-4">
      <div className="flex min-h-5 flex-none items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">{title}</p>
        <CamotionFrameSwitch
          destinationLabel={destination.label}
          primedLabel={`${destination.label}′`}
          mode={mode}
          onChange={setMode}
        />
      </div>
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
}: {
  journeyId: string;
  startLabel: string;
  startImage: string;
  endLabel: string;
  endImage: string;
}) {
  return (
    <div className="preview-leg">
      <img src={startImage} alt={`${journeyId} start ${startLabel}`} />
      <img src={endImage} alt={`${journeyId} end ${endLabel}`} />
    </div>
  );
}

export function PreviewModeSwitch({
  startLabel,
  endLabel,
  mode,
  onChange,
}: {
  startLabel: string;
  endLabel: string;
  mode: "video" | "stills";
  onChange: (mode: "video" | "stills") => void;
}) {
  const stillsLabel = `${startLabel}|${endLabel}`;
  return (
    <nav
      className="flex shrink-0 items-center gap-0.5 rounded-full border border-[#3a342c] p-0.5 text-[11px]"
      aria-label="Preview mode"
    >
      <button
        type="button"
        aria-pressed={mode === "video"}
        aria-label="Preview video"
        className={`rounded-full px-2.5 py-0.5 tracking-[0.14em] uppercase outline-none ${
          mode === "video" ? "bg-[#ece7df] text-[#0c0b0a]" : "text-[#cfc6b8] hover:text-[#ece7df]"
        }`}
        onClick={() => onChange("video")}
      >
        Video
      </button>
      <button
        type="button"
        aria-pressed={mode === "stills"}
        aria-label={`Preview ${stillsLabel}`}
        className={`rounded-full px-2.5 py-0.5 tracking-[0.14em] uppercase outline-none ${
          mode === "stills" ? "bg-[#ece7df] text-[#0c0b0a]" : "text-[#cfc6b8] hover:text-[#ece7df]"
        }`}
        onClick={() => onChange("stills")}
      >
        {stillsLabel}
      </button>
    </nav>
  );
}

function JourneyActions({
  journey,
  assessing,
  shooting,
  canAssess,
  canShoot,
  playable,
  playheadTime,
  onBlock,
  onShoot,
}: {
  journey: JourneyShot;
  assessing: boolean;
  shooting: boolean;
  canAssess: boolean;
  canShoot: boolean;
  playable: boolean;
  playheadTime: number;
  onBlock: () => void;
  onShoot: () => void;
}) {
  const busy = assessing || shooting;
  return (
    <div className="flex h-8 flex-none items-center gap-2">
      <button
        type="button"
        className="rounded border border-[#3a342c] px-3 py-1 text-sm text-[#ece7df] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canAssess || busy}
        aria-label={`Stage ${journey.id}`}
        onClick={onBlock}
      >
        {assessing ? "Staging…" : "Stage"}
      </button>
      <button
        type="button"
        className="rounded border border-[#3a342c] px-3 py-1 text-sm text-[#ece7df] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canShoot || busy}
        aria-label={`Generate ${journey.id}`}
        onClick={onShoot}
      >
        {shooting ? "Generating…" : "Generate"}
      </button>
      {playable ? (
        <p className="min-w-0 truncate text-sm text-[#9a8f7e]">Rendered · {playheadTime.toFixed(1)}s</p>
      ) : null}
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
    assessJourney,
    assessingJourneyIds,
    shootJourney,
    shootingJourneyIds,
  } = useProject();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [previewMode, setPreviewMode] = useState<"video" | "stills">("video");
  const layout = layoutTimeline(project.destinations, project.journeys, 1);

  const selectedJourney =
    selection.kind === "journey"
      ? project.journeys.find((journey) => journey.id === selection.journeyId)
      : null;
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
  const showPreviewTabs = playable && canShowStills;
  const showVideo = playable && Boolean(selectedJourney?.videoUrl) && previewMode === "video";
  const showStills = canShowStills && (!playable || previewMode === "stills");
  const destination = startDestination;
  const shootEmpty = project.journeys.length === 0;
  const assessing = selectedJourney ? assessingJourneyIds.includes(selectedJourney.id) : false;
  const shooting = selectedJourney
    ? shootingJourneyIds.includes(selectedJourney.id) || selectedJourney.status === "shooting"
    : false;
  const camotionRecords =
    selection.kind === "destination"
      ? camotionRecordsForDestination(
          project,
          selection.destinationId,
          occurrence?.inboundJourneyId ?? null,
          occurrence?.outboundJourneyId ?? null,
        )
      : [];
  const showCamotionToggle = !shootEmpty && selection.kind === "destination" && Boolean(destination);
  const destinationKey =
    selection.kind === "destination" ? `${selection.destinationId}:${selection.occurrenceIndex}` : "";

  useEffect(() => {
    setPreviewMode("video");
  }, [selectedJourney?.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playable || previewMode !== "video") {
      video?.pause();
      return;
    }
    if (playing) {
      void video.play();
    } else {
      video.pause();
    }
  }, [playing, playable, previewMode, selectedJourney?.id]);

  const title = shootEmpty
    ? "Preview"
    : selectedJourney
      ? `Preview · ${selectedJourney.id}`
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
    <section className="flex h-full min-h-0 flex-col gap-2 overflow-hidden bg-black p-4">
      <div className="flex min-h-5 flex-none items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">{title}</p>
        {showPreviewTabs && startDestination && endDestination ? (
          <PreviewModeSwitch
            startLabel={startDestination.label}
            endLabel={endDestination.label}
            mode={previewMode}
            onChange={(mode) => {
              if (mode !== "video") {
                setPlaying(false);
              }
              setPreviewMode(mode);
            }}
          />
        ) : null}
      </div>
      <PreviewMonitor>
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
        ) : showStills && selectedJourney && startDestination && endDestination ? (
          <JourneyCanonicalPair
            journeyId={selectedJourney.id}
            startLabel={startDestination.label}
            startImage={startDestination.image}
            endLabel={endDestination.label}
            endImage={endDestination.image}
          />
        ) : destination ? (
          <img src={destination.image} alt={`Destination ${destination.label}`} />
        ) : null}
      </PreviewMonitor>
      {selectedJourney ? (
        <JourneyActions
          journey={selectedJourney}
          assessing={assessing}
          shooting={shooting}
          canAssess={canAssessJourney(project, selectedJourney)}
          canShoot={canShootJourney(project, selectedJourney)}
          playable={playable}
          playheadTime={playheadTime}
          onBlock={() => void assessJourney(selectedJourney.id)}
          onShoot={() => void shootJourney(selectedJourney.id)}
        />
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
