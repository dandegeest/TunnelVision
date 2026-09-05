import { MediaInput } from "../types.ts";

export type ReasoningRequest = {
  readonly prompt: string;
  readonly systemInstruction?: string;
  readonly images?: readonly MediaInput[];
};

export type ReasoningResult = {
  readonly provider: "replicate";
  readonly model: string;
  readonly modelVersion: string | null;
  readonly predictionId: string;
  readonly status: "succeeded";
  readonly text: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly elapsedMs: number;
};

export interface ReasoningProvider {
  complete(request: ReasoningRequest): Promise<ReasoningResult>;
}
