/**
 * Product still generators. Slugs stay at the MediaProvider boundary.
 * This catalog is importable from the web app; do not import adapter
 * modules here (they pull Node types into the browser compile).
 * Nano Banana 2 Lite is the default for opening A and later B…N stills.
 * Flux Ultra is not in this catalog: it cannot take reference images.
 */
export const IMAGE_MODEL_IDS = ["nano-banana-2-lite", "nano-banana-2"] as const;
export const IMAGE_OUTPUT_FORMATS = ["png", "jpg"] as const;
export const IMAGE_RESOLUTIONS = ["1K", "2K", "4K"] as const;

export type ImageModelId = (typeof IMAGE_MODEL_IDS)[number];
export type ImageOutputFormat = (typeof IMAGE_OUTPUT_FORMATS)[number];
export type ImageResolution = (typeof IMAGE_RESOLUTIONS)[number];
export type ImageModelTier = "dev" | "hq";
export type ImageModelCost = "$" | "$$";

export type ImageModelOption = {
  readonly id: ImageModelId;
  readonly slug: string;
  readonly label: string;
  readonly tier: ImageModelTier;
  readonly cost: ImageModelCost;
  /** Shown in Project settings only when there is more than one choice. */
  readonly outputFormats: readonly ImageOutputFormat[];
  /** Shown in Project settings only when there is more than one choice. */
  readonly resolutions: readonly ImageResolution[];
};

export const DEFAULT_IMAGE_MODEL_ID: ImageModelId = "nano-banana-2-lite";
export const DEFAULT_IMAGE_OUTPUT_FORMAT: ImageOutputFormat = "png";
export const DEFAULT_IMAGE_RESOLUTION: ImageResolution = "1K";

export const IMAGE_MODELS: readonly ImageModelOption[] = [
  {
    id: "nano-banana-2-lite",
    slug: "google/nano-banana-2-lite",
    label: "Nano Banana 2 Lite",
    tier: "dev",
    cost: "$",
    outputFormats: ["png", "jpg"],
    resolutions: ["1K"],
  },
  {
    id: "nano-banana-2",
    slug: "google/nano-banana-2",
    label: "Nano Banana 2",
    tier: "hq",
    cost: "$$",
    outputFormats: ["png", "jpg"],
    resolutions: ["1K", "2K", "4K"],
  },
];

export function isImageModelId(value: unknown): value is ImageModelId {
  return typeof value === "string" && (IMAGE_MODEL_IDS as readonly string[]).includes(value);
}

export function imageModelOption(id: ImageModelId): ImageModelOption {
  const option = IMAGE_MODELS.find((item) => item.id === id);
  if (!option) {
    throw new Error(`Unknown image model ${id}`);
  }
  return option;
}

export function imageModelSlug(id: ImageModelId): string {
  return imageModelOption(id).slug;
}

export function imageModelMenuLabel(option: ImageModelOption): string {
  return `${option.label} ${option.cost}`;
}

/** Filmmaker-facing catalog label, or undefined when the id/slug is unknown. */
export function imageModelDisplayLabel(model: string): string | undefined {
  const id = parseImageModelId(model);
  return id ? imageModelOption(id).label : undefined;
}

/** Accept a product id or a known Replicate slug. */
export function parseImageModelId(value: unknown): ImageModelId | undefined {
  if (isImageModelId(value)) {
    return value;
  }
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  const trimmed = value.trim();
  return IMAGE_MODELS.find((item) => item.slug === trimmed)?.id;
}

export function resolveImageModelId(value: unknown): ImageModelId {
  return parseImageModelId(value) ?? DEFAULT_IMAGE_MODEL_ID;
}

export function isImageOutputFormat(value: unknown): value is ImageOutputFormat {
  return typeof value === "string" && (IMAGE_OUTPUT_FORMATS as readonly string[]).includes(value);
}

export function isImageResolution(value: unknown): value is ImageResolution {
  return typeof value === "string" && (IMAGE_RESOLUTIONS as readonly string[]).includes(value);
}

export function imageModelOutputFormats(id: ImageModelId): readonly ImageOutputFormat[] {
  return imageModelOption(id).outputFormats;
}

export function imageModelResolutions(id: ImageModelId): readonly ImageResolution[] {
  return imageModelOption(id).resolutions;
}

export function imageModelHasFormatChoice(id: ImageModelId): boolean {
  return imageModelOutputFormats(id).length > 1;
}

export function imageModelHasResolutionChoice(id: ImageModelId): boolean {
  return imageModelResolutions(id).length > 1;
}

export function resolveImageOutputFormat(
  id: ImageModelId,
  value: unknown,
): ImageOutputFormat {
  const formats = imageModelOutputFormats(id);
  if (isImageOutputFormat(value) && formats.includes(value)) {
    return value;
  }
  return formats.includes(DEFAULT_IMAGE_OUTPUT_FORMAT)
    ? DEFAULT_IMAGE_OUTPUT_FORMAT
    : formats[0] ?? DEFAULT_IMAGE_OUTPUT_FORMAT;
}

export function resolveImageResolution(id: ImageModelId, value: unknown): ImageResolution {
  const resolutions = imageModelResolutions(id);
  if (isImageResolution(value) && resolutions.includes(value)) {
    return value;
  }
  return resolutions.includes(DEFAULT_IMAGE_RESOLUTION)
    ? DEFAULT_IMAGE_RESOLUTION
    : resolutions[0] ?? DEFAULT_IMAGE_RESOLUTION;
}
