import type { LocomotionPace } from "../project/types";

function Chevron({ opacity = 1 }: { opacity?: number }) {
  return (
    <svg
      viewBox="0 0 8 14"
      className="h-3.5 w-2 shrink-0"
      style={{ opacity }}
      fill="none"
      aria-hidden
    >
      <path
        d="M1.5 1.5 L6.5 7 L1.5 12.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRow({ count, gap, opacity = 1 }: { count: number; gap: string; opacity?: number }) {
  return (
    <span className={`inline-flex items-center ${gap}`}>
      {Array.from({ length: count }, (_, index) => (
        <Chevron key={index} opacity={opacity} />
      ))}
    </span>
  );
}

/**
 * Motion-language marks in the gutter between destination stills.
 * Density is apparent speed. Slow-motion is a trailing hold. Variable is a swell.
 */
export function JourneyPaceMark({ pace }: { pace: LocomotionPace }) {
  switch (pace) {
    case "slow-motion":
      return (
        <span className="inline-flex items-center gap-1.5">
          <Chevron />
          <span className="ml-0.5 inline-flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-current opacity-55" />
            <span className="h-1 w-1 rounded-full bg-current opacity-35" />
            <span className="h-1 w-1 rounded-full bg-current opacity-20" />
          </span>
        </span>
      );
    case "slow":
      return <ChevronRow count={1} gap="gap-0" />;
    case "moderate":
      return <ChevronRow count={2} gap="gap-[3px]" />;
    case "fast":
      return <ChevronRow count={3} gap="gap-[2px]" />;
    case "hyperspeed":
      return <ChevronRow count={4} gap="gap-px" />;
    case "variable":
      return (
        <span className="inline-flex items-center gap-2">
          <ChevronRow count={1} gap="gap-0" opacity={0.85} />
          <ChevronRow count={2} gap="gap-[2px]" />
        </span>
      );
  }
}
