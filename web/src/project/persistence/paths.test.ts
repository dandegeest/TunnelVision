import { describe, expect, it } from "vitest";
import {
  displayProjectPath,
  isSafeProjectRelativePath,
  sanitizeProjectFolderName,
  uniqueProjectFolderName,
  takeAssetName,
} from "./paths";

describe("project folder names", () => {
  it("sanitizes unsafe filesystem characters", () => {
    expect(sanitizeProjectFolderName("Glowing Koi")).toBe("GlowingKoi");
    expect(sanitizeProjectFolderName("a/b\\c:d*e?f\"g<h>i|j")).toBe("abcdefghij");
    expect(sanitizeProjectFolderName("   ")).toBe("Untitled");
    expect(sanitizeProjectFolderName("CON")).toBe("Untitled");
  });

  it("allocates a predictable suffix when the folder already exists", () => {
    expect(uniqueProjectFolderName("Glowing Koi", ["GlowingKoi"])).toBe("GlowingKoi2");
    expect(uniqueProjectFolderName("Glowing Koi", ["GlowingKoi", "GlowingKoi2"])).toBe("GlowingKoi3");
    expect(uniqueProjectFolderName("Glowing Koi", ["other"])).toBe("GlowingKoi");
    expect(uniqueProjectFolderName("GlowingKoi", [])).toBe("GlowingKoi");
  });

  it("pads take filenames", () => {
    expect(takeAssetName(1, "png")).toBe("take-01.png");
    expect(takeAssetName(12, ".mp4")).toBe("take-12.mp4");
  });

  it("rejects path escape", () => {
    expect(isSafeProjectRelativePath("canonicals/A/take-01.png")).toBe(true);
    expect(isSafeProjectRelativePath("../secret")).toBe(false);
    expect(isSafeProjectRelativePath("/etc/passwd")).toBe(false);
  });

  it("shows a project path relative to the Projects Folder when it is inside", () => {
    expect(displayProjectPath("/Users/me/Projects/PaperChase", "/Users/me/Projects")).toBe("PaperChase");
    expect(displayProjectPath("/Users/me/Projects/PaperChase/", "/Users/me/Projects/")).toBe("PaperChase");
    expect(displayProjectPath("/Users/me/Projects/nested/PaperChase", "/Users/me/Projects")).toBe(
      "nested/PaperChase",
    );
  });

  it("keeps the absolute path when the project is not under the Projects Folder", () => {
    expect(displayProjectPath("/Users/me/Other/PaperChase", "/Users/me/Projects")).toBe(
      "/Users/me/Other/PaperChase",
    );
    expect(displayProjectPath("/Users/me/Projects-other/X", "/Users/me/Projects")).toBe(
      "/Users/me/Projects-other/X",
    );
    expect(displayProjectPath("/Users/me/Projects/PaperChase", null)).toBe("/Users/me/Projects/PaperChase");
    expect(displayProjectPath("/Users/me/Projects", "/Users/me/Projects")).toBe("/Users/me/Projects");
  });
});
