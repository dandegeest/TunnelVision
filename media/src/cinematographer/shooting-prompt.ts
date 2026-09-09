/**
 * Unembodied first-person POV: the camera has a position and trajectory,
 * but the viewer/camera operator must never become a visible character.
 * World subjects may appear naturally. Product still and video prompts
 * share this clause; filmmaker/Director story text should not.
 */
export const UNEMBODIED_FIRST_PERSON_POV =
  "Maintain an unembodied first-person POV. The viewer/camera operator must never be visible in-frame, including hands, arms, legs, feet, body, shadow, reflection, or FPS-style held objects such as weapons, phones, or camera equipment. People, animals, vehicles, objects, and other subjects may appear naturally as part of the world.";

/**
 * Stable TunnelVision locomotion baseline plus segment-specific CM addition.
 * Composition is deterministic concatenation. Do not LLM-merge these strings.
 *
 * The baseline inherits Terran Boylan's original TunnelVision continuous-
 * locomotion / environment-negotiation prompting. Agent-generated per-segment
 * choreography is current TunnelVision product work, not Terran's design.
 * Video generation is not invoked here.
 */
export const TUNNELVISION_LOCOMOTION_BASELINE =
  "First person POV camera continuously moving forward through a spatially-contiguous environment at a constant, fast speed, traveling forward from the supplied starting location through openings, tunnels, thresholds, or paths as necessary and arriving at the supplied ending location in uninterrupted forward motion. The camera never stops advancing through the environment. Nearby foreground objects pass beside the camera and move behind it through strong natural parallax as new space is continuously revealed ahead. The camera physically crosses thresholds and continues moving forward into newly revealed space. Do not dissolve, morph, crossfade, cut, teleport, retreat, reverse direction, or replace one scene with another. No music, no soundtrack, no dialogue. " +
  UNEMBODIED_FIRST_PERSON_POV;

export function composeShootingPrompt(
  baseline: string,
  segmentPromptAddition?: string,
): string {
  const frozen = baseline.trim();
  const addition = segmentPromptAddition?.trim();
  if (!addition) {
    return frozen;
  }
  return `${frozen}\n${addition}`;
}
