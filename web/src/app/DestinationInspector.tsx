import { useEffect, useState, type ReactNode } from "react";
import {
  camotionRecordKey,
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
} from "../project/destination";
import { formatFriendlyAspectRatio } from "../project/media-preflight";
import type { Project, StoryboardFrame } from "../project/types";
import { ClickToEditTextarea } from "../ui/ClickToEditTextarea";
import { commitActiveTextEdit } from "../ui/commit-text-edit";
import { CamotionFrameSwitch, CamotionSourceSwitch } from "./CamotionDiagnostic";
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
  const generated = destinationGeneratedPrompt(project, frame);
  const fieldClass = "destination-detail-prompt mt-2 block w-full text-[10px] leading-snug text-[#ece7df]";

  return (
    <>
      <label className="mt-2 block">
        <span className="block text-[10px] tracking-[0.16em] text-[#9a8f7e] uppercase">Intent</span>
        <ClickToEditTextarea
          aria-label={`Destination ${frame.label} intent`}
          rows={3}
          value={intent}
          disabled={disabled}
          className={fieldClass}
          onChange={onPlanChange ? (next) => onPlanChange({ intent: next }) : undefined}
        />
      </label>
      <label className="mt-2 block">
        <span className="block text-[10px] tracking-[0.16em] text-[#9a8f7e] uppercase">
          {opening ? "Story" : "Source"}
        </span>
        <ClickToEditTextarea
          aria-label={opening ? `Destination ${frame.label} story` : `Destination ${frame.label} source`}
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
        />
      </label>
      {generated ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-[10px] tracking-[0.16em] text-[#9a8f7e] uppercase">
            Prompt
          </summary>
          <p
            aria-label={`Destination ${frame.label} prompt`}
            className="mt-2 whitespace-pre-wrap text-[10px] leading-snug text-[#cfc6b8]"
          >
            {generated}
          </p>
        </details>
      ) : null}
    </>
  );
}

function DestinationMediaFacts({ frame }: { frame: StoryboardFrame }) {
  const info = frame.mediaInfo;
  const model = destinationImageModelLabel(frame);
  if (!info && !model) {
    return null;
  }
  return (
    <dl aria-label={`Destination ${frame.label} facts`} className="space-y-1 text-[#cfc6b8]">
      {info ? (
        <>
          <div>
            <dt className="text-[10px] tracking-[0.16em] text-[#9a8f7e] uppercase">Aspect ratio</dt>
            <dd>{formatFriendlyAspectRatio(info.width, info.height)}</dd>
          </div>
          <div>
            <dt className="text-[10px] tracking-[0.16em] text-[#9a8f7e] uppercase">Resolution</dt>
            <dd>
              {info.width}×{info.height}
            </dd>
          </div>
        </>
      ) : null}
      {model ? (
        <div>
          <dt className="text-[10px] tracking-[0.16em] text-[#9a8f7e] uppercase">Model</dt>
          <dd>{model}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function DestinationStillPreview({
  frame,
  canonicalImage,
  records,
  mode: controlledMode,
  onModeChange,
  recordKey: controlledKey,
  onRecordKeyChange,
}: {
  frame: StoryboardFrame;
  canonicalImage?: string;
  records: readonly DestinationCamotionRecord[];
  mode?: "canonical" | "primed";
  onModeChange?: (mode: "canonical" | "primed") => void;
  recordKey?: string;
  onRecordKeyChange?: (key: string) => void;
}) {
  const [localMode, setLocalMode] = useState<"canonical" | "primed">("canonical");
  const [localKey, setLocalKey] = useState<string | undefined>();

  useEffect(() => {
    setLocalMode("canonical");
    setLocalKey(undefined);
  }, [frame.id]);

  const mode = controlledMode ?? localMode;
  const setMode = onModeChange ?? setLocalMode;
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
      {image ? <img src={image} alt="" className="media-contain aspect-video w-full rounded" /> : null}
      {records.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <CamotionFrameSwitch
            destinationLabel={frame.label}
            primedLabel={`${frame.label}′`}
            mode={mode}
            onChange={setMode}
          />
          {mode === "primed" ? (
            <CamotionSourceSwitch
              records={records}
              activeKey={recordKey ?? (active ? camotionRecordKey(active) : "")}
              onChange={setRecordKey}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

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
}) {
  const records = camotionRecords ?? camotionRecordsForCanonical(project, frame.destinationId ?? frame.id);
  return (
    <>
      <h2 className="text-2xl">{label}</h2>
      <DestinationStillPreview
        frame={frame}
        canonicalImage={image}
        records={records}
        mode={stillMode}
        onModeChange={onStillModeChange}
        recordKey={camotionKey}
        onRecordKeyChange={onCamotionKeyChange}
      />
      {banner}
      <DestinationPlanFields
        frame={frame}
        project={project}
        disabled={reshooting}
        onPlanChange={onPlanChange}
        onStoryChange={onStoryChange}
      />
      {canShoot && onShoot ? (
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-[#3a342c] px-3 py-1 disabled:opacity-40"
            disabled={reshooting}
            aria-label={`Shoot destination ${frame.label}`}
            title="Generate this destination from its current prompt."
            onPointerDown={() => {
              commitActiveTextEdit();
            }}
            onClick={() => {
              onShoot();
            }}
          >
            {reshooting ? "Shooting…" : "Shoot"}
          </button>
        </div>
      ) : null}
      {canReshoot && onReshoot ? (
        <div className="flex gap-2">
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
        </div>
      ) : null}
      <DestinationMediaFacts frame={frame} />
      {afterFields}
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
  reshooting = false,
  stillMode,
  onStillModeChange,
  camotionKey,
  onCamotionKeyChange,
}: {
  frame: StoryboardFrame;
  project: Project;
  onPlanChange?: (next: { intent?: string; visualDescription?: string }) => void;
  onStoryChange?: (story: string) => void;
  onReshoot?: () => void;
  onShoot?: () => void;
  reshooting?: boolean;
  stillMode?: "canonical" | "primed";
  onStillModeChange?: (mode: "canonical" | "primed") => void;
  camotionKey?: string;
  onCamotionKeyChange?: (key: string) => void;
}) {
  return (
    <aside
      className="destination-inspector flex h-full min-h-0 w-[20rem] shrink-0 flex-col border-l border-[#2a2620] bg-[#12100d] text-sm"
      aria-label="Inspector - Destination"
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
          stillMode={stillMode}
          onStillModeChange={onStillModeChange}
          camotionKey={camotionKey}
          onCamotionKeyChange={onCamotionKeyChange}
        />
      </div>
    </aside>
  );
}
