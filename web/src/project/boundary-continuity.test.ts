import { describe, expect, it } from "vitest";
import { createForestProject, FOREST_BOUNDARY_ANALYSIS } from "../fixtures/forest-a-to-f";
import {
  boundaryContinuitiesForProject,
  boundaryContinuityAtSeam,
  classifyBoundaryMae,
} from "./boundary-continuity";
import type { Project } from "./types";

describe("boundary continuity", () => {
  it("classifies MAE with explicit heuristic bands", () => {
    expect(classifyBoundaryMae(1.22)).toBe("strong");
    expect(classifyBoundaryMae(2)).toBe("strong");
    expect(classifyBoundaryMae(2.1)).toBe("good");
    expect(classifyBoundaryMae(2.59)).toBe("good");
    expect(classifyBoundaryMae(4)).toBe("good");
    expect(classifyBoundaryMae(5)).toBe("review");
    expect(classifyBoundaryMae(8)).toBe("review");
    expect(classifyBoundaryMae(8.01)).toBe("mismatch");
  });

  it("exists only when both adjacent Journey videos are playable", () => {
    const complete = createForestProject();
    expect(boundaryContinuitiesForProject(complete).map((item) => item.sharedDestinationId)).toEqual([
      "B",
      "C",
      "D",
      "E",
    ]);

    const missingNext: Project = {
      ...complete,
      journeys: complete.journeys.map((journey) =>
        journey.id === "B-C"
          ? { ...journey, status: "planned" as const, videoUrl: undefined }
          : journey,
      ),
    };
    expect(boundaryContinuitiesForProject(missingNext).map((item) => item.sharedDestinationId)).toEqual(
      ["D", "E"],
    );
  });

  it("belongs to the shared destination seam, not either Journey alone", () => {
    const project = createForestProject();
    const continuities = boundaryContinuitiesForProject(project);
    const atB = boundaryContinuityAtSeam(continuities, "B", "A-B", "B-C");
    expect(atB?.previousJourneyId).toBe("A-B");
    expect(atB?.nextJourneyId).toBe("B-C");
    expect(boundaryContinuityAtSeam(continuities, "B", "A-B", null)).toBeUndefined();
    expect(boundaryContinuityAtSeam(continuities, "A", null, "A-B")).toBeUndefined();
    expect(boundaryContinuityAtSeam(continuities, "F", "E-F", null)).toBeUndefined();
  });

  it("preserves raw metrics and reports raster mismatch separately", () => {
    const project = createForestProject();
    const continuities = boundaryContinuitiesForProject(project);
    const b = continuities.find((item) => item.sharedDestinationId === "B");
    const c = continuities.find((item) => item.sharedDestinationId === "C");
    const measuredB = FOREST_BOUNDARY_ANALYSIS.find((item) => item.sharedDestinationId === "B");
    expect(b?.mae).toBe(measuredB?.mae);
    expect(b?.ssim).toBe(measuredB?.ssim);
    expect(b?.classification).toBe("strong");
    expect(b?.rasterMismatch).toBe(true);
    expect(b?.previousRaster).toEqual({ width: 1284, height: 716 });
    expect(b?.nextRaster).toEqual({ width: 1306, height: 706 });
    expect(c?.classification).toBe("good");
    expect(c?.rasterMismatch).toBe(false);
  });

  it("does not treat a high boundary score as traversal or shootability", () => {
    const project = createForestProject();
    const e = boundaryContinuitiesForProject(project).find((item) => item.sharedDestinationId === "E");
    const traversal = project.journeys.find((journey) => journey.id === "E-F");
    expect(e?.classification).toBe("strong");
    expect(e?.mae).toBeCloseTo(1.220785, 6);
    expect(traversal?.status).toBe("rendered");
    expect(e).not.toHaveProperty("shootability");
    expect(e).not.toHaveProperty("traversable");
    expect(JSON.stringify(e)).not.toMatch(/shootable|spatial continuity|seamless/i);
  });

  it("renders Forest fixture seam evidence from stored analysis, not UI constants", () => {
    const project = createForestProject();
    const byId = Object.fromEntries(
      boundaryContinuitiesForProject(project).map((item) => [item.sharedDestinationId, item]),
    );
    expect(byId.B?.mae).toBeCloseTo(1.843159, 6);
    expect(byId.C?.mae).toBeCloseTo(2.585173, 6);
    expect(byId.D?.mae).toBeCloseTo(2.094997, 6);
    expect(byId.E?.mae).toBeCloseTo(1.220785, 6);
    expect(byId.B?.classification).toBe("strong");
    expect(byId.C?.classification).toBe("good");
    expect(byId.D?.classification).toBe("good");
    expect(byId.E?.classification).toBe("strong");
  });
});
