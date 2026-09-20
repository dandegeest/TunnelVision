import { classifyProviderFailure, MediaGenerationError, redactSecrets } from "../errors.ts";
import { secretsToRedact, wrapRunwayError, type RunwayApi, type RunwayTask } from "./client.ts";

/** Official docs: do not poll a task faster than once every five seconds. */
export const RUNWAY_TASK_POLL_INTERVAL_MS = 5_000;
/** Matches the official SDK default for waitForTaskOutput. */
export const RUNWAY_TASK_TIMEOUT_MS = 10 * 60 * 1000;

const TERMINAL_FAILURE = new Set(["FAILED", "CANCELLED"]);

export type WaitForRunwayTaskOptions = {
  readonly timeoutMs?: number;
  readonly pollIntervalMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
  readonly token?: string;
};

export async function waitForRunwayTask(
  api: Pick<RunwayApi, "retrieveTask">,
  taskId: string,
  options: WaitForRunwayTaskOptions = {},
): Promise<RunwayTask> {
  const timeoutMs = options.timeoutMs ?? RUNWAY_TASK_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? RUNWAY_TASK_POLL_INTERVAL_MS;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const started = now();

  for (;;) {
    let task: RunwayTask;
    try {
      task = await api.retrieveTask(taskId);
    } catch (error) {
      throw wrapRunwayError(error, options.token);
    }

    if (task.status === "SUCCEEDED") {
      return task;
    }
    if (TERMINAL_FAILURE.has(task.status)) {
      const providerMessage = redactSecrets(
        task.failure || `Runway task ${task.status.toLowerCase()}`,
        secretsToRedact(options.token),
      );
      throw new MediaGenerationError(
        classifyProviderFailure({
          status: task.status,
          error: task.failure ?? task.failureCode,
        }),
        providerMessage,
        {
          providerMessage,
          predictionId: task.id,
        },
      );
    }

    if (now() - started >= timeoutMs) {
      throw new MediaGenerationError(
        "provider_unavailable",
        `Runway task timed out after ${timeoutMs}ms`,
        { predictionId: taskId },
      );
    }
    await sleep(pollIntervalMs);
    if (now() - started >= timeoutMs) {
      throw new MediaGenerationError(
        "provider_unavailable",
        `Runway task timed out after ${timeoutMs}ms`,
        { predictionId: taskId },
      );
    }
  }
}

export function runwayTaskOutputUrl(task: RunwayTask): string | undefined {
  const first = task.output?.find((item) => typeof item === "string" && item.length > 0);
  return first;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
