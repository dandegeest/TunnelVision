import { splitShootingPrompt } from "../../../media/src/cinematographer/shooting-prompt.ts";

/** Composed video prompt: CM addition in accent color, global baseline in body color. */
export function ShootingPromptText({
  effectivePrompt,
  segmentPromptAddition,
  className = "",
}: {
  effectivePrompt: string;
  segmentPromptAddition?: string;
  className?: string;
}) {
  const { addition, baseline } = splitShootingPrompt(effectivePrompt, segmentPromptAddition);
  return (
    <p className={`whitespace-pre-wrap ${className}`.trim()}>
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
