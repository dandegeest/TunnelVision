import { assertNoSecret, MediaGenerationError } from "../errors.ts";
import { resolveMediaInput } from "../media-input.ts";
import type { MediaInput } from "../types.ts";
import { getOptionalEnv } from "../config/environment.ts";
import {
  MISSING_RUNWAY_TOKEN_MESSAGE,
  RUNWAY_DEV_TOKEN_NAME,
  RunwayDevClient,
  wrapRunwayError,
  type RunwayApi,
  type RunwayDevClientOptions,
} from "./client.ts";
import {
  DEFAULT_ENHANCE_FRAME_RATE,
  ENHANCE_FRAME_RATE_MODEL,
  parseRunwayTargetFramerate,
  toEnhanceFrameRateBody,
  type RunwayTargetFramerate,
} from "./enhance-frame-rate.ts";
import { runwayTaskOutputUrl, waitForRunwayTask, type WaitForRunwayTaskOptions } from "./tasks.ts";

export type EnhanceFrameRateRequest = {
  readonly video: MediaInput;
  readonly fps?: number | string;
};

export type EnhanceFrameRateOptions = WaitForRunwayTaskOptions & {
  readonly onProgress?: (message: string) => void;
};

export type RunwayEnhancedVideo = {
  readonly provider: "runway";
  readonly model: typeof ENHANCE_FRAME_RATE_MODEL;
  readonly taskId: string;
  readonly predictionId: string;
  readonly status: "succeeded";
  readonly outputUrl: string;
  readonly outputUrls: readonly string[];
  readonly targetFramerate: RunwayTargetFramerate;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly elapsedMs: number;
};

export type RunwayDevProviderOptions = RunwayDevClientOptions & {
  readonly api?: RunwayApi;
};

export class RunwayDevProvider {
  private readonly token: string | undefined;
  private readonly api: RunwayApi;

  constructor(options: RunwayDevProviderOptions = {}) {
    this.token = options.token ?? getOptionalEnv(RUNWAY_DEV_TOKEN_NAME);
    this.api = options.api ?? new RunwayDevClient(options);
  }

  private assertConfigured(): void {
    if (!this.token) {
      throw new MediaGenerationError("configuration", MISSING_RUNWAY_TOKEN_MESSAGE);
    }
  }

  async enhanceFrameRate(
    video: MediaInput,
    options: Omit<EnhanceFrameRateRequest, "video"> & EnhanceFrameRateOptions = {},
  ): Promise<RunwayEnhancedVideo> {
    this.assertConfigured();
    const startedAt = new Date();
    const targetFramerate = parseRunwayTargetFramerate(options.fps ?? DEFAULT_ENHANCE_FRAME_RATE);
    const report = options.onProgress ?? (() => undefined);

    let videoUri: string;
    try {
      videoUri = await this.resolveVideoUri(video, report);
    } catch (error) {
      throw wrapRunwayError(error, this.token);
    }

    const body = toEnhanceFrameRateBody(videoUri, targetFramerate);
    report("submitting");
    let created;
    try {
      created = await this.api.createVideoUpscale(body);
    } catch (error) {
      throw wrapRunwayError(error, this.token);
    }
    report(`task ID ${created.id}`);
    report("processing");

    const task = await waitForRunwayTask(this.api, created.id, {
      timeoutMs: options.timeoutMs,
      pollIntervalMs: options.pollIntervalMs,
      sleep: options.sleep,
      now: options.now,
      token: this.token,
    });
    const outputUrl = runwayTaskOutputUrl(task);
    if (!outputUrl) {
      throw new MediaGenerationError(
        "generation_failed",
        "Runway task succeeded without an output URL",
        { predictionId: task.id },
      );
    }

    const completedAt = new Date();
    const result: RunwayEnhancedVideo = {
      provider: "runway",
      model: ENHANCE_FRAME_RATE_MODEL,
      taskId: task.id,
      predictionId: task.id,
      status: "succeeded",
      outputUrl,
      outputUrls: task.output ?? [outputUrl],
      targetFramerate,
      metadata: {
        runway_status: task.status,
        ...(created.estimatedCost ? { estimatedCost: created.estimatedCost } : {}),
        ...(task.cost ? { cost: task.cost } : {}),
        ...(task.estimatedCost ? { estimatedCost: task.estimatedCost } : {}),
      },
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      elapsedMs: completedAt.getTime() - startedAt.getTime(),
    };
    assertNoSecret(result, this.token);
    report("completed");
    return result;
  }

  private async resolveVideoUri(
    video: MediaInput,
    report: (message: string) => void,
  ): Promise<string> {
    const resolved = await resolveMediaInput(video);
    if (resolved.kind === "url") {
      return resolved.url;
    }
    report("uploading");
    return this.api.uploadVideo(resolved.filename, resolved.bytes);
  }
}
