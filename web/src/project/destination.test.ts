import { afterEach, describe, expect, it, vi } from "vitest";
import { createWardrobeProject } from "../fixtures/wardrobe-loop";
import { projectWithDirectorPlan } from "./storyboard";
import { projectWithReplacedStartImage } from "./starting-frame";
import { TRUSTED_MEDIA_IDS } from "./trusted-media-id";
import {
  canConstructDestinationFrame,
  CONSTRUCTIBLE_BEAT_ID,
  destinationConstructionPrompt,
  destinationConstructionRequestFromProject,
  parseDestinationConstructionResult,
  projectWithConstructedDestination,
  requestConstructDestination,
} from "./destination";

const upload = {
  mediaId: "upload-ffffffffffffffffffffffffffffffff",
  imageUrl: "/api/runtime-media/upload-ffffffffffffffffffffffffffffffff",
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
      intent: "Continue through the corridor.",
      visualDescription: "Deeper stone volume ahead.",
    },
  ],
};

function plannedFrom(project = createWardrobeProject()) {
  return projectWithDirectorPlan(project, beats);
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
    expect(destinationConstructionRequestFromProject(wardrobePlanned).sourceMediaId).toBe(
      TRUSTED_MEDIA_IDS.wardrobeLoopVisionA,
    );

    const replaced = projectWithReplacedStartImage(createWardrobeProject(), upload);
    const planned = plannedFrom(replaced);
    const request = destinationConstructionRequestFromProject(planned);
    expect(request.sourceMediaId).toBe(upload.mediaId);
    expect(request.sourceMediaId).not.toBe(TRUSTED_MEDIA_IDS.wardrobeLoopVisionA);
    expect(request.beatId).toBe("B");
    expect(request.intent).toBe(beats.beats[0]?.intent);
    expect(request.visualDescription).toBe(beats.beats[0]?.visualDescription);
  });

  it("exposes construction only for planned B", () => {
    const planned = plannedFrom();
    const a = planned.storyboard[0]!;
    const b = planned.storyboard[1]!;
    const c = planned.storyboard[2]!;
    expect(canConstructDestinationFrame(planned, a)).toBe(false);
    expect(canConstructDestinationFrame(planned, b)).toBe(true);
    expect(canConstructDestinationFrame(planned, c)).toBe(false);
    expect(b.id).toBe(CONSTRUCTIBLE_BEAT_ID);
  });

  it("assigns constructed image and trusted media identity without changing A, C...N, or story", () => {
    const planned = plannedFrom();
    const story = planned.story;
    const a = planned.storyboard[0]!;
    const c = planned.storyboard[2]!;
    const constructed = projectWithConstructedDestination(planned, {
      beatId: "B",
      mediaId: "upload-11111111111111111111111111111111",
      imageUrl: "/api/runtime-media/upload-11111111111111111111111111111111",
    });
    const b = constructed.storyboard[1]!;
    expect(b.id).toBe("B");
    expect(b.intent).toBe(beats.beats[0]?.intent);
    expect(b.visualDescription).toBe(beats.beats[0]?.visualDescription);
    expect(b.image).toBe("/api/runtime-media/upload-11111111111111111111111111111111");
    expect(b.mediaId).toBe("upload-11111111111111111111111111111111");
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

describe("destination construction client", () => {
  it("posts current A.mediaId with runtime B intent and visualDescription", async () => {
    const planned = plannedFrom(projectWithReplacedStartImage(createWardrobeProject(), upload));
    const request = destinationConstructionRequestFromProject(planned);
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual(request);
      return new Response(
        JSON.stringify({
          mediaId: "upload-11111111111111111111111111111111",
          imageUrl: "/api/runtime-media/upload-11111111111111111111111111111111",
          evidence: {
            request: {
              ...request,
              prompt: destinationConstructionPrompt(request),
            },
            model: "black-forest-labs/flux-kontext-pro",
            modelVersion: "test",
            predictionId: "pred-b",
            elapsedMs: 2000,
            outputMediaId: "upload-11111111111111111111111111111111",
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
    expect(result.mediaId).toBe("upload-11111111111111111111111111111111");
    expect(result.evidence.model).toBe("black-forest-labs/flux-kontext-pro");
  });

  it("does not invent media when construction fails", async () => {
    const planned = plannedFrom();
    const b = planned.storyboard[1];
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ error: "Destination construction failed." }), {
          status: 502,
          headers: { "content-type": "application/json" },
        }),
    );
    await expect(
      requestConstructDestination(destinationConstructionRequestFromProject(planned)),
    ).rejects.toThrow(/Destination construction failed/);
    expect(planned.storyboard[1]).toBe(b);
    expect(planned.storyboard[1]?.imageOrigin).toBe("none");
    expect(planned.storyboard[1]?.mediaId).toBeUndefined();
    expect(planned.storyboard[1]?.intent).toBe(beats.beats[0]?.intent);
    expect(planned.storyboard[1]?.visualDescription).toBe(beats.beats[0]?.visualDescription);
  });
});
