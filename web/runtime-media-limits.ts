/** Shared upload bounds. Session/dev-runtime stills; not durable storage. */
export const STARTING_FRAME_MAX_BYTES = 12 * 1024 * 1024;

export const RUNTIME_MEDIA_URL_PREFIX = "/api/runtime-media";

export function runtimeMediaPreviewUrl(mediaId: string): string {
  return `${RUNTIME_MEDIA_URL_PREFIX}/${mediaId}`;
}
