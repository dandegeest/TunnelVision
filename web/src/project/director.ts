import type { Project, StoryboardFrame } from "./types";
import { isTrustedMediaIdShape } from "./trusted-media-id";

export type DirectorBeat = {
  id: string;
  intent: string;
  visualDescription: string;
};

export type DirectorPlan = {
  summary: string;
  beats: DirectorBeat[];
};

export type DirectorStoryboardSlot = {
  id: string;
  label: string;
  specified: boolean;
  intent?: string;
  visualDescription?: string;
  mediaId?: string;
};

export type DirectorAnchor = {
  id: string;
  label: string;
  intent?: string;
  visualDescription?: string;
  mediaId?: string;
};

export type DirectorEvidence = {
  request: {
    story: string;
    agency: "directed" | "autonomous";
    startFrameId: string;
    startFrameIntent?: string;
    startMediaId: string;
    anchors?: DirectorAnchor[];
    storyboard?: DirectorStoryboardSlot[];
    storyDuration?: "auto" | number;
    systemInstruction: string;
    prompt: string;
  };
  rawText: string;
  model: string;
  modelVersion: string | null;
  predictionId: string;
  elapsedMs: number;
};

export type DirectorPlanResponse = {
  plan: DirectorPlan;
  evidence: DirectorEvidence;
};

export type DirectorPlanRequest = {
  story: string;
  agency: "directed" | "autonomous";
  startFrameId: string;
  startFrameIntent?: string;
  startMediaId: string;
  anchors?: DirectorAnchor[];
  storyboard?: DirectorStoryboardSlot[];
  storyDuration?: "auto" | number;
};

export function authoritativeStartFrame(project: Project) {
  const opening = project.storyboard.find((frame) => frame.id === "A");
  if (opening && opening.imageOrigin !== "none" && isTrustedMediaIdShape(opening.mediaId)) {
    return opening;
  }
  return (
    project.storyboard.find(
      (frame) =>
        (frame.imageOrigin === "user" || frame.imageOrigin === "generated") &&
        isTrustedMediaIdShape(frame.mediaId),
    ) ?? project.storyboard[0]
  );
}

function isSpecifiedDirectorAnchor(frame: StoryboardFrame): boolean {
  return frame.imageOrigin !== "none" && Boolean(frame.image);
}

function directorAnchorFromFrame(frame: StoryboardFrame): DirectorAnchor {
  const intent = frame.intent?.trim();
  const visualDescription = frame.visualDescription?.trim();
  return {
    id: frame.id,
    label: frame.label,
    ...(intent ? { intent } : {}),
    ...(visualDescription ? { visualDescription } : {}),
    ...(isTrustedMediaIdShape(frame.mediaId) ? { mediaId: frame.mediaId } : {}),
  };
}

function directorSlotFromFrame(frame: StoryboardFrame): DirectorStoryboardSlot {
  const intent = frame.intent?.trim();
  const visualDescription = frame.visualDescription?.trim();
  const specified = isSpecifiedDirectorAnchor(frame);
  return {
    id: frame.id,
    label: frame.label,
    specified,
    ...(intent ? { intent } : {}),
    ...(visualDescription ? { visualDescription } : {}),
    ...(specified && isTrustedMediaIdShape(frame.mediaId) ? { mediaId: frame.mediaId } : {}),
  };
}

export function directorPlanRequestFromProject(project: Project): DirectorPlanRequest {
  if (!project.story.trim()) {
    throw new Error("Director requires a filmmaker story");
  }
  const start = authoritativeStartFrame(project);
  if (!start) {
    throw new Error("Project has no starting storyboard frame");
  }
  if (!isTrustedMediaIdShape(start.mediaId)) {
    throw new Error("Starting frame has no trusted media identity");
  }
  const startFrameIntent = start.intent?.trim() || undefined;
  const specified = project.storyboard.filter(isSpecifiedDirectorAnchor);
  const extra = specified.filter(
    (frame) => frame.id.trim().toLowerCase() !== start.id.trim().toLowerCase(),
  );
  const storyboard = project.storyboard.map(directorSlotFromFrame);
  const storyDuration =
    project.storyDuration === "auto" && !project.storyDurationLocked
      ? "auto"
      : project.storyboard.length;
  return {
    story: project.story,
    agency: project.agency,
    startFrameId: start.id,
    startMediaId: start.mediaId,
    storyDuration,
    ...(startFrameIntent ? { startFrameIntent } : {}),
    ...(extra.length > 0 ? { anchors: specified.map(directorAnchorFromFrame) } : {}),
    ...(storyboard.length > 0 ? { storyboard } : {}),
  };
}

export async function requestDirectorPlan(input: DirectorPlanRequest): Promise<DirectorPlanResponse> {
  const response = await fetch("/api/director/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as
    | DirectorPlanResponse
    | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body && body.error ? body.error : "Director planning failed");
  }
  if (!("plan" in body) || !body.plan) {
    throw new Error("Director planning failed");
  }
  return body;
}