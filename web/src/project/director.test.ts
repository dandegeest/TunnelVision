import { afterEach, describe, expect, it, vi } from "vitest";
import { createWardrobeProject, WARDROBE_USER_PROMPT } from "../fixtures/wardrobe-loop";
import {
  authoritativeStartFrame,
  directorPlanRequestFromProject,
  requestDirectorPlan,
} from "./director";
import { projectWithDirectorPlan } from "./storyboard";
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
    expect(result.plan.summary).toBe("Leave through the wardrobe.");
    expect(result.plan.beats[0]?.intent).toBe("Enter the wardrobe.");
    expect(result.evidence.predictionId).toBe("pred-test");
    expect(fetchMock).toHaveBeenCalledOnce();
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

  it("initializes from the Wardrobe story but uses current Project.story at request time", () => {
    const project = createWardrobeProject();
    expect(project.story).toBe(WARDROBE_USER_PROMPT);
    expect(directorPlanRequestFromProject(project).story).toBe(WARDROBE_USER_PROMPT);

    const edited: Project = {
      ...project,
      story: "Travel forward through a quiet abandoned greenhouse at night.",
    };
    expect(directorPlanRequestFromProject(edited).story).toBe(
      "Travel forward through a quiet abandoned greenhouse at night.",
    );
    expect(directorPlanRequestFromProject(edited).story).not.toBe(WARDROBE_USER_PROMPT);
  });

  it("refuses an empty or whitespace-only story", () => {
    const project = createWardrobeProject();
    expect(() => directorPlanRequestFromProject({ ...project, story: "" })).toThrow(
      /filmmaker story/i,
    );
    expect(() => directorPlanRequestFromProject({ ...project, story: "   \n" })).toThrow(
      /filmmaker story/i,
    );
  });

  it("sends the edited story on re-plan without substituting the Wardrobe prompt", () => {
    const project = createWardrobeProject();
    const first = projectWithDirectorPlan(project, {
      summary: "A planned journey.",
      beats: [
        { id: "B", intent: "Old wardrobe beat.", visualDescription: "Old coats." },
        { id: "C", intent: "Old forest beat.", visualDescription: "Old trees." },
      ],
    });
    const edited: Project = {
      ...first,
      story: "Continue through a flooded courtyard toward a warm-lit workshop.",
    };
    const request = directorPlanRequestFromProject(edited);
    expect(request.story).toBe("Continue through a flooded courtyard toward a warm-lit workshop.");
    expect(request.story).not.toBe(WARDROBE_USER_PROMPT);
    expect(request.startMediaId).toBe(TRUSTED_MEDIA_IDS.wardrobeLoopVisionA);

    const second = projectWithDirectorPlan(edited, {
      summary: "A revised courtyard journey.",
      beats: [
        { id: "B", intent: "New greenhouse beat.", visualDescription: "Broken glass." },
        { id: "C", intent: "New courtyard beat.", visualDescription: "Flooded stone." },
        { id: "D", intent: "New workshop beat.", visualDescription: "Warm light." },
      ],
    });
    expect(second.story).toBe(edited.story);
    expect(second.storyboard[0]).toEqual(project.storyboard[0]);
    expect(second.storyboard.map((frame) => frame.id)).toEqual(["A", "B", "C", "D"]);
    expect(second.storyboard.slice(1).map((frame) => frame.intent)).toEqual([
      "New greenhouse beat.",
      "New courtyard beat.",
      "New workshop beat.",
    ]);
    expect(second.destinations).toEqual(project.destinations);
    expect(second.journeys).toEqual(project.journeys);
  });
});
