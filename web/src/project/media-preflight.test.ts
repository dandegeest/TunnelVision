import { afterEach, describe, expect, it, vi } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { createWardrobeProject } from "../fixtures/wardrobe-loop";
import {
  ASPECT_RELATIVE_TOLERANCE,
  aspectsAgree,
  compactFrameLabels,
  displayProvenanceForFrame,
  formatFriendlyAspectRatio,
  formatMediaInfoLine,
  mediaFormatFromFile,
  mediaPreflightForProject,
  readStoryboardMediaInfo,
  readStoryboardMediaInfoFromUrl,
  preflightWarningsForFrame,
  provenanceAccessibleLabel,
} from "./media-preflight";
import type { Project, StoryboardFrame, StoryboardMediaInfo } from "./types";

const JPEG_HD: StoryboardMediaInfo = { width: 1920, height: 1080, format: "jpeg" };
const JPEG_720: StoryboardMediaInfo = { width: 1280, height: 720, format: "jpeg" };
const PNG_HD: StoryboardMediaInfo = { width: 1920, height: 1080, format: "png" };
const JPEG_FOREST_A: StoryboardMediaInfo = { width: 1000, height: 558, format: "jpeg" };
const PNG_FOREST: StoryboardMediaInfo = { width: 1392, height: 752, format: "png" };

function actualFrame(
  id: string,
  mediaInfo: StoryboardMediaInfo,
  extras: Partial<StoryboardFrame> = {},
): StoryboardFrame {
  return {
    id,
    label: id,
    image: `${id}.bin`,
    imageOrigin: extras.imageOrigin ?? "generated",
    mediaInfo,
    ...extras,
  };
}

function projectWith(storyboard: StoryboardFrame[]): Project {
  return {
    ...createWardrobeProject(),
    id: "preflight-test",
    storyboard,
  };
}

describe("media preflight", () => {
  it("treats matching aspect, format, and dimensions as healthy", () => {
    const report = mediaPreflightForProject(
      projectWith([
        actualFrame("A", JPEG_HD, { imageOrigin: "user" }),
        actualFrame("B", JPEG_HD),
      ]),
    );
    expect(report.findings).toEqual([]);
    expect(report.warningCount).toBe(0);
    expect(report.infoCount).toBe(0);
  });

  it("reports different resolution at the same aspect as informational", () => {
    const report = mediaPreflightForProject(
      projectWith([
        actualFrame("A", JPEG_HD, { imageOrigin: "user" }),
        actualFrame("B", JPEG_720),
      ]),
    );
    expect(report.findings.map((finding) => finding.kind)).toEqual(["resolution"]);
    expect(report.findings[0]?.severity).toBe("info");
    expect(report.warningCount).toBe(0);
  });

  it("warns when aspect ratios differ meaningfully", () => {
    const report = mediaPreflightForProject(
      projectWith([
        actualFrame("A", JPEG_FOREST_A, { imageOrigin: "user" }),
        actualFrame("B", PNG_FOREST),
      ]),
    );
    const aspect = report.findings.find((finding) => finding.kind === "aspect");
    expect(aspect?.severity).toBe("warning");
    expect(report.warningCount).toBe(1);
  });

  it("reports format mismatch as informational", () => {
    const report = mediaPreflightForProject(
      projectWith([
        actualFrame("A", JPEG_HD, { imageOrigin: "user" }),
        actualFrame("B", PNG_HD),
      ]),
    );
    expect(report.findings.map((finding) => finding.kind)).toEqual(["format"]);
    expect(report.findings[0]?.severity).toBe("info");
    expect(report.warningCount).toBe(0);
  });

  it("does not warn on tiny numerical aspect differences", () => {
    expect(aspectsAgree(1920 / 1080, 1920 / 1081, ASPECT_RELATIVE_TOLERANCE)).toBe(true);
    const report = mediaPreflightForProject(
      projectWith([
        actualFrame("A", JPEG_HD, { imageOrigin: "user" }),
        actualFrame("B", { width: 1920, height: 1081, format: "jpeg" }),
      ]),
    );
    expect(report.findings.some((finding) => finding.kind === "aspect")).toBe(false);
    expect(report.findings.some((finding) => finding.kind === "resolution")).toBe(true);
    expect(report.warningCount).toBe(0);
  });

  it("ignores missing and unconstructed storyboard frames", () => {
    const report = mediaPreflightForProject(
      projectWith([
        actualFrame("A", JPEG_FOREST_A, { imageOrigin: "user" }),
        { id: "B", label: "B", imageOrigin: "none", intent: "Not yet constructed." },
        {
          id: "C",
          label: "C",
          imageOrigin: "generated",
          mediaInfo: PNG_FOREST,
        },
      ]),
    );
    expect(report.findings).toEqual([]);
  });

  it("derives Forest A vs B–F findings from metadata, not a fixture special case", () => {
    const report = mediaPreflightForProject(createForestProject());
    expect(report.warningCount).toBe(1);
    expect(report.infoCount).toBe(2);
    const aspect = report.findings.find((finding) => finding.kind === "aspect");
    expect(aspect?.groups.map((group) => compactFrameLabels(group.labels))).toEqual(["A", "B–F"]);
    expect(aspect?.groups[0]).toMatchObject({ width: 1000, height: 558, format: "jpeg" });
    expect(aspect?.groups[1]).toMatchObject({ width: 1392, height: 752, format: "png" });
    expect(report.findings.some((finding) => finding.kind === "resolution")).toBe(true);
    expect(report.findings.some((finding) => finding.kind === "format")).toBe(true);
  });

  it("reads jpeg/png/webp from MIME type", () => {
    expect(mediaFormatFromFile({ type: "image/jpeg" })).toBe("jpeg");
    expect(mediaFormatFromFile({ type: "image/png", name: "x.webp" })).toBe("png");
    expect(mediaFormatFromFile({ type: "image/webp" })).toBe("webp");
  });

  it("formats filmmaker-readable aspect ratios without false precision", () => {
    expect(formatFriendlyAspectRatio(1920, 1080)).toBe("16:9");
    expect(formatFriendlyAspectRatio(1280, 720)).toBe("16:9");
    expect(formatFriendlyAspectRatio(1000, 558)).toBe("~16:9");
    expect(formatFriendlyAspectRatio(1392, 752)).toBe("~1.85:1");
    expect(formatFriendlyAspectRatio(1000, 1000)).toBe("1:1");
    expect(formatFriendlyAspectRatio(1234, 789)).toBe("~1.56:1");
    expect(formatMediaInfoLine(JPEG_FOREST_A)).toBe("~16:9 · 1000×558 · JPG");
    expect(formatMediaInfoLine(PNG_FOREST)).toBe("~1.85:1 · 1392×752 · PNG");
  });

  it("maps stored origin to filmmaker provenance without inventing construction modes", () => {
    expect(displayProvenanceForFrame(actualFrame("A", JPEG_FOREST_A, { imageOrigin: "user" }))).toBe(
      "uploaded",
    );
    expect(displayProvenanceForFrame(actualFrame("B", PNG_FOREST))).toBe("derived");
    expect(provenanceAccessibleLabel("uploaded")).toBe("Uploaded frame");
    expect(provenanceAccessibleLabel("derived")).toBe("Derived destination");
    expect(provenanceAccessibleLabel("generated")).toBe("Generated frame");
    expect(provenanceAccessibleLabel("discovered")).toBe("Discovered destination");
  });

  it("places aspect warnings on the outlier frame, not informational differences", () => {
    const forest = mediaPreflightForProject(createForestProject());
    const atA = preflightWarningsForFrame(forest, "A");
    expect(atA).toHaveLength(1);
    expect(atA[0]?.title).toBe("Aspect ratio differs");
    expect(atA[0]?.detail).toContain("A is ~16:9 (1000×558).");
    expect(atA[0]?.detail).toContain("Other storyboard frames are ~1.85:1.");
    expect(preflightWarningsForFrame(forest, "B")).toEqual([]);
    expect(preflightWarningsForFrame(forest, "F")).toEqual([]);

    const sameAspect = mediaPreflightForProject(
      projectWith([
        actualFrame("A", JPEG_HD, { imageOrigin: "user" }),
        actualFrame("B", JPEG_720),
      ]),
    );
    expect(sameAspect.findings.some((finding) => finding.kind === "resolution")).toBe(true);
    expect(preflightWarningsForFrame(sameAspect, "A")).toEqual([]);
    expect(preflightWarningsForFrame(sameAspect, "B")).toEqual([]);
  });
});

const PNG_1X1 = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (char) => char.charCodeAt(0),
);

describe("storyboard media facts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads png dimensions from a blob even without a filename", async () => {
    vi.stubGlobal("createImageBitmap", async () => ({ width: 1, height: 1, close() {} }));
    const info = await readStoryboardMediaInfo(new Blob([PNG_1X1], { type: "image/png" }));
    expect(info).toEqual({ width: 1, height: 1, format: "png" });
  });

  it("reads generated stills from a fetchable image URL without a file extension", async () => {
    vi.stubGlobal("createImageBitmap", async () => ({ width: 1392, height: 752, close() {} }));
    vi.stubGlobal("fetch", async () =>
      new Response(PNG_1X1, { headers: { "content-type": "image/png" } }),
    );
    const info = await readStoryboardMediaInfoFromUrl("/api/runtime-media/upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(info).toEqual({ width: 1392, height: 752, format: "png" });
  });

  it("decodes a displayable URL when fetch is unavailable", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("blocked");
    });
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = 1024;
        naturalHeight = 576;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    const info = await readStoryboardMediaInfoFromUrl("https://cdn.example/generated.png");
    expect(info).toEqual({ width: 1024, height: 576, format: "png" });
  });
});
