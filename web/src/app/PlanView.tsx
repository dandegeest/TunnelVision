import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
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
  canDropAppendStoryboardDestination,
  canReplaceStoryboardFrameImage,
  canUploadStoryboardFrame,
  hasAuthoritativeStartingFrame,
  imageFileFromDataTransfer,
} from "../project/starting-frame";
import { useReplaceDestinationImage } from "./ClearStoryboardPlanDialog";
import { canAddStoryboardDestination, canRemoveStoryboardDestination } from "../project/storyboard";
import { previewFrameAspectRatio } from "../project/canonical-aspect";
import type { Project, StoryboardFrame } from "../project/types";
import { commitActiveTextEdit } from "../ui/commit-text-edit";
import { useDismissableMenu } from "../ui/dismissable-menu";
import { isTextEntryTarget, pointerOnBackdrop, reelKeyboardAction } from "../ui/text-entry";
import {
  camotionRecordKey,
  camotionRecordsForCanonical,
  preferredCamotionRecord,
} from "../project/camotion-diagnostics";
import {
  destinationDisplayedStillUrl,
  DestinationInspectorPanel,
  type DestinationInspectorPane,
} from "./DestinationInspector";
import { DestinationChevron } from "./DestinationChevron";
import { layoutShootTimeline } from "../timeline/shoot-layout";

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

function storyboardIntentCopy(intent: string) {
  return formatFpoIntentField(intent);
}

function StoryboardPlanOverlay({
  intent,
  beat,
  beatLabel = "Beat",
  showIntent,
  showBeat,
  variant,
  className,
}: {
  intent?: string;
  beat?: string;
  beatLabel?: "Beat" | "Story";
  showIntent: boolean;
  showBeat: boolean;
  variant: "still" | "fpo";
  className?: string;
}) {
  const intentText = showIntent ? intent?.trim() || undefined : undefined;
  const beatText = showBeat ? beat?.trim() || undefined : undefined;
  const beatDistinct = beatText && beatText !== intentText ? beatText : undefined;
  if (!intentText && !beatDistinct) {
    return null;
  }
  const split = Boolean(intentText && beatDistinct);
  const overlayClass = variant === "still" ? "storyboard-still-intent" : "storyboard-fpo-intent";
  return (
    <span
      className={`${overlayClass}${split ? " storyboard-plan-overlay-split" : ""}${className ? ` ${className}` : ""}`}
    >
      {intentText ? (
        <span className="storyboard-plan-overlay-block">
          {split ? <span className="storyboard-plan-overlay-kicker">Intent</span> : null}
          <span className="storyboard-plan-overlay-body">{storyboardIntentCopy(intentText)}</span>
        </span>
      ) : null}
      {split ? <span className="storyboard-plan-overlay-rule" aria-hidden /> : null}
      {beatDistinct ? (
        <span className="storyboard-plan-overlay-block">
          {split ? <span className="storyboard-plan-overlay-kicker">{beatLabel}</span> : null}
          <span className="storyboard-plan-overlay-body">{storyboardIntentCopy(beatDistinct)}</span>
        </span>
      ) : null}
    </span>
  );
}

function openingOverlayCopy(frame: StoryboardFrame, story?: string): { text?: string; label: "Beat" | "Story" } {
  if (frame.id === "A") {
    return { text: story, label: "Story" };
  }
  return { text: frame.visualDescription, label: "Beat" };
}

export function StoryboardFrameMedia({
  frame,
  selected,
  constructing,
  showMediaInfo = false,
  showIntentOverlay = false,
  showBeatOverlay = false,
  story,
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
  showIntentOverlay?: boolean;
  showBeatOverlay?: boolean;
  story?: string;
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
  const showPlanChanged = planChanged && !constructing;
  const overlaySecond = openingOverlayCopy(frame, story);
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
          <StoryboardPlanOverlay
            variant="still"
            intent={frame.intent}
            beat={overlaySecond.text}
            beatLabel={overlaySecond.label}
            showIntent={showIntentOverlay}
            showBeat={showBeatOverlay}
            className={`absolute inset-x-0 top-6 z-[1] px-1.5 pt-1.5 ${
              showMediaInfo && frame.mediaInfo ? "bottom-6" : "bottom-0 pb-2"
            }`}
          />
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
              if (selected && onOpenReel) {
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
            <StoryboardPlanOverlay
              variant="fpo"
              intent={frame.intent}
              beat={overlaySecond.text}
              beatLabel={overlaySecond.label}
              showIntent
              showBeat={showBeatOverlay}
            />
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
  useDismissableMenu(open, () => setOpen(false), rootRef);

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

function StoryboardOverlayToggle({
  checked,
  label,
  ariaLabel,
  onChange,
}: {
  checked: boolean;
  label: string;
  ariaLabel: string;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-[#ece7df] outline-none hover:bg-[#1c1916] focus-visible:bg-[#1c1916]"
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
    >
      <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center" aria-hidden>
        {checked ? (
          <svg viewBox="0 0 12 12" className="h-3 w-3">
            <path
              d="M2.4 6.2 4.8 8.6 9.6 3.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      {label}
    </button>
  );
}

export function StoryboardViewMenu({
  intentOverlay,
  beatOverlay,
  onIntentOverlayChange,
  onBeatOverlayChange,
  initiallyOpen = false,
}: {
  intentOverlay: boolean;
  beatOverlay: boolean;
  onIntentOverlayChange: (on: boolean) => void;
  onBeatOverlayChange: (on: boolean) => void;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const rootRef = useRef<HTMLSpanElement>(null);
  useDismissableMenu(open, () => setOpen(false), rootRef);

  return (
    <span ref={rootRef} className="storyboard-view-menu relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Storyboard options"
        title="Storyboard options"
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
          className="absolute top-full right-0 z-20 mt-0.5 min-w-[9.5rem] rounded border border-[#3a342c] bg-[#12100d] py-1 shadow-lg"
        >
          <StoryboardOverlayToggle
            checked={intentOverlay}
            label="Intent"
            ariaLabel="Intent overlay"
            onChange={onIntentOverlayChange}
          />
          <StoryboardOverlayToggle
            checked={beatOverlay}
            label="Beat"
            ariaLabel="Beat overlay"
            onChange={onBeatOverlayChange}
          />
        </span>
      ) : null}
    </span>
  );
}

function filesDrag(transfer: DataTransfer | null): boolean {
  return Boolean(transfer && [...transfer.types].includes("Files"));
}

function preventBrowserFileOpen(event: { preventDefault(): void; dataTransfer: DataTransfer | null }) {
  if (!filesDrag(event.dataTransfer)) {
    return false;
  }
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }
  return true;
}

export function StoryboardDestinationDrop({
  frameId,
  enabled,
  onDropFile,
  children,
  className,
}: {
  frameId: string;
  enabled: boolean;
  onDropFile: (file: File) => void;
  children: ReactNode;
  className?: string;
}) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);

  const reset = () => {
    depth.current = 0;
    setActive(false);
  };

  const canHighlight = (transfer: DataTransfer | null) => {
    if (!enabled || !filesDrag(transfer)) {
      return false;
    }
    if (transfer && transfer.files.length > 0) {
      return Boolean(imageFileFromDataTransfer(transfer));
    }
    return true;
  };

  return (
    <div
      data-destination-drop={enabled ? frameId : undefined}
      data-drop-active={active ? "true" : undefined}
      className={[
        className,
        active ? "rounded-sm ring-2 ring-[#ece7df] ring-offset-2 ring-offset-[#0c0b0a]" : undefined,
      ]
        .filter(Boolean)
        .join(" ")}
      onDragEnter={(event) => {
        preventBrowserFileOpen(event);
        if (!canHighlight(event.dataTransfer)) {
          return;
        }
        event.stopPropagation();
        depth.current += 1;
        setActive(true);
      }}
      onDragOver={(event) => {
        preventBrowserFileOpen(event);
        if (canHighlight(event.dataTransfer)) {
          event.stopPropagation();
        }
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) {
          setActive(false);
        }
      }}
      onDrop={(event) => {
        preventBrowserFileOpen(event);
        event.stopPropagation();
        const file = imageFileFromDataTransfer(event.dataTransfer);
        reset();
        if (enabled && file) {
          onDropFile(file);
        }
      }}
    >
      {children}
    </div>
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

export function storyboardReelFrames(frames: readonly StoryboardFrame[]): StoryboardFrame[] {
  return [...frames];
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
  return frames[currentIndex + direction];
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
  onDropFile,
  reshooting = false,
  initialInspectorPane = "source",
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
  onDropFile?: (file: File) => void;
  reshooting?: boolean;
  initialInspectorPane?: DestinationInspectorPane;
}) {
  const current = frames.find((frame) => frame.id === currentId);
  const prev = neighboringReelFrame(frames, currentId, -1);
  const next = neighboringReelFrame(frames, currentId, 1);
  const [inspectorPane, setInspectorPane] = useState<DestinationInspectorPane>(initialInspectorPane);
  const [camotionKey, setCamotionKey] = useState<string | undefined>();
  const stillMode = inspectorPane === "motion" ? "primed" : "canonical";
  const destinationId = current?.destinationId ?? current?.id;
  const camotionRecords = destinationId ? camotionRecordsForCanonical(project, destinationId) : [];
  const activeCamotion =
    camotionRecords.find((record) => camotionRecordKey(record) === camotionKey) ??
    preferredCamotionRecord(camotionRecords);
  const reelImage = destinationDisplayedStillUrl(current?.image, stillMode, activeCamotion);
  const startAspect = previewFrameAspectRatio(project);
  const reelRef = useRef<HTMLDivElement>(null);
  const stageColumnRef = useRef<HTMLDivElement>(null);
  const backdropPointerRef = useRef(false);

  useEffect(() => {
    setCamotionKey(undefined);
  }, [currentId]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const action = reelKeyboardAction(event);
      if (action === "close") {
        event.preventDefault();
        onClose();
        return;
      }
      if (action === "prev" && prev?.id) {
        event.preventDefault();
        onSelect(prev.id);
        return;
      }
      if (action === "next" && next?.id) {
        event.preventDefault();
        onSelect(next.id);
        return;
      }
      if (
        (event.key === "Backspace" || event.key === "Delete") &&
        !event.defaultPrevented &&
        !isTextEntryTarget(event.target)
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, onSelect, prev?.id, next?.id]);

  const noteBackdropPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    backdropPointerRef.current = pointerOnBackdrop(event.target, [
      reelRef.current,
      stageColumnRef.current,
    ]);
  };

  const closeIfBackdropClick = (event: { target: EventTarget | null }) => {
    if (
      backdropPointerRef.current &&
      pointerOnBackdrop(event.target, [reelRef.current, stageColumnRef.current])
    ) {
      onClose();
    }
  };

  if (!current) {
    return null;
  }

  return (
    <div
      ref={reelRef}
      className="storyboard-reel absolute inset-0 z-30 flex bg-[#0c0b0a]"
      role="dialog"
      aria-label={`Storyboard reel, destination ${current.label}`}
      onPointerDownCapture={noteBackdropPointer}
      onClick={closeIfBackdropClick}
    >
      <div
        ref={stageColumnRef}
        className="relative flex min-h-0 min-w-0 flex-1"
      >
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
        <DestinationChevron
          direction="prev"
          label="Previous destination"
          disabled={!prev}
          onClick={() => {
            if (prev) {
              onSelect(prev.id);
            }
          }}
        />
        <div
          className="preview-stage h-full min-h-0 min-w-0 flex-1 bg-transparent px-1 py-10"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <StoryboardDestinationDrop
            frameId={current.id}
            enabled={Boolean(onDropFile) && canReplaceStoryboardFrameImage(current)}
            className="flex h-full min-h-0 min-w-0 items-center justify-center"
            onDropFile={(file) => {
              onDropFile?.(file);
            }}
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
                <StoryboardPlanOverlay
                  variant="fpo"
                  intent={current.intent}
                  beat={current.id === "A" ? project.story : current.visualDescription}
                  beatLabel={current.id === "A" ? "Story" : "Beat"}
                  showIntent
                  showBeat
                />
              </span>
            </span>
          )}
          </StoryboardDestinationDrop>
        </div>
        <DestinationChevron
          direction="next"
          label="Next destination"
          disabled={!next}
          onClick={() => {
            if (next) {
              onSelect(next.id);
            }
          }}
        />
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
        pane={inspectorPane}
        onPaneChange={setInspectorPane}
        camotionKey={camotionKey}
        onCamotionKeyChange={setCamotionKey}
      />
    </div>
  );
}

export function StoryboardReelHost() {
  const {
    project,
    view,
    selection,
    select,
    storyboardReelId,
    setStoryboardReelId,
    setDestinationPlan,
    setComposerDraft,
    reshootDestination,
    generateOpeningFrame,
    constructDestination,
    constructingBeatId,
  } = useProject();
  const { applyDestinationImageFile, dialog: replacePlanDialog } = useReplaceDestinationImage();

  useEffect(() => {
    if (!storyboardReelId) {
      return;
    }
    if (!project.storyboard.some((item) => item.id === storyboardReelId)) {
      setStoryboardReelId(null);
    }
  }, [project.storyboard, setStoryboardReelId, storyboardReelId]);

  if (!storyboardReelId) {
    return replacePlanDialog;
  }

  return (
    <>
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
        if (view === "plan") {
          select({ kind: "storyboard", frameId });
          return;
        }
        const frame = project.storyboard.find((item) => item.id === frameId);
        const destinationId = frame?.destinationId ?? frameId;
        const preferred =
          selection.kind === "destination" && selection.destinationId === destinationId
            ? selection.occurrenceIndex
            : undefined;
        const occurrences = layoutShootTimeline(project, 1).occurrences;
        const match =
          occurrences.find(
            (occurrence) =>
              occurrence.destinationId === destinationId &&
              !occurrence.fpo &&
              occurrence.occurrenceIndex === preferred,
          ) ??
          occurrences.find((occurrence) => occurrence.destinationId === destinationId && !occurrence.fpo);
        if (match) {
          select({
            kind: "destination",
            destinationId,
            occurrenceIndex: match.occurrenceIndex,
          });
        }
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
      onDropFile={(file) => {
        applyDestinationImageFile(storyboardReelId, file);
      }}
      reshooting={constructingBeatId === storyboardReelId}
    />
    {replacePlanDialog}
    </>
  );
}

export function PlanView() {
  const {
    project,
    selection,
    select,
    directorStatus,
    appendDestinationWithImage,
    addDestination,
    removeDestination,
    constructingBeatId,
    constructDestination,
    generateOpeningFrame,
    reshootDestination,
    storyboardReelId,
    setStoryboardReelId,
  } = useProject();
  const { applyDestinationImageFile, dialog: replacePlanDialog } = useReplaceDestinationImage();
  const selectedId = selection.kind === "storyboard" ? selection.frameId : project.storyboard[0]?.id;
  const planning = directorStatus === "planning";
  const storyboardLocked = planning || Boolean(constructingBeatId);
  const hasOpeningFrame = hasAuthoritativeStartingFrame(project);
  const storyboardLive = Boolean(project.story.trim()) || hasOpeningFrame;
  const openingUploadReady = project.storyboard.some(
    (frame) => frame.id === "A" && frame.imageOrigin === "none" && !frame.image,
  );
  const boardInteractive = storyboardLive || openingUploadReady;
  const mediaPreflight = mediaPreflightForProject(project);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replacingFrameId = useRef<string | null>(null);
  const [showIntentOverlay, setShowIntentOverlay] = useState(false);
  const [showBeatOverlay, setShowBeatOverlay] = useState(false);

  const canAppendDrop =
    boardInteractive && !storyboardLocked && canDropAppendStoryboardDestination(project);

  useEffect(() => {
    const blockBrowserFileOpen = (event: DragEvent) => {
      preventBrowserFileOpen(event);
    };
    window.addEventListener("dragover", blockBrowserFileOpen);
    window.addEventListener("drop", blockBrowserFileOpen);
    return () => {
      window.removeEventListener("dragover", blockBrowserFileOpen);
      window.removeEventListener("drop", blockBrowserFileOpen);
    };
  }, []);

  return (
    <section
      className="relative h-full min-h-0 min-w-0 overflow-hidden"
      aria-label="Storyboard"
    >
      <div className="h-full min-h-0 overflow-auto px-6 py-5">
        <StoryboardDestinationDrop
          frameId="append"
          enabled={canAppendDrop}
          className="min-h-full"
          onDropFile={(file) => {
            void appendDestinationWithImage(file);
          }}
        >
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
              applyDestinationImageFile(frameId, file);
            }
          }}
        />
        <div className="mb-4 flex items-start justify-between gap-3">
          {!storyboardLive ? (
            <p className="text-sm text-[#9a8f7e]">
              Enter a journey story or upload starting frame A.
            </p>
          ) : (
            <span />
          )}
          <StoryboardViewMenu
            intentOverlay={showIntentOverlay}
            beatOverlay={showBeatOverlay}
            onIntentOverlayChange={setShowIntentOverlay}
            onBeatOverlayChange={setShowBeatOverlay}
          />
        </div>
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
              if (selectedCard) {
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
                showIntentOverlay={showIntentOverlay}
                showBeatOverlay={showBeatOverlay}
                story={project.story}
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
                  disabled={storyboardLocked}
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
                <StoryboardDestinationDrop
                  frameId={frame.id}
                  enabled={boardInteractive && canReplaceStoryboardFrameImage(frame)}
                  onDropFile={(file) => {
                    if (!frame.image) {
                      select({ kind: "storyboard", frameId: frame.id });
                    }
                    applyDestinationImageFile(frame.id, file);
                  }}
                >
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
                      reshootDisabled={storyboardLocked}
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
                </StoryboardDestinationDrop>
              </li>
            );
          })}
          {canAddStoryboardDestination(project) ? (
            <li className="min-w-0">
              <AddDestinationCard
                onAdd={addDestination}
                disabled={storyboardLocked}
              />
            </li>
          ) : null}
        </ol>
        </StoryboardDestinationDrop>
      </div>
      <StoryboardReelHost />
      {replacePlanDialog}
    </section>
  );
}
