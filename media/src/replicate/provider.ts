import Replicate from "replicate";

import { getOptionalEnv } from "../config/environment.ts";
import { classifyProviderFailure, MediaGenerationError, redactSecrets, assertNoSecret } from "../errors.ts";
import { resolveMediaInput } from "../media-input.ts";
import {
  GeneratedVideo,
  MediaProvider,
  VideoGenerationRequest,
} from "../types.ts";
import { ReplicatePrediction, ReplicatePredictionClient } from "./client.ts";
import {
  SEEDANCE_25_MODEL,
  Seedance25Settings,
  toSeedance25Input,
} from "./seedance-2.5.ts";

const MISSING_TOKEN_MESSAGE = "REPLICATE_API_TOKEN is not set";

export type ReplicateMediaProviderOptions = {
  readonly token?: string;
  readonly model?: string;
  readonly seedance?: Seedance25Settings;
  readonly client?: ReplicatePredictionClient;
};

export class ReplicateMediaProvider implements MediaProvider {
  private readonly token: string | undefined;
  private readonly model: string;
  private readonly seedance: Seedance25Settings | undefined;
  private readonly client: ReplicatePredictionClient;

  constructor(options: ReplicateMediaProviderOptions = {}) {
    this.token = options.token ?? getOptionalEnv("REPLICATE_API_TOKEN");
    this.model = options.model ?? SEEDANCE_25_MODEL;
    this.seedance = options.seedance;
    this.client = options.client ?? createOfficialClient(this.token);
  }

  async generateVideo(request: VideoGenerationRequest): Promise<GeneratedVideo> {
    if (!this.token) {
      throw new MediaGenerationError("configuration", MISSING_TOKEN_MESSAGE);
    }

    const startedAt = new Date();
    const start = await resolveMediaInput(request.startImage);
    const end = request.endImage
      ? await resolveMediaInput(request.endImage)
      : undefined;
    const input = toSeedance25Input(request, start, end, this.seedance);

    let prediction: ReplicatePrediction;
    try {
      prediction = await this.client.create({
        model: this.model,
        input: input as unknown as Record<string, unknown>,
      });
      prediction = await this.client.wait(prediction);
    } catch (error) {
      throw wrapClientError(error, this.token);
    }

    const completedAt = new Date();
    if (prediction.status !== "succeeded") {
      const providerMessage = prediction.error
        ? redactSecrets(prediction.error, secretsToRedact(this.token))
        : `Replicate prediction ${prediction.status}`;
      throw new MediaGenerationError(
        classifyProviderFailure({
          status: prediction.status,
          error: prediction.error,
        }),
        providerMessage,
        {
          providerMessage,
          predictionId: prediction.id,
        },
      );
    }

    const outputUrl = extractOutputUrl(prediction.output);
    if (!outputUrl) {
      throw new MediaGenerationError(
        "generation_failed",
        "Replicate prediction succeeded without an output URL",
        { predictionId: prediction.id },
      );
    }

    const result = {
      provider: "replicate" as const,
      model: prediction.model ?? this.model,
      modelVersion: prediction.version ?? null,
      predictionId: prediction.id,
      status: "succeeded" as const,
      outputUrl,
      metadata: {
        replicate_status: prediction.status,
        ...(prediction.metrics ? { metrics: prediction.metrics } : {}),
        ...(prediction.urls ? { urls: prediction.urls } : {}),
      },
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      elapsedMs: completedAt.getTime() - startedAt.getTime(),
    };
    assertNoSecret(result, this.token);
    return result;
  }
}

function createOfficialClient(token: string | undefined): ReplicatePredictionClient {
  const replicate = new Replicate({
    ...(token ? { auth: token } : {}),
    // Local files are Buffers; force file upload rather than inline data URIs.
    fileEncodingStrategy: "upload",
  });
  return {
    async create(options) {
      const prediction = await replicate.predictions.create({
        model: options.model,
        input: options.input,
      });
      return prediction as ReplicatePrediction;
    },
    async wait(prediction) {
      const completed = await replicate.wait(prediction);
      return completed as ReplicatePrediction;
    },
  };
}

function extractOutputUrl(output: unknown): string | null {
  if (typeof output === "string" && /^https?:\/\//i.test(output)) {
    return output;
  }
  if (Array.isArray(output) && typeof output[0] === "string") {
    return output[0];
  }
  if (output && typeof output === "object" && "href" in output) {
    const href = (output as { href?: unknown }).href;
    if (typeof href === "string") {
      return href;
    }
  }
  if (output && typeof output === "object" && "url" in output) {
    const url = (output as { url?: unknown }).url;
    if (typeof url === "function") {
      const value = url.call(output);
      if (typeof value === "string") {
        return value;
      }
    }
    if (typeof url === "string") {
      return url;
    }
  }
  return null;
}

function wrapClientError(error: unknown, token?: string): MediaGenerationError {
  if (error instanceof MediaGenerationError) {
    const message = redactSecrets(error.message, secretsToRedact(token));
    const providerMessage = error.providerMessage
      ? redactSecrets(error.providerMessage, secretsToRedact(token))
      : null;
    return new MediaGenerationError(error.code, message, {
      providerMessage,
      predictionId: error.predictionId,
    });
  }
  const message = redactSecrets(
    error instanceof Error ? error.message : String(error),
    secretsToRedact(token),
  );
  const httpStatus =
    error && typeof error === "object" && "response" in error
      ? Number((error as { response?: { status?: unknown } }).response?.status)
      : error && typeof error === "object" && "status" in error
        ? Number((error as { status?: unknown }).status)
        : null;
  const network =
    error instanceof Error &&
    (error.name === "FetchError" ||
      message.toLowerCase().includes("fetch") ||
      message.toLowerCase().includes("network"));
  const timeout = message.toLowerCase().includes("timeout");
  return new MediaGenerationError(
    classifyProviderFailure({
      error: message,
      httpStatus,
      network,
      timeout,
    }),
    message,
    { providerMessage: message },
  );
}

function secretsToRedact(token: string | undefined): string[] {
  return token ? [token] : [];
}
