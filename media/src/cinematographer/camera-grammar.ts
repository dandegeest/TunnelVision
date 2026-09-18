/**
 * Whole-journey camera relationship. One project / one journey / one grammar.
 * Mixed-grammar journeys, ORBIT, SIDE TRACK, and grammar transitions are out of scope.
 */
export const CAMERA_GRAMMARS = ["pov", "follow", "lead", "mounted"] as const;
export type CameraGrammar = (typeof CAMERA_GRAMMARS)[number];
export const DEFAULT_CAMERA_GRAMMAR: CameraGrammar = "pov";

export const CAMERA_GRAMMAR_LABEL: Record<CameraGrammar, string> = {
  pov: "POV",
  follow: "FOLLOW",
  lead: "LEAD",
  mounted: "MOUNTED",
};

/**
 * Unembodied first-person POV: the camera has a position and trajectory,
 * but the viewer/camera operator must never become a visible character.
 * Do not enumerate FPS-style objects; that primes the video model.
 * Product still and video prompts share this clause; filmmaker/Director
 * story text should not. World-subject persistence is not part of this
 * clause — stills may add WORLD_SUBJECTS_MAY_APPEAR; video leaves
 * subjects to CM segmentPromptAddition.
 */
export const UNEMBODIED_FIRST_PERSON_POV =
  "Maintain an unembodied first-person POV. Never show the viewer/camera operator, their body, shadow, reflection, or FPS-style objects.";

/** Still-generation only. Video subject guidance belongs in CM. */
export const WORLD_SUBJECTS_MAY_APPEAR =
  "People, animals, vehicles, objects, and other subjects may appear naturally as part of the world.";

const LOCOMOTION_PACE_MACRO = "{pace}";

export function isCameraGrammar(value: unknown): value is CameraGrammar {
  return typeof value === "string" && (CAMERA_GRAMMARS as readonly string[]).includes(value);
}

/** Missing or unknown values load as POV. Do not mutate stored legacy data. */
export function cameraGrammarFromUnknown(value: unknown): CameraGrammar {
  return isCameraGrammar(value) ? value : DEFAULT_CAMERA_GRAMMAR;
}

const CONTINUOUS_TRAVEL_PROHIBITIONS =
  "Maintain continuous physical travel through the visible environment. Do not invent intermediate structures or passageways. Do not dissolve, morph, crossfade, cut, teleport, or replace one scene with another.";

/**
 * POV locomotion: camera IS the traveler. Path-relative forward travel.
 * Turns/banks with the route. Unembodied. No persistent foreground rig.
 * This is the historical TunnelVision baseline plus path-relative heading.
 */
export const POV_LOCOMOTION_BASELINE_TEMPLATE =
  `First person POV camera continuously moving forward through a spatially-contiguous environment ${LOCOMOTION_PACE_MACRO}, physically traveling from the supplied starting location to the supplied ending location along the route described above, arriving at the supplied ending location in uninterrupted forward motion. The camera never stops advancing through the environment. When the visible route turns, the camera physically turns and banks onto the new heading and continues forward along that route rather than holding a fixed world-space heading. Nearby foreground objects pass beside the camera and move behind it through strong natural parallax as new space is continuously revealed ahead. Maintain continuous physical travel through the visible environment. Do not invent intermediate structures or passageways. Do not dissolve, morph, crossfade, cut, teleport, retreat, reverse direction, or replace one scene with another. ` +
  UNEMBODIED_FIRST_PERSON_POV;

/**
 * FOLLOW locomotion: invisible objective camera preserves the pursuit
 * relationship, not a fixed distance. Elastic framing is cinematic.
 */
export const FOLLOW_LOCOMOTION_BASELINE_TEMPLATE =
  `Invisible objective camera continuously following a persistent subject through a spatially-contiguous environment ${LOCOMOTION_PACE_MACRO}, physically traveling from the supplied starting location to the supplied ending location along the route described above. Preserve the follow relationship: stay in pursuit of the same subject without arbitrarily overtaking them or losing them. Following distance may expand and contract naturally — the subject may pull farther ahead, and the camera may lag, catch up, drift, or bank with the route. Do not lock a fixed distance or a mechanically bolted-behind framing. Do not introduce a visible camera operator or a second traveler. Nearby foreground objects pass beside the camera through strong natural parallax as new space is continuously revealed. ${CONTINUOUS_TRAVEL_PROHIBITIONS} Do not convert this shot into first-person POV through the subject's eyes, or into a camera physically mounted on the subject.`;

/**
 * LEAD locomotion: camera stays ahead of the subject while facing them.
 * Must not be rewritten by forward-only POV conditioning.
 */
export const LEAD_LOCOMOTION_BASELINE_TEMPLATE =
  `Invisible objective camera traveling continuously ahead of a persistent subject while facing that subject, ${LOCOMOTION_PACE_MACRO}, physically retreating through a spatially-contiguous environment along the route described above from the supplied starting location to the supplied ending location. The subject advances toward the camera; the camera remains ahead of them and continues facing them. Preserve the lead relationship: do not pass the subject, do not overtake in reverse, and do not turn around to travel forward away from the subject. Do not convert this shot into first-person POV, a follow from behind, or a forward push past the subject. Continuous forward camera travel is not this grammar. The camera operator is invisible and is never a second traveler. Nearby foreground objects pass beside the camera through strong natural parallax as the camera retreats through space. ${CONTINUOUS_TRAVEL_PROHIBITIONS}`;

/**
 * MOUNTED locomotion: camera is physically attached. Persistent mount
 * geometry may remain visible. Motion inherits the mount.
 */
export const MOUNTED_LOCOMOTION_BASELINE_TEMPLATE =
  `Camera physically mounted to a moving subject, vehicle, or object, continuously inheriting that mount's motion through a spatially-contiguous environment ${LOCOMOTION_PACE_MACRO}, physically traveling from the supplied starting location to the supplied ending location along the route described above. Camera motion follows the mounted subject's acceleration, turns, banking, and vibration. Persistent foreground geometry belonging to the mount — a hood, handlebars, vehicle frame, boat bow, aircraft structure, or similar — may remain visible and is appropriate. ${CONTINUOUS_TRAVEL_PROHIBITIONS} Do not convert this shot into an unembodied first-person POV that hides the mount, or into a detached follow or lead camera.`;

export const LOCOMOTION_BASELINE_TEMPLATES: Record<CameraGrammar, string> = {
  pov: POV_LOCOMOTION_BASELINE_TEMPLATE,
  follow: FOLLOW_LOCOMOTION_BASELINE_TEMPLATE,
  lead: LEAD_LOCOMOTION_BASELINE_TEMPLATE,
  mounted: MOUNTED_LOCOMOTION_BASELINE_TEMPLATE,
};

export function locomotionBaselineTemplate(grammar: CameraGrammar = DEFAULT_CAMERA_GRAMMAR): string {
  return LOCOMOTION_BASELINE_TEMPLATES[cameraGrammarFromUnknown(grammar)];
}

export function stillViewpointClause(grammar: CameraGrammar = DEFAULT_CAMERA_GRAMMAR): string {
  switch (cameraGrammarFromUnknown(grammar)) {
    case "follow":
      return [
        "This is a FOLLOW viewpoint from an invisible objective camera in pursuit of a persistent subject.",
        "The subject is the visual and continuity anchor and should remain visible.",
        "Do not show a camera operator, a second traveler, or first-person through the subject's eyes.",
        WORLD_SUBJECTS_MAY_APPEAR,
      ].join(" ");
    case "lead":
      return [
        "This is a LEAD viewpoint from an invisible objective camera ahead of a persistent subject, facing that subject.",
        "The subject is the visual and continuity anchor and should remain visible as they approach.",
        "Do not show a camera operator or a second traveler. Do not convert this into a forward POV looking away from the subject.",
        WORLD_SUBJECTS_MAY_APPEAR,
      ].join(" ");
    case "mounted":
      return [
        "This is a MOUNTED viewpoint: the camera is physically attached to the moving subject, vehicle, or object.",
        "Persistent foreground geometry belonging to the mount may remain visible when natural to this perspective.",
        "Do not convert this into an unembodied POV that hides the mount, or into a detached follow/lead camera.",
        WORLD_SUBJECTS_MAY_APPEAR,
      ].join(" ");
    case "pov":
    default:
      return `${UNEMBODIED_FIRST_PERSON_POV} ${WORLD_SUBJECTS_MAY_APPEAR}`;
  }
}

export function openingStillLead(grammar: CameraGrammar = DEFAULT_CAMERA_GRAMMAR): string {
  switch (cameraGrammarFromUnknown(grammar)) {
    case "follow":
      return "Generate a still photograph of the opening viewpoint of this FOLLOW journey. The invisible objective camera is already in pursuit of the persistent subject at the instant the journey begins.";
    case "lead":
      return "Generate a still photograph of the opening viewpoint of this LEAD journey. The invisible objective camera is already ahead of the persistent subject and facing them at the instant the journey begins.";
    case "mounted":
      return "Generate a still photograph of the opening viewpoint of this MOUNTED journey. The camera is already physically attached to the moving subject, vehicle, or object at the instant the journey begins.";
    case "pov":
    default:
      return "Generate a still photograph of the opening viewpoint of this first-person POV journey.";
  }
}

export function constructionTravelClause(grammar: CameraGrammar = DEFAULT_CAMERA_GRAMMAR): string {
  switch (cameraGrammarFromUnknown(grammar)) {
    case "follow":
      return "The destination is a spatially progressed FOLLOW viewpoint along the same route. The camera remains in pursuit of the same persistent subject. Framing and distance may breathe. Do not overtake the subject or lose the follow relationship. The required change is camera viewpoint displacement along the route, not a change of world.";
    case "lead":
      return "The destination is a spatially progressed LEAD viewpoint along the same route. The camera remains ahead of the same persistent subject while facing them, having retreated with the route. Do not convert this into a forward POV looking away from the subject, a follow from behind, or a push past the subject. The required change is camera viewpoint displacement along the route, not a change of world.";
    case "mounted":
      return "The destination is a spatially progressed MOUNTED viewpoint. The camera remains attached to the same moving subject and inherits its travel along the route. Mount geometry may persist. The required change is the mount's displacement through the environment, not a change of world.";
    case "pov":
    default:
      return "The destination may be the same kind of place as the source — deeper in the same forest, farther along the same track, farther down the same hill. Do not invent a new type of location to prove progress. The required change is camera viewpoint displacement, not a change of world.";
  }
}

export function directorGrammarResearchPrinciple(grammar: CameraGrammar = DEFAULT_CAMERA_GRAMMAR): string {
  switch (cameraGrammarFromUnknown(grammar)) {
    case "follow":
      return "- FOLLOW grammar: an invisible objective camera pursues a persistent subject for the entire journey. Preserve the camera–subject relationship, not a fixed following distance. Distance may expand and contract; the camera may lag, catch up, or bank with the route. Do not plan overtaking, a second traveler, first-person through the subject's eyes, or a bolted-behind mounted look.";
    case "lead":
      return "- LEAD grammar: an invisible objective camera travels ahead of a persistent subject while facing them, typically retreating as they advance. Plan destinations as progressed lead viewpoints looking at the approaching subject. Do not rewrite lead into forward POV, a follow from behind, or a push past the subject. Continuous forward camera travel is not this grammar.";
    case "mounted":
      return "- MOUNTED grammar: the camera is physically attached to the moving subject, vehicle, or object for the entire journey. Plan destinations from that mounted perspective. Persistent mount geometry may appear. Camera motion inherits the mount. Do not plan detached follow, lead, or unembodied POV viewpoints.";
    case "pov":
    default:
      return "- Continuous forward locomotion matters. The viewer should keep moving through space. The camera is the traveler (unembodied POV). When the route turns, the camera physically turns and banks onto the new heading rather than holding a fixed world-space heading.";
  }
}

export function directorGrammarBodyConstraint(grammar: CameraGrammar = DEFAULT_CAMERA_GRAMMAR): string {
  switch (cameraGrammarFromUnknown(grammar)) {
    case "follow":
      return "Keep the persistent subject as the continuity anchor in destinations. Do not describe a visible camera operator, a second traveler, or first-person through the subject's eyes.";
    case "lead":
      return "Keep the persistent subject as the continuity anchor, seen from ahead. Do not describe a visible camera operator. Do not plan viewpoints that look away from the subject along a forward POV.";
    case "mounted":
      return "Persistent mount or vehicle geometry may appear in destinations when natural to a physically attached camera.";
    case "pov":
    default:
      return "Do not describe the viewer's body, hands, or held camera equipment.";
  }
}

export function cinematographerGrammarInstruction(grammar: CameraGrammar = DEFAULT_CAMERA_GRAMMAR): string {
  switch (cameraGrammarFromUnknown(grammar)) {
    case "follow":
      return `This journey uses FOLLOW grammar. Both stills are pursuit viewpoints from an invisible objective camera following a persistent subject along the same route. Image 2 is the next FOLLOW viewpoint, not first-person through the subject's eyes, not a reverse lead looking back at a camera operator, and not a mounted rig bolted to the subject.

The camera operator is never a visible character. The subject is the continuity anchor. People, animals, vehicles, objects, and other world subjects in the stills may appear; preserve the intended follow subject when it is visible.

FOLLOW preserves the relationship, not a fixed distance. Choreograph natural cinematic elasticity: the subject may pull farther ahead; the camera may lag, catch up, drift, or bank with the route. Do not lock an exact offset. Do not arbitrarily overtake. Do not lose the follow relationship. A rigidly bolted-behind look is closer to MOUNTED than cinematic FOLLOW.

A landmark ahead in the start is typically space the pursuit will travel into, with the subject remaining the anchor. Do not treat a shared landmark as evidence that Image 2 is a reverse angle of Image 1.`;
    case "lead":
      return `This journey uses LEAD grammar. Both stills are viewpoints from an invisible objective camera ahead of a persistent subject, facing that subject. Image 2 is the next LEAD viewpoint along the same route after the camera has retreated, still facing the subject. It is not a follow from behind, not first-person POV looking away from the subject, and not a forward push past the subject.

The camera operator is never a visible character. The subject is the continuity anchor and should remain visible as they approach. People, animals, vehicles, objects, and other world subjects in the stills may appear; preserve the intended lead subject when it is visible.

Preserve backward/retreating travel relative to the camera's facing direction. The subject advances; the camera stays ahead and continues facing them. Do not rewrite this pair into continuous forward POV. Do not mark a facing-the-subject retreat as a reverse-angle error. Forward-only locomotion is not this grammar.

A landmark behind/around the camera is typically the space the camera is retreating into. The subject ahead is who the camera is facing, not the vanishing-point the camera should fly into. Do not treat facing the subject as a reason to push forward past them.`;
    case "mounted":
      return `This journey uses MOUNTED grammar. Both stills are viewpoints from a camera physically attached to the moving subject, vehicle, or object. Image 2 is the next mounted viewpoint after that mount has traveled along the route. It is not an unembodied POV that hides the mount, and not a detached follow or lead camera.

Persistent foreground geometry belonging to the mount may be visible and is appropriate. Camera motion should inherit the mount's acceleration, turns, banking, and vibration. People, animals, vehicles, objects, and other subjects in the stills are part of the world.

A landmark ahead in the start is typically where the mount is traveling. Do not treat mount geometry as an occlusion that must be removed, and do not convert the shot to unembodied POV to avoid it.`;
    case "pov":
    default:
      return `Both stills are first-person POV from the same continuously forward-moving camera. Image 2 is the next viewpoint along that same travel direction. It is not a reverse angle, not a look back, and not a camera placed at the far end of the destination facing toward the start.

The camera is unembodied. The viewer/camera operator is never a visible character. People, animals, vehicles, objects, and other subjects in the stills are part of the world.

A landmark that appears ahead in the start (a doorway, light, pool edge, corridor mouth) is typically the space the camera is traveling INTO. The end still is what that same forward camera sees after continuing into the next volume, still looking forward. Do not treat a shared landmark as evidence that the destination was photographed from the opposite direction.`;
  }
}

export function cinematographerBaselineDescription(grammar: CameraGrammar = DEFAULT_CAMERA_GRAMMAR): string {
  switch (cameraGrammarFromUnknown(grammar)) {
    case "follow":
      return "It enforces continuous FOLLOW travel — pursuit of a persistent subject with elastic distance — and forbids cinematic cheats (dissolve, morph, cut, teleport, invented passageways). It does not lock a fixed following distance.";
    case "lead":
      return "It enforces continuous LEAD travel — remaining ahead of and facing the subject while retreating along the route — and forbids cinematic cheats (dissolve, morph, cut, teleport, invented passageways). It does not license converting the shot into forward POV.";
    case "mounted":
      return "It enforces continuous MOUNTED travel that inherits the mount's motion, allows persistent mount geometry, and forbids cinematic cheats (dissolve, morph, cut, teleport, invented passageways).";
    case "pov":
    default:
      return "It only enforces continuous first-person travel and forbids cinematic cheats (dissolve, morph, cut, teleport, invented passageways).";
  }
}

export function cinematographerPairUserLines(grammar: CameraGrammar = DEFAULT_CAMERA_GRAMMAR): readonly string[] {
  switch (cameraGrammarFromUnknown(grammar)) {
    case "follow":
      return [
        "Both stills are FOLLOW viewpoints from an invisible objective camera pursuing the same persistent subject along the same route. Image 2 is the next pursuit viewpoint, not a reverse shot and not first-person through the subject's eyes.",
      ];
    case "lead":
      return [
        "Both stills are LEAD viewpoints from an invisible objective camera ahead of the same persistent subject, facing them. Image 2 is the next retreated lead viewpoint, not a reverse-angle error and not a forward POV looking away from the subject.",
      ];
    case "mounted":
      return [
        "Both stills are MOUNTED viewpoints from a camera physically attached to the same moving subject. Image 2 is the next mounted viewpoint after that travel, not an unembodied POV and not a detached follow/lead.",
      ];
    case "pov":
    default:
      return [
        "Both stills are first-person POV looking in the same travel direction. Image 2 is the next forward viewpoint, not a reverse shot of Image 1.",
      ];
  }
}

export function cinematographerNotShootableCaveat(grammar: CameraGrammar = DEFAULT_CAMERA_GRAMMAR): string {
  if (cameraGrammarFromUnknown(grammar) === "lead") {
    return "Do not mark not_shootable merely because setConsistency is low, the space beyond a threshold is surreal or impossible, or the camera is facing the approaching subject while retreating. Facing the subject is LEAD, not a reverse-angle failure.";
  }
  return "Do not mark not_shootable merely because setConsistency is low, the space beyond a threshold is surreal or impossible, or continuing forward through a start-frame opening would, under a reverse-angle reading, place the camera at the far end of the destination looking back.";
}
