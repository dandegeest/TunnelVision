import type { CameraGrammar, Project, StoryboardFrame } from "./types";
import { cameraGrammarFromUnknown } from "../../../media/src/cinematographer/camera-grammar.ts";
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
  attachImage?: boolean;
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
  cameraGrammar?: CameraGrammar;
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

function directorAnchorFromFrame(frame: StoryboardFrame, includeMedia: boolean): DirectorAnchor {
  const intent = frame.intent?.trim();
  const visualDescription = frame.visualDescription?.trim();
  return {
    id: frame.id,
    label: frame.label,
    ...(intent ? { intent } : {}),
    ...(visualDescription ? { visualDescription } : {}),
    ...(includeMedia && isTrustedMediaIdShape(frame.mediaId) ? { mediaId: frame.mediaId } : {}),
  };
}

/**
 * Stills sent to Plan: the opening, plus the actual still immediately before
 * each run of unresolved slots. A still that itself follows an unresolved
 * slot is not sent.
 */
export function directorPlanStillIds(
  storyboard: readonly StoryboardFrame[],
  startId: string,
): string[] {
  const key = (id: string) => id.trim().toLowerCase();
  const ids: string[] = [];
  const start = storyboard.find((frame) => key(frame.id) === key(startId));
  if (start && isSpecifiedDirectorAnchor(start)) {
    ids.push(start.id);
  }
  for (let index = 1; index < storyboard.length; index += 1) {
    if (isSpecifiedDirectorAnchor(storyboard[index]!)) {
      continue;
    }
    const previous = storyboard[index - 1]!;
    if (!isSpecifiedDirectorAnchor(previous)) {
      continue;
    }
    if (index >= 2 && !isSpecifiedDirectorAnchor(storyboard[index - 2]!)) {
      continue;
    }
    if (!ids.some((id) => key(id) === key(previous.id))) {
      ids.push(previous.id);
    }
  }
  return ids;
}

/** A one-slot board cannot mean "exactly one destination" — that forces empty beats. */
export function directorStoryDurationForRequest(project: Project): "auto" | number {
  if (project.storyboard.length <= 1) {
    return "auto";
  }
  if (project.storyDuration === "auto" && !project.storyDurationLocked) {
    return "auto";
  }
  return project.storyboard.length;
}

function directorSlotFromFrame(
  frame: StoryboardFrame,
  planImageIds: ReadonlySet<string>,
): DirectorStoryboardSlot {
  const intent = frame.intent?.trim();
  const visualDescription = frame.visualDescription?.trim();
  const specified = isSpecifiedDirectorAnchor(frame);
  return {
    id: frame.id,
    label: frame.label,
    specified,
    ...(intent ? { intent } : {}),
    ...(visualDescription ? { visualDescription } : {}),
    ...(specified &&
    planImageIds.has(frame.id.trim().toLowerCase()) &&
    isTrustedMediaIdShape(frame.mediaId)
      ? { mediaId: frame.mediaId }
      : {}),
    attachImage: planImageIds.has(frame.id.trim().toLowerCase()),
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
  const planImageIds = new Set(
    directorPlanStillIds(project.storyboard, start.id).map((id) => id.trim().toLowerCase()),
  );
  const storyboard = project.storyboard.map((frame) =>
    directorSlotFromFrame(frame, planImageIds),
  );
  const storyDuration = directorStoryDurationForRequest(project);
  return {
    story: project.story,
    agency: project.agency,
    startFrameId: start.id,
    startMediaId: start.mediaId,
    storyDuration,
    cameraGrammar: cameraGrammarFromUnknown(project.cameraGrammar),
    ...(startFrameIntent ? { startFrameIntent } : {}),
    ...(extra.length > 0
      ? {
          anchors: specified.map((frame) =>
            directorAnchorFromFrame(frame, planImageIds.has(frame.id.trim().toLowerCase())),
          ),
        }
      : {}),
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

export type DirectorStoryRequest = {
  startFrameId: string;
  startFrameIntent?: string;
  startMediaId: string;
};

export type DirectorStoryResponse = {
  story: string;
  evidence: DirectorEvidence;
};

export function directorStoryRequestFromProject(project: Project): DirectorStoryRequest {
  const start = authoritativeStartFrame(project);
  if (!start) {
    throw new Error("Project has no starting storyboard frame");
  }
  if (!isTrustedMediaIdShape(start.mediaId)) {
    throw new Error("Starting frame has no trusted media identity");
  }
  const startFrameIntent = start.intent?.trim() || undefined;
  return {
    startFrameId: start.id,
    startMediaId: start.mediaId,
    ...(startFrameIntent ? { startFrameIntent } : {}),
  };
}

export async function requestDirectorStory(input: DirectorStoryRequest): Promise<DirectorStoryResponse> {
  const response = await fetch("/api/director/story", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as DirectorStoryResponse | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body && body.error ? body.error : "Director story failed");
  }
  if (!("story" in body) || !body.story?.trim() || !("evidence" in body) || !body.evidence) {
    throw new Error("Director story failed");
  }
  return body;
}