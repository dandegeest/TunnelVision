import { useState, type ReactNode } from "react";
import { CopyToClipboardButton } from "../ui/CopyToClipboardButton";
import { DisclosureMarker, disclosureSummaryClass } from "../ui/Disclosure";

export function inspectorPanePillClass(active: boolean) {
  return `rounded-full px-2.5 py-0.5 tracking-[0.14em] uppercase outline-none ${
    active ? "bg-[#ece7df] text-[#0c0b0a]" : "text-[#cfc6b8] hover:text-[#ece7df]"
  }`;
}

export function InspectorPaneNav<T extends string>({
  pane,
  onChange,
  panes,
}: {
  pane: T;
  onChange: (next: T) => void;
  panes: ReadonlyArray<{ id: T; label: string }>;
}) {
  return (
    <nav
      className="flex shrink-0 items-center gap-0.5 rounded-full border border-[#3a342c] p-0.5 text-[11px]"
      aria-label="Inspector pane"
    >
      {panes.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-pressed={pane === id}
          aria-label={`Inspector ${id}`}
          className={inspectorPanePillClass(pane === id)}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

export function InspectorCopyDisclosure({
  label,
  copyLabel,
  copyText,
  children,
}: {
  label: string;
  copyLabel: string;
  copyText: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          className={`${disclosureSummaryClass} min-w-0 flex-1 text-left`}
          onClick={() => setOpen((current) => !current)}
        >
          <DisclosureMarker open={open} />
          <span className="min-w-0 flex-1">{label}</span>
        </button>
        <CopyToClipboardButton text={copyText} label={copyLabel} />
      </div>
      <div className="mt-2" hidden={!open}>
        {children}
      </div>
    </div>
  );
}
