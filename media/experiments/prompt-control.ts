export const FROZEN_FAST_PHRASE = "at a constant, fast speed";
export const SLOW_WALKING_PHRASE = "at a constant, slow walking speed";

export const CAMERA_SPEED_PROMPT_DIFF = [
  `- "${FROZEN_FAST_PHRASE}"`,
  `+ "${SLOW_WALKING_PHRASE}"`,
].join("\n");

/**
 * The only allowed prompt-control camera-speed edit is replacing the
 * frozen Ghost Library velocity phrase. Any other rewrite is rejected.
 */
export function cameraSpeedPromptDiff(
  controlPrompt: string,
  experimentalPrompt: string,
): string {
  const parts = controlPrompt.split(FROZEN_FAST_PHRASE);
  if (parts.length !== 2) {
    throw new Error("frozen locomotion prompt must contain the fast-speed phrase exactly once");
  }
  const expected = `${parts[0]}${SLOW_WALKING_PHRASE}${parts[1]}`;
  if (experimentalPrompt !== expected) {
    throw new Error(
      "experimental prompt must differ from the frozen locomotion prompt only by requested camera velocity",
    );
  }
  return CAMERA_SPEED_PROMPT_DIFF;
}

export function applySlowWalkingSpeed(controlPrompt: string): string {
  const parts = controlPrompt.split(FROZEN_FAST_PHRASE);
  if (parts.length !== 2) {
    throw new Error("frozen locomotion prompt must contain the fast-speed phrase exactly once");
  }
  return `${parts[0]}${SLOW_WALKING_PHRASE}${parts[1]}`;
}

const SLOW_TRAVERSAL_JOIN = `${SLOW_WALKING_PHRASE}, traveling forward`;
const EMBODIED_TRAVERSAL_JOIN =
  `${SLOW_WALKING_PHRASE}. The camera moves like the natural eye-level POV of a person physically walking, with subtle rhythmic vertical bob and gentle side-to-side body sway from each step, rather than smooth dolly, Steadicam, or stabilized camera motion. The movement feels human and physically grounded, not shaky or erratic, traveling forward`;

export const EMBODIED_WALKING_PROMPT_DIFF = [
  `- "${SLOW_TRAVERSAL_JOIN}"`,
  `+ "${EMBODIED_TRAVERSAL_JOIN}"`,
].join("\n");

/**
 * seedance-slow-embodied may add embodiment language after the slow-speed
 * phrase. The slow-walking-speed wording itself must stay intact.
 */
export function applyEmbodiedWalking(slowPrompt: string): string {
  if (!slowPrompt.includes(SLOW_WALKING_PHRASE)) {
    throw new Error("slow control prompt must retain the slow-walking-speed phrase");
  }
  const parts = slowPrompt.split(SLOW_TRAVERSAL_JOIN);
  if (parts.length !== 2) {
    throw new Error("slow control prompt must join speed to traversal with a comma exactly once");
  }
  return `${parts[0]}${EMBODIED_TRAVERSAL_JOIN}${parts[1]}`;
}

export function embodiedWalkingPromptDiff(
  slowPrompt: string,
  experimentalPrompt: string,
): string {
  const expected = applyEmbodiedWalking(slowPrompt);
  if (experimentalPrompt !== expected) {
    throw new Error(
      "experimental prompt must differ from seedance-slow only by embodied walking camera language",
    );
  }
  return EMBODIED_WALKING_PROMPT_DIFF;
}
