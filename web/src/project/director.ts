import type { Project } from "./types";
import { isTrustedMediaIdShape } from "./trusted-media-id";

export type DirectorBeat = {
  id: string;
  intent: string;
  visualDescription: string;
};

export type DirectorPlan = {
  summary?: string;
  beats: DirectorBeat[];
};

export type DirectorEvidence = {
  request: {
    story: string;
    agency: "directed" | "autonomous";
    startFrameId: string;
    startFrameIntent?: string;
    startMediaId: string;
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
};

export function authoritativeStartFrame(project: Project) {
  return project.storyboard.find((frame) => frame.imageOrigin === "user") ?? project.storyboard[0];
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
  return {
    story: project.story,
    agency: project.agency,
    startFrameId: start.id,
    startFrameIntent: start.intent,
    startMediaId: start.mediaId,
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