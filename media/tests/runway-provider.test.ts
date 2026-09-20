import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { MediaGenerationError } from "../src/errors.ts";
import { parseRunwayTargetFramerate, toEnhanceFrameRateBody } from "../src/runway/enhance-frame-rate.ts";
import { RunwayDevProvider } from "../src/runway/provider.ts";
import { waitForRunwayTask } from "../src/runway/tasks.ts";
import type { RunwayApi, RunwayTask } from "../src/runway/client.ts";

const TOKEN = "runway-dev-test-token";

function mockApi(overrides: Partial<RunwayApi> = {}): RunwayApi {
  return {
    async createVideoUpscale() {
      throw new Error("should not create a Runway task");
    },
    async retrieveTask() {
      throw new Error("should not retrieve a Runway task");
    },
    async uploadVideo() {
      throw new Error("should not upload to Runway");
    },
    ...overrides,
  };
}

test("missing RUNWAY_DEV_TOKEN fails with configuration error", async () => {
  const provider = new RunwayDevProvider({
    token: "",
    api: mockApi(),
  });
  await assert.rejects(
    () =>
      provider.enhanceFrameRate({
        kind: "url",
        url: "https://example.com/clip.mp4",
      }),
    (error: unknown) => {
      assert(error instanceof MediaGenerationError);
      assert.equal(error.code, "configuration");
      assert.equal(error.message, "RUNWAY_DEV_TOKEN is not set");
      return true;
    },
  );
});

test("invalid FPS is rejected before a Runway call", async () => {
  const provider = new RunwayDevProvider({
    token: TOKEN,
    api: mockApi(),
  });
  await assert.rejects(
    () =>
      provider.enhanceFrameRate(
        { kind: "url", url: "https://example.com/clip.mp4" },
        { fps: 90 },
      ),
    (error: unknown) => {
      assert(error instanceof MediaGenerationError);
      assert.equal(error.code, "invalid_input");
      assert.match(error.message, /90/);
      return true;
    },
  );
  assert.throws(() => parseRunwayTargetFramerate("15"), /15/);
});

test("maps supported FPS aliases onto official targetFramerate strings", () => {
  assert.deepEqual(toEnhanceFrameRateBody("https://example.com/clip.mp4"), {
    model: "enhance_frame_rate",
    videoUri: "https://example.com/clip.mp4",
    targetFramerate: "120",
  });
  assert.equal(parseRunwayTargetFramerate(120), "120");
  assert.equal(parseRunwayTargetFramerate("23.98"), "23_98");
  assert.equal(parseRunwayTargetFramerate("29_97"), "29_97");
});

test("successful enhanceFrameRate waits for SUCCEEDED and returns the output URL", async () => {
  const created: string[] = [];
  const provider = new RunwayDevProvider({
    token: TOKEN,
    api: mockApi({
      async createVideoUpscale(body) {
        created.push(JSON.stringify(body));
        assert.deepEqual(body, {
          model: "enhance_frame_rate",
          videoUri: "https://example.com/clip.mp4",
          targetFramerate: "120",
        });
        return { id: "task-success", estimatedCost: { credits: 3 } };
      },
      async retrieveTask(id) {
        assert.equal(id, "task-success");
        return {
          id,
          status: "SUCCEEDED",
          output: ["https://example.com/enhanced.mp4"],
          cost: { credits: 3 },
        };
      },
    }),
  });

  const result = await provider.enhanceFrameRate(
    { kind: "url", url: "https://example.com/clip.mp4" },
    { fps: 120 },
  );
  assert.equal(created.length, 1);
  assert.equal(result.provider, "runway");
  assert.equal(result.model, "enhance_frame_rate");
  assert.equal(result.taskId, "task-success");
  assert.equal(result.predictionId, "task-success");
  assert.equal(result.outputUrl, "https://example.com/enhanced.mp4");
  assert.equal(result.targetFramerate, "120");
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
});

test("failed Runway task becomes a generation_failed error", async () => {
  await assert.rejects(
    () =>
      waitForRunwayTask(
        {
          async retrieveTask(): Promise<RunwayTask> {
            return {
              id: "task-failed",
              status: "FAILED",
              failure: `upstream ${TOKEN}`,
              failureCode: "INTERNAL.ERROR",
            };
          },
        },
        "task-failed",
        { token: TOKEN, pollIntervalMs: 1, timeoutMs: 20 },
      ),
    (error: unknown) => {
      assert(error instanceof MediaGenerationError);
      assert.equal(error.code, "generation_failed");
      assert.equal(error.predictionId, "task-failed");
      assert.equal(error.message.includes(TOKEN), false);
      assert.match(error.message, /upstream/);
      return true;
    },
  );
});

test("local files are uploaded and submitted as a Runway URI", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tv-runway-"));
  const path = join(dir, "clip.mp4");
  await writeFile(path, "fake-mp4");
  const provider = new RunwayDevProvider({
    token: TOKEN,
    api: mockApi({
      async uploadVideo(filename, bytes) {
        assert.equal(filename, "clip.mp4");
        assert.equal(bytes.toString(), "fake-mp4");
        return "runway://uploaded-clip";
      },
      async createVideoUpscale(body) {
        assert.equal(body.videoUri, "runway://uploaded-clip");
        assert.equal(body.targetFramerate, "120");
        return { id: "task-upload" };
      },
      async retrieveTask(id) {
        return {
          id,
          status: "SUCCEEDED",
          output: ["https://example.com/uploaded-enhanced.mp4"],
        };
      },
    }),
  });
  const result = await provider.enhanceFrameRate({ kind: "file", path });
  assert.equal(result.outputUrl, "https://example.com/uploaded-enhanced.mp4");
});

test("polling stops with provider_unavailable after the timeout", async () => {
  let now = 0;
  await assert.rejects(
    () =>
      waitForRunwayTask(
        {
          async retrieveTask(): Promise<RunwayTask> {
            return { id: "task-slow", status: "RUNNING", progress: 0.1 };
          },
        },
        "task-slow",
        {
          timeoutMs: 10,
          pollIntervalMs: 5,
          now: () => now,
          sleep: async (ms) => {
            now += ms;
          },
        },
      ),
    (error: unknown) => {
      assert(error instanceof MediaGenerationError);
      assert.equal(error.code, "provider_unavailable");
      assert.match(error.message, /timed out/);
      assert.equal(error.predictionId, "task-slow");
      return true;
    },
  );
});
