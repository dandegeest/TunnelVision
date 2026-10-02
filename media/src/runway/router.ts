import { getOptionalEnv } from "../config/environment.ts";
import { MediaGenerationError } from "../errors.ts";
import { resolveMediaInput } from "../media-input.ts";
import type {
  GeneratedImage,
  GeneratedVideo,
  ImageAspectRatio,
  ImageEditRequest,
  ImageGenerationRequest,
  MediaInput,
  VideoGenerationRequest,
} from "../types.ts";
import {
  RunwayDevClient,
  wrapRunwayError,
  type RunwayApi,
  type RunwayDevClientOptions,
  type RunwayGenerateResponse,
  type RunwayRouting,
} from "./client.ts";
import { runwayTaskOutputUrl, waitForRunwayTask, type WaitForRunwayTaskOptions } from "./tasks.ts";

export type RouterGoal = "latency" | "quality";

const DRAFT_CONFIG = "tv-draft";
const FINAL_CONFIG = "tv-final";
const VIDEO_PROMPT_MAX = 20_000;
const IMAGE_PROMPT_MAX = 32_000;

export function runwayRouterConfigured(): boolean {
  return Boolean(getOptionalEnv("RUNWAY_DEV_TOKEN") ?? getOptionalEnv("RUNWAYML_API_SECRET"));
}

/**
 * Project settings pick the provider. An omitted choice keeps the previous
 * behavior: Runway when a token is configured, otherwise Replicate.
 */
export function mediaGenerationUsesRunway(choice: unknown): boolean {
  if (choice === "replicate") {
    return false;
  }
  if (choice === "runway") {
    return true;
  }
  return runwayRouterConfigured();
}

export function routerConfigId(goal: RouterGoal): string {
  const name = goal === "latency" ? "RUNWAY_ROUTER_DRAFT" : "RUNWAY_ROUTER_FINAL";
  return getOptionalEnv(name) ?? (goal === "latency" ? DRAFT_CONFIG : FINAL_CONFIG);
}

/** Fast uses the latency router. Balanced and quality use the quality router. */
export function routerGoalForIntent(intent: unknown): RouterGoal {
  return intent === "fast" ? "latency" : "quality";
}

export function routerAspectRatio(aspect?: ImageAspectRatio): string {
  if (!aspect || aspect.width <= 0 || aspect.height <= 0) {
    return "16:9";
  }
  const ratio = aspect.width / aspect.height;
  const choices: readonly [string, number][] = [
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
    ["4:3", 4 / 3],
    ["3:4", 3 / 4],
    ["1:1", 1],
    ["21:9", 21 / 9],
  ];
  let best = "16:9";
  let error = Number.POSITIVE_INFINITY;
  for (const [label, value] of choices) {
    const delta = Math.abs(ratio - value);
    if (delta < error) {
      error = delta;
      best = label;
    }
  }
  return best;
}

export function routerVideoInput(input: {
  readonly prompt: string;
  readonly firstUri: string;
  readonly lastUri?: string;
  readonly durationSeconds?: number;
  readonly goal: RouterGoal;
}): Record<string, unknown> {
  const referenceImages = [{ uri: input.firstUri, role: "first" }];
  if (input.lastUri) {
    referenceImages.push({ uri: input.lastUri, role: "last" });
  }
  const duration = clampDuration(input.durationSeconds);
  return {
    promptText: input.prompt.trim().slice(0, VIDEO_PROMPT_MAX) || "Continue the camera move.",
    aspectRatio: "16:9",
    duration,
    resolution: input.goal === "quality" ? "1080p" : "720p",
    referenceImages,
  };
}

/** FAST uses the 1k tier. Balanced and quality use 2k. The router still picks the model. */
export function canonicalImageResolution(goal: RouterGoal): "1k" | "2k" {
  return goal === "quality" ? "2k" : "1k";
}

export function routerImageInput(input: {
  readonly prompt: string;
  readonly aspect?: ImageAspectRatio;
  readonly referenceUris?: readonly string[];
  readonly goal: RouterGoal;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    promptText: input.prompt.trim().slice(0, IMAGE_PROMPT_MAX) || "A destination still.",
    aspectRatio: routerAspectRatio(input.aspect),
    resolution: canonicalImageResolution(input.goal),
  };
  if (input.referenceUris && input.referenceUris.length > 0) {
    body.referenceImages = input.referenceUris.map((uri) => ({ uri }));
  }
  return body;
}

function clampDuration(durationSeconds: number | undefined): number {
  const value = durationSeconds === undefined ? 5 : Math.round(durationSeconds);
  if (!Number.isFinite(value)) {
    return 5;
  }
  return Math.min(30, Math.max(2, value));
}

export type RunwayRouterProviderOptions = RunwayDevClientOptions &
  WaitForRunwayTaskOptions & {
    readonly api?: RunwayApi;
    readonly goal?: RouterGoal;
  };

export class RunwayRouterProvider {
  private readonly token: string | undefined;
  private readonly api: RunwayApi;
  private readonly goal: RouterGoal;
  private readonly wait: WaitForRunwayTaskOptions;

  constructor(options: RunwayRouterProviderOptions = {}) {
    const explicit = options.token;
    this.token =
      explicit !== undefined
        ? explicit || undefined
        : getOptionalEnv("RUNWAY_DEV_TOKEN") ?? getOptionalEnv("RUNWAYML_API_SECRET");
    this.api =
      options.api ??
      new RunwayDevClient({
        ...(this.token ? { token: this.token } : {}),
        ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
        ...(options.apiVersion ? { apiVersion: options.apiVersion } : {}),
        ...(options.fetch ? { fetch: options.fetch } : {}),
      });
    this.goal = options.goal ?? "quality";
    this.wait = options;
  }

  async generateImage(request: ImageGenerationRequest): Promise<GeneratedImage> {
    return this.runImage("/v1/generate/image", routerImageInput({
      prompt: request.prompt,
      ...(request.aspectRatio ? { aspect: request.aspectRatio } : {}),
      goal: this.goal,
    }));
  }

  async editImage(request: ImageEditRequest): Promise<GeneratedImage> {
    const uris = [await this.uriFor(request.sourceImage)];
    for (const extra of request.referenceImages ?? []) {
      uris.push(await this.uriFor(extra));
    }
    return this.runImage("/v1/generate/image", routerImageInput({
      prompt: request.prompt,
      ...(request.aspectRatio ? { aspect: request.aspectRatio } : {}),
      referenceUris: uris,
      goal: this.goal,
    }));
  }

  async generateVideo(request: VideoGenerationRequest): Promise<GeneratedVideo> {
    this.assertConfigured();
    const startedAt = new Date();
    const firstUri = await this.uriFor(request.startImage);
    const lastUri = request.endImage ? await this.uriFor(request.endImage) : undefined;
    const input = routerVideoInput({
      prompt: request.prompt,
      firstUri,
      ...(lastUri ? { lastUri } : {}),
      ...(request.durationSeconds !== undefined ? { durationSeconds: request.durationSeconds } : {}),
      goal: this.goal,
    });
    const created = await this.submit("/v1/generate/video", input);
    const task = await waitForRunwayTask(this.api, created.id, this.waitOptions());
    return this.finish(startedAt, created, task, "video") as GeneratedVideo;
  }

  private async runImage(path: string, input: Record<string, unknown>): Promise<GeneratedImage> {
    this.assertConfigured();
    const startedAt = new Date();
    const created = await this.submit(path, input);
    const task = await waitForRunwayTask(this.api, created.id, this.waitOptions());
    return this.finish(startedAt, created, task, "image");
  }

  private async submit(path: string, input: Record<string, unknown>): Promise<RunwayGenerateResponse> {
    try {
      return await this.api.createGeneration(path, {
        configId: routerConfigId(this.goal),
        input,
      });
    } catch (error) {
      throw wrapRunwayError(error, this.token);
    }
  }

  private finish(
    startedAt: Date,
    created: RunwayGenerateResponse,
    task: {
      id: string;
      output?: readonly string[] | null;
      routing?: RunwayRouting;
      status: string;
      cost?: { credits?: number };
      estimatedCost?: { credits?: number };
    },
    kind: "image" | "video",
  ): GeneratedImage {
    const outputUrl = runwayTaskOutputUrl(task);
    if (!outputUrl) {
      throw new MediaGenerationError("generation_failed", "Runway task succeeded without an output URL", {
        predictionId: task.id,
      });
    }
    const routing = created.routing ?? task.routing;
    const optimizeFor = routing?.optimizeFor ?? routing?.resolvedSettings?.optimizeFor ?? this.goal;
    const completedAt = new Date();
    const model = routing?.model || "router";
    const resolution = routing?.resolvedInput?.resolution;
    const credits = task.cost?.credits ?? created.estimatedCost?.credits ?? routing?.estimatedCost?.credits;
    return {
      provider: "runway",
      model,
      modelVersion: optimizeFor,
      predictionId: task.id,
      status: "succeeded",
      outputUrl,
      metadata: {
        configId: routing?.configId ?? routerConfigId(this.goal),
        optimizeFor,
        ...(routing?.model ? { routingModel: routing.model } : {}),
        ...(resolution ? { resolution } : {}),
        ...(typeof credits === "number" ? { credits } : {}),
        kind,
      },
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      elapsedMs: completedAt.getTime() - startedAt.getTime(),
    };
  }

  private async uriFor(input: MediaInput): Promise<string> {
    const resolved = await resolveMediaInput(input);
    if (resolved.kind === "url") {
      return resolved.url;
    }
    try {
      return await this.api.uploadVideo(resolved.filename, resolved.bytes);
    } catch (error) {
      throw wrapRunwayError(error, this.token);
    }
  }

  private waitOptions(): WaitForRunwayTaskOptions {
    return {
      ...(this.wait.timeoutMs !== undefined ? { timeoutMs: this.wait.timeoutMs } : {}),
      ...(this.wait.pollIntervalMs !== undefined ? { pollIntervalMs: this.wait.pollIntervalMs } : {}),
      ...(this.wait.sleep ? { sleep: this.wait.sleep } : {}),
      ...(this.wait.now ? { now: this.wait.now } : {}),
      ...(this.token ? { token: this.token } : {}),
    };
  }

  private assertConfigured(): void {
    if (!this.token) {
      throw new MediaGenerationError("configuration", "RUNWAY_DEV_TOKEN is not set");
    }
  }
}
