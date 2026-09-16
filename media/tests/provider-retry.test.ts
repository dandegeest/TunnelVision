import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyProviderFailure, isRetryableProviderError, MediaGenerationError } from "../src/errors.ts";
import { withProviderRetry } from "../src/provider-retry.ts";
import type { ReplicatePredictionClient } from "../src/replicate/client.ts";
import { ReplicateMediaProvider } from "../src/replicate/provider.ts";
import { ReplicateReasoningProvider } from "../src/replicate/reasoning.ts";

const noDelay = { delayMs: [0, 0] as const, sleep: async () => undefined };

test("transient HTTP statuses are provider_unavailable", () => {
  assert.equal(classifyProviderFailure({ httpStatus: 429 }), "provider_unavailable");
  assert.equal(classifyProviderFailure({ httpStatus: 503 }), "provider_unavailable");
  assert.equal(classifyProviderFailure({ httpStatus: 504 }), "provider_unavailable");
});

test("connect timeouts and fetch failures are retryable", () => {
  const timeout = new MediaGenerationError(
    "provider_unavailable",
    "fetch failed: Connect Timeout Error",
  );
  assert.equal(isRetryableProviderError(timeout), true);
  assert.equal(
    isRetryableProviderError(
      new TypeError("fetch failed", { cause: new Error("Connect Timeout Error") }),
    ),
    true,
  );
  assert.equal(
    isRetryableProviderError(new MediaGenerationError("generation_failed", "bad output")),
    false,
  );
  assert.equal(isRetryableProviderError(new MediaGenerationError("configuration", "no token")), false);
  const aborted = new Error("stopped");
  aborted.name = "AbortError";
  assert.equal(isRetryableProviderError(aborted), false);
});

test("withProviderRetry recovers after a timeout then succeeds", async () => {
  let attempts = 0;
  const value = await withProviderRetry(async () => {
    attempts += 1;
    if (attempts < 2) {
      throw new MediaGenerationError("provider_unavailable", "fetch failed: Connect Timeout Error");
    }
    return "ok";
  }, noDelay);
  assert.equal(value, "ok");
  assert.equal(attempts, 2);
});

test("withProviderRetry does not retry configuration errors", async () => {
  let attempts = 0;
  await assert.rejects(
    () =>
      withProviderRetry(async () => {
        attempts += 1;
        throw new MediaGenerationError("configuration", "REPLICATE_API_TOKEN is not set");
      }, noDelay),
    /REPLICATE_API_TOKEN/,
  );
  assert.equal(attempts, 1);
});

test("withProviderRetry exhausts attempts then throws", async () => {
  let attempts = 0;
  await assert.rejects(
    () =>
      withProviderRetry(async () => {
        attempts += 1;
        throw new MediaGenerationError("provider_unavailable", "timeout");
      }, { ...noDelay, attempts: 3 }),
    /timeout/,
  );
  assert.equal(attempts, 3);
});

test("Cinematographer reasoning retries a connect timeout", async () => {
  let attempts = 0;
  const client: ReplicatePredictionClient = {
    async create() {
      attempts += 1;
      if (attempts < 2) {
        throw new TypeError("fetch failed", { cause: new Error("Connect Timeout Error") });
      }
      return { id: "pred_cm", status: "starting", model: "google/gemini-3.1-pro" };
    },
    async wait() {
      return {
        id: "pred_cm",
        status: "succeeded",
        model: "google/gemini-3.1-pro",
        output: "Track forward through the opening.",
      };
    },
  };
  const provider = new ReplicateReasoningProvider({
    token: "r8_testtokenvalue",
    client,
    retry: noDelay,
  });
  const result = await provider.complete({ prompt: "Assess A to B." });
  assert.equal(result.text, "Track forward through the opening.");
  assert.equal(attempts, 2);
});

test("media create retries a connect timeout", async () => {
  let attempts = 0;
  const client: ReplicatePredictionClient = {
    async create() {
      attempts += 1;
      if (attempts < 2) {
        throw new TypeError("fetch failed", { cause: new Error("Connect Timeout Error") });
      }
      return { id: "pred_vid", status: "starting", model: "bytedance/seedance-2.5" };
    },
    async wait() {
      return {
        id: "pred_vid",
        status: "succeeded",
        model: "bytedance/seedance-2.5",
        output: "https://replicate.delivery/retry.mp4",
      };
    },
  };
  const provider = new ReplicateMediaProvider({
    token: "r8_testtokenvalue",
    client,
    retry: noDelay,
  });
  const result = await provider.generateVideo({
    startImage: { kind: "url", url: "https://example.com/a.png" },
    prompt: "go",
    durationSeconds: 6,
  });
  assert.equal(result.outputUrl, "https://replicate.delivery/retry.mp4");
  assert.equal(attempts, 2);
});
