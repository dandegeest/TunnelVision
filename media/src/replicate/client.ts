export type ReplicatePrediction = {
  readonly id: string;
  readonly status: string;
  readonly model?: string;
  readonly version?: string | null;
  readonly error?: string | null;
  readonly output?: unknown;
  readonly metrics?: Readonly<Record<string, unknown>> | null;
  readonly urls?: Readonly<Record<string, string>> | null;
  readonly input?: Readonly<Record<string, unknown>> | null;
  readonly logs?: string | null;
};

export interface ReplicatePredictionClient {
  create(options: {
    readonly model: string;
    readonly input: Record<string, unknown>;
  }): Promise<ReplicatePrediction>;
  wait(prediction: ReplicatePrediction): Promise<ReplicatePrediction>;
}
