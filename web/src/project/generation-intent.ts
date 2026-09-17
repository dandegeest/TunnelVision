import {
  DEFAULT_VIDEO_MODEL_ID,
  parseVideoModelId,
  videoModelDisplayLabel,
  videoModelHasModeChoice,
  type VideoModelId,
} from "../../../media/src/replicate/video-models.ts";

export const GENERATION_INTENTS = ["fast", "balanced", "quality"] as const;
export type GenerationIntent = (typeof GENERATION_INTENTS)[number];

export type VideoModelsByIntent = Record<GenerationIntent, VideoModelId>;

export const GENERATION_INTENT_MARK: Record<GenerationIntent, string> = {
  fast: "⚡",
  balanced: "◆",
  quality: "✦",
};

export const GENERATION_INTENT_LABEL: Record<GenerationIntent, string> = {
  fast: "Fast",
  balanced: "Balanced",
  quality: "Quality",
};

/** Provider-neutral defaults. Router policies can fulfill these later. */
export const DEFAULT_VIDEO_MODELS_BY_INTENT: VideoModelsByIntent = {
  fast: "pruna-p-video",
  balanced: "kling-v2.5-turbo-pro",
  quality: "veo-3.1-fast",
};

export function isGenerationIntent(value: unknown): value is GenerationIntent {
  return typeof value === "string" && (GENERATION_INTENTS as readonly string[]).includes(value);
}

export function defaultVideoModelsByIntent(): VideoModelsByIntent {
  return { ...DEFAULT_VIDEO_MODELS_BY_INTENT };
}

function catalogVideoModel(value: unknown, fallback: VideoModelId): VideoModelId {
  return parseVideoModelId(value) ?? fallback;
}

export function videoModelsByIntentFromProject(project: {
  videoModel: VideoModelId;
  videoModelsByIntent?: VideoModelsByIntent;
}): VideoModelsByIntent {
  const mapped = project.videoModelsByIntent;
  const fast = catalogVideoModel(project.videoModel, DEFAULT_VIDEO_MODEL_ID);
  return {
    fast,
    balanced: catalogVideoModel(mapped?.balanced, fast),
    quality: catalogVideoModel(mapped?.quality, fast),
  };
}

export function videoModelForIntent(
  project: {
    videoModel: VideoModelId;
    videoModelsByIntent?: VideoModelsByIntent;
  },
  intent: GenerationIntent,
): VideoModelId {
  return videoModelsByIntentFromProject(project)[intent];
}

export const DEFAULT_GENERATION_INTENT: GenerationIntent = "fast";

export function defaultTakeIntentFromProject(project: {
  defaultTakeIntent?: GenerationIntent;
}): GenerationIntent {
  return project.defaultTakeIntent ?? DEFAULT_GENERATION_INTENT;
}

export function projectShowsVideoModeChoice(project: {
  videoModel: VideoModelId;
  videoModelsByIntent?: VideoModelsByIntent;
}): boolean {
  return Object.values(videoModelsByIntentFromProject(project)).some(videoModelHasModeChoice);
}

export function unshotVideoModel(project: {
  videoModel: VideoModelId;
  videoModelsByIntent?: VideoModelsByIntent;
  defaultTakeIntent?: GenerationIntent;
}): VideoModelId {
  return videoModelForIntent(project, defaultTakeIntentFromProject(project));
}

export function takeIntentTooltip(take: {
  generationIntent?: GenerationIntent;
  model: string;
}): string | undefined {
  const model = videoModelDisplayLabel(take.model) ?? (take.model.trim() ? take.model : undefined);
  if (take.generationIntent) {
    const intent = GENERATION_INTENT_LABEL[take.generationIntent];
    return model ? `${intent} · ${model}` : intent;
  }
  return model;
}
