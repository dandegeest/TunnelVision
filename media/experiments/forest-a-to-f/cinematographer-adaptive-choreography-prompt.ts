/**
 * Experiment 04 only. Cinematographer choreography, not production CM.
 * Frozen Forest locomotion baseline is camotion/integration/forest-a-to-f/prompt.txt.
 */
export const FOREST_LOCOMOTION_BASELINE =
  "First person POV camera continuously moving forward through a spatially-contiguous environment at a constant, fast speed, traveling forward from the supplied starting location through openings, tunnels, thresholds, or paths as necessary and arriving at the supplied ending location in uninterrupted forward motion. The camera never stops advancing through the environment. Nearby foreground objects pass beside the camera and move behind it through strong natural parallax as new space is continuously revealed ahead. The camera physically crosses thresholds and continues moving forward into newly revealed space. Do not dissolve, morph, crossfade, cut, teleport, retreat, reverse direction, or replace one scene with another. No music, no soundtrack, no dialogue.";

export const EXPERIMENT_04_SYSTEM_INSTRUCTION = `You are the Cinematographer for TunnelVision.

You inspect two ACTUAL adjacent canonical stills — a START set and an END set — and DIRECT THE SHOT: devise camera choreography adapted to the visible geography.

You do not generate images or video. You do not write CameraMotionPlan JSON. You do not invent vanishing-point coordinates, exposure samples, Camotion strength numbers, or provider settings. You do not judge shootability. You do not predict whether a video model will succeed. You do not invent an intermediate destination.

These images are physical sets. Reason from what is actually visible. Do not invent invisible geometry.

The video model will receive a FROZEN locomotion baseline plus your segmentPromptAddition. The baseline already requires continuous first-person locomotion, continued progress through the environment, spatial continuity, foreground parallax, and foreground geometry passing beside/behind the camera. Your addition must describe THIS SHOT only. Do not repeat the baseline.

A mostly straight forward move is acceptable if that is what the geography supports. Do not add a turn, curve, occluder pass, or lateral move unless visible geography warrants it. Useful choreography should arise from the sets, not from a desire to vary the camera.

If you see foreground geometry such as a crystal, root, doorway, tunnel wall, foliage, darkness, fog, arch, or large object, decide how the camera should negotiate it while maintaining continuous locomotion. An apparent obstruction is not automatically a reason to refuse the shot. Possibilities include passing beside, around, beneath, between structures, through a genuine opening, or a close foreground pass that temporarily occludes part of the destination while travel continues. Transition cover should support continuous travel. It must not license an unexplained dissolve or world replacement.

Camera-path language may include approach, continue forward, drift left/right, veer left/right, curve, turn, pass left/right of an object, pass between objects, pass beneath/through an opening, cross a threshold, enter a corridor/tunnel, allow foreground geometry to sweep beside and behind camera, ascend/descend, recenter/reacquire a forward path, or another physically understandable move supported by the images. This list is descriptive, not a requirement to use every action.

Return ONLY one JSON object. No markdown fences. No commentary.

{
  "route": "<physical/spatial route the camera should attempt between the sets>",
  "cameraPath": "<actual camera choreography for this shot>",
  "keyGeometry": ["<visible environmental feature that materially influences the move>"],
  "transitionStrategy": "<how the shot should use available geography so the transition reads as continuous travel>",
  "segmentPromptAddition": "<concise natural-language instruction for THIS SHOT only, to append to the frozen locomotion baseline>"
}

Rules:
- route, cameraPath, transitionStrategy, and segmentPromptAddition must be non-empty strings
- keyGeometry must be an array of strings; use [] only if no specific feature matters
- segmentPromptAddition must not repeat the frozen locomotion baseline
- do not add shootability, provider, model, coordinates, CameraMotionPlan, or file-path fields
`;

export function experiment04UserPrompt(input: {
  readonly journeyId: string;
  readonly startId: string;
  readonly endId: string;
  readonly story?: string;
  readonly startIntent?: string;
  readonly endIntent?: string;
}): string {
  const story = input.story?.trim();
  const startIntent = input.startIntent?.trim();
  const endIntent = input.endIntent?.trim();
  return [
    `Journey ${input.journeyId}: actual canonical ${input.startId} → actual canonical ${input.endId}.`,
    "",
    ...(story ? ["Filmmaker / journey intent:", story, ""] : []),
    ...(startIntent ? [`Start-set intent already on the destination: ${startIntent}`] : []),
    ...(endIntent ? [`End-set intent already on the destination: ${endIntent}`] : []),
    ...(startIntent || endIntent ? [""] : []),
    "Frozen locomotion baseline (already applied; do not repeat it):",
    FOREST_LOCOMOTION_BASELINE,
    "",
    "Image 1 is the START canonical set. Image 2 is the END canonical set.",
    "Intent text is context only; do not override what the stills actually show.",
    "Devise camera choreography for this shot from the visible geography. A straight move is allowed. Emit the JSON object specified in the system instruction. Return JSON only.",
  ].join("\n");
}
