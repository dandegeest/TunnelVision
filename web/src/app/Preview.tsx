import { useEffect, useRef, type ReactNode } from "react";
import { ARRIVAL_BLOCKED_COPY, journeyIsPlayable } from "../project/policy";
import { canAssessJourney, journeyShootButtonLabel } from "../project/cinematographer";
import { canShootJourney } from "../project/shoot";
import { useProject } from "../project/ProjectProvider";
import { destinationById, type JourneyShot } from "../project/types";
import { layoutTimeline } from "../timeline/geometry";

function PreviewMonitor({ children }: { children: ReactNode }) {
  return (
    <div className="preview-stage">
      <div className="preview-monitor">{children}</div>
    </div>
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
  const shootLabel = journeyShootButtonLabel(journey);
  const busy = assessing || shooting;
  return (
    <div className="flex h-8 flex-none items-center gap-2">
      <button
        type="button"
        className="rounded border border-[#3a342c] px-3 py-1 text-sm text-[#ece7df] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canAssess || busy}
        aria-label={`Block ${journey.id}`}
        onClick={onBlock}
      >
        {assessing ? "Blocking…" : "Block"}
      </button>
      <button
        type="button"
        className="rounded border border-[#3a342c] px-3 py-1 text-sm text-[#ece7df] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canShoot || busy}
        aria-label={`${shootLabel} ${journey.id}`}
        onClick={onShoot}
      >
        {shooting ? "Shooting…" : shootLabel}
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
  const layout = layoutTimeline(project.destinations, project.journeys, 1);

  const selectedJourney =
    selection.kind === "journey"
      ? project.journeys.find((journey) => journey.id === selection.journeyId)
      : null;
  const playable = selectedJourney ? journeyIsPlayable(selectedJourney) : false;
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
  const destination = startDestination;
  const shootEmpty = project.journeys.length === 0;
  const assessing = selectedJourney ? assessingJourneyIds.includes(selectedJourney.id) : false;
  const shooting = selectedJourney
    ? shootingJourneyIds.includes(selectedJourney.id) || selectedJourney.status === "shooting"
    : false;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playable) {
      return;
    }
    if (playing) {
      void video.play();
    } else {
      video.pause();
    }
  }, [playing, playable, selectedJourney?.id]);

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

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 overflow-hidden bg-black p-4">
      <p className="h-5 flex-none truncate text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">{title}</p>
      <PreviewMonitor>
        {playable && selectedJourney?.videoUrl ? (
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
        ) : selectedJourney && startDestination && endDestination ? (
          <div className="preview-leg">
            <img src={startDestination.image} alt={`${selectedJourney.id} start ${startDestination.label}`} />
            <img src={endDestination.image} alt={`${selectedJourney.id} end ${endDestination.label}`} />
          </div>
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
