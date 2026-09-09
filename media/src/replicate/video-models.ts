/**
 * Product video generators. Slugs stay at the MediaProvider boundary.
 * This catalog is importable from the web app; do not import adapter
 * modules here (they pull Node types into the browser compile).
 * Pruna is the development default. Mid-tier and Seedance 2.5 are opt-in.
 */
export const VIDEO_MODEL_IDS = [
  "pruna-p-video",
  "luma-ray-flash-2-720p",
  "wan-2.2-first-last-frame",
  "seedance-2.0-fast",
  "seedance-2.5",
] as const;

export type VideoModelId = (typeof VIDEO_MODEL_IDS)[number];
export type VideoModelTier = "dev" | "mid" | "hq";
export type VideoModelCost = "$" | "$$" | "$$$";

export type VideoModelOption = {
  readonly id: VideoModelId;
  readonly slug: string;
  readonly label: string;
  readonly tier: VideoModelTier;
  readonly cost: VideoModelCost;
};

export const DEFAULT_VIDEO_MODEL_ID: VideoModelId = "pruna-p-video";

export const VIDEO_MODELS: readonly VideoModelOption[] = [
  {
    id: "pruna-p-video",
    slug: "prunaai/p-video",
    label: "Pruna",
    tier: "dev",
    cost: "$",
  },
  {
    id: "luma-ray-flash-2-720p",
    slug: "luma/ray-flash-2-720p",
    label: "Luma Ray Flash 2 720p",
    tier: "mid",
    cost: "$$",
  },
  {
    id: "wan-2.2-first-last-frame",
    slug: "wan-video/wan-2.2-i2v-fast",
    label: "Wan 2.2 First/Last Frame",
    tier: "mid",
    cost: "$$",
  },
  {
    id: "seedance-2.0-fast",
    slug: "bytedance/seedance-2.0-fast",
    label: "Seedance 2.0 Fast",
    tier: "mid",
    cost: "$$",
  },
  {
    id: "seedance-2.5",
    slug: "bytedance/seedance-2.5",
    label: "Seedance 2.5",
    tier: "hq",
    cost: "$$$",
  },
];

export function isVideoModelId(value: unknown): value is VideoModelId {
  return typeof value === "string" && (VIDEO_MODEL_IDS as readonly string[]).includes(value);
}

export function videoModelOption(id: VideoModelId): VideoModelOption {
  const option = VIDEO_MODELS.find((item) => item.id === id);
  if (!option) {
    throw new Error(`Unknown video model ${id}`);
  }
  return option;
}

export function videoModelSlug(id: VideoModelId): string {
  return videoModelOption(id).slug;
}

export function videoModelMenuLabel(option: VideoModelOption): string {
  return `${option.label} ${option.cost}`;
}

/** Accept a product id or a known Replicate slug. */
export function parseVideoModelId(value: unknown): VideoModelId | undefined {
  if (isVideoModelId(value)) {
    return value;
  }
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  const trimmed = value.trim();
  return VIDEO_MODELS.find((item) => item.slug === trimmed)?.id;
}
