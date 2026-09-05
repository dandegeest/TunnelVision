import Replicate from "replicate";

import { getOptionalEnv } from "../config/environment.ts";
import { classifyProviderFailure, MediaGenerationError, redactSecrets, assertNoSecret } from "../errors.ts";
import { resolveMediaInput } from "../media-input.ts";
import { ReasoningProvider, ReasoningRequest, ReasoningResult } from "../reasoning/types.ts";
import { ReplicatePrediction, ReplicatePredictionClient } from "./client.ts";
import {
  GEMINI_31_PRO_MODEL,
  Gemini31ProSettings,
  toGemini31ProInput,
} from "./gemini-3.1-pro.ts";
import { extractOutputText } from "./output.ts";

const MISSING_TOKEN_MESSAGE = "REPLICATE_API_TOKEN is not set";

export type ReplicateReasoningProviderOptions = {
  readonly token?: string;
  readonly model?: string;
  readonly gemini?: Gemini31ProSettings;
  readonly client?: ReplicatePredictionClient;
};

export class ReplicateReasoningProvider implements ReasoningProvider {
  private readonly token: string | undefined;
  private readonly model: string;
  private readonly gemini: Gemini31ProSettings | undefined;
  private readonly client: ReplicatePredictionClient;

  constructor(options: ReplicateReasoningProviderOptions = {}) {
    this.token = options.token ?? getOptionalEnv("REPLICATE_API_TOKEN");
    this.model = options.model ?? GEMINI_31_PRO_MODEL;
    this.gemini = options.gemini;
    this.client = options.client ?? createOfficialClient(this.token);
  }

  async complete(request: ReasoningRequest): Promise<ReasoningResult> {
    if (!this.token) {
      throw new MediaGenerationError("configuration", MISSING_TOKEN_MESSAGE);
    }

    const startedAt = new Date();
    const resolvedImages = [];
    for (const image of request.images ?? []) {
      resolvedImages.push(await resolveMediaInput(image));
    }
    const input = toGemini31ProInput(request, resolvedImages, this.gemini);

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

    const text = extractOutputText(prediction.output);
    if (!text || !text.trim()) {
      throw new MediaGenerationError(
        "generation_failed",
        "Replicate prediction succeeded without reasoning text",
        { predictionId: prediction.id },
      );
    }

    const result = {
      provider: "replicate" as const,
      model: prediction.model ?? this.model,
      modelVersion: prediction.version ?? null,
      predictionId: prediction.id,
      status: "succeeded" as const,
      text,
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
