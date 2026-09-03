export type ExperimentManifest = {
  readonly experiment: string;
  readonly provider: "replicate";
  readonly model: string;
  readonly start_image: string;
  readonly end_image?: string;
  readonly prompt: string;
  readonly duration_seconds?: number;
  readonly settings?: {
    readonly resolution?: "480p" | "720p" | "1080p";
    readonly aspect_ratio?:
      | "adaptive"
      | "16:9"
      | "9:16"
      | "1:1"
      | "4:3"
      | "3:4"
      | "21:9";
    readonly generate_audio?: boolean;
    readonly watermark?: boolean;
    readonly output_format?: "mp4" | "mov";
    readonly seed?: number;
  };
  readonly notes?: string;
};

const REQUIRED_STRINGS = ["experiment", "provider", "model", "start_image", "prompt"] as const;

export function parseManifest(raw: unknown): ExperimentManifest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("manifest must be a JSON object");
  }
  const data = raw as Record<string, unknown>;
  for (const key of REQUIRED_STRINGS) {
    if (typeof data[key] !== "string" || data[key].trim() === "") {
      throw new Error(`manifest.${key} must be a non-empty string`);
    }
  }
  if (data.provider !== "replicate") {
    throw new Error("manifest.provider must be replicate");
  }
  if (data.end_image !== undefined && typeof data.end_image !== "string") {
    throw new Error("manifest.end_image must be a string when present");
  }
  if (
    data.duration_seconds !== undefined &&
    (typeof data.duration_seconds !== "number" ||
      !Number.isInteger(data.duration_seconds))
  ) {
    throw new Error("manifest.duration_seconds must be an integer when present");
  }
  if (data.settings !== undefined && (typeof data.settings !== "object" || data.settings === null)) {
    throw new Error("manifest.settings must be an object when present");
  }
  if (JSON.stringify(data).includes("REPLICATE_API_TOKEN") || jsonHasToken(data)) {
    throw new Error("manifest must not contain secrets");
  }
  return data as ExperimentManifest;
}

function jsonHasToken(value: unknown): boolean {
  if (typeof value === "string") {
    return /r8_[A-Za-z0-9]{8,}/.test(value);
  }
  if (Array.isArray(value)) {
    return value.some(jsonHasToken);
  }
  if (value && typeof value === "object") {
    return Object.values(value).some(jsonHasToken);
  }
  return false;
}
