import { useState, type ReactNode } from "react";
import { CopyToClipboardButton } from "../ui/CopyToClipboardButton";

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
      <div className="flex items-center gap-2 text-[10px] tracking-[0.16em] text-[#9a8f7e] uppercase">
        <button
          type="button"
          aria-expanded={open}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left outline-none"
          onClick={() => setOpen((current) => !current)}
        >
          <svg
            viewBox="0 0 8 8"
            className={`h-2 w-2 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden
          >
            <path
              d="M2.2 1.1 6.2 4 2.2 6.9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
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
