import {
  DEFAULT_CAMERA_GRAMMAR,
  locomotionBaselineTemplate,
  UNEMBODIED_FIRST_PERSON_POV,
  WORLD_SUBJECTS_MAY_APPEAR,
  type CameraGrammar,
} from "./camera-grammar.ts";

export { UNEMBODIED_FIRST_PERSON_POV, WORLD_SUBJECTS_MAY_APPEAR };
export type { CameraGrammar };
/**
 * Apparent camera speed in the frozen locomotion baseline.
 * Pace does not set clip duration; this is linguistic conditioning, not runtime.
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
  "slow-motion": "in extreme cinematic slow motion throughout",
  slow: "at a constant, slow speed",
  moderate: "at a constant, moderate speed",
  fast: "at a constant, fast speed",
  hyperspeed: "at extreme hyper-speed while still physically traversing space",
  variable: "at a variable speed that quickens and eases with the geography",
};

/** First-class temporal treatments. Composed ahead of CM addition and the baseline. */
export const EXTREME_PACE_LEAD_INS = {
  "slow-motion":
    "Perform the entire traversal in extreme cinematic slow motion. All camera movement and visible motion in the environment unfolds at a dramatically slowed temporal rate from beginning to end.",
  hyperspeed:
    "Perform the entire traversal at extreme hyper-speed. Camera travel and visible motion through the environment unfolds at a dramatically accelerated temporal rate from beginning to end.",
} as const;

export function extremePaceLeadIn(pace: LocomotionPace): string {
  if (pace === "slow-motion") {
    return EXTREME_PACE_LEAD_INS["slow-motion"];
  }
  if (pace === "hyperspeed") {
    return EXTREME_PACE_LEAD_INS.hyperspeed;
  }
  return "";
}

export function isLocomotionPace(value: unknown): value is LocomotionPace {
  return typeof value === "string" && (LOCOMOTION_PACES as readonly string[]).includes(value);
}

export function locomotionPaceList(): string {
  return LOCOMOTION_PACES.join(", ");
}

/**
 * Grammar-specific locomotion baseline plus segment-specific CM addition.
 * Composition is deterministic concatenation: extreme-pace lead-in when
 * the pace is slow-motion or hyperspeed, then shot choreography, then the
 * filled locomotion baseline. Do not LLM-merge these strings.
 * `{pace}` is filled from the segment's BLOCK pace before concatenation.
 *
 * POV inherits Terran Boylan's original TunnelVision continuous-locomotion /
 * anti-cheat prompting. FOLLOW / LEAD / MOUNTED are dedicated baselines so
 * forward-only POV conditioning cannot rewrite those relationships.
 * Route-specific spatial language belongs in CM segmentPromptAddition.
 * Video generation is not invoked here.
 */
export const TUNNELVISION_LOCOMOTION_BASELINE_TEMPLATE = locomotionBaselineTemplate("pov");

export function locomotionBaseline(
  pace: LocomotionPace = DEFAULT_LOCOMOTION_PACE,
  grammar: CameraGrammar = DEFAULT_CAMERA_GRAMMAR,
): string {
  if (!isLocomotionPace(pace)) {
    throw new Error(`Locomotion pace must be ${locomotionPaceList()}`);
  }
  return locomotionBaselineTemplate(grammar).replaceAll(
    LOCOMOTION_PACE_MACRO,
    LOCOMOTION_PACE_PHRASES[pace],
  );
}

/** Default filled baseline (fast). Prefer `locomotionBaseline(pace)` at shoot time. */
export const TUNNELVISION_LOCOMOTION_BASELINE = locomotionBaseline(DEFAULT_LOCOMOTION_PACE);

export function composeShootingPrompt(
  baseline: string,
  segmentPromptAddition?: string,
  pace?: LocomotionPace,
): string {
  const frozen = baseline.trim();
  const addition = segmentPromptAddition?.trim();
  const lead = pace ? extremePaceLeadIn(pace).trim() : "";
  return [lead, addition, frozen].filter(Boolean).join("\n");
}

/** Shot choreography plus the grammar-specific filled locomotion baseline. */
export function composeJourneyShootingPrompt(
  segmentPromptAddition: string,
  pace: LocomotionPace = DEFAULT_LOCOMOTION_PACE,
  grammar: CameraGrammar = DEFAULT_CAMERA_GRAMMAR,
): string {
  return composeShootingPrompt(locomotionBaseline(pace, grammar), segmentPromptAddition, pace);
}

/** Split a composed video prompt for inspector display. Prefers the stored CM addition. */
export function splitShootingPrompt(
  effectivePrompt: string,
  segmentPromptAddition?: string,
): { paceLeadIn: string; addition: string; baseline: string } {
  let prompt = effectivePrompt.trim();
  let paceLeadIn = "";
  for (const lead of Object.values(EXTREME_PACE_LEAD_INS)) {
    if (prompt === lead) {
      return { paceLeadIn: lead, addition: "", baseline: "" };
    }
    const prefix = `${lead}\n`;
    if (prompt.startsWith(prefix)) {
      paceLeadIn = lead;
      prompt = prompt.slice(prefix.length);
      break;
    }
  }
  const addition = segmentPromptAddition?.trim() ?? "";
  if (addition) {
    if (prompt === addition) {
      return { paceLeadIn, addition, baseline: "" };
    }
    const prefix = `${addition}\n`;
    if (prompt.startsWith(prefix)) {
      return { paceLeadIn, addition, baseline: prompt.slice(prefix.length) };
    }
  }
  const newline = prompt.indexOf("\n");
  if (newline >= 0) {
    return { paceLeadIn, addition: prompt.slice(0, newline), baseline: prompt.slice(newline + 1) };
  }
  return { paceLeadIn, addition: "", baseline: prompt };
}
