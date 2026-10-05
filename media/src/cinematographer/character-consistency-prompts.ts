import { cameraGrammarFromUnknown, type CameraGrammar } from "./camera-grammar.ts";

/**
 * Character consistency is identity only. It is a separate call from
 * cinematographer motion planning, set consistency, and traversal confidence.
 */

export const CHARACTER_CONSISTENCY_SYSTEM = [
  "You compare a persistent subject reference with one candidate canonical still.",
  "Score only whether the visible subject is still the same design.",
  "Do not score camera motion, temporal continuity, spatial continuity, composition continuity, scene continuity, or whether the shot can be filmed.",
  "Pose, body orientation, camera angle, perspective, apparent scale, expression, lighting, physical motion, wind, gravity, and scene interaction are not identity failures. Those variations are desirable.",
  "A part that is occluded, facing away, distant, or on the far side of the subject is not an identity failure. Rear views, side views, and action poses hide parts of the reference. Do not require antennae, the face, chest panels, or other front details to be readable from behind.",
  "Do not build a parts checklist. Judge the recognizable design you can actually see: silhouette, color scheme, and distinctive features that are in frame.",
  "A score under 60 means the visible subject is a different design. An unclear or unseen detail is not enough.",
  "Return JSON only.",
].join(" ");

/** What this grammar makes visible. Follow is a view from behind the subject. */
export function characterConsistencyViewpoint(grammar: CameraGrammar | unknown): string {
  switch (cameraGrammarFromUnknown(grammar)) {
    case "follow":
      return "Camera grammar is FOLLOW. The camera stays with the subject, seeing them from behind or from the side. A part hidden by that angle is not identity drift. Do not ask for a repair that turns the subject to face the camera.";
    case "lead":
      return "Camera grammar is LEAD. The camera is ahead of the subject and seeing them from the front. The back is expected to be hidden.";
    case "mounted":
      return "Camera grammar is MOUNTED. The camera is attached to the subject. Score only the parts of the subject this mount can see.";
    case "pov":
    default:
      return "Camera grammar is POV. The camera is the traveler. The persistent subject may be absent or only partly in frame.";
  }
}

export function characterConsistencyUserPrompt(
  description: string,
  grammar: CameraGrammar | unknown = "pov",
): string {
  const note = description.trim();
  return [
    "Image 1 is the authoritative persistent subject reference.",
    "Image 2 is the candidate canonical still. Score image 2 from its own camera angle.",
    characterConsistencyViewpoint(grammar),
    note
      ? `Persistent subject:\n${note}\nOnly the features named here are mandatory identity. Do not require every unmarked detail from the sheet to be visible.`
      : "Persistent subject: no written description. Judge whether image 2 is still recognizably the same subject. Do not invent a mandatory parts list from the sheet.",
    "Does the visible subject in image 2 still look like the same persistent subject?",
    "Pass when the design matches and some reference parts are simply not visible from this angle, distance, or pose.",
    "Fail only when a feature that is actually visible is the wrong design: a different character, a changed color scheme, a changed costume, or a material that is visibly different on a surface you can see.",
    "Do not ask for a repair that turns the subject around, shows its front, or copies the reference pose in order to reveal a hidden part.",
    'Return JSON: {"score":0,"observations":["..."],"repairInstructions":["..."]}',
    "score is an integer 0–100 for visible subject identity only. Use 60 or above when it is still the same subject.",
    "observations are short notes about what is visible.",
    "repairInstructions are present only for a feature that is visibly the wrong design. Never instruct the image to rotate or to display a part the camera cannot see.",
  ].join("\n\n");
}
