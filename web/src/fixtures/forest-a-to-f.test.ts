import { describe, expect, it } from "vitest";
import { directorPlanRequestFromProject } from "../project/director";
import { mediaPreflightForProject } from "../project/media-preflight";
import { boundaryContinuitiesForProject } from "../project/boundary-continuity";
import { journeyIsPlayable } from "../project/policy";
import { TRUSTED_MEDIA_IDS } from "../project/trusted-media-id";
import { createForestProject, createForestPartialAnchorProject, FOREST_STORYBOARD_INTENTS, FOREST_USER_PROMPT } from "./forest-a-to-f";

describe("forest A→F development fixture", () => {
  const project = createForestProject();

  it("represents the completed A→F journey with actual destinations and clips", () => {
    expect(project.id).toBe("forest-a-to-f");
    expect(project.title).toBe("FOREST A→F");
    expect(project.story).toBe(FOREST_USER_PROMPT);
    expect(project.destinations.map((destination) => destination.id)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
    ]);
    expect(project.destinations.every((destination) => destination.status === "ready")).toBe(true);
    expect(project.journeys.map((journey) => journey.id)).toEqual([
      "A-B",
      "B-C",
      "C-D",
      "D-E",
      "E-F",
    ]);
    expect(project.journeys.every((journey) => journey.status === "rendered")).toBe(true);
    expect(project.journeys.every((journey) => journeyIsPlayable(journey))).toBe(true);
  });

  it("keeps A as filmmaker-provided and B–F as sequentially derived stills", () => {
    expect(project.storyboard.map((frame) => frame.id)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(project.storyboard[0]?.imageOrigin).toBe("user");
    expect(project.storyboard[0]?.mediaId).toBe(TRUSTED_MEDIA_IDS.forestAtoFA);
    expect(project.storyboard.slice(1).every((frame) => frame.imageOrigin === "generated")).toBe(true);
    expect(project.storyboard.slice(1).map((frame) => frame.mediaId)).toEqual([
      TRUSTED_MEDIA_IDS.forestAtoFB,
      TRUSTED_MEDIA_IDS.forestAtoFC,
      TRUSTED_MEDIA_IDS.forestAtoFD,
      TRUSTED_MEDIA_IDS.forestAtoFE,
      TRUSTED_MEDIA_IDS.forestAtoFF,
    ]);
    expect(project.storyboard.every((frame) => frame.destinationId === frame.id)).toBe(true);
    expect(project.storyboard[0]?.intent).toBe(FOREST_STORYBOARD_INTENTS.A);
  });

  it("carries canonical media metadata so Plan preflight can derive A vs B–F", () => {
    expect(project.storyboard[0]?.mediaInfo).toEqual({ width: 1000, height: 558, format: "jpeg" });
    expect(
      project.storyboard.slice(1).every((frame) =>
        frame.mediaInfo?.width === 1392 &&
        frame.mediaInfo.height === 752 &&
        frame.mediaInfo.format === "png",
      ),
    ).toBe(true);
    expect(mediaPreflightForProject(project).warningCount).toBe(1);
  });

  it("holds measured seam analysis for Shoot without implying E→F was a successful traversal", () => {
    const seams = boundaryContinuitiesForProject(project);
    expect(seams).toHaveLength(4);
    expect(seams.every((seam) => seam.metricVersion === "forest-a-to-f-boundary-analysis-v1")).toBe(
      true,
    );
    expect(directorPlanRequestFromProject(project).startMediaId).toBe(TRUSTED_MEDIA_IDS.forestAtoFA);
    expect(directorPlanRequestFromProject(project).startMediaId).not.toMatch(/[/\\]/);
  });

  it("keeps a partial-anchor variant with A, D, and F specified and B, C, E unresolved", () => {
    const complete = createForestProject();
    const partial = createForestPartialAnchorProject();
    expect(partial.storyboard.map((frame) => frame.id)).toEqual(["A", "D", "F"]);
    expect(partial.storyboard[0]).toEqual(complete.storyboard[0]);
    expect(partial.storyboard[1]).toEqual(complete.storyboard[3]);
    expect(partial.storyboard[2]).toEqual(complete.storyboard[5]);
    expect(partial.story).toBe(FOREST_USER_PROMPT);
    expect(directorPlanRequestFromProject(partial).anchors?.map((anchor) => anchor.id)).toEqual([
      "A",
      "D",
      "F",
    ]);
    expect(createForestProject().storyboard.map((frame) => frame.id)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
    ]);
  });
});
