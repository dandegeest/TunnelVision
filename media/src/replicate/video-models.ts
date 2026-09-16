/**
 * Product video generators. Slugs stay at the MediaProvider boundary.
 * This catalog is importable from the web app; do not import adapter
 * modules here (they pull Node types into the browser compile).
 * Pruna is the development default. Mid-tier, Seedance 2.5, and Kling 3 are opt-in.
 */
export const VIDEO_MODEL_IDS = [
  "pruna-p-video",
  "kling-v2.5-turbo-pro",
  "kling-v3-video",
  "wan-2.2-first-last-frame",
  "seedance-2.0-fast",
  "seedance-2.5",
] as const;

export const KLING_V3_MODES = ["standard", "pro", "4k"] as const;
export type KlingV3Mode = (typeof KLING_V3_MODES)[number];
export const DEFAULT_KLING_V3_MODE: KlingV3Mode = "standard";

export const KLING_V3_MODE_LABEL: Record<KlingV3Mode, string> = {
  standard: "Standard · 720p",
  pro: "Pro · 1080p",
  "4k": "4K",
};

export type VideoModelId = (typeof VIDEO_MODEL_IDS)[number];
export type VideoModelTier = "dev" | "mid" | "hq";
export type VideoModelCost = "$" | "$$" | "$$$";

export type VideoModelOption = {
  readonly id: VideoModelId;
  readonly slug: string;
  readonly label: string;
  readonly tier: VideoModelTier;
  readonly cost: VideoModelCost;
  /** Clip length this generator produces for a product SHOOT. */
  readonly durationSeconds: number;
};

export const DEFAULT_VIDEO_MODEL_ID: VideoModelId = "pruna-p-video";

export const VIDEO_MODELS: readonly VideoModelOption[] = [
  {
    id: "pruna-p-video",
    slug: "prunaai/p-video",
    label: "Pruna",
    tier: "dev",
    cost: "$",
    durationSeconds: 6,
  },
  {
    id: "kling-v2.5-turbo-pro",
    slug: "kwaivgi/kling-v2.5-turbo-pro",
    label: "Kling 2.5 Turbo Pro",
    tier: "mid",
    cost: "$$",
    durationSeconds: 5,
  },
  {
    id: "kling-v3-video",
    slug: "kwaivgi/kling-v3-video",
    label: "Kling 3",
    tier: "hq",
    cost: "$$$",
    durationSeconds: 6,
  },
  {
    id: "wan-2.2-first-last-frame",
    slug: "wan-video/wan-2.2-i2v-fast",
    label: "Wan 2.2 First/Last Frame",
    tier: "mid",
    cost: "$$",
    durationSeconds: 6,
  },
  {
    id: "seedance-2.0-fast",
    slug: "bytedance/seedance-2.0-fast",
    label: "Seedance 2.0 Fast",
    tier: "mid",
    cost: "$$",
    durationSeconds: 6,
  },
  {
    id: "seedance-2.5",
    slug: "bytedance/seedance-2.5",
    label: "Seedance 2.5",
    tier: "hq",
    cost: "$$$",
    durationSeconds: 6,
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

export function videoModelDurationSeconds(id: VideoModelId): number {
  return videoModelOption(id).durationSeconds;
}

export function isKlingV3Mode(value: unknown): value is KlingV3Mode {
  return typeof value === "string" && (KLING_V3_MODES as readonly string[]).includes(value);
}

export function resolveKlingV3Mode(value: unknown): KlingV3Mode {
  return isKlingV3Mode(value) ? value : DEFAULT_KLING_V3_MODE;
}

/** Shown in Project settings only when Kling 3 is mapped to an intent. */
export function videoModelHasModeChoice(id: VideoModelId): boolean {
  return id === "kling-v3-video";
}

export function videoModelMenuLabel(option: VideoModelOption): string {
  return `${option.label} ${option.cost}`;
}

/** Filmmaker-facing catalog label, or undefined when the id/slug is unknown. */
export function videoModelDisplayLabel(model: string): string | undefined {
  const id = parseVideoModelId(model);
  return id ? videoModelOption(id).label : undefined;
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
