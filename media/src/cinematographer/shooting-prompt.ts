/**
 * Unembodied first-person POV: the camera has a position and trajectory,
 * but the viewer/camera operator must never become a visible character.
 * World subjects may appear naturally. Product still and video prompts
 * share this clause; filmmaker/Director story text should not.
 */
export const UNEMBODIED_FIRST_PERSON_POV =
  "Maintain an unembodied first-person POV. The viewer/camera operator must never be visible in-frame, including hands, arms, legs, feet, body, shadow, reflection, or FPS-style held objects such as weapons, phones, or camera equipment. People, animals, vehicles, objects, and other subjects may appear naturally as part of the world.";

/**
 * Apparent camera speed in the frozen locomotion baseline.
 * Clip duration is unchanged; this is linguistic conditioning, not runtime.
 * BLOCK sets it per segment. Default remains fast.
 *
 * `{pace}` is a full adverbial phrase, not an adjective inside "constant speed",
 * so variable, hyperspeed, and slow-motion stay grammatical.
 */
export const LOCOMOTION_PACE_MACRO = "{pace}";
export const LOCOMOTION_PACES = [
  "slow-motion",
  "slow",
  "moderate",
  "fast",
  "hyperspeed",
  "variable",
] as const;
export type LocomotionPace = (typeof LOCOMOTION_PACES)[number];
export const DEFAULT_LOCOMOTION_PACE: LocomotionPace = "fast";

export const LOCOMOTION_PACE_PHRASES: Record<LocomotionPace, string> = {
  "slow-motion": "in continuous slow motion",
  slow: "at a constant, slow speed",
  moderate: "at a constant, moderate speed",
  fast: "at a constant, fast speed",
  hyperspeed: "at hyperspeed while still physically traversing space",
  variable: "at a variable speed that quickens and eases with the geography",
};

export function isLocomotionPace(value: unknown): value is LocomotionPace {
  return typeof value === "string" && (LOCOMOTION_PACES as readonly string[]).includes(value);
}

export function locomotionPaceList(): string {
  return LOCOMOTION_PACES.join(", ");
}

/**
 * Stable TunnelVision locomotion baseline plus segment-specific CM addition.
 * Composition is deterministic concatenation: shot choreography first,
 * then the filled locomotion baseline. Do not LLM-merge these strings.
 * `{pace}` is filled from the segment's BLOCK pace before concatenation.
 *
 * The baseline inherits Terran Boylan's original TunnelVision continuous-
 * locomotion / environment-negotiation prompting. Agent-generated per-segment
 * choreography is current TunnelVision product work, not Terran's design.
 * Video generation is not invoked here.
 */
export const TUNNELVISION_LOCOMOTION_BASELINE_TEMPLATE =
  `First person POV camera continuously moving forward through a spatially-contiguous environment ${LOCOMOTION_PACE_MACRO}, physically traveling from the supplied starting location to the supplied ending location along a route appropriate to the visible world, arriving at the supplied ending location in uninterrupted forward motion. The camera never stops advancing through the environment. Nearby foreground objects pass beside the camera and move behind it through strong natural parallax as new space is continuously revealed ahead. The camera physically follows the available route through the environment, crossing openings, thresholds, tunnels, paths, or open space only when they naturally exist in the supplied world. Do not dissolve, morph, crossfade, cut, teleport, retreat, reverse direction, or replace one scene with another. ` +
  UNEMBODIED_FIRST_PERSON_POV;

export function locomotionBaseline(pace: LocomotionPace = DEFAULT_LOCOMOTION_PACE): string {
  if (!isLocomotionPace(pace)) {
    throw new Error(`Locomotion pace must be ${locomotionPaceList()}`);
  }
  return TUNNELVISION_LOCOMOTION_BASELINE_TEMPLATE.replaceAll(
    LOCOMOTION_PACE_MACRO,
    LOCOMOTION_PACE_PHRASES[pace],
  );
}

/** Default filled baseline (fast). Prefer `locomotionBaseline(pace)` at shoot time. */
export const TUNNELVISION_LOCOMOTION_BASELINE = locomotionBaseline(DEFAULT_LOCOMOTION_PACE);

export function composeShootingPrompt(
  baseline: string,
  segmentPromptAddition?: string,
): string {
  const frozen = baseline.trim();
  const addition = segmentPromptAddition?.trim();
  if (!addition) {
    return frozen;
  }
  return `${addition}\n${frozen}`;
}
