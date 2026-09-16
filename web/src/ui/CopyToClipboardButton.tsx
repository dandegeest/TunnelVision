import { useState, type MouseEvent } from "react";
import { copyTextToClipboard } from "./clipboard";

export function CopyToClipboardButton({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);
  const disabled = !text;

  const onCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) {
      return;
    }
    const ok = await copyTextToClipboard(text);
    if (!ok) {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      disabled={disabled}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#9a8f7e] outline-none hover:text-[#ece7df] focus-visible:text-[#ece7df] focus-visible:ring-1 focus-visible:ring-[#7a7266] disabled:opacity-40"
      onClick={(event) => {
        void onCopy(event);
      }}
    >
      {copied ? (
        <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
          <path
            d="M2.5 6.2 5 8.7 9.5 3.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
          <rect
            x="3.6"
            y="3.2"
            width="6.2"
            height="7.1"
            rx="1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path
            d="M2.2 8.4V2.7c0-.6.5-1.1 1.1-1.1h5.1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
