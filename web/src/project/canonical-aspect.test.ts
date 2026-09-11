import { describe, expect, it } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { createNewProject } from "./new-project";
import {
  GENERATED_OPENING_ASPECT_RATIO,
  previewFrameAspectRatio,
  previewMonitorAspectRatio,
  projectCanonicalAspectRatio,
  projectWithCanonicalAspectRatio,
} from "./canonical-aspect";

describe("project canonical aspect ratio", () => {
  it("prefers the stored project value over A's pixels", () => {
    const forest = createForestProject();
    expect(projectCanonicalAspectRatio(forest)).toEqual({ width: 1000, height: 558 });
    const overridden = projectWithCanonicalAspectRatio(forest, { width: 16, height: 9 });
    expect(projectCanonicalAspectRatio(overridden)).toEqual({ width: 16, height: 9 });
  });

  it("falls back to generated opening 16:9 when A is generated without stored AR", () => {
    const project = {
      ...createNewProject(),
      storyboard: [
        {
          id: "A",
          label: "A",
          imageOrigin: "generated" as const,
          image: "/api/runtime-media/upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
    };
    expect(projectCanonicalAspectRatio(project)).toEqual(GENERATED_OPENING_ASPECT_RATIO);
  });

  it("is absent on an unresolved untitled opening", () => {
    expect(projectCanonicalAspectRatio(createNewProject())).toBeUndefined();
  });
});

describe("preview monitor aspect ratio", () => {
  it("uses the still's measured pixels, then two of those side by side", () => {
    const forest = createForestProject();
    expect(previewFrameAspectRatio(forest, "A")).toEqual({ width: 1000, height: 558 });
    expect(previewMonitorAspectRatio({ width: 800, height: 800 }, false)).toEqual({
      width: 800,
      height: 800,
    });
    expect(previewMonitorAspectRatio({ width: 800, height: 800 }, true)).toEqual({
      width: 1600,
      height: 800,
    });
  });

  it("falls back to generated 16:9 when the storyboard has no measured still", () => {
    expect(previewFrameAspectRatio(createNewProject())).toEqual(GENERATED_OPENING_ASPECT_RATIO);
  });
});
