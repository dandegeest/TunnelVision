import type { MouseEvent } from "react";

export type OptionMenuChoice<T extends string> = {
  value: T;
  label: string;
};

const menuItemClass =
  "flex w-full items-center px-2.5 py-1.5 text-left text-[11px] tracking-[0.08em] text-[#ece7df] hover:bg-[#2a2620]";

/** In-app dropdown. Project settings use this instead of native OS `<select>` menus. */
export function OptionMenu<T extends string>({
  ariaLabel,
  title,
  value,
  disabled = false,
  options,
  onChange,
  triggerClassName,
}: {
  ariaLabel: string;
  title?: string;
  value: T;
  disabled?: boolean;
  options: readonly OptionMenuChoice<T>[];
  onChange: (value: T) => void;
  triggerClassName: string;
}) {
  const selected = options.find((option) => option.value === value);
  const stop = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  return (
    <details className="relative" onClick={stop}>
      <summary
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        title={title}
        data-value={value}
        className={`${triggerClassName} flex list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden ${
          disabled ? "cursor-not-allowed" : "cursor-pointer"
        }`}
        onClick={(event) => {
          stop(event);
          if (disabled) {
            event.preventDefault();
          }
        }}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? value}</span>
        <span aria-hidden="true">▾</span>
      </summary>
      {disabled ? null : (
        <div
          role="menu"
          className="absolute z-40 mt-1 w-full rounded border border-[#3a342c] bg-[#161410] py-1"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitem"
              data-value={option.value}
              className={menuItemClass}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const details = event.currentTarget.closest("details");
                if (details) {
                  details.open = false;
                }
                if (option.value !== value) {
                  onChange(option.value);
                }
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </details>
  );
}
