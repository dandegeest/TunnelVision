import { UNEMBODIED_FIRST_PERSON_POV } from "../../../media/src/cinematographer/shooting-prompt.ts";
import { isTrustedMediaIdShape } from "./trusted-media-id";
import { runtimeMediaPreviewUrl } from "../../runtime-media-limits";
import { projectWithSyncedProductionLegs } from "./production-legs";
import type { Project, StoryboardFrame } from "./types";

export type DestinationLookAhead = {
  intent: string;
  visualDescription: string;
};

export type DestinationConstructionRequest = {
  sourceMediaId: string;
  beatId: string;
  intent: string;
  visualDescription: string;
  /** Following beat's plan. Far-field only; this viewpoint stays this destination. */
  nextDestination?: DestinationLookAhead;
};

export type DestinationConstructionResult = {
  mediaId: string;
  imageUrl: string;
};

export type DestinationConstructionEvidence = {
  request: {
    sourceMediaId: string;
    beatId: string;
    intent: string;
    visualDescription: string;
    nextDestination?: DestinationLookAhead;
    prompt: string;
  };
  model: string;
  modelVersion: string | null;
  predictionId: string;
  elapsedMs: number;
  outputMediaId: string;
  outputUrl?: string;
};

export type DestinationConstructionResponse = DestinationConstructionResult & {
  evidence: DestinationConstructionEvidence;
};

function isActualTrustedFrame(frame: StoryboardFrame | undefined): frame is StoryboardFrame & {
  mediaId: string;
} {
  if (!frame) {
    return false;
  }
  return (
    (frame.imageOrigin === "user" || frame.imageOrigin === "generated") &&
    isTrustedMediaIdShape(frame.mediaId)
  );
}

export function optionalDestinationLookAhead(value: unknown): DestinationLookAhead | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const intent = "intent" in value && typeof value.intent === "string" ? value.intent.trim() : "";
  const visualDescription =
    "visualDescription" in value && typeof value.visualDescription === "string"
      ? value.visualDescription.trim()
      : "";
  if (!intent && !visualDescription) {
    return undefined;
  }
  return {
    intent: intent || visualDescription,
    visualDescription: visualDescription || intent,
  };
}

function followingDestinationLookAhead(next: DestinationLookAhead): string {
  const payload = (next.visualDescription || next.intent).replace(/\s+/g, " ").trim();
  return [
    "Look ahead only:",
    payload,
    "Hint at this only through the far field or a visible opening if physically appropriate. Do not move the camera there, replace this place with it, or relight this place to match it.",
  ].join("\n");
}

/**
 * Provider-neutral destination-construction prompt. Spatial intent and the
 * resulting viewpoint are both required. Not a shooting-geometry prompt.
 * Order: this destination's image, preserve world, A→B move, subordinate
 * far-field look-ahead, unembodied POV. A following beat is distant
 * foreshadowing only; this viewpoint stays this destination.
 */
export function destinationConstructionPrompt(input: {
  intent: string;
  visualDescription: string;
  nextDestination?: DestinationLookAhead;
}): string {
  const intent = input.intent.trim();
  const visualDescription = input.visualDescription.trim();
  if (!intent || !visualDescription) {
    throw new Error("Destination construction requires intent and visual description");
  }
  const next = optionalDestinationLookAhead(input.nextDestination);
  return [
    "Create this destination viewpoint:",
    visualDescription,
    "",
    ...(next
      ? ["This viewpoint is the destination. Do not advance to the following destination.", ""]
      : []),
    "Preserve the same physical world, materials, lighting character, and visual identity of the source image.",
    "Move the camera from the source viewpoint:",
    intent,
    "This is a spatial continuation of the same world, not a restyle and not an in-place edit of the existing composition. The camera position must change.",
    "",
    ...(next ? [followingDestinationLookAhead(next), ""] : []),
    UNEMBODIED_FIRST_PERSON_POV,
  ].join("\n");
}

/** Immediately preceding actual destination. Construction of N uses N-1. */
export function precedingActualFrame(
  project: Project,
  frame: StoryboardFrame,
): (StoryboardFrame & { mediaId: string }) | undefined {
  const index = project.storyboard.findIndex((item) => item.id === frame.id);
  if (index <= 0) {
    return undefined;
  }
  const previous = project.storyboard[index - 1];
  return isActualTrustedFrame(previous) ? previous : undefined;
}

/** Following storyboard beat's plan, if it has spatial intent. Last beat has none. */
export function followingDestinationPlan(
  project: Project,
  frame: StoryboardFrame,
): DestinationLookAhead | undefined {
  const index = project.storyboard.findIndex((item) => item.id === frame.id);
  if (index < 0 || index >= project.storyboard.length - 1) {
    return undefined;
  }
  const next = project.storyboard[index + 1];
  return next ? destinationConstructionPlan(next) ?? undefined : undefined;
}

/** Spatial intent plus viewpoint prompt. Either field may stand in for a missing pair on reshoot. */
export function destinationConstructionPlan(
  frame: StoryboardFrame,
): { intent: string; visualDescription: string } | null {
  const intent = frame.intent?.trim() ?? "";
  const visualDescription = frame.visualDescription?.trim() ?? "";
  if (!intent && !visualDescription) {
    return null;
  }
  return {
    intent: intent || visualDescription,
    visualDescription: visualDescription || intent,
  };
}

/** Inputs that would be used to generate or reshoot this still right now. */
export function storyboardGenerationSignature(project: Project, frame: StoryboardFrame): string | undefined {
  if (frame.id === "A") {
    const story = project.story.trim();
    return story ? `story:${story}` : undefined;
  }
  const plan = destinationConstructionPlan(frame);
  if (!plan) {
    return undefined;
  }
  const next = followingDestinationPlan(project, frame);
  if (!next) {
    return `plan:${plan.intent}\n${plan.visualDescription}`;
  }
  return `plan:${plan.intent}\n${plan.visualDescription}\nnext:${next.intent}\n${next.visualDescription}`;
}

export function generatedStillNeedsReshoot(project: Project, frame: StoryboardFrame): boolean {
  if (frame.imageOrigin !== "generated" || !frame.image || !frame.generatedFrom) {
    return false;
  }
  const current = storyboardGenerationSignature(project, frame);
  return Boolean(current && current !== frame.generatedFrom);
}

export function canConstructDestinationFrame(project: Project, frame: StoryboardFrame): boolean {
  if (frame.imageOrigin !== "none" || frame.image) {
    return false;
  }
  if (!frame.intent?.trim() || !frame.visualDescription?.trim()) {
    return false;
  }
  return Boolean(precedingActualFrame(project, frame));
}

export function canReshootOpeningFrame(project: Project): boolean {
  if (!project.story.trim()) {
    return false;
  }
  const opening = project.storyboard.find((frame) => frame.id === "A");
  return Boolean(opening && opening.imageOrigin === "generated" && opening.image);
}

/** Regenerates an already-generated still. User-uploaded stills stay on Replace. */
export function canReshootDestinationFrame(project: Project, frame: StoryboardFrame): boolean {
  if (frame.imageOrigin !== "generated" || !frame.image) {
    return false;
  }
  if (frame.id === "A") {
    return canReshootOpeningFrame(project);
  }
  if (!destinationConstructionPlan(frame)) {
    return false;
  }
  return Boolean(precedingActualFrame(project, frame));
}

/** Next unresolved beat that can be derived from the immediately preceding actual frame. */
export function nextConstructableDestinationId(project: Project): string | undefined {
  return project.storyboard.find((frame) => canConstructDestinationFrame(project, frame))?.id;
}

export function openingFrameGenerationPrompt(story: string): string {
  const trimmed = story.trim();
  if (!trimmed) {
    throw new Error("Opening frame requires a journey story");
  }
  return [
    "Generate a still photograph of the opening viewpoint of this first-person POV journey.",
    "The camera is already in the world, looking continuously forward.",
    UNEMBODIED_FIRST_PERSON_POV,
    "Do not show text.",
    "",
    "Journey:",
    trimmed,
    "",
    "Show only the first moment of that journey: the starting place before the camera begins to move.",
  ].join("\n");
}

export function canGenerateOpeningFrame(project: Project): boolean {
  if (!project.story.trim()) {
    return false;
  }
  const opening = project.storyboard.find((frame) => frame.id === "A");
  return Boolean(opening && opening.imageOrigin === "none" && !opening.image);
}

export type OpeningFrameGenerationRequest = {
  story: string;
};

export function openingFrameGenerationRequestFromProject(
  project: Project,
): OpeningFrameGenerationRequest {
  if (!canGenerateOpeningFrame(project) && !canReshootOpeningFrame(project)) {
    throw new Error("Opening frame is not ready to generate");
  }
  return { story: project.story };
}

export function projectWithGeneratedOpeningFrame(
  project: Project,
  next: DestinationConstructionResult,
): Project {
  if (!isTrustedMediaIdShape(next.mediaId)) {
    throw new Error("Generated opening frame has no trusted media identity");
  }
  if (!canGenerateOpeningFrame(project) && !canReshootOpeningFrame(project)) {
    throw new Error("Opening frame is not ready to generate");
  }
  return projectWithSyncedProductionLegs({
    ...project,
    storyboard: project.storyboard.map((frame) =>
      frame.id === "A"
        ? {
            ...frame,
            image: next.imageUrl,
            mediaId: next.mediaId,
            imageOrigin: "generated",
            destinationId: frame.destinationId ?? "A",
            generatedFrom: storyboardGenerationSignature(project, frame),
          }
        : frame,
    ),
  });
}

export function destinationConstructionRequestFromProject(
  project: Project,
  beatId: string,
): DestinationConstructionRequest {
  const beat = project.storyboard.find((frame) => frame.id === beatId);
  const plan = beat ? destinationConstructionPlan(beat) : null;
  const previous = beat ? precedingActualFrame(project, beat) : undefined;
  const constructable = Boolean(beat && canConstructDestinationFrame(project, beat));
  const reshootable = Boolean(beat && beat.id !== "A" && canReshootDestinationFrame(project, beat));
  if (!beat || !previous || !plan || (!constructable && !reshootable)) {
    throw new Error("Destination is not ready to construct");
  }
  const nextDestination = followingDestinationPlan(project, beat);
  return {
    sourceMediaId: previous.mediaId,
    beatId: beat.id,
    intent: plan.intent,
    visualDescription: plan.visualDescription,
    ...(nextDestination ? { nextDestination } : {}),
  };
}

export function parseDestinationConstructionResult(body: unknown): DestinationConstructionResult {
  if (!body || typeof body !== "object") {
    throw new Error("Server returned an invalid media identity.");
  }
  const mediaId = "mediaId" in body ? body.mediaId : undefined;
  const imageUrl = "imageUrl" in body ? body.imageUrl : undefined;
  if (!isTrustedMediaIdShape(mediaId)) {
    throw new Error("Server returned an invalid media identity.");
  }
  if (imageUrl !== runtimeMediaPreviewUrl(mediaId)) {
    throw new Error("Server returned an invalid media identity.");
  }
  return { mediaId, imageUrl };
}

/**
 * Apply a constructed still to a planned beat. Preserves other beats and story.
 * Actual adjacent canonicals become production Destinations / JourneyShots on
 * the same Project.
 */
export function projectWithConstructedDestination(
  project: Project,
  next: DestinationConstructionResult & { beatId: string },
): Project {
  if (!isTrustedMediaIdShape(next.mediaId)) {
    throw new Error("Constructed destination has no trusted media identity");
  }
  const beat = project.storyboard.find((frame) => frame.id === next.beatId);
  if (!beat || (beat.imageOrigin !== "none" && beat.imageOrigin !== "generated")) {
    throw new Error("Destination is not a planned beat");
  }
  if (!precedingActualFrame(project, beat)) {
    throw new Error("Destination is not ready to construct");
  }
  return projectWithSyncedProductionLegs({
    ...project,
    storyboard: project.storyboard.map((frame) =>
      frame.id === next.beatId
        ? {
            ...frame,
            image: next.imageUrl,
            mediaId: next.mediaId,
            imageOrigin: "generated",
            destinationId: frame.destinationId ?? frame.id,
            generatedFrom: storyboardGenerationSignature(project, frame),
          }
        : frame,
    ),
  });
}

export async function requestConstructDestination(
  input: DestinationConstructionRequest,
): Promise<DestinationConstructionResponse> {
  const response = await fetch("/api/destination/construct", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "Destination construction failed.";
    throw new Error(message);
  }
  const constructed = parseDestinationConstructionResult(body);
  const evidence =
    body && typeof body === "object" && "evidence" in body
      ? (body.evidence as DestinationConstructionEvidence)
      : undefined;
  if (!evidence || evidence.outputMediaId !== constructed.mediaId) {
    throw new Error("Destination construction failed.");
  }
  return { ...constructed, evidence };
}

export async function requestGenerateOpeningFrame(
  input: OpeningFrameGenerationRequest,
): Promise<DestinationConstructionResponse> {
  const response = await fetch("/api/destination/generate-opening", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "Opening frame generation failed.";
    throw new Error(message);
  }
  const constructed = parseDestinationConstructionResult(body);
  const evidence =
    body && typeof body === "object" && "evidence" in body
      ? (body.evidence as DestinationConstructionEvidence)
      : undefined;
  if (!evidence || evidence.outputMediaId !== constructed.mediaId) {
    throw new Error("Opening frame generation failed.");
  }
  return { ...constructed, evidence };
}
