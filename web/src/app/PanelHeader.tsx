import type { ReactNode } from "react";

export function PanelHeader({
  className,
  title,
  children,
}: {
  className: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`${className} flex shrink-0 items-center justify-between gap-2 border-b border-[#2a2620] bg-[#0c0b0a] px-3 py-3`}
    >
      <p className="min-w-0 truncate text-[13px] font-semibold tracking-[0.18em] text-[#cfc6b8] uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}
