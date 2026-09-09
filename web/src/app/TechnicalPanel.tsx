import { useEffect, useMemo, useState } from "react";
import { useProject } from "../project/ProjectProvider";
import type { JourneyShot, StoryboardFrame } from "../project/types";
import { actualFrameForDestination } from "../project/cinematographer";

type DebugMediaSnapshot = {
  storeDirectory: string | null;
  records: { mediaId: string; filePath: string; mimeType: string }[];
  camotion: {
    workDirPrefix: string;
    depth: string;
    cleanup: string;
  };
};

function pathForId(snapshot: DebugMediaSnapshot | null, mediaId: string | undefined) {
  if (!mediaId || !snapshot) {
    return undefined;
  }
  return snapshot.records.find((record) => record.mediaId === mediaId)?.filePath;
}

function DebugPath({ label, value }: { label: string; value?: string | null }) {
  return (
    <p>
      <span className="text-[#9a8f7e]">{label}. </span>
      <span className="break-all text-[#cfc6b8]">{value?.trim() ? value : "—"}</span>
    </p>
  );
}

export function TechnicalPanel() {
  const { debugOn, project, selection } = useProject();
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<DebugMediaSnapshot | null>(null);

  const selectedFrame = useMemo((): StoryboardFrame | undefined => {
    if (selection.kind === "storyboard") {
      return project.storyboard.find((frame) => frame.id === selection.frameId);
    }
    if (selection.kind === "destination") {
      return project.storyboard.find((frame) => frame.destinationId === selection.destinationId);
    }
    return undefined;
  }, [project.storyboard, selection]);

  const selectedJourney = useMemo((): JourneyShot | undefined => {
    if (selection.kind !== "journey") {
      return undefined;
    }
    return project.journeys.find((journey) => journey.id === selection.journeyId);
  }, [project.journeys, selection]);

  useEffect(() => {
    if (!debugOn) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    void fetch("/api/debug/media")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: DebugMediaSnapshot | null) => {
        if (!cancelled && body) {
          setSnapshot(body);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSnapshot(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debugOn, project, open]);

  const startCanonical = selectedJourney
    ? actualFrameForDestination(project, selectedJourney.startDestinationId)
    : undefined;
  const endCanonical =
    selectedJourney?.endDestinationId
      ? actualFrameForDestination(project, selectedJourney.endDestinationId)
      : undefined;

  return (
    <details
      className="mt-auto border-t border-[#2a2620] pt-3 text-xs text-[#9a8f7e]"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer tracking-[0.16em] uppercase">Technical</summary>
      <div className="mt-2 space-y-1 leading-relaxed">
        <p>Construction: planned. Discovery is not implemented.</p>
        <p>
          Video uses Camotion shooting frames and a configurable provider model. The current
          development generator receives A′ and B′ as start and last-frame conditions.
        </p>
        {debugOn ? (
          <div className="mt-3 space-y-1 border-t border-[#2a2620] pt-2">
            <p className="tracking-[0.16em] uppercase">Debug</p>
            <DebugPath label="Session store" value={snapshot?.storeDirectory} />
            {selectedFrame ? (
              <>
                <DebugPath
                  label={`Canonical ${selectedFrame.label}`}
                  value={pathForId(snapshot, selectedFrame.mediaId)}
                />
                <DebugPath label="Origin" value={selectedFrame.imageOrigin} />
                <DebugPath label="Media id" value={selectedFrame.mediaId} />
              </>
            ) : (
              <p>Select a destination to inspect its canonical path.</p>
            )}
            {selectedJourney ? (
              <>
                <DebugPath
                  label={`Canonical ${selectedJourney.startDestinationId}`}
                  value={pathForId(snapshot, startCanonical?.mediaId)}
                />
                <DebugPath
                  label={`Canonical ${selectedJourney.endDestinationId ?? "end"}`}
                  value={pathForId(snapshot, endCanonical?.mediaId)}
                />
                <DebugPath
                  label="Segment A′"
                  value={pathForId(snapshot, selectedJourney.take?.startShootingFrame.mediaId)}
                />
                <DebugPath
                  label="Segment B′"
                  value={pathForId(snapshot, selectedJourney.take?.endShootingFrame.mediaId)}
                />
                <DebugPath
                  label="Camotion A′ work"
                  value={
                    selectedJourney.take?.camotion?.workDirRetained
                      ? selectedJourney.take.camotion.startWorkDir
                      : selectedJourney.take
                        ? "Deleted after copy (Debug was off)"
                        : undefined
                  }
                />
                <DebugPath
                  label="Camotion B′ work"
                  value={
                    selectedJourney.take?.camotion?.workDirRetained
                      ? selectedJourney.take.camotion.endWorkDir
                      : selectedJourney.take
                        ? "Deleted after copy (Debug was off)"
                        : undefined
                  }
                />
                <DebugPath
                  label="Depth map"
                  value={
                    selectedJourney.take
                      ? "Not created. Product shoot does not pass --depth."
                      : undefined
                  }
                />
              </>
            ) : null}
            <p>{snapshot?.camotion.depth ?? "Product shoot does not pass --depth."}</p>
            <p>
              {snapshot?.camotion.cleanup ??
                "Without Debug, Camotion work dirs are deleted after A′/B′ are copied into the session store."}
            </p>
          </div>
        ) : (
          <p>Turn on Debug in the header to inspect session asset paths and Camotion work dirs.</p>
        )}
      </div>
    </details>
  );
}
