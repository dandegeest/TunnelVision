export type MediaInput =
  | { readonly kind: "file"; readonly path: string }
  | { readonly kind: "url"; readonly url: string };

/**
 * Filmmaking video request. Provider-specific knobs stay behind adapters.
 * Do not add Seedance field names here.
 */
export type VideoGenerationRequest = {
  readonly startImage: MediaInput;
  readonly endImage?: MediaInput;
  readonly prompt: string;
  readonly durationSeconds?: number;
  readonly seed?: number;
};

/** Pixel pair or reduced ratio. Adapters map this onto an explicit provider aspect_ratio. */
export type ImageAspectRatio = {
  readonly width: number;
  readonly height: number;
};

export type ImageGenerationRequest = {
  readonly prompt: string;
  readonly seed?: number;
  readonly aspectRatio?: ImageAspectRatio;
};

/**
 * Image-conditioned edit. Distinct from text-to-image `ImageGenerationRequest`.
 * Provider-specific model names stay behind adapters.
 */
export type ImageEditRequest = {
  readonly sourceImage: MediaInput;
  readonly prompt: string;
  readonly seed?: number;
  /** Explicit output aspect. Adapters must not substitute match_input_image when this is set. */
  readonly aspectRatio?: ImageAspectRatio;
};

export type GeneratedVideo = {
  readonly provider: "replicate";
  readonly model: string;
  readonly modelVersion: string | null;
  readonly predictionId: string;
  readonly status: "succeeded";
  readonly outputUrl: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly elapsedMs: number;
};

export type GeneratedImage = {
  readonly provider: "replicate";
  readonly model: string;
  readonly modelVersion: string | null;
  readonly predictionId: string;
  readonly status: "succeeded";
  readonly outputUrl: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly elapsedMs: number;
};

export interface MediaProvider {
  generateVideo(request: VideoGenerationRequest): Promise<GeneratedVideo>;
  generateImage(request: ImageGenerationRequest): Promise<GeneratedImage>;
}

/** Image-conditioned editing. Not text-to-image. */
export interface ImageEditProvider {
  editImage(request: ImageEditRequest): Promise<GeneratedImage>;
}

export type MediaErrorCode =
  | "configuration"
  | "invalid_input"
  | "moderation"
  | "generation_failed"
  | "provider_unavailable";
