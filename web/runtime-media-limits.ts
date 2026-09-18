/** Shared upload bounds. Session/dev-runtime stills; not durable storage. */
export const STARTING_FRAME_MAX_BYTES = 12 * 1024 * 1024;

export const RUNTIME_MEDIA_URL_PREFIX = "/api/runtime-media";

export function runtimeMediaPreviewUrl(mediaId: string): string {
  return `${RUNTIME_MEDIA_URL_PREFIX}/${mediaId}`;
}

export function runtimeMediaIdFromUrl(url: string): string | undefined {
  const path = url.split("?")[0] ?? "";
  const fromPath = /^\/api\/runtime-media\/([^/]+)$/.exec(path);
  if (fromPath?.[1]) {
    return fromPath[1];
  }
  try {
    const parsed = new URL(url);
    const fromAbsolute = /^\/api\/runtime-media\/([^/]+)$/.exec(parsed.pathname);
    return fromAbsolute?.[1];
  } catch {
    return undefined;
  }
}
