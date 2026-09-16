import { describe, expect, it } from "vitest";
import { createNewProject } from "./new-project";
import {
  DEFAULT_GENERATION_INTENT,
  DEFAULT_VIDEO_MODELS_BY_INTENT,
  GENERATION_INTENT_MARK,
  defaultTakeIntentFromProject,
  takeIntentTooltip,
  unshotVideoModel,
  videoModelForIntent,
  videoModelsByIntentFromProject,
} from "./generation-intent";
import { takeDisplayLabel } from "./takes";
import { projectWithVideoModelForIntent } from "./shoot";

describe("generation intents", () => {
  it("defaults a new project to Fast/Pruna, Balanced/Wan, Quality/Seedance 2.5", () => {
    const project = createNewProject();
    expect(videoModelsByIntentFromProject(project)).toEqual(DEFAULT_VIDEO_MODELS_BY_INTENT);
    expect(defaultTakeIntentFromProject(project)).toBe(DEFAULT_GENERATION_INTENT);
    expect(unshotVideoModel(project)).toBe("pruna-p-video");
    expect(videoModelForIntent(project, "fast")).toBe("pruna-p-video");
    expect(videoModelForIntent(project, "balanced")).toBe("wan-2.2-first-last-frame");
    expect(videoModelForIntent(project, "quality")).toBe("seedance-2.5");
  });

  it("resolves Agent footage through the default Take intent mapping", () => {
    const project = createNewProject();
    expect(unshotVideoModel({ ...project, defaultTakeIntent: "quality" })).toBe("seedance-2.5");
    expect(unshotVideoModel({ ...project, defaultTakeIntent: "balanced" })).toBe("wan-2.2-first-last-frame");
    expect(defaultTakeIntentFromProject({ videoModel: "pruna-p-video" })).toBe("fast");
  });

  it("falls back to the project video model when mappings are absent", () => {
    const project = { ...createNewProject(), videoModelsByIntent: undefined, videoModel: "kling-v2.5-turbo-pro" as const };
    expect(videoModelForIntent(project, "fast")).toBe("kling-v2.5-turbo-pro");
    expect(videoModelForIntent(project, "quality")).toBe("kling-v2.5-turbo-pro");
  });

  it("updates one intent mapping without renaming the filmmaking control", () => {
    const project = projectWithVideoModelForIntent(createNewProject(), "quality", "kling-v2.5-turbo-pro");
    expect(project.videoModelsByIntent?.quality).toBe("kling-v2.5-turbo-pro");
    expect(project.videoModel).toBe("pruna-p-video");
    expect(project.videoModelsByIntent?.fast).toBe("pruna-p-video");
  });

  it("marks Takes with the generation intent, not a quality rating", () => {
    expect(takeDisplayLabel({ number: 1, generationIntent: "fast" })).toBe(`TAKE 1 · ${GENERATION_INTENT_MARK.fast}`);
    expect(takeDisplayLabel({ number: 2, generationIntent: "quality" })).toBe(`TAKE 2 · ${GENERATION_INTENT_MARK.quality}`);
    expect(takeDisplayLabel({ number: 3 })).toBe("TAKE 3");
    expect(takeIntentTooltip({ generationIntent: "fast", model: "prunaai/p-video" })).toBe("Fast · Pruna");
    expect(takeIntentTooltip({ generationIntent: "quality", model: "bytedance/seedance-2.5" })).toBe("Quality · Seedance 2.5");
  });
});
