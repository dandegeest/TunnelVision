import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createForestPartialAnchorProject,
  createForestProject,
  FOREST_STORYBOARD_INTENTS,
} from "../fixtures/forest-a-to-f";
import { createWardrobeProject, WARDROBE_USER_PROMPT } from "../fixtures/wardrobe-loop";
import { createNewProject } from "./new-project";
import {
  authoritativeStartFrame,
  directorPlanRequestFromProject,
  requestDirectorPlan,
} from "./director";
import { projectWithDirectorPlan } from "./storyboard";
import { TRUSTED_MEDIA_IDS } from "./trusted-media-id";
import type { Project } from "./types";
import { directorUserPrompt } from "../../../media/src/director/prompts";

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
      storyDuration: "auto",
      storyboard: [
        {
          id: "A",
          label: "A",
          specified: true,
          intent: project.storyboard[0]?.intent,
          mediaId: TRUSTED_MEDIA_IDS.wardrobeLoopVisionA,
        },
      ],
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
    expect(request.anchors).toBeUndefined();

    const second = projectWithDirectorPlan(edited, {
      summary: "A revised courtyard journey.",
      beats: [
        { id: "B", intent: "New greenhouse beat.", visualDescription: "Broken glass." },
        { id: "C", intent: "New courtyard beat.", visualDescription: "Flooded stone." },
      ],
    });
    expect(second.story).toBe(edited.story);
    expect(second.storyboard[0]).toEqual(project.storyboard[0]);
    expect(second.storyboard.map((frame) => frame.id)).toEqual(["A", "B", "C"]);
    expect(second.storyboard.slice(1).map((frame) => frame.intent)).toEqual([
      "New greenhouse beat.",
      "New courtyard beat.",
    ]);
    expect(second.destinations).toEqual(project.destinations);
    expect(second.journeys).toEqual(project.journeys);
  });

  it("lists existing A, D, and F as authoritative anchors without assuming they are user-provided", () => {
    const project = createForestPartialAnchorProject();
    const request = directorPlanRequestFromProject(project);
    expect(request.startMediaId).toBe(TRUSTED_MEDIA_IDS.forestAtoFA);
    expect(request.anchors?.map((anchor) => anchor.id)).toEqual(["A", "D", "F"]);
    expect(request.anchors?.[0]).toMatchObject({
      id: "A",
      label: "A",
      intent: FOREST_STORYBOARD_INTENTS.A,
      mediaId: TRUSTED_MEDIA_IDS.forestAtoFA,
    });
    expect(request.anchors?.[1]).toMatchObject({
      id: "D",
      label: "D",
      intent: FOREST_STORYBOARD_INTENTS.D,
      mediaId: TRUSTED_MEDIA_IDS.forestAtoFD,
    });
    expect(request.anchors?.[2]).toMatchObject({
      id: "F",
      label: "F",
      intent: FOREST_STORYBOARD_INTENTS.F,
      mediaId: TRUSTED_MEDIA_IDS.forestAtoFF,
    });
    const prompt = directorUserPrompt(request);
    expect(prompt).toMatch(/Complete ordered storyboard/);
    expect(prompt).toMatch(/Image 2 is this destination/);
    expect(prompt).toMatch(/Image 3 is this destination/);
    expect(prompt).toMatch(/All listed destinations are actual/);
    expect(prompt).toMatch(/Intent: Root tunnel with a large glowing crystal/);
    expect(prompt).not.toMatch(/Plan the subsequent spatially traversable beats from this opening/);
  });

  it("does not treat a generated-only continuation as anchors on re-plan", () => {
    const project = createWardrobeProject();
    expect(directorPlanRequestFromProject(project).anchors).toBeUndefined();
    const planned = projectWithDirectorPlan(project, {
      summary: "A planned journey.",
      beats: [
        { id: "B", intent: "Enter the wardrobe.", visualDescription: "Dark coats." },
        { id: "C", intent: "Enter the forest.", visualDescription: "Trees." },
      ],
    });
    expect(directorPlanRequestFromProject(planned).anchors).toBeUndefined();
  });

  it("includes completed Forest destinations as existing anchors", () => {
    const request = directorPlanRequestFromProject(createForestProject());
    expect(request.anchors?.map((anchor) => anchor.id)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(request.anchors?.every((anchor) => Boolean(anchor.mediaId))).toBe(true);
  });

  it("refuses to plan a new project before the filmmaker supplies starting frame A", () => {
    expect(() =>
      directorPlanRequestFromProject({
        ...createNewProject(),
        story: "Travel forward through an imagined interior at night.",
      }),
    ).toThrow(/trusted media identity/);
  });
});
