import { isRetryableProviderError } from "./errors.ts";

/** Initial try plus two retries. Connect timeouts are 10s each. */
export const PROVIDER_RETRY_ATTEMPTS = 3;
export const PROVIDER_RETRY_DELAYS_MS = [1000, 2000] as const;

export type ProviderRetryOptions = {
  readonly attempts?: number;
  readonly delayMs?: readonly number[];
  readonly sleep?: (ms: number) => Promise<void>;
};

export async function defaultProviderRetrySleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function withProviderRetry<T>(
  operation: () => Promise<T>,
  options: ProviderRetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? PROVIDER_RETRY_ATTEMPTS;
  const delays = options.delayMs ?? PROVIDER_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? defaultProviderRetrySleep;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableProviderError(error)) {
        throw error;
      }
      const delay = delays[Math.min(attempt - 1, delays.length - 1)] ?? 0;
      await sleep(delay);
    }
  }
  throw lastError;
}
