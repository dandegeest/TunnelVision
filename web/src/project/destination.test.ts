import { afterEach, describe, expect, it, vi } from "vitest";
import { createWardrobeProject } from "../fixtures/wardrobe-loop";
import { projectWithDirectorPlan } from "./storyboard";
import { projectWithReplacedStartImage } from "./starting-frame";
import { TRUSTED_MEDIA_IDS } from "./trusted-media-id";
import {
  canConstructDestinationFrame,
  destinationConstructionPrompt,
  destinationConstructionRequestFromProject,
  parseDestinationConstructionResult,
  precedingActualFrame,
  projectWithConstructedDestination,
  requestConstructDestination,
} from "./destination";

const upload = {
  mediaId: "upload-ffffffffffffffffffffffffffffffff",
  imageUrl: "/api/runtime-media/upload-ffffffffffffffffffffffffffffffff",
};

const generatedB = {
  mediaId: "upload-11111111111111111111111111111111",
  imageUrl: "/api/runtime-media/upload-11111111111111111111111111111111",
};

const generatedC = {
  mediaId: "upload-22222222222222222222222222222222",
  imageUrl: "/api/runtime-media/upload-22222222222222222222222222222222",
};

const beats = {
  beats: [
    {
      id: "B",
      intent: "Move forward directly into the glowing vertical cleft of the rock monolith.",
      visualDescription: "A narrow, smooth-walled stone corridor radiating intense orange geothermal light.",
    },
    {
      id: "C",
      intent: "Descend the next threshold in this test world.",
      visualDescription: "A test tunnel continuing from the previous actual beat.",
    },
    {
      id: "D",
      intent: "Emerge from the tunnel into a vast, enclosed cavern.",
      visualDescription: "A massive cavern overgrown with giant, bioluminescent crystalline trees.",
    },
    {
      id: "E",
      intent: "Pass through a hidden doorway.",
      visualDescription: "A sterile interior beyond the flora.",
    },
  ],
};

function plannedFrom(project = createWardrobeProject()) {
  return projectWithDirectorPlan(project, beats);
}

function withActualB(project = plannedFrom()) {
  return projectWithConstructedDestination(project, {
    beatId: "B",
    ...generatedB,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("destination construction prompt", () => {
  it("includes both spatial intent and destination description", () => {
    const prompt = destinationConstructionPrompt({
      intent: "Move forward into the cleft.",
      visualDescription: "A narrow stone corridor with orange light.",
    });
    expect(prompt).toMatch(/Move forward into the cleft/);
    expect(prompt).toMatch(/narrow stone corridor with orange light/);
    expect(prompt).toMatch(/spatial continuation/i);
    expect(prompt).toMatch(/camera must have changed position/i);
    expect(prompt).not.toMatch(/vanishing point/i);
    expect(prompt).not.toMatch(/Camotion/i);
    expect(prompt).not.toMatch(/Seedance/i);
    expect(prompt).not.toMatch(/exposure/i);
  });
});

describe("construct B from current Project state", () => {
  it("uses current authoritative A.mediaId, including after replacement", () => {
    const wardrobePlanned = plannedFrom();
    expect(destinationConstructionRequestFromProject(wardrobePlanned, "B").sourceMediaId).toBe(
      TRUSTED_MEDIA_IDS.wardrobeLoopVisionA,
    );

    const replaced = projectWithReplacedStartImage(createWardrobeProject(), upload);
    const planned = plannedFrom(replaced);
    const request = destinationConstructionRequestFromProject(planned, "B");
    expect(request.sourceMediaId).toBe(upload.mediaId);
    expect(request.sourceMediaId).not.toBe(TRUSTED_MEDIA_IDS.wardrobeLoopVisionA);
    expect(request.beatId).toBe("B");
    expect(request.intent).toBe(beats.beats[0]?.intent);
    expect(request.visualDescription).toBe(beats.beats[0]?.visualDescription);
  });

  it("exposes construction only for planned B until B is actual", () => {
    const planned = plannedFrom();
    const a = planned.storyboard[0]!;
    const b = planned.storyboard[1]!;
    const c = planned.storyboard[2]!;
    const d = planned.storyboard[3]!;
    expect(canConstructDestinationFrame(planned, a)).toBe(false);
    expect(canConstructDestinationFrame(planned, b)).toBe(true);
    expect(canConstructDestinationFrame(planned, c)).toBe(false);
    expect(canConstructDestinationFrame(planned, d)).toBe(false);
  });

  it("assigns constructed image and trusted media identity without changing A, C...N, or story", () => {
    const planned = plannedFrom();
    const story = planned.story;
    const a = planned.storyboard[0]!;
    const c = planned.storyboard[2]!;
    const constructed = projectWithConstructedDestination(planned, {
      beatId: "B",
      ...generatedB,
    });
    const b = constructed.storyboard[1]!;
    expect(b.id).toBe("B");
    expect(b.intent).toBe(beats.beats[0]?.intent);
    expect(b.visualDescription).toBe(beats.beats[0]?.visualDescription);
    expect(b.image).toBe(generatedB.imageUrl);
    expect(b.mediaId).toBe(generatedB.mediaId);
    expect(b.imageOrigin).toBe("generated");
    expect(constructed.storyboard[0]).toEqual(a);
    expect(constructed.storyboard[2]).toEqual(c);
    expect(constructed.story).toBe(story);
    expect(constructed.destinations).toEqual(planned.destinations);
    expect(constructed.journeys).toEqual(planned.journeys);
    expect(canConstructDestinationFrame(constructed, b)).toBe(false);
  });

  it("does not apply an invalid constructed identity, leaving planned B intact", () => {
    const planned = plannedFrom();
    const b = planned.storyboard[1];
    expect(() =>
      parseDestinationConstructionResult({
        mediaId: "/etc/passwd",
        imageUrl: "/etc/passwd",
      }),
    ).toThrow(/invalid media identity/i);
    expect(planned.storyboard[1]).toBe(b);
    expect(planned.storyboard[1]?.imageOrigin).toBe("none");
    expect(planned.storyboard[1]?.mediaId).toBeUndefined();
  });
});

describe("construct C from actual B", () => {
  it("becomes constructible only when B has actual trusted media", () => {
    const planned = plannedFrom();
    expect(canConstructDestinationFrame(planned, planned.storyboard[2]!)).toBe(false);
    expect(() => destinationConstructionRequestFromProject(planned, "C")).toThrow(
      /not ready to construct/i,
    );

    const actualB = withActualB(planned);
    expect(canConstructDestinationFrame(actualB, actualB.storyboard[1]!)).toBe(false);
    expect(canConstructDestinationFrame(actualB, actualB.storyboard[2]!)).toBe(true);
    expect(canConstructDestinationFrame(actualB, actualB.storyboard[3]!)).toBe(false);
    expect(precedingActualFrame(actualB, actualB.storyboard[2]!)?.mediaId).toBe(generatedB.mediaId);
  });

  it("uses B.mediaId as source, not A, and reads runtime C semantics", () => {
    const actualB = withActualB(plannedFrom(projectWithReplacedStartImage(createWardrobeProject(), upload)));
    const request = destinationConstructionRequestFromProject(actualB, "C");
    expect(request.sourceMediaId).toBe(generatedB.mediaId);
    expect(request.sourceMediaId).not.toBe(upload.mediaId);
    expect(request.sourceMediaId).not.toBe(TRUSTED_MEDIA_IDS.wardrobeLoopVisionA);
    expect(request.beatId).toBe("C");
    expect(request.intent).toBe(beats.beats[1]?.intent);
    expect(request.visualDescription).toBe(beats.beats[1]?.visualDescription);
    expect(destinationConstructionPrompt(request)).toContain(beats.beats[1]?.intent ?? "");
    expect(destinationConstructionPrompt(request)).toContain(beats.beats[1]?.visualDescription ?? "");
  });

  it("gives C actual media without changing A, B, D...N, or story", () => {
    const actualB = withActualB();
    const story = actualB.story;
    const a = actualB.storyboard[0]!;
    const b = actualB.storyboard[1]!;
    const d = actualB.storyboard[3]!;
    const e = actualB.storyboard[4]!;
    const constructed = projectWithConstructedDestination(actualB, {
      beatId: "C",
      ...generatedC,
    });
    const c = constructed.storyboard[2]!;
    expect(c.id).toBe("C");
    expect(c.intent).toBe(beats.beats[1]?.intent);
    expect(c.visualDescription).toBe(beats.beats[1]?.visualDescription);
    expect(c.image).toBe(generatedC.imageUrl);
    expect(c.mediaId).toBe(generatedC.mediaId);
    expect(c.imageOrigin).toBe("generated");
    expect(constructed.storyboard[0]).toEqual(a);
    expect(constructed.storyboard[1]).toEqual(b);
    expect(constructed.storyboard[3]).toEqual(d);
    expect(constructed.storyboard[4]).toEqual(e);
    expect(constructed.story).toBe(story);
    expect(constructed.destinations).toEqual(actualB.destinations);
    expect(constructed.journeys).toEqual(actualB.journeys);
    expect(canConstructDestinationFrame(constructed, constructed.storyboard[3]!)).toBe(true);
    expect(canConstructDestinationFrame(constructed, c)).toBe(false);
  });

  it("cannot construct a destination whose predecessor lacks actual media", () => {
    const planned = plannedFrom();
    expect(() =>
      projectWithConstructedDestination(planned, {
        beatId: "C",
        ...generatedC,
      }),
    ).toThrow(/not ready to construct/i);
    expect(planned.storyboard[2]?.imageOrigin).toBe("none");
    expect(planned.storyboard[2]?.mediaId).toBeUndefined();
  });
});

describe("destination construction client", () => {
  it("posts current A.mediaId with runtime B intent and visualDescription", async () => {
    const planned = plannedFrom(projectWithReplacedStartImage(createWardrobeProject(), upload));
    const request = destinationConstructionRequestFromProject(planned, "B");
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual(request);
      return new Response(
        JSON.stringify({
          ...generatedB,
          evidence: {
            request: {
              ...request,
              prompt: destinationConstructionPrompt(request),
            },
            model: "black-forest-labs/flux-kontext-pro",
            modelVersion: "test",
            predictionId: "pred-b",
            elapsedMs: 2000,
            outputMediaId: generatedB.mediaId,
            outputUrl: "https://example.test/b.png",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await requestConstructDestination(request);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/destination/construct",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.mediaId).toBe(generatedB.mediaId);
    expect(result.evidence.model).toBe("black-forest-labs/flux-kontext-pro");
  });

  it("posts B.mediaId when constructing C and does not invent C media on failure", async () => {
    const actualB = withActualB();
    const b = actualB.storyboard[1];
    const c = actualB.storyboard[2];
    const request = destinationConstructionRequestFromProject(actualB, "C");
    expect(request.sourceMediaId).toBe(generatedB.mediaId);
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ error: "Destination construction failed." }), {
          status: 502,
          headers: { "content-type": "application/json" },
        }),
    );
    await expect(requestConstructDestination(request)).rejects.toThrow(
      /Destination construction failed/,
    );
    expect(actualB.storyboard[1]).toBe(b);
    expect(actualB.storyboard[1]?.mediaId).toBe(generatedB.mediaId);
    expect(actualB.storyboard[2]).toBe(c);
    expect(actualB.storyboard[2]?.imageOrigin).toBe("none");
    expect(actualB.storyboard[2]?.mediaId).toBeUndefined();
    expect(actualB.storyboard[2]?.intent).toBe(beats.beats[1]?.intent);
    expect(actualB.storyboard[2]?.visualDescription).toBe(beats.beats[1]?.visualDescription);
  });
});
