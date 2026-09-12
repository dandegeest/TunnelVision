import type { DestinationCamotionRecord } from "../project/camotion-diagnostics";
import {
  NO_CAMOTION_DATA,
  camotionDirectionLabel,
  camotionGeneratedPath,
  camotionInspectorHeading,
  camotionRecordKey,
  camotionRetainedWorkDir,
  camotionSourceLabel,
  camotionWorkPath,
  formatExposureStrength,
  formatPlanBox,
  formatPlanPoint,
  formatPlanScalar,
} from "../project/camotion-diagnostics";
import type { Project } from "../project/types";

const pillClass = (active: boolean) =>
  `rounded-full px-2.5 py-0.5 tracking-[0.14em] uppercase outline-none ${
    active ? "bg-[#ece7df] text-[#0c0b0a]" : "text-[#cfc6b8] hover:text-[#ece7df]"
  }`;

export function CamotionFrameSwitch({
  destinationLabel,
  primedLabel,
  mode,
  onChange,
}: {
  destinationLabel: string;
  primedLabel: string;
  mode: "canonical" | "primed";
  onChange: (mode: "canonical" | "primed") => void;
}) {
  return (
    <nav
      className="flex shrink-0 items-center gap-0.5 rounded-full border border-[#3a342c] p-0.5 text-[11px]"
      aria-label="Camotion frame"
    >
      <button
        type="button"
        aria-pressed={mode === "canonical"}
        aria-label="Preview source"
        title={`Source ${destinationLabel}`}
        className={pillClass(mode === "canonical")}
        onClick={() => onChange("canonical")}
      >
        Source
      </button>
      <button
        type="button"
        aria-pressed={mode === "primed"}
        aria-label="Preview motion"
        title={`Motion ${primedLabel}`}
        className={pillClass(mode === "primed")}
        onClick={() => onChange("primed")}
      >
        Motion
      </button>
    </nav>
  );
}

export function CamotionSourceSwitch({
  records,
  activeKey,
  onChange,
}: {
  records: readonly DestinationCamotionRecord[];
  activeKey: string;
  onChange: (key: string) => void;
}) {
  if (records.length < 2) {
    return null;
  }
  return (
    <nav className="flex min-w-0 flex-wrap items-center gap-1 text-[11px]" aria-label="Camotion source">
      {records.map((record) => {
        const key = camotionRecordKey(record);
        const label = camotionSourceLabel(record);
        const active = key === activeKey;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            aria-label={`Camotion ${label}`}
            className={`rounded border px-1.5 py-0.5 outline-none ${
              active
                ? "border-[#ece7df] text-[#ece7df]"
                : "border-[#3a342c] text-[#9a8f7e] hover:border-[#7a7266] hover:text-[#cfc6b8]"
            }`}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}

export function CamotionEmptyState({
  compact = false,
  copy = NO_CAMOTION_DATA,
}: {
  compact?: boolean;
  copy?: string;
} = {}) {
  return (
    <p className={compact ? "text-sm text-[#9a8f7e]" : "flex h-full w-full items-center justify-center px-6 text-center text-sm text-[#9a8f7e]"}>
      {copy}
    </p>
  );
}

function DiagnosticLine({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-[#9a8f7e]">{label}. </span>
      <span className="break-all text-[#cfc6b8]">{value}</span>
    </p>
  );
}

function InspectorCamotionField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">{label}</p>
      <p className="break-all text-[#cfc6b8]">{value}</p>
    </div>
  );
}

export function CamotionRecordFields({ record }: { record: DestinationCamotionRecord }) {
  const work = camotionWorkPath(record);
  const generated = camotionGeneratedPath(record);
  return (
    <div className="space-y-1 leading-relaxed text-[#cfc6b8]">
      <p className="text-[11px] tracking-[0.16em] text-[#9a8f7e] uppercase">
        {record.primedLabel} · {camotionSourceLabel(record)}
      </p>
      <DiagnosticLine label="Vanishing point" value={formatPlanPoint(record.plan.camera.vanishing_point)} />
      <DiagnosticLine label="Radial forward" value={formatPlanScalar(record.plan.camera.forward)} />
      <DiagnosticLine label="Destination point" value={formatPlanPoint(record.plan.destination.point)} />
      <DiagnosticLine label="Protect" value={record.plan.destination.protect ? "Yes" : "No"} />
      <DiagnosticLine label="Bounding box" value={formatPlanBox(record.plan.destination.bbox)} />
      <DiagnosticLine label="Exposure" value={formatExposureStrength(record.plan.exposure.strength)} />
      <DiagnosticLine label="Samples" value={String(record.plan.exposure.samples)} />
      <DiagnosticLine label="Media id" value={record.shootingFrame.mediaId} />
      <DiagnosticLine label="Asset" value={record.shootingFrame.imageUrl} />
      {generated ? <DiagnosticLine label="Camotion output" value={generated} /> : null}
      {work ? <DiagnosticLine label="Work dir" value={work} /> : null}
      <p className="text-[#9a8f7e]">CameraMotionPlan v1. Read-only Motion Plan evidence.</p>
    </div>
  );
}

function FilmmakerCamotionRecord({
  record,
  debugOn,
  project,
}: {
  record: DestinationCamotionRecord;
  debugOn: boolean;
  project: Pick<Project, "destinations" | "journeys">;
}) {
  const journey = project.journeys.find((item) => item.id === record.journeyId);
  const heading = journey
    ? camotionInspectorHeading(record, project.destinations, journey.startDestinationId, journey.endDestinationId)
    : `${record.primedLabel} · ${camotionSourceLabel(record)}`;
  const travelDirection = journey?.motionPlan?.cinematographer?.travel?.direction ?? journey?.cinematographer?.travel?.direction;
  const direction = camotionDirectionLabel(record, travelDirection);
  const workDir = debugOn ? camotionRetainedWorkDir(record) : undefined;
  return (
    <div className="space-y-2">
      <p className="text-[11px] tracking-[0.16em] text-[#cfc6b8] uppercase">{heading}</p>
      {direction ? <InspectorCamotionField label="Direction" value={direction} /> : null}
      <InspectorCamotionField
        label="Vanishing point"
        value={formatPlanPoint(record.plan.camera.vanishing_point)}
      />
      <InspectorCamotionField label="Destination" value={formatPlanPoint(record.plan.destination.point)} />
      <InspectorCamotionField label="Protected" value={record.plan.destination.protect ? "Yes" : "No"} />
      <InspectorCamotionField label="Exposure" value={formatExposureStrength(record.plan.exposure.strength)} />
      {workDir ? <InspectorCamotionField label="Working directory" value={workDir} /> : null}
    </div>
  );
}

export function CamotionDiagnosticPanel({
  records,
  emptyCopy,
  filmmaker = false,
  debugOn = false,
  project,
}: {
  records: readonly DestinationCamotionRecord[];
  emptyCopy?: string;
  filmmaker?: boolean;
  debugOn?: boolean;
  project?: Pick<Project, "destinations" | "journeys">;
}) {
  return (
    <section className="border-t border-[#2a2620] pt-3 text-xs" aria-label="Camotion diagnostic">
      <p className="text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Camotion</p>
      {records.length === 0 ? (
        <CamotionEmptyState compact copy={emptyCopy} />
      ) : (
        <div className="mt-2 space-y-3">
          {records.map((record) =>
            filmmaker && project ? (
              <FilmmakerCamotionRecord
                key={camotionRecordKey(record)}
                record={record}
                debugOn={debugOn}
                project={project}
              />
            ) : (
              <CamotionRecordFields key={camotionRecordKey(record)} record={record} />
            ),
          )}
        </div>
      )}
    </section>
  );
}
