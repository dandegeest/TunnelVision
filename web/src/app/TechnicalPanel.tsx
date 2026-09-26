import { useEffect, useMemo, useState } from "react";
import { useProject } from "../project/ProjectProvider";
import type { JourneyShot, StoryboardFrame } from "../project/types";
import { actualFrameForDestination } from "../project/cinematographer";
import { DisclosureMarker, disclosureSummaryClass } from "../ui/Disclosure";

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

/** Session Technical/Debug path panel. Not mounted in the Shoot inspector. */
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
  }, [debugOn, open, project]);

  const startCanonical = selectedJourney
    ? actualFrameForDestination(project, selectedJourney.startDestinationId)
    : undefined;
  const endCanonical =
    selectedJourney?.endDestinationId
      ? actualFrameForDestination(project, selectedJourney.endDestinationId)
      : undefined;

  return (
    <details
      className="tv-disclosure mt-auto border-t border-[#2a2620] pt-3 text-[#9a8f7e]"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className={disclosureSummaryClass}>
        <DisclosureMarker />
        Technical
      </summary>
      <div className="mt-2 space-y-1 text-xs leading-relaxed">
        <p>Construction: planned. Discovery is not implemented.</p>
        <p>
          Video uses Camotion shooting frames and the Project panel Video
          model for every SHOOT. Pruna is the development default. Mid-tier
          and Seedance 2.5 map A′/B′ onto that generator's start and last-frame
          fields.
        </p>
        {debugOn ? (
          <div className="mt-3 space-y-1 border-t border-[#2a2620] pt-2">
            <p className="text-[10px] tracking-[0.16em] text-[#9a8f7e] uppercase">Debug</p>
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
                  value={pathForId(
                    snapshot,
                    selectedJourney.motionPlan?.startShootingFrame.mediaId ??
                      selectedJourney.take?.startShootingFrame.mediaId,
                  )}
                />
                <DebugPath
                  label="Segment B′"
                  value={pathForId(
                    snapshot,
                    selectedJourney.motionPlan?.endShootingFrame.mediaId ??
                      selectedJourney.take?.endShootingFrame.mediaId,
                  )}
                />
                <DebugPath
                  label="Camotion A′ work"
                  value={
                    (selectedJourney.motionPlan?.camotion ?? selectedJourney.take?.camotion)?.workDirRetained
                      ? (selectedJourney.motionPlan?.camotion ?? selectedJourney.take?.camotion)?.startWorkDir
                      : selectedJourney.motionPlan || selectedJourney.take
                        ? "Deleted after copy (Debug was off)"
                        : undefined
                  }
                />
                <DebugPath
                  label="Camotion B′ work"
                  value={
                    (selectedJourney.motionPlan?.camotion ?? selectedJourney.take?.camotion)?.workDirRetained
                      ? (selectedJourney.motionPlan?.camotion ?? selectedJourney.take?.camotion)?.endWorkDir
                      : selectedJourney.motionPlan || selectedJourney.take
                        ? "Deleted after copy (Debug was off)"
                        : undefined
                  }
                />
                <DebugPath
                  label="Depth map"
                  value={
                    (selectedJourney.motionPlan?.camotion ?? selectedJourney.take?.camotion)?.depthSupplied
                      ? (selectedJourney.motionPlan?.camotion ?? selectedJourney.take?.camotion)?.startDepthPath ??
                        (selectedJourney.motionPlan?.camotion ?? selectedJourney.take?.camotion)?.depthPath ??
                        "Estimated and reused for this canonical."
                      : selectedJourney.motionPlan || selectedJourney.take
                        ? "Unavailable. Camotion used destination/VP weights only."
                        : undefined
                  }
                />
              </>
            ) : null}
            <p>
              {snapshot?.camotion.depth ??
                "Product shoot estimates a reusable near-weight depth map per unchanged canonical."}
            </p>
            <p>
              {snapshot?.camotion.cleanup ??
                "Without Debug, Camotion work dirs are deleted after A′/B′ are copied into the session store."}
            </p>
          </div>
        ) : (
          <p>Turn on Debug mode in Project settings to inspect session asset paths and Camotion work dirs.</p>
        )}
      </div>
    </details>
  );
}
