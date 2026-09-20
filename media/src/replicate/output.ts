const PREDICTION_FILE_URL_KEYS = ["output", "video", "file", "stream"] as const;

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** Control endpoints on a prediction, not generated media. */
function isPredictionControlUrl(url: string): boolean {
  return (
    /\/predictions\/[^/?#]+(?:\/cancel)?$/i.test(url) ||
    /replicate\.com\/p\//i.test(url)
  );
}

/**
 * Prefer `prediction.output`. Kling (and some other video models) can
 * succeed with `output: null` and put the file on `urls.stream`.
 */
export function extractPredictionOutputUrl(prediction: {
  readonly output?: unknown;
  readonly urls?: Readonly<Record<string, string>> | null;
}): string | null {
  const fromOutput = extractOutputUrl(prediction.output);
  if (fromOutput) {
    return fromOutput;
  }
  const urls = prediction.urls;
  if (!urls) {
    return null;
  }
  for (const key of PREDICTION_FILE_URL_KEYS) {
    const url = extractOutputUrl(urls[key]);
    if (url && !isPredictionControlUrl(url)) {
      return url;
    }
  }
  return null;
}

export function extractOutputUrl(output: unknown): string | null {
  if (typeof output === "string" && isHttpUrl(output)) {
    return output;
  }
  if (Array.isArray(output)) {
    for (const item of output) {
      const url = extractOutputUrl(item);
      if (url) {
        return url;
      }
    }
    return null;
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
  if (output && typeof output === "object") {
    const record = output as Record<string, unknown>;
    for (const key of ["video", "file", "output"]) {
      if (key in record) {
        const url = extractOutputUrl(record[key]);
        if (url) {
          return url;
        }
      }
    }
  }
  return null;
}

export function extractOutputText(output: unknown): string | null {
  if (typeof output === "string") {
    return output;
  }
  if (Array.isArray(output)) {
    const parts = output.filter((part): part is string => typeof part === "string");
    if (parts.length === 0) {
      return null;
    }
    return parts.join("");
  }
  return null;
}
