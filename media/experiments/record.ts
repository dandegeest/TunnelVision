export type ExperimentRunRecord = {
  readonly experiment: string;
  readonly provider: "replicate";
  readonly requested_model: string;
  readonly resolved_model: string | null;
  readonly resolved_model_version: string | null;
  readonly prediction_id: string | null;
  readonly start_image: {
    readonly path: string;
    readonly sha256: string;
    readonly bytes: number;
  };
  readonly end_image: {
    readonly path: string;
    readonly sha256: string;
    readonly bytes: number;
  } | null;
  readonly prompt: string;
  readonly submitted_settings: Readonly<Record<string, unknown>>;
  readonly manifest_sha256: string;
  readonly git_commit: string | null;
  readonly started_at: string;
  readonly completed_at: string;
  readonly elapsed_ms: number;
  readonly status: string;
  readonly provider_error: string | null;
  readonly error_code: string | null;
  readonly output: {
    readonly filename: string;
    readonly path: string;
    readonly source_url: string | null;
  } | null;
  /**
   * Optional operator-recorded USD cost. Not returned by Replicate unless
   * later sourced from the API; omit when unknown. Never required for success.
   */
  readonly observed_cost_usd?: number | null;
};

const FORBIDDEN = ["REPLICATE_API_TOKEN", "auth", "authorization", "bearer"];

export function assertRecordIsSafe(record: ExperimentRunRecord, token?: string): void {
  const serialized = JSON.stringify(record);
  for (const key of FORBIDDEN) {
    if (serialized.toLowerCase().includes(`"${key}"`)) {
      throw new Error(`run record must not include ${key}`);
    }
  }
  if (token && serialized.includes(token)) {
    throw new Error("run record must not include the API token");
  }
  if (/r8_[A-Za-z0-9]{8,}/.test(serialized)) {
    throw new Error("run record must not include a Replicate token");
  }
}
