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

export async function requestDirectorPlan(input: {
  story: string;
  agency: "directed" | "autonomous";
  startFrameId: string;
  startFrameIntent?: string;
}): Promise<DirectorPlanResponse> {
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