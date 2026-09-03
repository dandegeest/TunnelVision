import { MediaErrorCode } from "./types.ts";

export class MediaGenerationError extends Error {
  readonly code: MediaErrorCode;
  readonly providerMessage: string | null;
  readonly predictionId: string | null;

  constructor(
    code: MediaErrorCode,
    message: string,
    options?: {
      readonly cause?: unknown;
      readonly providerMessage?: string | null;
      readonly predictionId?: string | null;
    },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "MediaGenerationError";
    this.code = code;
    this.providerMessage = options?.providerMessage ?? null;
    this.predictionId = options?.predictionId ?? null;
  }
}

const TOKEN_PATTERN = /r8_[A-Za-z0-9]+/g;

export function redactSecrets(value: string, extraSecrets: readonly string[] = []): string {
  let redacted = value.replace(TOKEN_PATTERN, "[redacted]");
  for (const secret of extraSecrets) {
    if (secret) {
      redacted = redacted.split(secret).join("[redacted]");
    }
  }
  return redacted;
}

export function assertNoSecret(payload: unknown, token: string | undefined): void {
  if (!token) {
    return;
  }
  const serialized = JSON.stringify(payload);
  if (serialized.includes(token)) {
    throw new MediaGenerationError(
      "generation_failed",
      "Refusing to serialize a secret into provider metadata",
    );
  }
}

/**
 * Normalize a Replicate (or other) failure. Do not infer moderation unless
 * the provider text explicitly reports it.
 */
export function classifyProviderFailure(input: {
  readonly status?: string | null;
  readonly error?: string | null;
  readonly httpStatus?: number | null;
  readonly network?: boolean;
  readonly timeout?: boolean;
}): MediaErrorCode {
  if (input.timeout || input.network) {
    return "provider_unavailable";
  }
  const error = (input.error ?? "").toLowerCase();
  if (
    input.httpStatus === 401 ||
    input.httpStatus === 403 ||
    error.includes("unauthenticated") ||
    error.includes("invalid token") ||
    error.includes("authentication")
  ) {
    return "configuration";
  }
  if (input.httpStatus === 400 || input.httpStatus === 422) {
    return "invalid_input";
  }
  const explicitModeration =
    error.includes("moderation") ||
    error.includes("nsfw") ||
    error.includes("content policy") ||
    error.includes("safety filter") ||
    error.includes("safety system") ||
    error.includes("flagged");
  if (explicitModeration) {
    return "moderation";
  }
  return "generation_failed";
}
