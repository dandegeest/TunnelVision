import { afterEach, describe, expect, it, vi } from "vitest";
import { createWardrobeProject } from "../fixtures/wardrobe-loop";
import { projectWithDirectorPlan, projectWithStoryboardBeatPlan } from "./storyboard";
import { projectWithReplacedStartImage } from "./starting-frame";
import { createNewProject } from "./new-project";
import { TRUSTED_MEDIA_IDS } from "./trusted-media-id";
import {
  canConstructDestinationFrame,
  canGenerateOpeningFrame,
  canReshootDestinationFrame,
  canReshootOpeningFrame,
  generatedStillNeedsReshoot,
  nextConstructableDestinationId,
  destinationConstructionPrompt,
  farFieldVisualDetails,
  destinationConstructionRequestFromProject,
  openingFrameGenerationPrompt,
  openingFrameGenerationRequestFromProject,
  openingFrameIntent,
  parseDestinationConstructionResult,
  precedingActualFrame,
  projectWithConstructedDestination,
  projectWithGeneratedOpeningFrame,
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

const generatedD = {
  mediaId: "upload-33333333333333333333333333333333",
  imageUrl: "/api/runtime-media/upload-33333333333333333333333333333333",
};

const beats = {
  summary: "A test journey through connected volumes.",
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
    expect(prompt).toMatch(/camera position must change/i);
    expect(prompt).toMatch(/unembodied first-person POV/);
    expect(prompt).toMatch(/People, animals, vehicles, objects, and other subjects may appear naturally/);
    expect(prompt).not.toMatch(/Do not show a person/);
    expect(prompt).not.toMatch(/vanishing point/i);
    expect(prompt).not.toMatch(/Camotion/i);
    expect(prompt).not.toMatch(/Seedance/i);
    expect(prompt).not.toMatch(/Far-field continuity/);
    expect(prompt).not.toMatch(/far field/);
    expect(prompt).not.toMatch(/following destination/i);
    expect(prompt.indexOf("Create this destination viewpoint:")).toBeLessThan(
      prompt.indexOf("Move the camera from the source viewpoint:"),
    );
    expect(prompt.indexOf("A narrow stone corridor with orange light.")).toBeLessThan(
      prompt.indexOf("Move forward into the cleft."),
    );
  });

  it("injects the next visual as demoted far-field continuity", () => {
    const visual = "A dark cobblestone alley with warm lanterns.";
    const prompt = destinationConstructionPrompt({
      intent: "Track forward through the lantern alley.",
      visualDescription: visual,
      nextDestination: {
        intent: "Cross the threshold into the desert.",
        visualDescription: "A bright sunlit desert with iron gates.",
      },
    });
    expect(prompt).toMatch(/Create this destination viewpoint:\nA dark cobblestone alley with warm lanterns/);
    expect(prompt).toMatch(/Move the camera from the source viewpoint:\nTrack forward through the lantern alley/);
    expect(prompt).toMatch(/Far-field continuity:/);
    expect(prompt).toMatch(/distant environmental information only/);
    expect(prompt).toMatch(/opening, path, or far field/);
    expect(prompt).toMatch(/iron gates/);
    expect(prompt).toMatch(/Do not arrive there, replace this destination with it, or adopt its overall lighting or style/);
    expect(prompt).not.toMatch(/following destination/i);
    expect(prompt).not.toMatch(/Look ahead only/);
    expect(prompt).not.toMatch(/The next viewpoint should look like this:/);
    expect(prompt).not.toContain("Cross the threshold into the desert.");
    const visualAt = prompt.indexOf(visual);
    const intentAt = prompt.indexOf("Track forward through the lantern alley.");
    const lookAt = prompt.indexOf("Far-field continuity:");
    const povAt = prompt.indexOf("unembodied first-person POV");
    expect(visualAt).toBeGreaterThan(-1);
    expect(visualAt).toBeLessThan(intentAt);
    expect(intentAt).toBeLessThan(lookAt);
    expect(lookAt).toBeLessThan(povAt);
  });

  it("keeps useful next-place visual detail as far-field without treating it as a second target", () => {
    const visual = "The shadowed threshold of the cabin interior. Rotted floorboards and fallen debris lead toward the main room.";
    const nextVisual =
      "A decaying room centered on an imposing, ornately carved stone fireplace draped in dense cobwebs. A weathered oval table and broken wooden chairs rest on the ruined plank floor.";
    const prompt = destinationConstructionPrompt({
      intent: "Advance up the wooden steps and pass through the broken front door into the cabin.",
      visualDescription: visual,
      nextDestination: {
        intent: "Move into the center of the main room, stopping before the fireplace.",
        visualDescription: nextVisual,
      },
    });
    expect(prompt).toContain("ornately carved stone fireplace draped in dense cobwebs");
    expect(prompt).toContain("weathered oval table and broken wooden chairs");
    expect(prompt).toMatch(/Far-field continuity:\nA decaying room centered on an imposing, ornately carved stone fireplace draped in dense cobwebs/);
    expect(prompt).not.toMatch(/dense Hint at this/);
    expect(prompt).not.toContain("Move into the center of the main room, stopping before the fireplace.");
    expect(prompt).not.toMatch(/following destination/i);
    expect(prompt.indexOf(visual)).toBeLessThan(prompt.indexOf("Far-field continuity:"));
    expect(prompt.indexOf("Move the camera from the source viewpoint:")).toBeLessThan(
      prompt.indexOf("Far-field continuity:"),
    );
  });

  it("shortens a long far-field visual at a sentence boundary", () => {
    const kept =
      "A bright sunlit desert with iron gates standing before wind-carved cliffs. Endless dunes roll to the horizon under a hard blue sky with scattered stone outcrops. A caravan of camels waits beside a well.";
    const dropped =
      "Painted banners snap on tall poles above a marble palace that fills the skyline with musicians and market stalls stretching for hundreds of meters.";
    const nextVisual = `${kept} ${dropped}`;
    expect(farFieldVisualDetails(nextVisual)).toBe(kept);
    expect(farFieldVisualDetails(nextVisual).endsWith(".")).toBe(true);
    expect(farFieldVisualDetails(nextVisual)).not.toMatch(/\wHint /);
    const prompt = destinationConstructionPrompt({
      intent: "Track forward through the lantern alley.",
      visualDescription: "A dark cobblestone alley with warm lanterns.",
      nextDestination: {
        intent: "Enter the desert city.",
        visualDescription: nextVisual,
      },
    });
    expect(prompt).toContain("iron gates");
    expect(prompt).toContain("Endless dunes");
    expect(prompt).not.toContain("marble palace");
    expect(prompt).not.toContain("market stalls");
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
    expect(request.nextDestination).toEqual({
      intent: beats.beats[1]?.intent,
      visualDescription: beats.beats[1]?.visualDescription,
    });
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
    expect(nextConstructableDestinationId(planned)).toBe("B");
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
    expect(b.mediaInfo).toBeUndefined();
    const withFacts = projectWithConstructedDestination(planned, {
      beatId: "B",
      ...generatedB,
      mediaInfo: { width: 1392, height: 752, format: "png" },
    });
    expect(withFacts.storyboard[1]?.mediaInfo).toEqual({ width: 1392, height: 752, format: "png" });
    expect(constructed.storyboard[0]).toEqual(a);
    expect(constructed.storyboard[2]).toEqual(c);
    expect(constructed.story).toBe(story);
    expect(constructed.destinations.find((destination) => destination.id === "B")?.image).toBe(
      generatedB.imageUrl,
    );
    expect(constructed.destinations.find((destination) => destination.id === "C")?.image).toBe(
      planned.destinations.find((destination) => destination.id === "C")?.image,
    );
    expect(constructed.journeys.find((journey) => journey.id === "A-B")?.status).toBe("ready");
    expect(constructed.journeys.find((journey) => journey.id === "A-B")?.cinematographer).toBeUndefined();
    expect(constructed.journeys.find((journey) => journey.id === "A-B")?.videoUrl).toBeUndefined();
    expect(constructed.journeys.find((journey) => journey.id === "B-C")?.status).toBe("ready");
    expect(constructed.journeys.find((journey) => journey.id === "C-D")?.status).toBe("rendered");
    expect(constructed.journeys.map((journey) => journey.id)).toEqual(
      planned.journeys.map((journey) => journey.id),
    );
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
    expect(nextConstructableDestinationId(actualB)).toBe("C");
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
    expect(request.nextDestination).toEqual({
      intent: beats.beats[2]?.intent,
      visualDescription: beats.beats[2]?.visualDescription,
    });
    expect(destinationConstructionPrompt(request)).toContain(beats.beats[1]?.intent ?? "");
    expect(destinationConstructionPrompt(request)).toContain(beats.beats[1]?.visualDescription ?? "");
    expect(destinationConstructionPrompt(request)).toContain(beats.beats[2]?.visualDescription ?? "");
    expect(destinationConstructionPrompt(request)).toMatch(/Far-field continuity:/);
    expect(destinationConstructionPrompt(request)).not.toMatch(/following destination/i);
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
    expect(constructed.destinations.find((destination) => destination.id === "C")?.image).toBe(
      generatedC.imageUrl,
    );
    expect(constructed.destinations.find((destination) => destination.id === "B")?.image).toBe(
      generatedB.imageUrl,
    );
    expect(constructed.journeys.find((journey) => journey.id === "A-B")?.status).toBe("ready");
    expect(constructed.journeys.find((journey) => journey.id === "B-C")?.status).toBe("ready");
    expect(constructed.journeys.find((journey) => journey.id === "C-D")?.status).toBe("ready");
    expect(constructed.journeys.find((journey) => journey.id === "D-E")?.status).toBe("rendered");
    expect(constructed.journeys.map((journey) => journey.id)).toEqual(
      actualB.journeys.map((journey) => journey.id),
    );
    expect(canConstructDestinationFrame(constructed, constructed.storyboard[3]!)).toBe(true);
    expect(canConstructDestinationFrame(constructed, c)).toBe(false);
  });

  it("omits look-ahead on the last planned beat", () => {
    const actualD = projectWithConstructedDestination(
      projectWithConstructedDestination(withActualB(), { beatId: "C", ...generatedC }),
      { beatId: "D", ...generatedD },
    );
    const request = destinationConstructionRequestFromProject(actualD, "E");
    expect(request.beatId).toBe("E");
    expect(request.nextDestination).toBeUndefined();
    expect(destinationConstructionPrompt(request)).not.toMatch(/Far-field continuity/);
  });

  it("passes the stored canonical aspect ratio when constructing later destinations", () => {
    const generated = projectWithGeneratedOpeningFrame(
      { ...createNewProject(), story: "Travel forward through connected volumes." },
      generatedB,
    );
    const planned = projectWithDirectorPlan(generated, {
      summary: "Continue forward.",
      beats: [
        {
          id: "B",
          intent: "Move forward into the next space.",
          visualDescription: "A corridor continuing the same world.",
        },
      ],
    });
    expect(destinationConstructionRequestFromProject(planned, "B").aspectRatio).toEqual({
      width: 16,
      height: 9,
    });
    const uploaded = projectWithDirectorPlan(
      projectWithReplacedStartImage(
        { ...createNewProject(), story: "Travel forward through connected volumes." },
        {
          ...upload,
          mediaInfo: { width: 1000, height: 558, format: "jpeg" },
        },
      ),
      {
        summary: "Continue forward.",
        beats: [
          {
            id: "B",
            intent: "Move forward into the next space.",
            visualDescription: "A corridor continuing the same world.",
          },
        ],
      },
    );
    expect(destinationConstructionRequestFromProject(uploaded, "B").aspectRatio).toEqual({
      width: 1000,
      height: 558,
    });
  });

  it("uses an uploaded following still's adopted plan as look-ahead", () => {
    const planned = projectWithDirectorPlan(
      {
        ...createNewProject(),
        story: "Travel forward through connected volumes.",
        storyboard: [
          {
            id: "A",
            label: "A",
            imageOrigin: "user",
            image: upload.imageUrl,
            mediaId: upload.mediaId,
          },
          { id: "B", label: "B", imageOrigin: "none" },
          {
            id: "C",
            label: "C",
            imageOrigin: "user",
            image: "/api/runtime-media/upload-cccccccccccccccccccccccccccccccc",
            mediaId: "upload-cccccccccccccccccccccccccccccccc",
          },
        ],
      },
      {
        summary: "Reach the window.",
        beats: [
          { id: "B", intent: "Enter the hall.", visualDescription: "A dark hall." },
          { id: "C", intent: "Reach the window.", visualDescription: "An empty window onto pines." },
        ],
      },
    );
    const request = destinationConstructionRequestFromProject(planned, "B");
    expect(request.nextDestination).toEqual({
      intent: "Reach the window.",
      visualDescription: "An empty window onto pines.",
    });
    expect(destinationConstructionPrompt(request)).toMatch(/Far-field continuity:/);
    expect(destinationConstructionPrompt(request)).toContain("An empty window onto pines.");
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

describe("opening frame generation", () => {
  it("requires a journey story and unresolved A", () => {
    const empty = createNewProject();
    expect(canGenerateOpeningFrame(empty)).toBe(false);
    const withStory = { ...empty, story: "Travel forward through an imagined interior at night." };
    expect(canGenerateOpeningFrame(withStory)).toBe(true);
    expect(openingFrameGenerationPrompt(withStory.story)).toMatch(/Travel forward through an imagined interior at night/);
    expect(openingFrameGenerationPrompt(withStory.story)).toMatch(/unembodied first-person POV/);
    expect(openingFrameGenerationPrompt(withStory.story)).toMatch(
      /People, animals, vehicles, objects, and other subjects may appear naturally/,
    );
    expect(openingFrameGenerationPrompt(withStory.story)).not.toMatch(/Do not show a person/);
    expect(openingFrameGenerationPrompt(withStory.story)).toMatch(/Do not show text/);
    expect(openingFrameGenerationRequestFromProject(withStory)).toEqual({
      story: withStory.story,
      aspectRatio: { width: 16, height: 9 },
    });
    expect(openingFrameIntent(withStory.story)).toBe(
      "Travel forward through an imagined interior at night.",
    );
    expect(openingFrameIntent("Leave the attic. Cross into the forest.")).toBe("Leave the attic.");
    expect(openingFrameIntent("  ")).toBeUndefined();
    const generated = projectWithGeneratedOpeningFrame(withStory, {
      ...generatedB,
      mediaInfo: { width: 1024, height: 576, format: "png" },
    });
    expect(generated.storyboard[0]?.imageOrigin).toBe("generated");
    expect(generated.storyboard[0]?.mediaId).toBe(generatedB.mediaId);
    expect(generated.storyboard[0]?.destinationId).toBe("A");
    expect(generated.storyboard[0]?.mediaInfo).toEqual({ width: 1024, height: 576, format: "png" });
    expect(generated.storyboard[0]?.generatedFrom).toBe(`story:${withStory.story}`);
    expect(generated.canonicalAspectRatio).toEqual({ width: 16, height: 9 });
    expect(generated.storyboard[0]?.intent).toBe(
      "Travel forward through an imagined interior at night.",
    );
    expect(generated.storyboard[0]?.visualDescription).toBe(
      openingFrameGenerationPrompt(withStory.story),
    );
    expect(generatedStillNeedsReshoot(generated, generated.storyboard[0]!)).toBe(false);
    expect(canGenerateOpeningFrame(generated)).toBe(false);
    expect(canReshootOpeningFrame(generated)).toBe(true);
    expect(openingFrameGenerationRequestFromProject(generated)).toEqual({
      story: generated.story,
      aspectRatio: { width: 16, height: 9 },
    });
    const keptIntent = projectWithGeneratedOpeningFrame(
      {
        ...generated,
        storyboard: generated.storyboard.map((frame) =>
          frame.id === "A" ? { ...frame, intent: "Filmmaker opening note." } : frame,
        ),
      },
      generatedC,
    );
    expect(keptIntent.storyboard[0]?.intent).toBe("Filmmaker opening note.");
    expect(keptIntent.storyboard[0]?.visualDescription).toBe(
      openingFrameGenerationPrompt(generated.story),
    );
    const reshots = projectWithGeneratedOpeningFrame(generated, generatedC);
    expect(reshots.storyboard[0]?.mediaId).toBe(generatedC.mediaId);
    expect(reshots.storyboard[0]?.intent).toBe(generated.storyboard[0]?.intent);
    expect(reshots.storyboard[0]?.visualDescription).toBe(
      openingFrameGenerationPrompt(generated.story),
    );
  });
});

describe("destination reshoot", () => {
  it("rebuilds an already generated beat from the current plan and previous actual", () => {
    const actualB = withActualB();
    expect(canConstructDestinationFrame(actualB, actualB.storyboard[1]!)).toBe(false);
    expect(canReshootDestinationFrame(actualB, actualB.storyboard[1]!)).toBe(true);
    const request = destinationConstructionRequestFromProject(actualB, "B");
    expect(request.sourceMediaId).toBe(actualB.storyboard[0]?.mediaId);
    expect(request.intent).toBe(beats.beats[0]?.intent);
    const reshots = projectWithConstructedDestination(actualB, {
      beatId: "B",
      ...generatedC,
    });
    expect(reshots.storyboard[1]?.mediaId).toBe(generatedC.mediaId);
    expect(reshots.storyboard[1]?.imageOrigin).toBe("generated");
    expect(reshots.storyboard[1]?.intent).toBe(actualB.storyboard[1]?.intent);
    expect(canReshootDestinationFrame(actualB, actualB.storyboard[0]!)).toBe(false);
    expect(actualB.storyboard[1]?.generatedFrom).toContain("plan:");
    expect(generatedStillNeedsReshoot(actualB, actualB.storyboard[1]!)).toBe(false);
    const stale = projectWithStoryboardBeatPlan(actualB, "B", {
      visualDescription: "A rewritten viewpoint after the still already exists.",
    });
    expect(generatedStillNeedsReshoot(stale, stale.storyboard[1]!)).toBe(true);
    expect(generatedStillNeedsReshoot(reshots, reshots.storyboard[1]!)).toBe(false);
    const nextStale = projectWithStoryboardBeatPlan(actualB, "C", {
      visualDescription: "A rewritten following destination after B already exists.",
    });
    expect(generatedStillNeedsReshoot(nextStale, nextStale.storyboard[1]!)).toBe(true);
  });
});
