import {
  DEFAULT_CAMERA_GRAMMAR,
  cameraGrammarFromUnknown,
  constructionTravelClause,
  openingStillLead,
  stillViewpointClause,
  type CameraGrammar,
} from "../cinematographer/camera-grammar.ts";
import { joinPromptSections } from "./assemble.ts";

/**
 * Canonical still-construction prompt templates.
 *
 * Filmmaker-owned inputs (Prompt Coach): subject, beats, style.
 * Camera grammar law is injected here from `camera-grammar.ts` and must not
 * be restated in the journey prompt.
 *
 * Pull Forward Reference (`pullForwardReferenceEnabled`, default true) is a
 * reversible experiment. ON keeps the current world-continuity clause and
 * the previous canonical as the image-edit source. OFF replaces only that
 * visual-inheritance language so Ghost Library / Courtyard-style journeys
 * can change architecture between destinations; continuity then relies on
 * forward travel, thresholds, camera grammar, and traversal. The same flag
 * also swaps the locomotion-baseline "do not invent passageways" sentence
 * for threshold-connective travel. OFF is not the preferred product default.
 *
 * TODO: future persistent subject/object reference images can plug into this
 * assembler as an extra structured part after pull-forward continuity. Do not
 * add schema or persistence for that here.
 */

export const CANONICAL_CONSTRUCTION_SECTION_ORDER = [
  "destinationIntent",
  "spatialProgression",
  "localRoute",
  "cameraGrammarLaw",
  "pullForwardContinuity",
  "farFieldContinuity",
] as const;

export type CanonicalConstructionSection = (typeof CANONICAL_CONSTRUCTION_SECTION_ORDER)[number];

export const DESTINATION_INTENT_LEAD = "Create this destination viewpoint:";

export const SPATIAL_PROGRESSION_PRIMARY = [
  "SPATIAL PROGRESSION IS PRIMARY.",
  "Render this canonical from a substantially progressed camera viewpoint. Do not render it from the source camera position. Nearby foreground geometry from the source must have passed behind the camera or be substantially repositioned. Reveal new terrain and environment ahead as a consequence of that movement.",
].join("\n");

export const LOCAL_ROUTE_LEAD = "Move the camera from the source viewpoint:";

/** World / subject / style continuity. Source composition must change; world must not. */
export const WORLD_CONTINUITY = [
  "Preserve the same physical world, materials, lighting character, and visual identity of the source image.",
  "Do not satisfy the destination merely by changing the activity, subjects, weather, lighting, visual style, or state of the source scene.",
  "Environmental activity, subject motion, and stylistic changes are secondary to viewpoint displacement. Include them when called for by the Journey, but only with clear physical travel of the camera along the route.",
  "This is a spatial continuation of the same world, not a restyle and not an in-place edit of the existing composition. The camera viewpoint must physically travel along the route. Keeping the source composition and substituting new content is a failure.",
].join("\n");

export const DEFAULT_PULL_FORWARD_REFERENCE_ENABLED = true;

/**
 * Missing / unknown values stay ON so older projects keep current behavior.
 * Only an explicit `false` disables pull-forward visual inheritance.
 */
export function pullForwardReferenceEnabledFromUnknown(value: unknown): boolean {
  return value !== false;
}

/**
 * Pull-forward continuity for the next canonical.
 *
 * ON: existing source-image world preservation (current product behavior).
 * OFF: route / threshold / grammar continuity only. Destinations may differ
 * visually when the Journey asks for it. Does not weaken spatial progression
 * or camera grammar; those stay in their own sections.
 */
export function pullForwardContinuityClause(input: { enabled?: boolean } = {}): string {
  return pullForwardReferenceEnabledFromUnknown(input.enabled)
    ? WORLD_CONTINUITY
    : PULL_FORWARD_CONTINUITY_OFF;
}

export const PULL_FORWARD_CONTINUITY_OFF = [
  "Do not preserve the previous composition merely for visual continuity. The new destination may differ substantially in architecture, materials, lighting, environment, and visual content when the Journey calls for it.",
  "Continuity should come from forward travel, route logic, thresholds, and camera grammar rather than visual similarity to the previous canonical.",
].join("\n");

export const FAR_FIELD_CONTINUITY_LEAD = "Far-field continuity:";

export const FAR_FIELD_CONTINUITY_RULE =
  "This is optional distant environmental information only. Include it only if it fits naturally and spatially from the current destination viewpoint. It is acceptable for no far-field preview to appear. Do not force the next destination into the frame, and do not let it dominate, replace, or drive the composition, lighting, or style of the current destination.";

export function farFieldContinuitySection(details: string): string {
  const trimmed = details.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return "";
  }
  return [FAR_FIELD_CONTINUITY_LEAD, trimmed, FAR_FIELD_CONTINUITY_RULE].join("\n");
}

export function destinationIntentSection(visualDescription: string): string {
  return `${DESTINATION_INTENT_LEAD}\n${visualDescription.trim()}`;
}

export function spatialProgressionSection(grammar: CameraGrammar): string {
  return `${SPATIAL_PROGRESSION_PRIMARY}\n${constructionTravelClause(grammar)}`;
}

export function localRouteSection(intent: string): string {
  return `${LOCAL_ROUTE_LEAD}\n${intent.trim()}`;
}

/** Proven still-grammar law. Do not paraphrase. */
export function cameraGrammarLawSection(grammar: CameraGrammar): string {
  return stillViewpointClause(grammar);
}

export type CanonicalConstructionPromptInput = {
  intent: string;
  visualDescription: string;
  nextDestinationVisual?: string;
  cameraGrammar?: CameraGrammar;
  /** Missing means ON (current behavior). */
  pullForwardReferenceEnabled?: boolean;
};

export function assembleCanonicalConstructionPrompt(input: CanonicalConstructionPromptInput): string {
  const intent = input.intent.trim();
  const visualDescription = input.visualDescription.trim();
  if (!intent || !visualDescription) {
    throw new Error("Destination construction requires intent and visual description");
  }
  const grammar = cameraGrammarFromUnknown(input.cameraGrammar);
  const farField = farFieldContinuitySection(input.nextDestinationVisual ?? "");
  const pullForwardEnabled = pullForwardReferenceEnabledFromUnknown(input.pullForwardReferenceEnabled);
  return joinPromptSections(
    destinationIntentSection(visualDescription),
    spatialProgressionSection(grammar),
    localRouteSection(intent),
    cameraGrammarLawSection(grammar),
    pullForwardContinuityClause({ enabled: pullForwardEnabled }),
    farField || undefined,
  );
}

function pullForwardContinuityStart(prompt: string): number {
  const worldAt = prompt.indexOf("Preserve the same physical world");
  if (worldAt >= 0) {
    return worldAt;
  }
  return prompt.indexOf("Do not preserve the previous composition merely for visual continuity");
}

export function canonicalConstructionSectionStarts(
  prompt: string,
  grammar: CameraGrammar = DEFAULT_CAMERA_GRAMMAR,
): Record<CanonicalConstructionSection, number> {
  return {
    destinationIntent: prompt.indexOf(DESTINATION_INTENT_LEAD),
    spatialProgression: prompt.indexOf("SPATIAL PROGRESSION IS PRIMARY."),
    localRoute: prompt.indexOf(LOCAL_ROUTE_LEAD),
    cameraGrammarLaw: prompt.indexOf(stillViewpointClause(grammar)),
    pullForwardContinuity: pullForwardContinuityStart(prompt),
    farFieldContinuity: prompt.indexOf(FAR_FIELD_CONTINUITY_LEAD),
  };
}

export function assembleOpeningFramePrompt(story: string, cameraGrammar?: CameraGrammar): string {
  const trimmed = story.trim();
  if (!trimmed) {
    throw new Error("Opening frame requires a journey story");
  }
  const grammar = cameraGrammarFromUnknown(cameraGrammar);
  return joinPromptSections(
    `${openingStillLead(grammar)} Use the Journey to determine the specific physical viewpoint, orientation, environment, and situation at the instant the journey begins. Show only that opening moment; do not anticipate, combine, or depict later destinations or events from the Journey.`,
    `The camera is already in the world, oriented along the journey's intended direction of travel. ${stillViewpointClause(grammar)} Do not show text.`,
    `Journey: ${trimmed}`,
  );
}

export function assembleCanonicalRepairPrompt(input: {
  role: "start" | "end";
  intent: string;
  visualDescription: string;
  instruction: string;
  cameraGrammar?: CameraGrammar;
}): string {
  const intent = input.intent.trim();
  const visualDescription = input.visualDescription.trim();
  const instruction = input.instruction.trim();
  if (!intent || !visualDescription || !instruction) {
    throw new Error("Canonical repair requires intent, visual description, and a repair instruction");
  }
  const grammar = cameraGrammarFromUnknown(input.cameraGrammar);
  const roleLine =
    input.role === "start"
      ? "Regenerate this START destination so it still depicts the same intended place, while establishing a plausible continuous route toward the opposite canonical."
      : "Regenerate this END destination so it still depicts the same intended arrival, while creating a stronger continuously shootable route from the established START.";
  const grammarLock =
    grammar === "follow"
      ? "Preserve FOLLOW geometry: camera behind the subject, subject ahead and receding, rear/aft/trailing side readable. Do not convert a pursuit still into a lead-facing view of the subject in order to reduce far-field, change lighting, or improve aesthetics."
      : "Preserve this destination's camera grammar. Do not sacrifice the camera–subject relationship to reduce far-field, change lighting, or improve aesthetics.";
  return joinPromptSections(
    [
      roleLine,
      "Preserve this destination's semantic intent and story beat.",
      visualDescription,
    ].join("\n"),
    ["Camera / spatial intent:", intent].join("\n"),
    [
      "The stills must belong to one continuously shootable physical space. Do not make the two images look alike. Do not replace this destination with the opposite place. Do not repair merely to improve aesthetics.",
      grammarLock,
      `CM spatial repair: ${instruction}`,
      "The established START still, when supplied, is a spatial/geographic reference for the route, not a style match.",
    ].join("\n"),
    stillViewpointClause(grammar),
  );
}
