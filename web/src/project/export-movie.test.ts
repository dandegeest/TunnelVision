import { describe, expect, it } from "vitest";
import { movieExportSlug, nextMovieExportFilename } from "./export-movie";

describe("movie export filename", () => {
  it("compacts the project name and starts at v1", () => {
    expect(movieExportSlug("Feather Flight")).toBe("FeatherFlight");
    expect(movieExportSlug("Chernobyl")).toBe("Chernobyl");
    expect(nextMovieExportFilename("Chernobyl")).toBe("Chernobyl_v1.mp4");
  });

  it("increments vN for the same slug", () => {
    expect(nextMovieExportFilename("Chernobyl", "Chernobyl_v1.mp4")).toBe("Chernobyl_v2.mp4");
    expect(nextMovieExportFilename("Chernobyl", "Chernobyl_v9.mp4")).toBe("Chernobyl_v10.mp4");
  });

  it("restarts at v1 when the project name changes", () => {
    expect(nextMovieExportFilename("Pripyat", "Chernobyl_v3.mp4")).toBe("Pripyat_v1.mp4");
  });

  it("truncates a long name to 32 characters", () => {
    const title = "AVeryLongTunnelVisionProjectNameThatShouldTruncate";
    expect(movieExportSlug(title)).toHaveLength(32);
    expect(nextMovieExportFilename(title)).toBe(`${title.slice(0, 32)}_v1.mp4`);
  });
});
