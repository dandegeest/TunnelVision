import { authoritativeStartFrame } from "./director";
import { isTrustedMediaIdShape } from "./trusted-media-id";
import { runtimeMediaPreviewUrl } from "../../runtime-media-limits";
import type { Project, StoryboardFrame } from "./types";

/** This PR constructs only the first planned beat. */
export const CONSTRUCTIBLE_BEAT_ID = "B";

export type DestinationConstructionRequest = {
  sourceMediaId: string;
  beatId: typeof CONSTRUCTIBLE_BEAT_ID;
  intent: string;
  visualDescription: string;
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

/**
 * Provider-neutral destination-construction prompt. Spatial intent and the
 * resulting viewpoint are both required. Not a shooting-geometry prompt.
 */
export function destinationConstructionPrompt(input: {
  intent: string;
  visualDescription: string;
}): string {
  const intent = input.intent.trim();
  const visualDescription = input.visualDescription.trim();
  if (!intent || !visualDescription) {
    throw new Error("Destination construction requires intent and visual description");
  }
  return [
    "Preserve the same physical world, materials, lighting character, and visual identity of the source image.",
    "",
    "Move the camera to a new position according to this spatial intent:",
    intent,
    "",
    "The next viewpoint should look like this:",
    visualDescription,
    "",
    "This is a spatial continuation of the same world, not a restyle and not an in-place edit of the existing composition. The camera must have changed position. Preserve recognizable environmental continuity where physically appropriate.",
  ].join("\n");
}

export function plannedConstructibleBeat(project: Project): StoryboardFrame | undefined {
  return project.storyboard.find((frame) => frame.id === CONSTRUCTIBLE_BEAT_ID);
}

export function canConstructDestinationFrame(project: Project, frame: StoryboardFrame): boolean {
  if (frame.id !== CONSTRUCTIBLE_BEAT_ID) {
    return false;
  }
  if (frame.imageOrigin !== "none" || frame.image) {
    return false;
  }
  if (!frame.intent?.trim() || !frame.visualDescription?.trim()) {
    return false;
  }
  const start = authoritativeStartFrame(project);
  return isTrustedMediaIdShape(start?.mediaId);
}

export function destinationConstructionRequestFromProject(
  project: Project,
): DestinationConstructionRequest {
  const start = authoritativeStartFrame(project);
  if (!start || !isTrustedMediaIdShape(start.mediaId)) {
    throw new Error("Starting frame has no trusted media identity");
  }
  const beat = plannedConstructibleBeat(project);
  const intent = beat?.intent?.trim() ?? "";
  const visualDescription = beat?.visualDescription?.trim() ?? "";
  if (!beat || !canConstructDestinationFrame(project, beat) || !intent || !visualDescription) {
    throw new Error("Destination B is not ready to construct");
  }
  return {
    sourceMediaId: start.mediaId,
    beatId: CONSTRUCTIBLE_BEAT_ID,
    intent,
    visualDescription,
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
 * Apply a constructed still to planned B. Preserves A, C...N, story, and Shoot.
 */
export function projectWithConstructedDestination(
  project: Project,
  next: DestinationConstructionResult & { beatId: string },
): Project {
  if (next.beatId !== CONSTRUCTIBLE_BEAT_ID) {
    throw new Error("This slice can only construct destination B");
  }
  if (!isTrustedMediaIdShape(next.mediaId)) {
    throw new Error("Constructed destination has no trusted media identity");
  }
  const beat = plannedConstructibleBeat(project);
  if (!beat || beat.imageOrigin !== "none") {
    throw new Error("Destination B is not a planned beat");
  }
  return {
    ...project,
    storyboard: project.storyboard.map((frame) =>
      frame.id === CONSTRUCTIBLE_BEAT_ID
        ? {
            ...frame,
            image: next.imageUrl,
            mediaId: next.mediaId,
            imageOrigin: "generated",
          }
        : frame,
    ),
  };
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
