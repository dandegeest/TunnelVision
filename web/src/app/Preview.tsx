import { useEffect, useRef, type ReactNode } from "react";
import { ARRIVAL_BLOCKED_COPY, journeyIsPlayable } from "../project/policy";
import { useProject } from "../project/ProjectProvider";
import { destinationById } from "../project/types";
import { layoutTimeline } from "../timeline/geometry";

function PreviewMonitor({ children }: { children: ReactNode }) {
  return (
    <div className="preview-stage">
      <div className="preview-monitor">{children}</div>
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
  const destination = destinationById(
    project.destinations,
    selection.kind === "destination" ? selection.destinationId : selectedJourney?.startDestinationId ?? "A",
  );

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

  const title = selectedJourney
    ? `Preview · ${selectedJourney.id}`
    : `Preview · Destination ${destination?.label}${occurrence?.arrivalBlocked ? " · arrival blocked" : ""}`;

  let caption = "This is what the generated world actually gave us.";
  if (selectedJourney && !playable) {
    caption = "This journey is not a finished movie clip.";
  } else if (playable && selectedJourney) {
    caption = `Rendered · ${playheadTime.toFixed(1)}s`;
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
            onTimeUpdate={(event) => {
              const laid = layout.journeys.find((item) => item.journeyId === selectedJourney.id);
              if (!laid) {
                return;
              }
              setPlayheadTime(laid.startTime + event.currentTarget.currentTime);
            }}
          />
        ) : (
          <>
            {destination ? (
              <img
                src={destination.image}
                alt={selectedJourney ? "" : `Destination ${destination.label}`}
                className={`rounded ${selectedJourney && !playable ? "opacity-40" : ""}`}
              />
            ) : null}
            {selectedJourney && !playable ? (
              <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-[#f0c2a8]">
                {ARRIVAL_BLOCKED_COPY}
              </div>
            ) : null}
          </>
        )}
      </PreviewMonitor>
      <p
        className={`h-5 flex-none truncate text-sm ${occurrence?.arrivalBlocked || (selectedJourney && !playable) ? "text-[#f0c2a8]" : "text-[#9a8f7e]"}`}
      >
        {caption}
      </p>
    </section>
  );
}
