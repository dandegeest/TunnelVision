export function extractOutputUrl(output: unknown): string | null {
  if (typeof output === "string" && /^https?:\/\//i.test(output)) {
    return output;
  }
  if (Array.isArray(output) && typeof output[0] === "string") {
    const first = output[0];
    if (/^https?:\/\//i.test(first)) {
      return first;
    }
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
