import { useEffect, useState, type ReactNode } from "react";
import {
  camotionRecordKey,
  camotionRecordsCopyText,
  camotionRecordsForCanonical,
  preferredCamotionRecord,
  type DestinationCamotionRecord,
} from "../project/camotion-diagnostics";
import {
  canConstructDestinationFrame,
  canGenerateOpeningFrame,
  canReshootDestinationFrame,
  destinationGeneratedPrompt,
  destinationImageModelLabel,
  precedingActualFrame,
} from "../project/destination";
import { canonicalTakes, selectedCanonicalTake } from "../project/canonical-takes";
import { canUploadStoryboardFrame } from "../project/starting-frame";
import { formatFriendlyAspectRatio } from "../project/media-preflight";
import type { Project, StoryboardFrame } from "../project/types";
import { ClickToEditTextarea } from "../ui/ClickToEditTextarea";
import { CopyToClipboardButton } from "../ui/CopyToClipboardButton";
import { DisclosureMarker, disclosureSummaryClass } from "../ui/Disclosure";
import { commitActiveTextEdit } from "../ui/commit-text-edit";
import { CamotionDiagnosticPanel, CamotionEmptyState, CamotionSourceSwitch } from "./CamotionDiagnostic";
import { InspectorCopyDisclosure, InspectorPaneNav } from "./InspectorPanes";
import { PanelHeader } from "./PanelHeader";

export function destinationDisplayedStillUrl(
  canonicalImage: string | undefined,
  mode: "canonical" | "primed",
  record?: DestinationCamotionRecord,
): string | undefined {
  if (mode === "primed" && record?.shootingFrame.imageUrl) {
    return record.shootingFrame.imageUrl;
  }
  return canonicalImage;
}

export function DestinationPlanFields({
  frame,
  project,
  disabled = false,
  onPlanChange,
  onStoryChange,
}: {
  frame: StoryboardFrame;
  project: Project;
  disabled?: boolean;
  onPlanChange?: (next: { intent?: string; visualDescription?: string }) => void;
  onStoryChange?: (story: string) => void;
}) {
  const opening = frame.id === "A";
  const intent = frame.intent ?? "";
  const source = opening ? project.story : (frame.visualDescription ?? "");
  const fieldClass = "destination-detail-prompt tv-prompt mt-2 block w-full leading-snug text-[#ece7df]";

  return (
    <>
      <div>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-[10px] tracking-[0.16em] text-[#9a8f7e] uppercase">Intent</span>
          <CopyToClipboardButton text={intent} label={`Copy destination ${frame.label} intent`} />
        </div>
        <ClickToEditTextarea
          key={`${frame.id}-intent`}
          aria-label={`Destination ${frame.label} intent`}
          rows={3}
          value={intent}
          disabled={disabled}
          className={fieldClass}
          onChange={onPlanChange ? (next) => onPlanChange({ intent: next }) : undefined}
          commitOnBlur
        />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-[10px] tracking-[0.16em] text-[#9a8f7e] uppercase">
            {opening ? "Story" : "Beat"}
          </span>
          <CopyToClipboardButton
            text={source}
            label={opening ? `Copy destination ${frame.label} story` : `Copy destination ${frame.label} beat`}
          />
        </div>
        <ClickToEditTextarea
          key={`${frame.id}-beat`}
          aria-label={opening ? `Destination ${frame.label} story` : `Destination ${frame.label} beat`}
          rows={3}
          value={source}
          disabled={disabled}
          className={`${fieldClass} destination-detail-visual`}
          onChange={
            opening
              ? onStoryChange
              : onPlanChange
                ? (next) => onPlanChange({ visualDescription: next })
                : undefined
          }
          commitOnBlur
        />
      </div>
    </>
  );
}

function DestinationGeneratedPrompt({
  frame,
  project,
}: {
  frame: StoryboardFrame;
  project: Project;
}) {
  const generated = destinationGeneratedPrompt(project, frame);
  if (!generated) {
    return null;
  }
  return (
    <InspectorCopyDisclosure label="Prompt" copyLabel="Copy prompt" copyText={generated}>
      <p
        aria-label={`Destination ${frame.label} prompt`}
        className="tv-prompt whitespace-pre-wrap leading-snug text-[#cfc6b8]"
      >
        {generated}
      </p>
    </InspectorCopyDisclosure>
  );
}

function DestinationMediaFacts({
  frame,
  project,
}: {
  frame: StoryboardFrame;
  project: Project;
}) {
  const info = frame.mediaInfo;
  const model = destinationImageModelLabel(project, frame);
  const parts = [
    info ? formatFriendlyAspectRatio(info.width, info.height) : undefined,
    info ? `${info.width}×${info.height}` : undefined,
    model,
  ].filter((part): part is string => Boolean(part));
  if (parts.length === 0) {
    return null;
  }
  return (
    <p aria-label={`Destination ${frame.label} facts`} className="text-[10px] leading-snug text-[#9a8f7e]">
      {parts.join(" · ")}
    </p>
  );
}

function DestinationStillPreview({
  frame,
  canonicalImage,
  records,
  mode = "canonical",
  recordKey: controlledKey,
  onRecordKeyChange,
  onOpenReel,
}: {
  frame: StoryboardFrame;
  canonicalImage?: string;
  records: readonly DestinationCamotionRecord[];
  mode?: "canonical" | "primed";
  recordKey?: string;
  onRecordKeyChange?: (key: string) => void;
  onOpenReel?: () => void;
}) {
  const [localKey, setLocalKey] = useState<string | undefined>();

  useEffect(() => {
    setLocalKey(undefined);
  }, [frame.id]);

  const recordKey = controlledKey ?? localKey;
  const setRecordKey = onRecordKeyChange ?? setLocalKey;
  const active =
    records.find((record) => camotionRecordKey(record) === recordKey) ?? preferredCamotionRecord(records);
  const image = destinationDisplayedStillUrl(canonicalImage, mode, active);
  if (!image && records.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {image ? (
        onOpenReel ? (
          <button
            type="button"
            className="block w-full p-0 outline-none focus-visible:ring-1 focus-visible:ring-[#d4b36a]"
            onClick={onOpenReel}
            aria-label={`View destination ${frame.label} still`}
            title="View still"
          >
            <img src={image} alt="" className="media-contain aspect-video w-full rounded" />
          </button>
        ) : (
          <img src={image} alt="" className="media-contain aspect-video w-full rounded" />
        )
      ) : null}
      {mode === "primed" ? (
        <CamotionSourceSwitch
          records={records}
          activeKey={recordKey ?? (active ? camotionRecordKey(active) : "")}
          onChange={setRecordKey}
        />
      ) : null}
    </div>
  );
}

function destinationShootHint(
  project: Project,
  frame: StoryboardFrame,
  canShoot: boolean,
): string {
  if (canShoot) {
    return "Generate this destination from its current prompt.";
  }
  if (frame.id === "A") {
    return "Enter a journey story before shooting this destination.";
  }
  if (!frame.intent?.trim() || !frame.visualDescription?.trim()) {
    return "Set intent and beat before shooting this destination.";
  }
  if (!precedingActualFrame(project, frame)) {
    return "Generate the previous destination first.";
  }
  return "This destination cannot be shot yet.";
}

function PreviousTakes({
  frame,
  onOpenTake,
}: {
  frame: StoryboardFrame;
  onOpenTake?: (takeId: string) => void;
}) {
  const selected = selectedCanonicalTake(frame);
  const previous = canonicalTakes(frame).filter((take) => take.id !== selected?.id && take.imageUrl);
  const [open, setOpen] = useState(false);
  if (previous.length === 0) {
    return null;
  }
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-label="Previous takes"
        className={`${disclosureSummaryClass} text-left`}
        onClick={() => setOpen((current) => !current)}
      >
        <DisclosureMarker open={open} />
        Previous takes
      </button>
      <div className="mt-2 flex flex-wrap gap-2" hidden={!open}>
        {previous.map((take) => (
          <button
            key={take.id}
            type="button"
            aria-label={`Open take ${take.number} of destination ${frame.label}`}
            title={`Take ${take.number}`}
            className="w-16 overflow-hidden rounded border border-[#3a342c]"
            onClick={() => onOpenTake?.(take.id)}
          >
            <img src={take.imageUrl} alt="" className="aspect-video w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

export type DestinationInspectorPane = "source" | "motion" | "details";

const destinationPanes = [
  { id: "source" as const, label: "Source" },
  { id: "motion" as const, label: "Motion" },
  { id: "details" as const, label: "Details" },
];

export function DestinationInspectorFields({
  frame,
  project,
  image,
  label,
  banner,
  afterFields,
  footer,
  onPlanChange,
  onStoryChange,
  canReshoot = false,
  canShoot = false,
  reshooting = false,
  onReshoot,
  onShoot,
  camotionRecords,
  stillMode,
  onStillModeChange,
  camotionKey,
  onCamotionKeyChange,
  onOpenReel,
  onOpenTake,
  debugOn = false,
  initialPane = "source",
  pane: paneProp,
  onPaneChange,
}: {
  frame: StoryboardFrame;
  project: Project;
  image?: string;
  label: string;
  banner?: ReactNode;
  afterFields?: ReactNode;
  footer?: ReactNode;
  onPlanChange?: (next: { intent?: string; visualDescription?: string }) => void;
  onStoryChange?: (story: string) => void;
  canReshoot?: boolean;
  canShoot?: boolean;
  reshooting?: boolean;
  onReshoot?: () => void;
  onShoot?: () => void;
  camotionRecords?: readonly DestinationCamotionRecord[];
  stillMode?: "canonical" | "primed";
  onStillModeChange?: (mode: "canonical" | "primed") => void;
  camotionKey?: string;
  onCamotionKeyChange?: (key: string) => void;
  onOpenReel?: () => void;
  onOpenTake?: (takeId: string) => void;
  debugOn?: boolean;
  initialPane?: DestinationInspectorPane;
  pane?: DestinationInspectorPane;
  onPaneChange?: (pane: DestinationInspectorPane) => void;
}) {
  const records = camotionRecords ?? camotionRecordsForCanonical(project, frame.destinationId ?? frame.id);
  const showShoot = canShoot || canUploadStoryboardFrame(frame);
  const [localPane, setLocalPane] = useState<DestinationInspectorPane>(initialPane);
  const pane = paneProp ?? localPane;

  const selectPane = (next: DestinationInspectorPane) => {
    if (paneProp === undefined) {
      setLocalPane(next);
    }
    onPaneChange?.(next);
    if (next === "source") {
      onStillModeChange?.("canonical");
    }
    if (next === "motion") {
      onStillModeChange?.("primed");
    }
  };

  const stillPane = pane === "motion" ? "primed" : "canonical";
  const camotionCopy = camotionRecordsCopyText(records, project, debugOn);

  return (
    <>
      <h2 className="text-2xl">{label}</h2>
      <InspectorPaneNav pane={pane} onChange={selectPane} panes={destinationPanes} />
      <div hidden={pane === "details"} className="flex flex-col gap-3">
        {pane === "motion" && records.length === 0 ? (
          <CamotionEmptyState compact copy="Awaiting next destination" />
        ) : (
          <DestinationStillPreview
            frame={frame}
            canonicalImage={image}
            records={records}
            mode={stillMode ?? stillPane}
            recordKey={camotionKey}
            onRecordKeyChange={onCamotionKeyChange}
            onOpenReel={onOpenReel}
          />
        )}
        {banner}
        {pane === "source" ? (
          <>
            <DestinationPlanFields
              frame={frame}
              project={project}
              disabled={reshooting}
              onPlanChange={onPlanChange}
              onStoryChange={onStoryChange}
            />
            {showShoot || (canReshoot && onReshoot) ? (
              <div className="flex shrink-0 gap-2">
                {showShoot ? (
                  <button
                    type="button"
                    className="rounded border border-[#3a342c] px-3 py-1 disabled:opacity-40"
                    disabled={!canShoot || reshooting || !onShoot}
                    aria-label={`Shoot destination ${frame.label}`}
                    title={destinationShootHint(project, frame, canShoot)}
                    onPointerDown={() => {
                      commitActiveTextEdit();
                    }}
                    onClick={() => {
                      if (canShoot) {
                        onShoot?.();
                      }
                    }}
                  >
                    {reshooting ? "Shooting…" : "Shoot"}
                  </button>
                ) : null}
                {canReshoot && onReshoot ? (
                  <button
                    type="button"
                    className="rounded border border-[#3a342c] px-3 py-1 disabled:opacity-40"
                    disabled={reshooting}
                    aria-label={`Reshoot destination ${frame.label}`}
                    title="Regenerate this destination from its current prompt."
                    onPointerDown={() => {
                      commitActiveTextEdit();
                    }}
                    onClick={() => {
                      onReshoot();
                    }}
                  >
                    {reshooting ? "Reshooting…" : "Reshoot"}
                  </button>
                ) : null}
              </div>
            ) : null}
            <PreviousTakes frame={frame} onOpenTake={onOpenTake} />
            {afterFields}
          </>
        ) : null}
      </div>
      <div hidden={pane !== "details"} className="space-y-3">
        <DestinationMediaFacts frame={frame} project={project} />
        <DestinationGeneratedPrompt frame={frame} project={project} />
        <InspectorCopyDisclosure label="Camotion" copyLabel="Copy camotion" copyText={camotionCopy}>
          <CamotionDiagnosticPanel
            records={records}
            emptyCopy="Awaiting next destination"
            filmmaker
            debugOn={debugOn}
            project={project}
            showHeading={false}
          />
        </InspectorCopyDisclosure>
      </div>
      {footer}
    </>
  );
}

export function DestinationInspectorPanel({
  frame,
  project,
  onPlanChange,
  onStoryChange,
  onReshoot,
  onShoot,
  onOpenTake,
  reshooting = false,
  stillMode,
  onStillModeChange,
  camotionKey,
  onCamotionKeyChange,
  pane,
  onPaneChange,
}: {
  frame: StoryboardFrame;
  project: Project;
  onPlanChange?: (next: { intent?: string; visualDescription?: string }) => void;
  onStoryChange?: (story: string) => void;
  onReshoot?: () => void;
  onShoot?: () => void;
  onOpenTake?: (takeId: string) => void;
  reshooting?: boolean;
  stillMode?: "canonical" | "primed";
  onStillModeChange?: (mode: "canonical" | "primed") => void;
  camotionKey?: string;
  onCamotionKeyChange?: (key: string) => void;
  pane?: DestinationInspectorPane;
  onPaneChange?: (pane: DestinationInspectorPane) => void;
}) {
  return (
    <aside
      className="destination-inspector flex h-full min-h-0 w-[20rem] shrink-0 flex-col border-l border-[#2a2620] bg-[#12100d] text-sm"
      aria-label="Inspector - Destination"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <PanelHeader className="inspector-header" title="Inspector - Destination">
        <span />
      </PanelHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
        <DestinationInspectorFields
          frame={frame}
          project={project}
          image={frame.image}
          label={frame.label}
          onPlanChange={onPlanChange}
          onStoryChange={onStoryChange}
          canReshoot={canReshootDestinationFrame(project, frame)}
          canShoot={
            frame.id === "A"
              ? canGenerateOpeningFrame(project)
              : canConstructDestinationFrame(project, frame)
          }
          reshooting={reshooting}
          onReshoot={onReshoot}
          onShoot={onShoot}
          onOpenTake={onOpenTake}
          stillMode={stillMode}
          onStillModeChange={onStillModeChange}
          camotionKey={camotionKey}
          onCamotionKeyChange={onCamotionKeyChange}
          pane={pane}
          onPaneChange={onPaneChange}
        />
      </div>
    </aside>
  );
}
