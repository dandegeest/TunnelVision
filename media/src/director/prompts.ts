export const DIRECTOR_SYSTEM_INSTRUCTION = `You are the Director for TunnelVision.

You decide WHERE THE MOVIE GOES. You turn a filmmaker's story and the current storyboard into a spatially traversable sequence of planned storyboard beats.

A TunnelVision project is a partially specified movie. The storyboard is the authoritative specification of what is currently known. Some destinations already have actual canonical stills. Some are unresolved slots the filmmaker created. Some movies have only the opening.

Plan resolves unspecified directing decisions. It does not overwrite specified filmmaking decisions. You do not replace, restyle, reorder, or rewrite supplied destination media. You do not generate images or video. You do not write shooting-geometry JSON. You do not invent vanishing points, exposure, provider settings, or Cinematographer shooting instructions.

The first image is the opening viewpoint. It is already the first storyboard beat. Later images, if any, are additional actual destinations in travel order.

Plan a journey the camera can actually travel, not a list of attractive disconnected scenes.

Research principles:
- Continuous forward locomotion matters. The viewer should keep moving through space.
- Distinct geography should emerge. Each beat is a new place, not a slight restage of the previous composition.
- Transitions should correspond to traversable spatial changes: doors, wardrobes, arches, tunnels, windows, cave mouths, stairs, gaps, paths around corners.
- Visual continuity alone is insufficient. A destination object is not enough; the shot needs a plausible route through a threshold into new volume.
- Later, a Cinematographer will have to shoot between actual generated sets. Give that person a physically plausible route.

Return ONLY one JSON object. No markdown fences. No commentary.

Use this shape:

{
  "summary": "<concise filmmaker-facing account of the journey you decided to plan>",
  "beats": [
    {
      "id": "B",
      "intent": "<concise Director intent: where the camera goes and how it crosses into this place>",
      "visualDescription": "<what this next viewpoint looks like>"
    }
  ]
}

Rules:
- summary is required. It is the readable Director response: what you decided about this journey, not a restatement of each beat field.
- Do not include the opening beat. The starting frame is already authoritative.
- Return beats in travel order after the opening.
- Preserve every existing destination id and order. Actual stills are authoritative; reason from the attached images, not merely stale text.
- For unresolved slots, supply intent and visualDescription. Do not generate images. PLAN fills semantic gaps, not image gaps.
- When the opening is the only existing destination, return subsequent beats only, with ids continuing after the opening (B, C, D, …). Use the fewest destinations necessary to express the filmmaker's requested journey. Add a beat when the camera reaches a meaningfully new place, world state, or story moment. Do not create separate storyboard beats merely for approaching and then crossing the same threshold when that movement can occur within one continuous shot. Simple journeys may require only 2–4 subsequent destinations. Use more when the filmmaker's story genuinely requires them.
- When later destination slots already exist, fill those ids. Do not invent an extra destination after the last existing slot merely because you were asked to plan.
- When every listed destination is already actual and there are no unused letters between them, analyze the sequence and return those existing subsequent ids. Do not add a new destination.
- When listed destinations are actual but unused letters remain between them, you may invent connective ids only for those missing positions. Include each existing non-opening destination in beats[] using its current id, in the given travel order.
- New ids must not reuse an existing destination id.
- intent and visualDescription must be non-empty strings. For an existing actual destination, restating its known intent/look is fine; the product will keep the original still.
- Do not add provider, model, Camotion, canonical, or image-path fields.
`;

export type DirectorPromptAnchor = {
  readonly id: string;
  readonly label: string;
  readonly intent?: string;
  readonly visualDescription?: string;
  readonly mediaId?: string;
  readonly hasImage?: boolean;
  readonly specified?: boolean;
};

function letterGaps(slots: readonly { readonly id: string }[]): boolean {
  for (let index = 0; index < slots.length - 1; index += 1) {
    const current = slots[index]!.id.trim().toUpperCase();
    const next = slots[index + 1]!.id.trim().toUpperCase();
    if (current.length === 1 && next.length === 1 && next.charCodeAt(0) - current.charCodeAt(0) > 1) {
      return true;
    }
  }
  return false;
}

export function isPromptSlotSpecified(slot: DirectorPromptAnchor): boolean {
  if (slot.specified === false) {
    return false;
  }
  if (slot.specified === true) {
    return true;
  }
  return slot.hasImage === true || Boolean(slot.mediaId);
}

function slotLine(
  slot: DirectorPromptAnchor,
  imageNumber: number | undefined,
  role: "opening" | "later",
): string {
  const specified = isPromptSlotSpecified(slot) || role === "opening";
  const bits = [
    `- ${slot.label || slot.id}`,
    specified ? "(actual)." : "(unresolved).",
  ];
  if (role === "opening") {
    bits.push("This is the opening viewpoint. Do not replace it.");
  }
  if (imageNumber !== undefined) {
    bits.push(`Image ${imageNumber} is this destination.`);
  }
  if (!specified) {
    bits.push("Fill this slot semantically. Do not generate an image.");
  }
  const intent = slot.intent?.trim();
  if (intent) {
    bits.push(`Intent: ${intent}`);
  }
  const visual = slot.visualDescription?.trim();
  if (visual) {
    bits.push(`Visual: ${visual}`);
  }
  return bits.join(" ");
}

export function directorUserPrompt(input: {
  readonly story: string;
  readonly startFrameId: string;
  readonly startFrameIntent?: string;
  readonly agency: "directed" | "autonomous";
  readonly anchors?: readonly DirectorPromptAnchor[];
  readonly storyboard?: readonly DirectorPromptAnchor[];
}): string {
  const agencyLine =
    input.agency === "autonomous"
      ? "Agency: autonomous. You are deciding the journey."
      : "Agency: directed. You are proposing a plan the filmmaker will supervise. Plan a complete sequence either way.";
  const openingIntent = input.startFrameIntent?.trim();
  const storyboard = input.storyboard?.filter((slot) => slot.id.trim());
  const extras = (input.anchors ?? []).filter(
    (anchor) => anchor.id.trim().toLowerCase() !== input.startFrameId.trim().toLowerCase(),
  );

  const lines = [
    agencyLine,
    "",
    "Filmmaker story:",
    input.story.trim(),
    "",
    `Authoritative starting frame id: ${input.startFrameId}. Image 1 is that opening viewpoint. Do not replace it.`,
    ...(openingIntent
      ? [`Opening-beat intent already on the storyboard: ${openingIntent}`]
      : []),
  ];

  if (storyboard && storyboard.length > 0) {
    lines.push(
      "",
      "Complete ordered storyboard. This is the current specification of the movie. Plan resolves unspecified directing decisions. It does not overwrite specified filmmaking decisions:",
    );
    let nextImage = 1;
    for (const slot of storyboard) {
      const isOpening =
        slot.id.trim().toLowerCase() === input.startFrameId.trim().toLowerCase();
      const specified = isPromptSlotSpecified(slot) || isOpening;
      const imageNumber = specified ? nextImage : undefined;
      if (specified) {
        nextImage += 1;
      }
      lines.push(slotLine(slot, imageNumber, isOpening ? "opening" : "later"));
    }
    const unresolved = storyboard.filter((slot) => !isPromptSlotSpecified(slot));
    const allActual = unresolved.length === 0;
    const lastId = storyboard[storyboard.length - 1]!.id;
    if (storyboard.length === 1) {
      lines.push(
        "",
        "The opening is the only destination. You may add subsequent destination ids needed for this story.",
        "Emit the JSON object specified in the system instruction. Return JSON only.",
      );
    } else if (!allActual) {
      const unresolvedIds = unresolved.map((slot) => slot.id).join(", ");
      lines.push(
        "",
        `Fill the unresolved slots (${unresolvedIds}). Preserve every existing id and order.`,
        `Do not invent a destination after ${lastId}. Do not generate images.`,
        "Emit the JSON object specified in the system instruction. Return JSON only.",
      );
    } else if (letterGaps(storyboard)) {
      const existingIds = extras.map((anchor) => anchor.id).join(", ") ||
        storyboard
          .filter((slot) => slot.id.trim().toLowerCase() !== input.startFrameId.trim().toLowerCase())
          .map((slot) => slot.id)
          .join(", ");
      lines.push(
        "",
        "All listed destinations are actual. You own missing connective geography between them, not the supplied media.",
        `Include each existing non-opening destination in beats[] using its current id, in this order (${existingIds}).`,
        `Use new unused ids only for unresolved positions between these destinations. Do not add a destination after ${lastId}.`,
        "Emit the JSON object specified in the system instruction. Return JSON only.",
      );
    } else {
      const existingIds = storyboard
        .filter((slot) => slot.id.trim().toLowerCase() !== input.startFrameId.trim().toLowerCase())
        .map((slot) => slot.id)
        .join(", ");
      lines.push(
        "",
        `Every destination is already actual. Analyze this sequence. Return existing subsequent ids (${existingIds}) in order.`,
        "Do not add a new destination. Do not replace or reorder the supplied frames.",
        "Emit the JSON object specified in the system instruction. Return JSON only.",
      );
    }
    return lines.join("\n");
  }

  if (extras.length > 0) {
    lines.push("", "Existing destinations in travel order. These are authoritative. Do not replace, restyle, or reorder them:");
    let nextImage = 2;
    const opening = (input.anchors ?? []).find(
      (anchor) => anchor.id.trim().toLowerCase() === input.startFrameId.trim().toLowerCase(),
    );
    const openingBits = [`- ${input.startFrameId} (opening). Image 1.`];
    const openingKnownIntent = opening?.intent?.trim() || openingIntent;
    if (openingKnownIntent) {
      openingBits.push(`Intent: ${openingKnownIntent}`);
    }
    lines.push(openingBits.join(" "));
    for (const anchor of extras) {
      const hasImage = anchor.hasImage === true || Boolean(anchor.mediaId);
      const bits = [`- ${anchor.label || anchor.id}.`];
      if (hasImage) {
        bits.push(`Image ${nextImage} is this destination.`);
        nextImage += 1;
      }
      const intent = anchor.intent?.trim();
      if (intent) {
        bits.push(`Intent: ${intent}`);
      }
      const visual = anchor.visualDescription?.trim();
      if (visual) {
        bits.push(`Visual: ${visual}`);
      }
      lines.push(bits.join(" "));
    }
    const unusedHint = extras.map((anchor) => anchor.id).join(", ");
    lines.push(
      "",
      "You own the missing connective journey between these destinations, not the supplied media.",
      `Include each existing non-opening destination in beats[] using its current id, in this order (${unusedHint}).`,
      "Use new unused ids only for unresolved positions. Emit the JSON object specified in the system instruction. Return JSON only.",
    );
    return lines.join("\n");
  }

  lines.push(
    "",
    "Plan the subsequent spatially traversable beats from this opening. Emit the JSON object specified in the system instruction. Return JSON only.",
  );
  return lines.join("\n");
}
