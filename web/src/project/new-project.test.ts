import { describe, expect, it } from "vitest";
import { createNewProject, createNewProjectFromSession } from "./new-project";
import { canProvideStartingFrame, hasAuthoritativeStartingFrame } from "./starting-frame";

describe("new product project", () => {
  it("starts as a partially specified movie with an unresolved opening slot", () => {
    const project = createNewProject();
    expect(project.id).toBe("untitled");
    expect(project.title).toBe("UNTITLED");
    expect(project.story).toBe("");
    expect(project.agency).toBe("directed");
    expect(project.construction).toBe("planned");
    expect(project.storyboard).toEqual([{ id: "A", label: "A", imageOrigin: "none" }]);
    expect(project.canonicalAspectRatio).toBeUndefined();
    expect(project.destinations).toEqual([]);
    expect(project.journeys).toEqual([]);
    expect(project.boundaryAnalysis).toBeUndefined();
    expect(project.storyDuration).toBe("auto");
    expect(project.autoGenerateOpening).toBe(true);
    expect(project.autoGenerateAllDestinations).toBe(false);
    expect(project.autoBlockShots).toBe(false);
    expect(project.autoShoot).toBe(false);
    expect(project.generateAudio).toBe(false);
    expect(project.pullForwardReferenceEnabled).toBe(true);
    expect(project.cameraGrammar).toBe("pov");
    expect(project.durationMode).toBe("adaptive");
    expect(project.fixedDurationSeconds).toBe(5);
    expect(project.videoModel).toBe("pruna-p-video");
    expect(project.defaultTakeIntent).toBe("fast");
    expect(project.videoModelsByIntent).toEqual({
      fast: "pruna-p-video",
      balanced: "kling-v2.5-turbo-pro",
      quality: "veo-3.1-fast",
    });
    expect(project.imageModel).toBe("nano-banana-2");
    expect(project.imageOutputFormat).toBe("png");
    expect(project.imageResolution).toBe("1K");
    expect(project.klingV3Mode).toBe("standard");
    expect(project.storyDurationLocked).toBe(false);
    expect(canProvideStartingFrame(project.storyboard[0]!)).toBe(true);
    expect(hasAuthoritativeStartingFrame(project)).toBe(false);
  });

  it("does not invent Forest destinations, journeys, media, or story", () => {
    const project = createNewProject();
    expect(project.story).not.toMatch(/forest/i);
    expect(JSON.stringify(project)).not.toMatch(/forest-a-to-f/i);
    expect(project.storyboard.every((frame) => !frame.image && !frame.mediaId)).toBe(true);
  });

  it("adopts the previous Agent project's settings without copying its journey", () => {
    const previous = {
      ...createNewProject(),
      id: "forest-a-to-f",
      title: "NightForest",
      story: "Travel the forest.",
      agency: "autonomous" as const,
      defaultTakeIntent: "quality" as const,
      imageModel: "nano-banana-2-lite" as const,
      imageOutputFormat: "jpg" as const,
      imageResolution: "2K" as const,
      cameraGrammar: "follow" as const,
      generateAudio: true,
      durationMode: "fixed" as const,
      fixedDurationSeconds: 8,
      videoModel: "kling-v2.5-turbo-pro" as const,
      videoModelsByIntent: {
        fast: "kling-v2.5-turbo-pro" as const,
        balanced: "kling-v2.5-turbo-pro" as const,
        quality: "seedance-2.5" as const,
      },
      pullForwardReferenceEnabled: false,
      autoGenerateAllDestinations: true,
      storyDuration: 6 as const,
      storyDurationLocked: true,
      storyboard: [
        { id: "A", label: "A", imageOrigin: "generated" as const, image: "/a.jpg" },
        { id: "B", label: "B", imageOrigin: "generated" as const, image: "/b.jpg" },
      ],
    };
    const next = createNewProjectFromSession(previous);
    expect(next.id).toBe("untitled");
    expect(next.title).toBe("UNTITLED");
    expect(next.story).toBe("");
    expect(next.storyboard).toEqual([{ id: "A", label: "A", imageOrigin: "none" }]);
    expect(next.journeys).toEqual([]);
    expect(next.storyDurationLocked).toBe(false);
    expect(next.defaultTakeIntent).toBe("quality");
    expect(next.imageModel).toBe("nano-banana-2-lite");
    expect(next.imageOutputFormat).toBe("jpg");
    expect(next.imageResolution).toBe("2K");
    expect(next.cameraGrammar).toBe("follow");
    expect(next.generateAudio).toBe(true);
    expect(next.durationMode).toBe("fixed");
    expect(next.fixedDurationSeconds).toBe(8);
    expect(next.videoModel).toBe("kling-v2.5-turbo-pro");
    expect(next.videoModelsByIntent).toEqual(previous.videoModelsByIntent);
    expect(next.videoModelsByIntent).not.toBe(previous.videoModelsByIntent);
    expect(next.pullForwardReferenceEnabled).toBe(false);
    expect(next.autoGenerateAllDestinations).toBe(true);
    expect(next.storyDuration).toBe(6);
  });
});
