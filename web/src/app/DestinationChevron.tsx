export function DestinationChevron({
  direction,
  label,
  disabled = false,
  onClick,
}: {
  direction: "prev" | "next";
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className="flex h-full w-12 shrink-0 items-center justify-center text-[#ece7df] outline-none hover:text-[#fff] focus-visible:ring-1 focus-visible:ring-[#d4b36a] disabled:text-[#5c564c] disabled:hover:text-[#5c564c]"
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) {
          onClick();
        }
      }}
    >
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
    </button>
  );
}
