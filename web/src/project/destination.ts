import { cameraGrammarFromUnknown, type CameraGrammar } from "../../../media/src/cinematographer/camera-grammar.ts";
import {
  assembleCanonicalConstructionPrompt,
  assembleCanonicalRepairPrompt,
  assembleOpeningFramePrompt,
  pullForwardReferenceEnabledFromUnknown,
} from "../../../media/src/prompts/canonical-destination.ts";
import {
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_IMAGE_OUTPUT_FORMAT,
  DEFAULT_IMAGE_RESOLUTION,
  imageModelDisplayLabel,
  imageModelHasResolutionChoice,
  parseImageModelId,
  resolveImageOutputFormat,
  resolveImageResolution,
  type ImageModelId,
  type ImageOutputFormat,
  type ImageResolution,
} from "../../../media/src/replicate/image-models.ts";
import type { ImageAspectRatio } from "../../../media/src/types.ts";
import { isTrustedMediaIdShape } from "./trusted-media-id";
import { runtimeMediaPreviewUrl } from "../../runtime-media-limits";
import {
  GENERATED_OPENING_ASPECT_RATIO,
  projectCanonicalAspectRatio,
} from "./canonical-aspect";
import { projectWithSyncedProductionLegs } from "./production-legs";
import { frameWithAppendedCanonicalTake } from "./canonical-takes";
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
  /** Product still generator for this construct / reshoot. */
  imageModel: ImageModelId;
  imageOutputFormat: ImageOutputFormat;
  imageResolution?: ImageResolution;
  /** Opposite / established START canonical for Agent spatial repair. Nano Banana includes it as extra image_input. */
  referenceMediaId?: string;
  /** CM spatial repair instruction. Directed construct leaves this unset. */
  repairInstruction?: string;
  repairRole?: "start" | "end";
  cameraGrammar?: CameraGrammar;
  /** Missing means ON. Repair ignores this and keeps its own image inputs. */
  pullForwardReferenceEnabled?: boolean;
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

/**
 * Provider-neutral destination-construction prompt. Spatial intent and the
 * resulting viewpoint are both required. Not a shooting-geometry prompt.
 * Order: destination intent, spatial progression, local route from source,
 * camera grammar law, pull-forward continuity, far-field last.
 * Look-ahead is distant environment only; this viewpoint stays this destination.
 */
export function pullForwardReferenceEnabledFromProject(
  project: Pick<Project, "pullForwardReferenceEnabled">,
): boolean {
  return pullForwardReferenceEnabledFromUnknown(project.pullForwardReferenceEnabled);
}

export function destinationConstructionPrompt(input: {
  intent: string;
  visualDescription: string;
  nextDestination?: DestinationLookAhead;
  cameraGrammar?: CameraGrammar;
  pullForwardReferenceEnabled?: boolean;
}): string {
  const next = optionalDestinationLookAhead(input.nextDestination);
  return assembleCanonicalConstructionPrompt({
    intent: input.intent,
    visualDescription: input.visualDescription,
    nextDestinationVisual: next ? farFieldVisualDetails(next.visualDescription || next.intent) : undefined,
    cameraGrammar: cameraGrammarFromUnknown(input.cameraGrammar),
    pullForwardReferenceEnabled: pullForwardReferenceEnabledFromUnknown(input.pullForwardReferenceEnabled),
  });
}

/** Agent canonical repair. Preserve the destination beat; fix shootable space. */
export function canonicalRepairPrompt(input: {
  role: "start" | "end";
  intent: string;
  visualDescription: string;
  instruction: string;
  cameraGrammar?: CameraGrammar;
}): string {
  return assembleCanonicalRepairPrompt(input);
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

function ownGenerationSignature(project: Project, frame: StoryboardFrame): string | undefined {
  if (frame.id === "A") {
    const story = project.story.trim();
    return story ? `story:${story}` : undefined;
  }
  const plan = destinationConstructionPlan(frame);
  if (!plan) {
    return undefined;
  }
  return `plan:${plan.intent}\n${plan.visualDescription}`;
}

function storedOwnGenerationSignature(generatedFrom: string): string {
  const lookAhead = generatedFrom.indexOf("\nnext:");
  return lookAhead >= 0 ? generatedFrom.slice(0, lookAhead) : generatedFrom;
}

/** Following storyboard beat if it already has a still. */
export function followingActualFrame(
  project: Project,
  frame: StoryboardFrame,
): (StoryboardFrame & { mediaId: string }) | undefined {
  const index = project.storyboard.findIndex((item) => item.id === frame.id);
  if (index < 0 || index >= project.storyboard.length - 1) {
    return undefined;
  }
  const next = project.storyboard[index + 1];
  return isActualTrustedFrame(next) ? next : undefined;
}

/** Inputs that would be used to generate or reshoot this still right now. */
export function storyboardGenerationSignature(project: Project, frame: StoryboardFrame): string | undefined {
  const own = ownGenerationSignature(project, frame);
  if (!own || frame.id === "A") {
    return own;
  }
  const next = followingDestinationPlan(project, frame);
  if (!next) {
    return own;
  }
  return `${own}\nnext:${next.intent}\n${next.visualDescription}`;
}

/** Prompt TunnelVision would send to generate or reshoot this still right now. */
export function destinationGeneratedPrompt(project: Project, frame: StoryboardFrame): string | undefined {
  if (frame.id === "A") {
    const story = project.story.trim();
    return story ? openingFrameGenerationPrompt(story, project.cameraGrammar) : undefined;
  }
  const plan = destinationConstructionPlan(frame);
  if (!plan) {
    return undefined;
  }
  return destinationConstructionPrompt({
    ...plan,
    nextDestination: followingDestinationPlan(project, frame),
    cameraGrammar: project.cameraGrammar,
    pullForwardReferenceEnabled: pullForwardReferenceEnabledFromProject(project),
  });
}

/** Product image model for a generated still. Uploads have no model. */
export function destinationImageModelLabel(
  project: Project,
  frame: StoryboardFrame,
): string | undefined {
  if (frame.imageOrigin !== "generated") {
    return undefined;
  }
  return imageModelDisplayLabel(project.imageModel);
}

/** Switch the still generator. Existing stills keep their pixels until reshoot. */
export function projectWithImageModel(project: Project, imageModel: ImageModelId): Project {
  const imageOutputFormat = resolveImageOutputFormat(imageModel, project.imageOutputFormat);
  const imageResolution = resolveImageResolution(imageModel, project.imageResolution);
  if (
    project.imageModel === imageModel &&
    project.imageOutputFormat === imageOutputFormat &&
    project.imageResolution === imageResolution
  ) {
    return project;
  }
  return { ...project, imageModel, imageOutputFormat, imageResolution };
}

export function projectWithImageOutputFormat(
  project: Project,
  imageOutputFormat: ImageOutputFormat,
): Project {
  const next = resolveImageOutputFormat(project.imageModel, imageOutputFormat);
  if (project.imageOutputFormat === next) {
    return project;
  }
  return { ...project, imageOutputFormat: next };
}

export function projectWithImageResolution(project: Project, imageResolution: ImageResolution): Project {
  const next = resolveImageResolution(project.imageModel, imageResolution);
  if (project.imageResolution === next) {
    return project;
  }
  return { ...project, imageResolution: next };
}

export function generatedStillNeedsReshoot(project: Project, frame: StoryboardFrame): boolean {
  if (frame.imageOrigin !== "generated" || !frame.image || !frame.generatedFrom) {
    return false;
  }
  const own = ownGenerationSignature(project, frame);
  if (own && own !== storedOwnGenerationSignature(frame.generatedFrom)) {
    return true;
  }
  if (followingActualFrame(project, frame)) {
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

/**
 * After the first Director plan, remaining unfilled beats can generate from
 * that plan. Before that, Generate all destinations is only a CREATE JOURNEY option.
 */
export function canGenerateRemainingDestinationsWithoutPlanning(project: Project): boolean {
  return project.storyDurationLocked && Boolean(nextConstructableDestinationId(project));
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

export function openingFrameGenerationPrompt(story: string, cameraGrammar?: CameraGrammar): string {
  return assembleOpeningFramePrompt(story, cameraGrammar);
}

/**
 * Attach opening plan text to A. Intent is the first sentence of the
 * journey when empty. A has no Director beat; the opening still prompt is
 * rebuilt from `Project.story` at generate/reshoot time and is not stored
 * as visualDescription.
 */
export function storyboardFrameWithOpeningPlan(frame: StoryboardFrame, story: string): StoryboardFrame {
  const next: StoryboardFrame = { ...frame };
  if (!next.intent?.trim()) {
    const intent = openingFrameIntent(story);
    if (intent) {
      next.intent = intent;
    }
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
  imageModel: ImageModelId;
  imageOutputFormat: ImageOutputFormat;
  imageResolution?: ImageResolution;
  cameraGrammar?: CameraGrammar;
};

export function openingFrameGenerationRequestFromProject(
  project: Project,
): OpeningFrameGenerationRequest {
  if (!canGenerateOpeningFrame(project) && !canReshootOpeningFrame(project)) {
    throw new Error("Opening frame is not ready to generate");
  }
  return {
    story: project.story,
    aspectRatio: GENERATED_OPENING_ASPECT_RATIO,
    ...imageGenerationKnobsFromProject(project),
    cameraGrammar: cameraGrammarFromUnknown(project.cameraGrammar),
  };
}

function frameWithConstructedStill(
  frame: StoryboardFrame,
  next: DestinationConstructionResult & { mediaInfo?: StoryboardMediaInfo },
  extras: Pick<StoryboardFrame, "destinationId" | "generatedFrom"> & { source?: "generated" | "constructed" | "repair" },
): StoryboardFrame {
  return frameWithAppendedCanonicalTake(
    { ...frame, destinationId: extras.destinationId ?? frame.destinationId ?? frame.id },
    {
      mediaId: next.mediaId,
      imageUrl: next.imageUrl,
      origin: "generated",
      source: extras.source ?? "constructed",
      generatedFrom: extras.generatedFrom,
      mediaInfo: next.mediaInfo,
    },
  );
}

export function projectWithDestinationConstructionError(
  project: Project,
  beatId: string,
  error: string | undefined,
): Project {
  return {
    ...project,
    storyboard: project.storyboard.map((frame) => {
      if (frame.id !== beatId) {
        return frame;
      }
      const next = { ...frame };
      if (error) {
        next.constructionError = error;
      } else {
        delete next.constructionError;
      }
      return next;
    }),
  };
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
        ? (() => {
            const opening = storyboardFrameWithOpeningPlan(
              frameWithConstructedStill(frame, next, {
                destinationId: frame.destinationId ?? "A",
                generatedFrom: storyboardGenerationSignature(project, frame),
                source: "generated",
              }),
              project.story,
            );
            delete opening.visualDescription;
            return opening;
          })()
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
    ...imageGenerationKnobsFromProject(project),
    cameraGrammar: cameraGrammarFromUnknown(project.cameraGrammar),
    pullForwardReferenceEnabled: pullForwardReferenceEnabledFromProject(project),
  };
}

export function destinationRepairRequestFromProject(
  project: Project,
  beatId: string,
  input: {
    role: "start" | "end";
    instruction: string;
    referenceMediaId?: string;
  },
): DestinationConstructionRequest {
  const beat = project.storyboard.find((frame) => frame.id === beatId);
  if (!beat || beat.imageOrigin !== "generated" || !isTrustedMediaIdShape(beat.mediaId)) {
    throw new Error("Destination is not ready to construct");
  }
  const plan =
    destinationConstructionPlan(beat) ??
    (beat.id === "A" && project.story.trim()
      ? {
          intent: openingFrameIntent(project.story) ?? project.story.trim(),
          visualDescription: openingFrameGenerationPrompt(project.story, project.cameraGrammar),
        }
      : null);
  if (!plan) {
    throw new Error("Destination is not ready to construct");
  }
  if (!input.instruction.trim()) {
    throw new Error("Canonical repair requires a repair instruction");
  }
  const previous = precedingActualFrame(project, beat);
  const sourceMediaId = input.role === "end" && previous ? previous.mediaId : beat.mediaId;
  if (!isTrustedMediaIdShape(sourceMediaId)) {
    throw new Error("Starting frame has no trusted media identity");
  }
  const nextDestination = followingDestinationPlan(project, beat);
  const aspectRatio = projectCanonicalAspectRatio(project);
  const referenceMediaId =
    input.referenceMediaId &&
    input.referenceMediaId !== sourceMediaId &&
    isTrustedMediaIdShape(input.referenceMediaId)
      ? input.referenceMediaId
      : undefined;
  return {
    sourceMediaId,
    beatId: beat.id,
    intent: plan.intent,
    visualDescription: plan.visualDescription,
    ...(nextDestination && input.role === "end" ? { nextDestination } : {}),
    ...(aspectRatio ? { aspectRatio } : {}),
    ...imageGenerationKnobsFromProject(project),
    repairInstruction: input.instruction,
    repairRole: input.role,
    cameraGrammar: cameraGrammarFromUnknown(project.cameraGrammar),
    ...(referenceMediaId ? { referenceMediaId } : {}),
  };
}

function imageGenerationKnobsFromProject(project: Project): {
  imageModel: ImageModelId;
  imageOutputFormat: ImageOutputFormat;
  imageResolution?: ImageResolution;
} {
  return {
    imageModel: project.imageModel,
    imageOutputFormat: resolveImageOutputFormat(project.imageModel, project.imageOutputFormat),
    ...(imageModelHasResolutionChoice(project.imageModel)
      ? { imageResolution: resolveImageResolution(project.imageModel, project.imageResolution) }
      : {}),
  };
}

export function imageModelIdFromBody(value: unknown): ImageModelId {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_IMAGE_MODEL_ID;
  }
  const parsed = parseImageModelId(value);
  if (!parsed) {
    throw new Error("Unknown image model");
  }
  return parsed;
}

export function imageOutputFormatFromBody(
  imageModel: ImageModelId,
  value: unknown,
): ImageOutputFormat {
  if (value === undefined || value === null || value === "") {
    return resolveImageOutputFormat(imageModel, DEFAULT_IMAGE_OUTPUT_FORMAT);
  }
  const next = resolveImageOutputFormat(imageModel, value);
  if (typeof value === "string" && value.trim() && next !== value) {
    throw new Error("Unknown image output format");
  }
  return next;
}

export function imageResolutionFromBody(
  imageModel: ImageModelId,
  value: unknown,
): ImageResolution | undefined {
  if (!imageModelHasResolutionChoice(imageModel)) {
    return undefined;
  }
  if (value === undefined || value === null || value === "") {
    return DEFAULT_IMAGE_RESOLUTION;
  }
  const next = resolveImageResolution(imageModel, value);
  if (typeof value === "string" && value.trim() && next !== value) {
    throw new Error("Unknown image resolution");
  }
  return next;
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
            source: "constructed",
          })
        : frame,
    ),
  });
}

/** Apply an Agent canonical repair. Opening A uses the generated-opening write path. */
export function projectWithRepairedCanonical(
  project: Project,
  next: DestinationConstructionResult & { beatId: string; mediaInfo?: StoryboardMediaInfo },
): Project {
  if (next.beatId === "A") {
    return projectWithGeneratedOpeningFrame(project, next);
  }
  return projectWithConstructedDestination(project, next);
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
