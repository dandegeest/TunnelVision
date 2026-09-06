import { useEffect, useRef } from "react";
import { LOOP_ARRIVAL_COPY } from "../fixtures/wardrobe-loop";
import { journeyIsPlayable } from "../project/policy";
import { useProject } from "../project/ProjectProvider";
import { destinationById } from "../project/types";
import { layoutTimeline } from "../timeline/geometry";

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

  if (selectedJourney && !playable) {
    return (
      <section className="flex h-full min-h-0 flex-col gap-2 overflow-hidden bg-black p-4">
        <p className="flex-none text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Preview · {selectedJourney.id}</p>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded bg-[#161410]">
          {destination ? (
            <img src={destination.image} alt="" className="h-full w-full object-cover opacity-40" />
          ) : null}
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-[#f0c2a8]">
            {LOOP_ARRIVAL_COPY}
          </div>
        </div>
        <p className="flex-none text-sm text-[#9a8f7e]">This journey is not a finished movie clip.</p>
      </section>
    );
  }

  if (playable && selectedJourney?.videoUrl) {
    const startStill = destinationById(project.destinations, selectedJourney.startDestinationId);
    return (
      <section className="flex h-full min-h-0 flex-col gap-2 overflow-hidden bg-black p-4">
        <p className="flex-none text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Preview · {selectedJourney.id}</p>
        <div className="min-h-0 flex-1 overflow-hidden">
          <video
            ref={videoRef}
            key={selectedJourney.id}
            className="h-full w-full rounded bg-black object-contain"
            src={selectedJourney.videoUrl}
            poster={startStill?.image}
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
        </div>
        <p className="flex-none text-sm text-[#9a8f7e]">
          {selectedJourney.status === "needs_review" ? "Rendered · needs review" : "Rendered"} · {playheadTime.toFixed(1)}s
        </p>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 overflow-hidden bg-black p-4">
      <p className="flex-none text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">
        Preview · Destination {destination?.label}
        {occurrence?.arrivalBlocked ? " · arrival blocked" : ""}
      </p>
      {destination ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <img
            src={destination.image}
            alt={`Destination ${destination.label}`}
            className="h-full w-full rounded object-cover"
          />
        </div>
      ) : null}
      {occurrence?.arrivalBlocked ? (
        <p className="flex-none text-sm text-[#f0c2a8]">{LOOP_ARRIVAL_COPY}</p>
      ) : (
        <p className="flex-none text-sm text-[#9a8f7e]">Still from the generated set.</p>
      )}
    </section>
  );
}
