import type { MouseEvent } from "react";
import {
  GENERATION_INTENT_LABEL,
  GENERATION_INTENT_MARK,
  GENERATION_INTENTS,
  type GenerationIntent,
} from "../project/generation-intent";

const menuItemClass =
  "flex w-full items-center gap-2 px-2.5 py-1 text-left text-[10px] tracking-[0.12em] text-[#ece7df] hover:bg-[#2a2620]";

export function generationIntentActionLabel(label: string, intent: GenerationIntent): string {
  return `${label} · ${GENERATION_INTENT_MARK[intent]}`;
}

/** ALL menu: same intent generates; a new intent only changes the control. */
export function intentMenuAppliesChoice(
  selected: GenerationIntent,
  current: GenerationIntent,
  pickOnly: boolean,
): "choose" | "pick" {
  if (!pickOnly || selected === current) {
    return "choose";
  }
  return "pick";
}

export function GenerationIntentMenu({
  label,
  ariaLabel,
  defaultIntent,
  disabled = false,
  busy = false,
  busyLabel = "Generating…",
  buttonClass,
  menuPlacement = "down",
  onChoose,
  onPickIntent,
}: {
  label: string;
  ariaLabel: string;
  defaultIntent: GenerationIntent;
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  buttonClass: string;
  menuPlacement?: "up" | "down";
  onChoose: (intent: GenerationIntent) => void;
  /** When set, the arrow menu only changes intent. The primary hit still generates. */
  onPickIntent?: (intent: GenerationIntent) => void;
}) {
  if (busy) {
    return (
      <span className="relative z-[2] shrink-0 text-[10px] leading-[16px] tracking-[0.12em] text-[#ece7df] storyboard-generating-label">
        {busyLabel}
      </span>
    );
  }

  const stop = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const onPrimary = (event: MouseEvent<HTMLButtonElement>) => {
    stop(event);
    if (disabled) {
      event.preventDefault();
      return;
    }
    onChoose(defaultIntent);
  };

  const onChevronClick = (event: MouseEvent<HTMLElement>) => {
    stop(event);
    if (disabled) {
      event.preventDefault();
    }
  };

  const intentName = GENERATION_INTENT_LABEL[defaultIntent];
  const displayLabel = generationIntentActionLabel(label, defaultIntent);

  const menuPositionClass =
    menuPlacement === "up"
      ? "bottom-full left-0 mb-1"
      : "right-0 top-full mt-1";

  return (
    <div
      className={`relative z-30 inline-flex w-max max-w-full shrink-0 items-center self-start ${buttonClass}${
        disabled ? " cursor-not-allowed opacity-40" : ""
      }`}
      onClick={stop}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        title={
          onPickIntent
            ? `${intentName}. Generate with this intent. The arrow changes intent without generating unless that intent is already selected.`
            : `${intentName}. Generate with the default Take intent, or use the arrow to choose Fast, Balanced, or Quality.`
        }
        disabled={disabled}
        className="inline-flex h-full shrink-0 items-center px-2.5 outline-none disabled:cursor-not-allowed"
        onClick={onPrimary}
      >
        {displayLabel}
      </button>
      {disabled ? (
        <span className="flex h-full shrink-0 items-center border-l border-[#3a342c] px-1.5" aria-hidden="true">
          ▾
        </span>
      ) : (
        <details className="relative flex h-full shrink-0 items-center" onClick={stop}>
          <summary
            className="flex h-full list-none cursor-pointer items-center border-l border-[#3a342c] px-1.5 outline-none [&::-webkit-details-marker]:hidden"
            aria-label={`${ariaLabel} intent chooser`}
            title={
              onPickIntent
                ? "Choose Fast, Balanced, or Quality. The same intent generates; a new intent only changes the control."
                : "Choose Fast, Balanced, or Quality"
            }
            onClick={onChevronClick}
          >
            ▾
          </summary>
          <div
            role="menu"
            className={`absolute z-40 min-w-[8.5rem] rounded border border-[#3a342c] bg-[#161410] py-1 ${menuPositionClass}`}
          >
            {GENERATION_INTENTS.map((intent) => (
              <button
                key={intent}
                type="button"
                role="menuitem"
                className={menuItemClass}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const details = event.currentTarget.closest("details");
                  if (details) {
                    details.open = false;
                  }
                  if (intentMenuAppliesChoice(intent, defaultIntent, Boolean(onPickIntent)) === "pick" && onPickIntent) {
                    onPickIntent(intent);
                  } else {
                    onChoose(intent);
                  }
                }}
              >
                <span aria-hidden="true">{GENERATION_INTENT_MARK[intent]}</span>
                {GENERATION_INTENT_LABEL[intent]}
                {intent === defaultIntent ? " · Default" : ""}
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
