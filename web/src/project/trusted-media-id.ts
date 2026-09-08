/** Opaque trusted media identities. Not filesystem paths. Not Wardrobe-specific Project fields. */

export const TRUSTED_MEDIA_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const TRUSTED_MEDIA_IDS = {
  wardrobeLoopVisionA: "wardrobe-loop-vision-a",
  forestAtoFA: "forest-a-to-f-a",
  forestAtoFB: "forest-a-to-f-b",
  forestAtoFC: "forest-a-to-f-c",
  forestAtoFD: "forest-a-to-f-d",
  forestAtoFE: "forest-a-to-f-e",
  forestAtoFF: "forest-a-to-f-f",
} as const;

export type TrustedMediaId = (typeof TRUSTED_MEDIA_IDS)[keyof typeof TRUSTED_MEDIA_IDS];

export function isTrustedMediaIdShape(value: unknown): value is string {
  return typeof value === "string" && TRUSTED_MEDIA_ID_PATTERN.test(value);
}
