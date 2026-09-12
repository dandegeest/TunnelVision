import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useProject } from "../project/ProjectProvider";
import { canConstructDestinationFrame, canGenerateOpeningFrame, canReshootDestinationFrame, generatedStillNeedsReshoot } from "../project/destination";
import {
  displayProvenanceForFrame,
  formatMediaInfoLine,
  mediaPreflightForProject,
  preflightWarningsForFrame,
  provenanceAccessibleLabel,
  type DisplayProvenance,
  type FramePreflightWarning,
} from "../project/media-preflight";
import {
  STARTING_FRAME_ACCEPT,
  canUploadStoryboardFrame,
  hasAuthoritativeStartingFrame,
  shouldClearStoryboardPlanOnUpload,
} from "../project/starting-frame";
import { canAddStoryboardDestination, canRemoveStoryboardDestination } from "../project/storyboard";
import { previewFrameAspectRatio } from "../project/canonical-aspect";
import type { Project, StoryboardFrame } from "../project/types";
import { commitActiveTextEdit } from "../ui/commit-text-edit";
import {
  camotionRecordKey,
  camotionRecordsForCanonical,
  preferredCamotionRecord,
} from "../project/camotion-diagnostics";
import { destinationDisplayedStillUrl, DestinationInspectorPanel } from "./DestinationInspector";

export { formatDirectorEvidenceJson } from "./ConversationRail";

function ProvenanceIcon({ provenance }: { provenance: DisplayProvenance }) {
  const label = provenanceAccessibleLabel(provenance);
  const icon =
    provenance === "uploaded" ? (
      <path
        d="M6 2.5v6.5M3.75 6.25 6 4l2.25 2.25M2.5 9.5h7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ) : provenance === "generated" ? (
      <path
        d="M6 1.75 6.7 4.6 9.5 5.25 6.7 5.9 6 8.75 5.3 5.9 2.5 5.25 5.3 4.6Z"
        fill="currentColor"
      />
    ) : provenance === "derived" ? (
      <path
        d="M3.25 3.25h2.25v2.25H3.25Zm3.25 3.25h2.25v2.25H6.5M5.5 4.5 7.6 6.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ) : (
      <>
        <circle cx="6" cy="6" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M6 2.75v6.5M2.75 6h6.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </>
    );
  return (
    <span className="inline-flex shrink-0" title={label}>
      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-label={label} role="img">
        {icon}
      </svg>
    </span>
  );
}

function WarningGlyph() {
  return (
    <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden>
      <path
        d="M6 1.35 10.85 10.4H1.15Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M6 4.55v2.35" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="6" cy="8.55" r="0.5" fill="currentColor" />
    </svg>
  );
}

export function PreflightWarningControl({
  warnings,
  initiallyOpen = false,
}: {
  warnings: FramePreflightWarning[];
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  if (warnings.length === 0) {
    return null;
  }
  const title =
    warnings.length === 1 ? warnings[0]!.title : `${warnings.length} media warnings`;
  const description = warnings.map((warning) => `${warning.title}. ${warning.detail}`).join(" ");
  return (
    <span className="storyboard-preflight-warning absolute right-0.5 bottom-0.5 z-10 flex h-6 items-center">
      <button
        type="button"
        aria-expanded={open}
        aria-label={title}
        title={title}
        className="flex h-6 w-8 items-center justify-end pr-1.5 text-[#d4b36a] outline-none hover:text-[#ece7df] focus-visible:ring-1 focus-visible:ring-[#d4b36a]"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <WarningGlyph />
      </button>
      <span className="sr-only">{description}</span>
      {open ? (
        <span
          role="tooltip"
          className="absolute right-1.5 bottom-full z-20 mb-1 w-56 rounded border border-[#3a342c] bg-[#12100d] px-2.5 py-2 text-left text-[11px] leading-snug font-normal tracking-normal text-[#cfc6b8] shadow-lg"
        >
          {warnings.map((warning) => (
            <span key={warning.kind} className="block whitespace-pre-wrap">
              <span className="block text-[#ece7df]">{warning.title}</span>
              {warning.detail}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

export function StoryboardFrameMedia({
  frame,
  selected,
  constructing,
  showMediaInfo = false,
  hasWarning = false,
  planChanged = false,
  onSelect,
  onOpenReel,
  onOpenDetails,
  detailOpen = false,
}: {
  frame: StoryboardFrame;
  selected: boolean;
  constructing: boolean;
  showMediaInfo?: boolean;
  hasWarning?: boolean;
  planChanged?: boolean;
  onSelect?: () => void;
  onOpenReel?: () => void;
  onOpenDetails?: () => void;
  detailOpen?: boolean;
}) {
  const frameBorder = selected ? "border-2 border-[#ece7df]" : "border-2 border-[#3a342c]";
  const provenance = displayProvenanceForFrame(frame);
  const labelTracking = frame.label.length <= 2 ? "tracking-[0.22em]" : "tracking-normal";
  const fpoIntent = frame.intent?.trim() || undefined;
  const showPlanChanged = planChanged && !constructing;
  const stillLabel = planChanged ? `Storyboard ${frame.label}, plan changed` : `Storyboard ${frame.label}`;
  const still = frame.image ? (
    <img src={frame.image} alt="" className="media-contain block h-full w-full" />
  ) : null;

  return (
    <span className={`relative block aspect-video w-full overflow-hidden bg-black ${frameBorder}`}>
      {frame.image ? (
        <>
          {onOpenReel || onSelect ? (
            <button
              type="button"
              className="absolute inset-0 z-0 p-0"
              onClick={() => {
                if (selected && onOpenReel) {
                  onOpenReel();
                  return;
                }
                onSelect?.();
              }}
              aria-label={stillLabel}
              aria-pressed={selected}
              title={
                planChanged
                  ? "The plan changed after this still was generated. Reshoot to update it."
                  : selected
                    ? "View still"
                    : undefined
              }
            >
              {still}
            </button>
          ) : (
            still
          )}
          {onOpenDetails ? (
            <button
              type="button"
              className="storyboard-frame-label absolute inset-x-0 top-0 z-[1] flex h-6 items-center bg-[#0c0b0a]/72 px-1.5 pr-7 outline-none focus-visible:ring-1 focus-visible:ring-[#d4b36a]"
              onClick={onOpenDetails}
              aria-label={`Destination ${frame.label} plan`}
              aria-expanded={detailOpen || undefined}
            >
              <span className={`min-w-0 truncate text-[11px] text-[#ece7df] ${labelTracking}`} title={frame.label}>
                {frame.label}
              </span>
            </button>
          ) : (
            <span className="storyboard-frame-label pointer-events-none absolute inset-x-0 top-0 flex h-6 items-center bg-[#0c0b0a]/72 px-1.5 pr-7">
              <span className={`min-w-0 truncate text-[11px] text-[#ece7df] ${labelTracking}`} title={frame.label}>
                {frame.label}
              </span>
            </span>
          )}
          {showPlanChanged ? (
            <span className="storyboard-plan-changed-flag pointer-events-none">Plan changed</span>
          ) : null}
          {showMediaInfo && frame.mediaInfo ? (
            <span
              className={`storyboard-media-info absolute inset-x-0 bottom-0 z-[1] flex h-6 items-center gap-1.5 bg-[#0c0b0a]/72 px-1.5 text-[9px] leading-none tracking-[0.08em] text-[#d4cdc2] ${
                onOpenReel ? "pointer-events-auto" : "pointer-events-none"
              } ${hasWarning ? "pr-8" : ""}`}
            >
              {provenance ? <ProvenanceIcon provenance={provenance} /> : null}
              <span className="min-w-0 truncate">{formatMediaInfoLine(frame.mediaInfo)}</span>
            </span>
          ) : null}
        </>
      ) : (
        <span
          className={`storyboard-fpo storyboard-fpo-planned${constructing ? " storyboard-generating" : ""}`}
          aria-busy={constructing || undefined}
        >
          <button
            type="button"
            className="storyboard-fpo-copy outline-none"
            onClick={() => {
              if (selected && onOpenReel && destinationDetailContent(frame)) {
                onOpenReel();
                return;
              }
              onSelect?.();
            }}
            aria-label={`Storyboard ${frame.label}`}
            aria-pressed={selected}
            aria-expanded={detailOpen || undefined}
          >
            <span className="storyboard-fpo-label max-w-full truncate" title={frame.label}>
              {frame.label}
            </span>
            {fpoIntent ? (
              <span className="storyboard-fpo-intent">{formatFpoIntentField(fpoIntent)}</span>
            ) : null}
          </button>
          {constructing ? (
            <span
              className="storyboard-fpo-action"
              role="status"
              aria-label={`Generating destination ${frame.id}`}
            >
              <span className="storyboard-generating-label">Generating…</span>
            </span>
          ) : null}
        </span>
      )}
    </span>
  );
}

export function DestinationGenerateControl({
  frameId,
  constructing,
  canConstruct,
  disabled,
  onGenerate,
  title = "Generate this destination from the previous actual frame.",
}: {
  frameId: string;
  constructing: boolean;
  canConstruct: boolean;
  disabled: boolean;
  onGenerate: () => void;
  title?: string;
}) {
  if (constructing || !canConstruct) {
    return null;
  }
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Generate destination ${frameId}`}
      title={title}
      onClick={(event) => {
        event.stopPropagation();
        onGenerate();
      }}
      className="destination-generate inline-flex h-7 items-center rounded border border-[#3a342c] px-2.5 text-[11px] tracking-[0.16em] text-[#ece7df] uppercase outline-none hover:border-[#7a7266] hover:text-[#ece7df] focus-visible:border-[#ece7df] disabled:cursor-not-allowed disabled:opacity-40"
    >
      Generate
    </button>
  );
}

export function formatFpoIntentField(intent: string): string {
  return intent.trim();
}

export function destinationDetailContent(frame: StoryboardFrame): {
  label: string;
  intent?: string;
  visualDescription?: string;
} | null {
  const intent = frame.intent?.trim() || undefined;
  const visualDescription = frame.visualDescription?.trim() || undefined;
  if (!intent && !visualDescription) {
    if (frame.image && (frame.imageOrigin === "user" || frame.imageOrigin === "generated")) {
      return { label: frame.label };
    }
    return null;
  }
  if (visualDescription && intent && intent !== visualDescription) {
    return { label: frame.label, intent, visualDescription };
  }
  if (visualDescription) {
    return { label: frame.label, visualDescription };
  }
  return { label: frame.label, intent };
}

export function DestinationMenu({
  frameId,
  label,
  initiallyOpen = false,
  actionLabel = "Replace…",
  onReplace,
  onReshoot,
  onDelete,
  reshooting = false,
  reshootDisabled = false,
}: {
  frameId: string;
  label: string;
  initiallyOpen?: boolean;
  actionLabel?: string;
  onReplace?: () => void;
  onReshoot?: () => void;
  onDelete?: () => void;
  reshooting?: boolean;
  reshootDisabled?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="destination-menu absolute top-0 right-0 z-10">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Destination ${label} actions`}
        title="Destination actions"
        className="flex h-6 w-7 items-center justify-center text-[#9a8f7e] outline-none hover:text-[#ece7df] focus-visible:text-[#ece7df] focus-visible:ring-1 focus-visible:ring-[#7a7266]"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
          <circle cx="6" cy="2.4" r="0.85" fill="currentColor" />
          <circle cx="6" cy="6" r="0.85" fill="currentColor" />
          <circle cx="6" cy="9.6" r="0.85" fill="currentColor" />
        </svg>
      </button>
      {open ? (
        <span
          role="menu"
          className="absolute top-full right-0 z-20 mt-0.5 min-w-[7.5rem] rounded border border-[#3a342c] bg-[#12100d] py-1 shadow-lg"
        >
          {onReshoot ? (
            <button
              type="button"
              role="menuitem"
              aria-label={`Reshoot destination ${label}`}
              disabled={reshooting || reshootDisabled}
              className="block w-full px-2.5 py-1.5 text-left text-[12px] text-[#ece7df] outline-none hover:bg-[#1c1916] focus-visible:bg-[#1c1916] disabled:cursor-not-allowed disabled:opacity-40"
              onPointerDown={() => {
                commitActiveTextEdit();
              }}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                onReshoot();
              }}
            >
              {reshooting ? "Reshooting…" : "Reshoot"}
            </button>
          ) : null}
          {onReplace ? (
            <button
              type="button"
              role="menuitem"
              className="block w-full px-2.5 py-1.5 text-left text-[12px] text-[#ece7df] outline-none hover:bg-[#1c1916] focus-visible:bg-[#1c1916]"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                onReplace();
              }}
            >
              {actionLabel}
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              role="menuitem"
              className="block w-full px-2.5 py-1.5 text-left text-[12px] text-[#ece7df] outline-none hover:bg-[#1c1916] focus-visible:bg-[#1c1916]"
              aria-label={`Delete destination ${label}`}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                onDelete();
              }}
            >
              Delete
            </button>
          ) : null}
        </span>
      ) : null}
      <span className="sr-only">{`Destination ${frameId} menu`}</span>
    </span>
  );
}

export function AddDestinationCard({
  onAdd,
  disabled = false,
}: {
  onAdd: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label="Add Destination"
      disabled={disabled}
      title={disabled ? "Wait until planning and destination generation finish." : undefined}
      onClick={onAdd}
      className="storyboard-add-destination flex aspect-video w-full flex-col items-center justify-center border border-dashed border-[#3a342c] bg-[#12100d]/40 text-[#9a8f7e] outline-none hover:border-[#7a7266] hover:text-[#cfc6b8] focus-visible:border-[#ece7df] focus-visible:text-[#ece7df] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#3a342c] disabled:hover:text-[#9a8f7e]"
    >
      <span className="text-lg leading-none">+</span>
      <span className="mt-2 text-[11px] tracking-[0.14em] uppercase">Add Destination</span>
    </button>
  );
}

function ReelChevron({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg viewBox="0 0 12 24" className="h-8 w-4" aria-hidden>
      {direction === "prev" ? (
        <path
          d="M8.5 2 2.5 12 8.5 22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M3.5 2 9.5 12 3.5 22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function storyboardReelFrames(frames: readonly StoryboardFrame[]): StoryboardFrame[] {
  return frames.filter((frame) => destinationDetailContent(frame) !== null);
}

function neighboringReelFrame(
  frames: readonly StoryboardFrame[],
  currentId: string,
  direction: -1 | 1,
): StoryboardFrame | undefined {
  const currentIndex = frames.findIndex((frame) => frame.id === currentId);
  if (currentIndex < 0) {
    return undefined;
  }
  for (let index = currentIndex + direction; index >= 0 && index < frames.length; index += direction) {
    const frame = frames[index];
    if (frame && destinationDetailContent(frame)) {
      return frame;
    }
  }
  return undefined;
}

export function StoryboardReel({
  frames,
  currentId,
  project,
  onClose,
  onSelect,
  onPlanChange,
  onStoryChange,
  onReshoot,
  onShoot,
  reshooting = false,
}: {
  frames: readonly StoryboardFrame[];
  currentId: string;
  project: Project;
  onClose: () => void;
  onSelect: (frameId: string) => void;
  onPlanChange?: (frameId: string, next: { intent?: string; visualDescription?: string }) => void;
  onStoryChange?: (story: string) => void;
  onReshoot?: (frameId: string) => void;
  onShoot?: (frameId: string) => void;
  reshooting?: boolean;
}) {
  const current = frames.find((frame) => frame.id === currentId);
  const prev = neighboringReelFrame(frames, currentId, -1);
  const next = neighboringReelFrame(frames, currentId, 1);
  const [stillMode, setStillMode] = useState<"canonical" | "primed">("canonical");
  const [camotionKey, setCamotionKey] = useState<string | undefined>();
  const destinationId = current?.destinationId ?? current?.id;
  const camotionRecords = destinationId ? camotionRecordsForCanonical(project, destinationId) : [];
  const activeCamotion =
    camotionRecords.find((record) => camotionRecordKey(record) === camotionKey) ??
    preferredCamotionRecord(camotionRecords);
  const reelImage = destinationDisplayedStillUrl(current?.image, stillMode, activeCamotion);
  const startAspect = previewFrameAspectRatio(project);

  useEffect(() => {
    setStillMode("canonical");
    setCamotionKey(undefined);
  }, [currentId]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowLeft" && prev?.id) {
        event.preventDefault();
        onSelect(prev.id);
        return;
      }
      if (event.key === "ArrowRight" && next?.id) {
        event.preventDefault();
        onSelect(next.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, onSelect, prev?.id, next?.id]);

  if (!current) {
    return null;
  }

  return (
    <div
      className="storyboard-reel absolute inset-0 z-30 flex bg-[#0c0b0a]"
      role="dialog"
      aria-label={`Storyboard reel, destination ${current.label}`}
      onClick={onClose}
    >
      <div className="relative flex min-h-0 min-w-0 flex-1">
        <button
          type="button"
          aria-label="Close storyboard reel"
          className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center text-[#9a8f7e] outline-none hover:text-[#ece7df] focus-visible:text-[#ece7df] focus-visible:ring-1 focus-visible:ring-[#7a7266]"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        >
          <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden>
            <path d="M3 3l6 6M9 3 3 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        <span className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 text-[11px] tracking-[0.22em] text-[#ece7df] uppercase">
          {current.label}
        </span>
        <button
          type="button"
          aria-label="Previous destination"
          disabled={!prev}
          className="flex h-full w-12 shrink-0 items-center justify-center text-[#ece7df] outline-none hover:text-[#fff] focus-visible:ring-1 focus-visible:ring-[#d4b36a] disabled:text-[#5c564c] disabled:hover:text-[#5c564c]"
          onClick={(event) => {
            event.stopPropagation();
            if (prev) {
              onSelect(prev.id);
            }
          }}
        >
          <ReelChevron direction="prev" />
        </button>
        <div
          className="preview-stage h-full min-h-0 min-w-0 flex-1 bg-transparent px-1 py-10"
          onClick={(event) => event.stopPropagation()}
        >
          {reelImage ? (
            <img
              src={reelImage}
              alt={
                stillMode === "primed" && activeCamotion
                  ? `Destination ${current.label}′`
                  : `Destination ${current.label}`
              }
              className="media-contain max-h-full max-w-full"
            />
          ) : (
            <span
              className="storyboard-fpo storyboard-fpo-planned preview-monitor"
              style={
                {
                  "--preview-ar-w": startAspect.width,
                  "--preview-ar-h": startAspect.height,
                } as CSSProperties
              }
            >
              <span className="storyboard-fpo-copy">
                <span className="storyboard-fpo-label">{current.label}</span>
                {current.intent?.trim() ? (
                  <span className="storyboard-fpo-intent">{formatFpoIntentField(current.intent)}</span>
                ) : null}
              </span>
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label="Next destination"
          disabled={!next}
          className="flex h-full w-12 shrink-0 items-center justify-center text-[#ece7df] outline-none hover:text-[#fff] focus-visible:ring-1 focus-visible:ring-[#d4b36a] disabled:text-[#5c564c] disabled:hover:text-[#5c564c]"
          onClick={(event) => {
            event.stopPropagation();
            if (next) {
              onSelect(next.id);
            }
          }}
        >
          <ReelChevron direction="next" />
        </button>
      </div>
      <DestinationInspectorPanel
        frame={current}
        project={project}
        reshooting={reshooting}
        onPlanChange={onPlanChange ? (next) => onPlanChange(current.id, next) : undefined}
        onStoryChange={onStoryChange}
        onReshoot={onReshoot ? () => onReshoot(current.id) : undefined}
        onShoot={onShoot ? () => onShoot(current.id) : undefined}
        stillMode={stillMode}
        onStillModeChange={setStillMode}
        camotionKey={camotionKey}
        onCamotionKeyChange={setCamotionKey}
      />
    </div>
  );
}

export function PlanView() {
  const {
    project,
    selection,
    select,
    directorStatus,
    replaceDestinationImage,
    addDestination,
    removeDestination,
    constructingBeatId,
    constructDestination,
    generateOpeningFrame,
    setDestinationPlan,
    setComposerDraft,
    reshootDestination,
    storyboardReelId,
    setStoryboardReelId,
    assessingJourneyIds,
    shootingJourneyIds,
  } = useProject();
  const selectedId = selection.kind === "storyboard" ? selection.frameId : project.storyboard[0]?.id;
  const planning = directorStatus === "planning";
  const pipelineBusy =
    planning ||
    Boolean(constructingBeatId) ||
    assessingJourneyIds.length > 0 ||
    shootingJourneyIds.length > 0;
  const hasOpeningFrame = hasAuthoritativeStartingFrame(project);
  const storyboardLive = Boolean(project.story.trim()) || hasOpeningFrame;
  const openingUploadReady = project.storyboard.some(
    (frame) => frame.id === "A" && frame.imageOrigin === "none" && !frame.image,
  );
  const boardInteractive = storyboardLive || openingUploadReady;
  const mediaPreflight = mediaPreflightForProject(project);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replacingFrameId = useRef<string | null>(null);
  useEffect(() => {
    if (!storyboardReelId) {
      return;
    }
    if (!project.storyboard.some((item) => item.id === storyboardReelId)) {
      setStoryboardReelId(null);
    }
  }, [project.storyboard, setStoryboardReelId, storyboardReelId]);

  return (
    <section
      className="relative h-full min-h-0 min-w-0 overflow-hidden"
      aria-label="Storyboard"
    >
      <div className="h-full min-h-0 overflow-auto px-6 py-5">
        <input
          ref={fileInputRef}
          id="replace-destination-image"
          type="file"
          accept={STARTING_FRAME_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            const frameId = replacingFrameId.current;
            event.target.value = "";
            replacingFrameId.current = null;
            if (file && frameId) {
              const frame = project.storyboard.find((item) => item.id === frameId);
              const clearPlan = frame
                ? shouldClearStoryboardPlanOnUpload(frame, (message) => window.confirm(message))
                : false;
              void replaceDestinationImage(frameId, file, { clearPlan });
            }
          }}
        />
        {!storyboardLive ? (
          <p className="mb-4 text-sm text-[#9a8f7e]">
            Enter a journey story or upload starting frame A.
          </p>
        ) : null}
        <ol
          className={`grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-x-5 gap-y-7 ${
            boardInteractive ? "" : "pointer-events-none opacity-40"
          }`}
          aria-disabled={!boardInteractive || undefined}
        >
          {project.storyboard.map((frame) => {
            const selectedCard = frame.id === selectedId;
            const canConstruct = canConstructDestinationFrame(project, frame);
            const canGenerateOpening = frame.id === "A" && canGenerateOpeningFrame(project);
            const constructing = constructingBeatId === frame.id;
            const planChanged = generatedStillNeedsReshoot(project, frame);
            const warnings = preflightWarningsForFrame(mediaPreflight, frame.id);
            const selectFrame = () => {
              if (!boardInteractive) {
                return;
              }
              select({ kind: "storyboard", frameId: frame.id });
            };
            const selectStill = () => {
              selectFrame();
              setStoryboardReelId(null);
            };
            const openReel = () => {
              selectFrame();
              setStoryboardReelId(frame.id);
            };
            const selectOrOpenReel = () => {
              if (selectedCard && destinationDetailContent(frame)) {
                openReel();
                return;
              }
              selectStill();
            };
            const frameMedia = (
              <StoryboardFrameMedia
                frame={frame}
                selected={selectedCard}
                constructing={constructing}
                showMediaInfo={selectedCard}
                hasWarning={warnings.length > 0}
                planChanged={planChanged}
                onSelect={frame.image ? selectStill : selectOrOpenReel}
                onOpenReel={openReel}
                onOpenDetails={openReel}
                detailOpen={storyboardReelId === frame.id}
              />
            );
            const generate = (
              <div className="destination-generate-row mt-2 flex justify-center">
                <DestinationGenerateControl
                  frameId={frame.id}
                  constructing={constructing}
                  canConstruct={canGenerateOpening || canConstruct}
                  disabled={pipelineBusy}
                  title={
                    canGenerateOpening
                      ? "Generate this opening frame from the journey story."
                      : "Generate this destination from the previous actual frame."
                  }
                  onGenerate={() => {
                    select({ kind: "storyboard", frameId: frame.id });
                    if (canGenerateOpening) {
                      void generateOpeningFrame();
                      return;
                    }
                    void constructDestination(frame.id);
                  }}
                />
              </div>
            );
            return (
              <li key={frame.id} className="min-w-0">
                {frame.image ? (
                  <div
                    className={`relative ${selectedCard ? "" : "opacity-90"}`}
                    data-destination-card={frame.id}
                  >
                    {frameMedia}
                    <PreflightWarningControl warnings={warnings} />
                    {storyboardLive ? (
                    <DestinationMenu
                      frameId={frame.id}
                      label={frame.label}
                      onReshoot={
                        canReshootDestinationFrame(project, frame)
                          ? () => {
                              select({ kind: "storyboard", frameId: frame.id });
                              void reshootDestination(frame.id);
                            }
                          : undefined
                      }
                      reshooting={constructing}
                      reshootDisabled={pipelineBusy}
                      onReplace={() => {
                        replacingFrameId.current = frame.id;
                        fileInputRef.current?.click();
                      }}
                      onDelete={
                        canRemoveStoryboardDestination(project, frame.id)
                          ? () => {
                              setStoryboardReelId(storyboardReelId === frame.id ? null : storyboardReelId);
                              removeDestination(frame.id);
                            }
                          : undefined
                      }
                    />
                    ) : null}
                  </div>
                ) : (
                  <div
                    className={`relative w-full text-left ${selectedCard ? "" : "opacity-90"}`}
                    data-destination-card={frame.id}
                  >
                    {frameMedia}
                    {boardInteractive &&
                    (canUploadStoryboardFrame(frame) || canRemoveStoryboardDestination(project, frame.id)) ? (
                      <DestinationMenu
                        frameId={frame.id}
                        label={frame.label}
                        actionLabel="Upload image"
                        onReplace={
                          canUploadStoryboardFrame(frame)
                            ? () => {
                                select({ kind: "storyboard", frameId: frame.id });
                                replacingFrameId.current = frame.id;
                                fileInputRef.current?.click();
                              }
                            : undefined
                        }
                        onDelete={
                          canRemoveStoryboardDestination(project, frame.id)
                            ? () => {
                                setStoryboardReelId(storyboardReelId === frame.id ? null : storyboardReelId);
                                removeDestination(frame.id);
                              }
                            : undefined
                        }
                      />
                    ) : null}
                    {storyboardLive && (canConstruct || canGenerateOpening) && !constructing ? generate : null}
                  </div>
                )}
              </li>
            );
          })}
          {canAddStoryboardDestination(project) ? (
            <li className="min-w-0">
              <AddDestinationCard
                onAdd={addDestination}
                disabled={pipelineBusy}
              />
            </li>
          ) : null}
        </ol>
      </div>
      {storyboardReelId ? (
        <StoryboardReel
          frames={project.storyboard}
          currentId={storyboardReelId}
          project={project}
          onClose={() => {
            commitActiveTextEdit();
            setStoryboardReelId(null);
          }}
          onSelect={(frameId) => {
            commitActiveTextEdit();
            setStoryboardReelId(frameId);
            select({ kind: "storyboard", frameId });
          }}
          onPlanChange={(frameId, next) => setDestinationPlan(frameId, next)}
          onStoryChange={setComposerDraft}
          onReshoot={(frameId) => {
            void reshootDestination(frameId);
          }}
          onShoot={(frameId) => {
            if (frameId === "A") {
              void generateOpeningFrame();
              return;
            }
            void constructDestination(frameId);
          }}
          reshooting={constructingBeatId === storyboardReelId}
        />
      ) : null}
    </section>
  );
}
