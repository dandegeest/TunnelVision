import { splitShootingPrompt } from "../../../media/src/cinematographer/shooting-prompt.ts";

/** Composed video prompt: extreme-pace lead-in, CM addition, then global baseline. */
export function ShootingPromptText({
  effectivePrompt,
  segmentPromptAddition,
  className = "",
}: {
  effectivePrompt: string;
  segmentPromptAddition?: string;
  className?: string;
}) {
  const { paceLeadIn, addition, baseline } = splitShootingPrompt(effectivePrompt, segmentPromptAddition);
  return (
    <p className={`whitespace-pre-wrap ${className}`.trim()}>
      {paceLeadIn ? (
        <span className="text-[#f4d27a]" data-prompt-role="pace">
          {paceLeadIn}
        </span>
      ) : null}
      {paceLeadIn && (addition || baseline) ? "\n" : null}
      {addition ? (
        <span className="text-[#e6c36a]" data-prompt-role="cm">
          {addition}
        </span>
      ) : null}
      {addition && baseline ? "\n" : null}
      {baseline ? (
        <span className="text-[#cfc6b8]" data-prompt-role="baseline">
          {baseline}
        </span>
      ) : null}
    </p>
  );
}
