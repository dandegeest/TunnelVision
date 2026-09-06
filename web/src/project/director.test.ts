import { afterEach, describe, expect, it, vi } from "vitest";
import { createWardrobeProject } from "../fixtures/wardrobe-loop";
import {
  authoritativeStartFrame,
  directorPlanRequestFromProject,
  requestDirectorPlan,
} from "./director";
import { TRUSTED_MEDIA_IDS } from "./trusted-media-id";
import type { Project } from "./types";

const payload = {
  story: "Make a first-person POV journey through an impossible world at night.",
  agency: "directed" as const,
  startFrameId: "A",
  startFrameIntent: "Inside the attic bedroom. Approach the open wardrobe.",
  startMediaId: TRUSTED_MEDIA_IDS.wardrobeLoopVisionA,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Director client boundary", () => {
  it("posts the story and starting frame, then returns structured Director output", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual(payload);
      return new Response(
        JSON.stringify({
          plan: {
            summary: "Leave through the wardrobe.",
            beats: [
              {
                id: "B",
                intent: "Enter the wardrobe.",
                visualDescription: "Dark coats, snow ahead.",
              },
            ],
          },
          evidence: {
            request: {
              story: payload.story,
              agency: "directed",
              startFrameId: "A",
              startFrameIntent: payload.startFrameIntent,
              startMediaId: payload.startMediaId,
              systemInstruction: "Director",
              prompt: "Plan forward",
            },
            rawText: '{"beats":[]}',
            model: "google/gemini-3.1-pro",
            modelVersion: null,
            predictionId: "pred-test",
            elapsedMs: 1200,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestDirectorPlan(payload);
    expect(fetchMock).toHaveBeenCalledWith("/api/director/plan", expect.objectContaining({ method: "POST" }));
    expect(result.plan.beats[0]?.intent).toBe("Enter the wardrobe.");
    expect(result.evidence.predictionId).toBe("pred-test");
  });

  it("fails visibly on invalid Director output instead of inventing beats", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ error: "Director JSON must include beats[]" }), {
          status: 502,
          headers: { "content-type": "application/json" },
        }),
    );
    await expect(requestDirectorPlan(payload)).rejects.toThrow(/beats\[\]/);
  });
});

describe("Director request from Project state", () => {
  it("identifies the filmmaker starting frame as the authoritative start", () => {
    const project = createWardrobeProject();
    const start = authoritativeStartFrame(project);
    expect(start?.id).toBe("A");
    expect(start?.imageOrigin).toBe("user");
    expect(start?.mediaId).toBe(TRUSTED_MEDIA_IDS.wardrobeLoopVisionA);
    expect(start?.image).toMatch(/canonical\/vision\/A\.jpg/i);
  });

  it("constructs the Director request from that starting-frame identity", () => {
    const project = createWardrobeProject();
    expect(directorPlanRequestFromProject(project)).toEqual({
      story: project.story,
      agency: project.agency,
      startFrameId: "A",
      startFrameIntent: project.storyboard[0]?.intent,
      startMediaId: TRUSTED_MEDIA_IDS.wardrobeLoopVisionA,
    });
  });

  it("follows a different Project media identity without changing request construction", () => {
    const project = createWardrobeProject();
    const otherStart: Project = {
      ...project,
      storyboard: project.storyboard.map((frame, index) =>
        index === 0 ? { ...frame, mediaId: "dev-test-trusted-media" } : frame,
      ),
    };
    expect(directorPlanRequestFromProject(otherStart).startMediaId).toBe("dev-test-trusted-media");
  });

  it("refuses to send a filesystem-looking identity", () => {
    const project = createWardrobeProject();
    const unsafe: Project = {
      ...project,
      storyboard: project.storyboard.map((frame, index) =>
        index === 0
          ? { ...frame, mediaId: "camotion/integration/wardrobe-loop-01/canonical/vision/A.jpg" }
          : frame,
      ),
    };
    expect(() => directorPlanRequestFromProject(unsafe)).toThrow(/trusted media identity/);
  });

  it("fails when the starting frame has no trusted media identity", () => {
    const project = createWardrobeProject();
    const missing: Project = {
      ...project,
      storyboard: project.storyboard.map((frame, index) =>
        index === 0 ? { ...frame, mediaId: undefined } : frame,
      ),
    };
    expect(() => directorPlanRequestFromProject(missing)).toThrow(/trusted media identity/);
  });
});
