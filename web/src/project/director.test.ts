import { afterEach, describe, expect, it, vi } from "vitest";
import { requestDirectorPlan } from "./director";

const payload = {
  story: "Make a first-person POV journey through an impossible world at night.",
  agency: "directed" as const,
  startFrameId: "A",
  startFrameIntent: "Inside the attic bedroom. Approach the open wardrobe.",
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
