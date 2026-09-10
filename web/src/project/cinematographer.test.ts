import { afterEach, describe, expect, it, vi } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { createWardrobeProject } from "../fixtures/wardrobe-loop";
import {
  canAssessJourney,
  cinematographerRequestFromProject,
  cinematographerShootabilityLabel,
  cinematographerShootabilityTileLabel,
  locomotionPaceLabel,
  journeyLegStatusLabel,
  journeySegmentAriaLabel,
  journeySegmentCaption,
  footageBandAriaLabel,
  footageBandCaption,
  motionBandAriaLabel,
  journeysReadyToBlock,
  projectWithCinematographerAssessment,
  requestCinematographerAssessment,
} from "./cinematographer";
import { directorPlanRequestFromProject } from "./director";
import { journeyIsPlayable } from "./policy";
import { TRUSTED_MEDIA_IDS } from "./trusted-media-id";
import type { CinematographerAssessment, Project } from "./types";

const shootableAB: CinematographerAssessment = {
  shootability: "shootable",
  summary: "Walk through the root gateway into the darker mouth.",
  route: "Advance along the forest path and pass through the trunk opening.",
  threshold: "The dark root-mouth opening slightly right of center.",
  camera: "Track forward along the path, passing between near trunks toward the opening.",
  parallax: "Near trunks the camera can pass beside.",
  transitionStrategy: "Pass through the visible gateway so near trunks sweep past the lens.",
  segmentPromptAddition:
    "Track forward along the path, pass between the near trunks, and move through the visible opening toward the darker mouth.",
  pace: "fast",
  camotionSuitability: "appropriate",
  concerns: [],
};

function withFpoB(project: Project): Project {
  return {
    ...project,
    storyboard: project.storyboard.map((frame) =>
      frame.id === "B"
        ? { id: "B", label: "B", imageOrigin: "none" as const, intent: frame.intent }
        : frame,
    ),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Cinematographer actual-set assessment", () => {
  it("can analyze a Forest journey with two actual endpoints", () => {
    const project = createForestProject();
    const journey = project.journeys.find((item) => item.id === "A-B")!;
    expect(canAssessJourney(project, journey)).toBe(true);
    expect(cinematographerRequestFromProject(project, "A-B")).toEqual({
      journeyId: "A-B",
      startDestinationId: "A",
      endDestinationId: "B",
      startMediaId: TRUSTED_MEDIA_IDS.forestAtoFA,
      endMediaId: TRUSTED_MEDIA_IDS.forestAtoFB,
      startIntent: project.storyboard[0]?.intent,
      endIntent: project.storyboard[1]?.intent,
      story: project.story,
    });
    expect(journeysReadyToBlock(project).some((journey) => journey.id === "A-B")).toBe(true);
    expect(
      journeysReadyToBlock(projectWithCinematographerAssessment(project, "A-B", shootableAB)).some(
        (journey) => journey.id === "A-B",
      ),
    ).toBe(true);
  });

  it("posts trusted media identities rather than filesystem paths", async () => {
    const project = createForestProject();
    const request = cinematographerRequestFromProject(project, "A-B");
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual(request);
      expect(request.startMediaId).not.toMatch(/[/\\]/);
      expect(request.endMediaId).not.toMatch(/[/\\]/);
      return new Response(JSON.stringify({ assessment: shootableAB }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await requestCinematographerAssessment(request);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cinematographer/assess",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.assessment.shootability).toBe("shootable");
  });

  it("cannot analyze a leg whose end is still FPO", () => {
    const project = withFpoB(createForestProject());
    const journey = project.journeys.find((item) => item.id === "A-B")!;
    expect(canAssessJourney(project, journey)).toBe(false);
    expect(() => cinematographerRequestFromProject(project, "A-B")).toThrow(
      /two actual destinations/i,
    );
  });

  it("stores the structured assessment on the JourneyShot only", () => {
    const project = createForestProject();
    const destinations = project.destinations;
    const storyboard = project.storyboard;
    const next = projectWithCinematographerAssessment(project, "A-B", shootableAB);
    expect(next.journeys.find((journey) => journey.id === "A-B")?.cinematographer).toEqual(
      shootableAB,
    );
    expect(next.destinations).toEqual(destinations);
    expect(next.storyboard).toEqual(storyboard);
    expect(next.journeys.find((journey) => journey.id === "B-C")?.cinematographer).toBeUndefined();
    expect(next.journeys.find((journey) => journey.id === "A-B")?.videoUrl).toBe(
      project.journeys[0]?.videoUrl,
    );
    expect(project.journeys.find((journey) => journey.id === "A-B")?.status).toBe("rendered");
    expect(next.journeys.find((journey) => journey.id === "A-B")?.status).toBe("rendered");
  });

  it("replaces the previous Cinematographer result on reassessment", () => {
    const first = projectWithCinematographerAssessment(createForestProject(), "A-B", shootableAB);
    const replacement: CinematographerAssessment = {
      ...shootableAB,
      summary: "Revised: stay on the center line through the opening.",
      camera: "Push straight forward through the visible opening.",
      segmentPromptAddition: "Push straight forward through the visible opening toward the darker mouth.",
    };
    const next = projectWithCinematographerAssessment(first, "A-B", replacement);
    expect(next.journeys.find((journey) => journey.id === "A-B")?.cinematographer).toEqual(replacement);
    expect(first.journeys.find((journey) => journey.id === "A-B")?.cinematographer).toEqual(shootableAB);
  });

  it("maps inspector shootability without replacing operational status, and uses the filmmaking ladder on the tile", () => {
    expect(cinematographerShootabilityLabel("shootable")).toBe("Ready");
    expect(cinematographerShootabilityLabel("needs_review")).toBe("Needs review");
    expect(cinematographerShootabilityLabel("not_shootable")).toBe("Not shootable");
    expect(cinematographerShootabilityTileLabel("shootable")).toBe("clear");
    expect(cinematographerShootabilityTileLabel("needs_review")).toBe("hold");
    expect(cinematographerShootabilityTileLabel("not_shootable")).toBe("no go");
    expect(locomotionPaceLabel("slow-motion")).toBe("Slow-motion");
    expect(locomotionPaceLabel("slow")).toBe("Slow");
    expect(locomotionPaceLabel("fast")).toBe("Fast");
    expect(locomotionPaceLabel("hyperspeed")).toBe("Hyperspeed");
    expect(locomotionPaceLabel("variable")).toBe("Variable");
    const rendered = createForestProject().journeys[0]!;
    expect(rendered.status).toBe("rendered");
    expect(journeyLegStatusLabel(rendered)).toBe("Export");
    expect(journeyLegStatusLabel({ ...rendered, cinematographer: shootableAB })).toBe("Export");
    expect(
      journeyLegStatusLabel({
        ...rendered,
        cinematographer: { ...shootableAB, shootability: "needs_review" },
      }),
    ).toBe("Export");
    expect(
      journeyLegStatusLabel({
        ...rendered,
        cinematographer: { ...shootableAB, shootability: "not_shootable" },
      }),
    ).toBe("Export");
    const unblocked = {
      ...rendered,
      status: "ready" as const,
      cinematographer: undefined,
      videoUrl: undefined,
      take: undefined,
    };
    expect(journeyLegStatusLabel(unblocked)).toBe("Stage");
    expect(journeySegmentCaption(unblocked)).toBe("Stage");
    expect(journeySegmentAriaLabel(unblocked)).toBe("Motion A-B");
    expect(motionBandAriaLabel(unblocked)).toBe("Motion A-B");
    expect(footageBandCaption(unblocked)).toBe("—");
    expect(footageBandAriaLabel(unblocked)).toBe("Footage A-B");
    const blocked = { ...unblocked, cinematographer: shootableAB };
    expect(journeyLegStatusLabel(blocked)).toBe("Film");
    expect(journeySegmentCaption(blocked)).toBe("Film · clear");
    expect(journeySegmentAriaLabel(blocked)).toBe("Motion A-B");
    expect(journeySegmentAriaLabel({ ...blocked, cinematographer: { ...shootableAB, shootability: "needs_review" } })).toBe(
      "Motion A-B",
    );
    expect(
      journeySegmentAriaLabel({
        ...blocked,
        cinematographer: { ...shootableAB, pace: "slow-motion" },
      }),
    ).toBe("Motion A-B");
    expect(
      journeySegmentAriaLabel({
        ...blocked,
        cinematographer: { ...shootableAB, pace: "variable" },
      }),
    ).toBe("Motion A-B");
    expect(journeyLegStatusLabel({ ...blocked, status: "shooting" })).toBe("Film");
    expect(footageBandCaption({ ...blocked, status: "shooting" })).toBe("Generating…");
    expect(footageBandAriaLabel({ ...blocked, status: "shooting" })).toBe("Footage A-B");
    expect(journeySegmentCaption({ ...rendered, cinematographer: shootableAB })).toBe("Film · clear");
    expect(footageBandCaption({ ...rendered, cinematographer: shootableAB })).toBe("Take");
    expect(footageBandAriaLabel({ ...rendered, cinematographer: shootableAB })).toBe("Footage A-B");
  });

  it("does not gate JourneyShot progression when CM says not_shootable", () => {
    const project = createForestProject();
    const next = projectWithCinematographerAssessment(project, "A-B", {
      ...shootableAB,
      shootability: "not_shootable",
      summary: "No clear corridor, but still describe a forward move.",
    });
    const journey = next.journeys.find((item) => item.id === "A-B")!;
    expect(journey.status).toBe("rendered");
    expect(journey.cinematographer?.shootability).toBe("not_shootable");
    expect(journeyIsPlayable(journey)).toBe(true);
  });

  it("does not mutate either canonical destination", () => {
    const project = createForestProject();
    const start = { ...project.destinations[0]! };
    const end = { ...project.destinations[1]! };
    const next = projectWithCinematographerAssessment(project, "C-D", {
      ...shootableAB,
      shootability: "needs_review",
      summary: "The pair tends to replace C rather than enter D.",
    });
    expect(next.destinations[0]).toEqual(start);
    expect(next.destinations[1]).toEqual(end);
    expect(next.destinations.find((destination) => destination.id === "C")).toEqual(
      project.destinations.find((destination) => destination.id === "C"),
    );
    expect(next.destinations.find((destination) => destination.id === "D")).toEqual(
      project.destinations.find((destination) => destination.id === "D"),
    );
  });

  it("leaves Director / Plan request construction unchanged", () => {
    const project = createForestProject();
    const before = directorPlanRequestFromProject(project);
    const next = projectWithCinematographerAssessment(project, "A-B", shootableAB);
    expect(directorPlanRequestFromProject(next)).toEqual(before);
    expect(directorPlanRequestFromProject(createWardrobeProject()).startMediaId).toBe(
      TRUSTED_MEDIA_IDS.wardrobeLoopVisionA,
    );
  });
});
