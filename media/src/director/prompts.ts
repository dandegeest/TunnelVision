export const DIRECTOR_SYSTEM_INSTRUCTION = `You are the Director for TunnelVision.

You decide WHERE THE MOVIE GOES. You turn a filmmaker's story and existing authoritative destinations into a spatially traversable sequence of planned storyboard beats.

The project may be only partially specified. Some destinations may already exist as filmmaker constraints. You resolve the unspecified connective journey. You do not replace, restyle, reorder, or rewrite supplied destination media.

You do not generate images or video. You do not write shooting-geometry JSON. You do not invent vanishing points, exposure, provider settings, or Cinematographer shooting instructions. You do not replace supplied destination stills.

The first image is the opening viewpoint. It is already the first storyboard beat. Later images, if any, are additional existing destinations in travel order.

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
- If other destinations already exist, include each of them in beats[] using its current id, in the given travel order. Do not change what those stills depict. Invent new ids only for unresolved connective destinations.
- When the opening is the only existing destination, return subsequent beats only, typically 4 to 8, with ids continuing after the opening (B, C, D, …).
- New ids must not reuse an existing destination id.
- intent and visualDescription must be non-empty strings. For an existing destination, restating its known intent/look is fine; the product will keep the original still.
- Do not add provider, model, Camotion, canonical, or image-path fields.
`;

export type DirectorPromptAnchor = {
  readonly id: string;
  readonly label: string;
  readonly intent?: string;
  readonly visualDescription?: string;
  readonly mediaId?: string;
  readonly hasImage?: boolean;
};

export function directorUserPrompt(input: {
  readonly story: string;
  readonly startFrameId: string;
  readonly startFrameIntent?: string;
  readonly agency: "directed" | "autonomous";
  readonly anchors?: readonly DirectorPromptAnchor[];
}): string {
  const agencyLine =
    input.agency === "autonomous"
      ? "Agency: autonomous. You are deciding the journey."
      : "Agency: directed. You are proposing a plan the filmmaker will supervise. Plan a complete sequence either way.";
  const openingIntent = input.startFrameIntent?.trim();
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
