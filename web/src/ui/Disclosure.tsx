import type { ReactNode } from "react";

/** Filled triangle used by every disclosure / collapsible header. */
export function DisclosureMarker({ open = false }: { open?: boolean }) {
  return (
    <svg
      viewBox="0 0 8 8"
      className={`tv-disclosure-marker h-2 w-2 shrink-0${open ? " is-open" : ""}`}
      aria-hidden
    >
      <path d="M3 1.15 L6.6 4 L3 6.85 Z" fill="currentColor" />
    </svg>
  );
}

/** Shared summary / disclosure-header chrome: marker + uppercase label. */
export const disclosureSummaryClass =
  "tv-disclosure-summary flex cursor-pointer list-none items-center gap-1.5 text-[10px] tracking-[0.16em] text-[#9a8f7e] uppercase outline-none select-none";

export function DisclosureSummary({
  children,
  className = "",
  open,
}: {
  children: ReactNode;
  className?: string;
  /** When set (button-based disclosures), rotates the marker. Native `<details>` uses CSS on `[open]`. */
  open?: boolean;
}) {
  return (
    <span className={`${disclosureSummaryClass}${className ? ` ${className}` : ""}`.trim()}>
      <DisclosureMarker open={open} />
      {children}
    </span>
  );
}
