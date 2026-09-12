import {
  UNEMBODIED_FIRST_PERSON_POV,
  WORLD_SUBJECTS_MAY_APPEAR,
} from "../../../media/src/cinematographer/shooting-prompt.ts";
import type { ImageAspectRatio } from "../../../media/src/types.ts";
import { isTrustedMediaIdShape } from "./trusted-media-id";
import { runtimeMediaPreviewUrl } from "../../runtime-media-limits";
import {
  GENERATED_OPENING_ASPECT_RATIO,
  projectCanonicalAspectRatio,
} from "./canonical-aspect";
import { projectWithSyncedProductionLegs } from "./production-legs";
import type { Project, StoryboardFrame, StoryboardMediaInfo } from "./types";

export type DestinationLookAhead = {
  intent: string;
  visualDescription: string;
};

export type DestinationConstructionRequest = {
  sourceMediaId: string;
  beatId: string;
  intent: string;
  visualDescription: string;
  /** Next beat's plan. Far-field continuity only; this viewpoint stays this destination. */
  nextDestination?: DestinationLookAhead;
  /** Project canonical aspect. Adapters map this onto an explicit provider AR. */
  aspectRatio?: ImageAspectRatio;
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
    aspectRatio?: ImageAspectRatio;
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

const FAR_FIELD_VISUAL_MAX_CHARS = 280;

/** Sentence-bounded far-field copy. Never splits a word or a sentence mid-way. */
export function farFieldVisualDetails(visual: string): string {
  const text = visual.replace(/\s+/g, " ").trim();
  if (!text || text.length <= FAR_FIELD_VISUAL_MAX_CHARS) {
    return text;
  }
  const sentences =
    text.match(/[^.!?]+(?:[.!?]+|$)/g)?.map((part) => part.trim()).filter(Boolean) ?? [text];
  let assembled = "";
  for (const sentence of sentences) {
    const candidate = assembled ? `${assembled} ${sentence}` : sentence;
    if (assembled && candidate.length > FAR_FIELD_VISUAL_MAX_CHARS) {
      break;
    }
    assembled = candidate;
  }
  return assembled || sentences[0]!;
}

function farFieldContinuity(next: DestinationLookAhead): string {
  const details = farFieldVisualDetails(next.visualDescription || next.intent);
  return [
    "Far-field continuity:",
    details,
    "This is distant environmental information only. It may appear through an opening, path, or far field if physically appropriate. Do not arrive there, replace this destination with it, or adopt its overall lighting or style.",
  ].join("\n");
}

/**
 * Provider-neutral destination-construction prompt. Spatial intent and the
 * resulting viewpoint are both required. Not a shooting-geometry prompt.
 * Order: this destination (highest priority), camera move from the source
 * image, subordinate far-field continuity, unembodied POV. Look-ahead is
 * distant environment only; this viewpoint stays this destination.
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
    "Preserve the same physical world, materials, lighting character, and visual identity of the source image.",
    "Move the camera from the source viewpoint:",
    intent,
    "This is a spatial continuation of the same world, not a restyle and not an in-place edit of the existing composition. The camera position must change.",
    "",
    ...(next ? [farFieldContinuity(next), ""] : []),
    UNEMBODIED_FIRST_PERSON_POV,
    WORLD_SUBJECTS_MAY_APPEAR,
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

/** Prompt TunnelVision would send to generate or reshoot this still right now. */
export function destinationGeneratedPrompt(project: Project, frame: StoryboardFrame): string | undefined {
  if (frame.id === "A") {
    const story = project.story.trim();
    return story ? openingFrameGenerationPrompt(story) : undefined;
  }
  const plan = destinationConstructionPlan(frame);
  if (!plan) {
    return undefined;
  }
  return destinationConstructionPrompt({
    ...plan,
    nextDestination: followingDestinationPlan(project, frame),
  });
}

/** Product image model for a generated still. Uploads have no model. */
export function destinationImageModelLabel(frame: StoryboardFrame): string | undefined {
  if (frame.imageOrigin !== "generated") {
    return undefined;
  }
  return frame.id === "A" ? "FLUX 1.1 Pro Ultra" : "FLUX Kontext Pro";
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

/** First sentence of the journey story. Opening A uses this as intent when that field is empty. */
export function openingFrameIntent(story: string): string | undefined {
  const trimmed = story.trim();
  if (!trimmed) {
    return undefined;
  }
  const match = trimmed.match(/^[\s\S]+?(?:[.!?](?:\s|$)|$)/);
  const intent = (match?.[0] ?? trimmed).trim();
  return intent || undefined;
}

export function openingFrameGenerationPrompt(story: string): string {
  const trimmed = story.trim();
  if (!trimmed) {
    throw new Error("Opening frame requires a journey story");
  }
  return [
    "Generate a still photograph of the opening viewpoint of this first-person POV journey. Use the Journey to determine the specific physical viewpoint, orientation, environment, and situation at the instant the journey begins. Show only that opening moment; do not anticipate, combine, or depict later destinations or events from the Journey.",
    "",
    `The camera is already in the world, oriented along the journey's intended direction of travel. ${UNEMBODIED_FIRST_PERSON_POV} ${WORLD_SUBJECTS_MAY_APPEAR} Do not show text.`,
    "",
    `Journey: ${trimmed}`,
  ].join("\n");
}

/**
 * Attach opening plan text to A. Generated stills store the TunnelVision
 * prompt as visualDescription. Uploads only fill empty intent from the story.
 */
export function storyboardFrameWithOpeningPlan(
  frame: StoryboardFrame,
  story: string,
  origin: "user" | "generated",
): StoryboardFrame {
  const next: StoryboardFrame = { ...frame };
  if (!next.intent?.trim()) {
    const intent = openingFrameIntent(story);
    if (intent) {
      next.intent = intent;
    }
  }
  if (origin === "generated") {
    next.visualDescription = openingFrameGenerationPrompt(story);
  }
  return next;
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
  aspectRatio: ImageAspectRatio;
};

export function openingFrameGenerationRequestFromProject(
  project: Project,
): OpeningFrameGenerationRequest {
  if (!canGenerateOpeningFrame(project) && !canReshootOpeningFrame(project)) {
    throw new Error("Opening frame is not ready to generate");
  }
  return { story: project.story, aspectRatio: GENERATED_OPENING_ASPECT_RATIO };
}

function frameWithConstructedStill(
  frame: StoryboardFrame,
  next: DestinationConstructionResult & { mediaInfo?: StoryboardMediaInfo },
  extras: Pick<StoryboardFrame, "destinationId" | "generatedFrom">,
): StoryboardFrame {
  const constructed: StoryboardFrame = {
    ...frame,
    image: next.imageUrl,
    mediaId: next.mediaId,
    imageOrigin: "generated",
    destinationId: extras.destinationId,
    generatedFrom: extras.generatedFrom,
  };
  if (next.mediaInfo) {
    constructed.mediaInfo = next.mediaInfo;
  } else {
    delete constructed.mediaInfo;
  }
  return constructed;
}

export function projectWithGeneratedOpeningFrame(
  project: Project,
  next: DestinationConstructionResult & { mediaInfo?: StoryboardMediaInfo },
): Project {
  if (!isTrustedMediaIdShape(next.mediaId)) {
    throw new Error("Generated opening frame has no trusted media identity");
  }
  if (!canGenerateOpeningFrame(project) && !canReshootOpeningFrame(project)) {
    throw new Error("Opening frame is not ready to generate");
  }
  return projectWithSyncedProductionLegs({
    ...project,
    canonicalAspectRatio: GENERATED_OPENING_ASPECT_RATIO,
    storyboard: project.storyboard.map((frame) =>
      frame.id === "A"
        ? storyboardFrameWithOpeningPlan(
            frameWithConstructedStill(frame, next, {
              destinationId: frame.destinationId ?? "A",
              generatedFrom: storyboardGenerationSignature(project, frame),
            }),
            project.story,
            "generated",
          )
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
  const aspectRatio = projectCanonicalAspectRatio(project);
  return {
    sourceMediaId: previous.mediaId,
    beatId: beat.id,
    intent: plan.intent,
    visualDescription: plan.visualDescription,
    ...(nextDestination ? { nextDestination } : {}),
    ...(aspectRatio ? { aspectRatio } : {}),
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
  next: DestinationConstructionResult & { beatId: string; mediaInfo?: StoryboardMediaInfo },
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
        ? frameWithConstructedStill(frame, next, {
            destinationId: frame.destinationId ?? frame.id,
            generatedFrom: storyboardGenerationSignature(project, frame),
          })
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
