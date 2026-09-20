import { getOptionalEnv } from "../config/environment.ts";
import {
  classifyProviderFailure,
  formatErrorWithCause,
  MediaGenerationError,
  redactSecrets,
} from "../errors.ts";

export const RUNWAY_DEV_TOKEN_NAME = "RUNWAY_DEV_TOKEN";
export const MISSING_RUNWAY_TOKEN_MESSAGE = `${RUNWAY_DEV_TOKEN_NAME} is not set`;
export const RUNWAY_API_BASE_URL = "https://api.dev.runwayml.com";
export const RUNWAY_API_VERSION = "2024-11-06";

export type RunwayEstimatedCost = {
  readonly credits: number;
};

export type RunwayTask = {
  readonly id: string;
  readonly status: string;
  readonly createdAt?: string;
  readonly output?: readonly string[] | null;
  readonly failure?: string | null;
  readonly failureCode?: string | null;
  readonly progress?: number;
  readonly estimatedCost?: RunwayEstimatedCost;
  readonly cost?: RunwayEstimatedCost;
};

export type RunwayCreateTaskResponse = {
  readonly id: string;
  readonly estimatedCost?: RunwayEstimatedCost;
};

export interface RunwayApi {
  createVideoUpscale(body: Record<string, unknown>): Promise<RunwayCreateTaskResponse>;
  retrieveTask(id: string): Promise<RunwayTask>;
  uploadVideo(filename: string, bytes: Buffer): Promise<string>;
}

export type RunwayDevClientOptions = {
  readonly token?: string;
  readonly baseUrl?: string;
  readonly apiVersion?: string;
  readonly fetch?: typeof fetch;
};

type RunwayUploadSession = {
  readonly uploadUrl: string;
  readonly fields: Record<string, string>;
  readonly runwayUri: string;
};

export class RunwayDevClient implements RunwayApi {
  private readonly token: string | undefined;
  private readonly baseUrl: string;
  private readonly apiVersion: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: RunwayDevClientOptions = {}) {
    this.token = options.token ?? getOptionalEnv(RUNWAY_DEV_TOKEN_NAME);
    this.baseUrl = options.baseUrl ?? RUNWAY_API_BASE_URL;
    this.apiVersion = options.apiVersion ?? RUNWAY_API_VERSION;
    this.fetchImpl = options.fetch ?? fetch;
  }

  assertConfigured(): void {
    if (!this.token) {
      throw new MediaGenerationError("configuration", MISSING_RUNWAY_TOKEN_MESSAGE);
    }
  }

  async createVideoUpscale(body: Record<string, unknown>): Promise<RunwayCreateTaskResponse> {
    return this.requestJson<RunwayCreateTaskResponse>("POST", "/v1/video_upscale", body);
  }

  async retrieveTask(id: string): Promise<RunwayTask> {
    return this.requestJson<RunwayTask>("GET", `/v1/tasks/${encodeURIComponent(id)}`);
  }

  async uploadVideo(filename: string, bytes: Buffer): Promise<string> {
    const session = await this.requestJson<RunwayUploadSession>("POST", "/v1/uploads", {
      filename,
      type: "ephemeral",
    });
    if (!session.uploadUrl || !session.runwayUri || !session.fields) {
      throw new MediaGenerationError("generation_failed", "Runway upload session was incomplete");
    }

    const form = new FormData();
    for (const [key, value] of Object.entries(session.fields)) {
      form.append(key, value);
    }
    form.append("file", new Blob([bytes], { type: contentTypeForFilename(filename) }), filename);

    let response: Response;
    try {
      response = await this.fetchImpl(session.uploadUrl, { method: "POST", body: form });
    } catch (error) {
      throw wrapRunwayError(error, this.token);
    }
    if (!response.ok) {
      throw wrapRunwayError(
        new Error(`Runway media upload failed (${response.status})`),
        this.token,
        response.status,
      );
    }
    return session.runwayUri;
  }

  private async requestJson<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    this.assertConfigured();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "X-Runway-Version": this.apiVersion,
    };
    if (body) {
      headers["Content-Type"] = "application/json";
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      throw wrapRunwayError(error, this.token);
    }

    const text = await response.text();
    const parsed = parseJsonBody(text);
    if (!response.ok) {
      throw wrapRunwayError(
        new Error(messageFromRunwayBody(parsed, `Runway request failed (${response.status})`)),
        this.token,
        response.status,
      );
    }
    return parsed as T;
  }
}

export function wrapRunwayError(
  error: unknown,
  token?: string,
  httpStatus?: number | null,
): MediaGenerationError {
  if (error instanceof MediaGenerationError) {
    return new MediaGenerationError(
      error.code,
      redactSecrets(error.message, secretsToRedact(token)),
      {
        providerMessage: error.providerMessage
          ? redactSecrets(error.providerMessage, secretsToRedact(token))
          : null,
        predictionId: error.predictionId,
      },
    );
  }
  const message = redactSecrets(formatErrorWithCause(error), secretsToRedact(token));
  const timeout = message.toLowerCase().includes("timeout");
  const network =
    error instanceof Error &&
    (error.name === "FetchError" ||
      message.toLowerCase().includes("fetch") ||
      message.toLowerCase().includes("network"));
  return new MediaGenerationError(
    classifyProviderFailure({ error: message, httpStatus, network, timeout }),
    message,
    { providerMessage: message },
  );
}

export function secretsToRedact(token: string | undefined): string[] {
  return token ? [token] : [];
}

function parseJsonBody(text: string): unknown {
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

function messageFromRunwayBody(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.error === "string" && record.error) {
      return record.error;
    }
    if (typeof record.message === "string" && record.message) {
      return record.message;
    }
    if (typeof record.failure === "string" && record.failure) {
      return record.failure;
    }
  }
  return fallback;
}

function contentTypeForFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".mov")) {
    return "video/quicktime";
  }
  if (lower.endsWith(".webm")) {
    return "video/webm";
  }
  return "video/mp4";
}
