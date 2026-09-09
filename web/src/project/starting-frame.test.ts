import { afterEach, describe, expect, it, vi } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { createWardrobeProject, STORYBOARD_INTENTS } from "../fixtures/wardrobe-loop";
import { createNewProject } from "./new-project";
import { directorPlanRequestFromProject } from "./director";
import { projectWithDirectorPlan } from "./storyboard";
import {
  canProvideStartingFrame,
  canUploadStoryboardFrame,
  hasAuthoritativeStartingFrame,
  parseStartingFrameUpload,
  projectWithReplacedFrameImage,
  projectWithReplacedStartImage,
  runtimeMediaPreviewUrl,
  STARTING_FRAME_MAX_BYTES,
  startingFrameFileError,
  uploadStartingFrame,
} from "./starting-frame";
import { TRUSTED_MEDIA_IDS } from "./trusted-media-id";
import { directorUserPrompt } from "../../../media/src/director/prompts";

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("starting-frame file checks", () => {
  it("accepts PNG, JPEG, and WebP", () => {
    expect(startingFrameFileError({ size: 12, type: "image/png" })).toBeNull();
    expect(startingFrameFileError({ size: 12, type: "image/jpeg" })).toBeNull();
    expect(startingFrameFileError({ size: 12, type: "image/webp" })).toBeNull();
  });

  it("rejects an unsupported type", () => {
    expect(startingFrameFileError({ size: 12, type: "image/gif" })).toMatch(/unsupported image type/i);
    expect(startingFrameFileError({ size: 12, type: "application/pdf" })).toMatch(
      /unsupported image type/i,
    );
  });

  it("rejects an oversized input", () => {
    expect(
      startingFrameFileError({ size: STARTING_FRAME_MAX_BYTES + 1, type: "image/png" }),
    ).toMatch(/too large/i);
  });
});

describe("starting-frame upload client", () => {
  it("sends file bytes, not a filesystem path", async () => {
    const file = new File([PNG], "../../etc/passwd.png", { type: "image/png" });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("/api/runtime-media");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(file);
      expect(JSON.stringify(init?.headers)).not.toMatch(/passwd|camotion|\.\./);
      expect(init).not.toHaveProperty("path");
      return new Response(
        JSON.stringify({
          mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          imageUrl: "/api/runtime-media/upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const uploaded = await uploadStartingFrame(file);
    expect(uploaded.mediaId).toBe("upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(uploaded.imageUrl).toBe(runtimeMediaPreviewUrl(uploaded.mediaId));
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects an invalid returned media identity without producing a replacement", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            mediaId: "/etc/passwd",
            imageUrl: "/etc/passwd",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const file = new File([PNG], "a.png", { type: "image/png" });
    await expect(uploadStartingFrame(file)).rejects.toThrow(/invalid media identity/i);
  });

  it("surfaces a failed upload", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ error: "Upload failed." }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
    );
    const file = new File([PNG], "a.png", { type: "image/png" });
    await expect(uploadStartingFrame(file)).rejects.toThrow(/upload failed/i);
  });
});

describe("replacing authoritative A", () => {
  it("keeps Wardrobe initialization intent until A is replaced", () => {
    const project = createWardrobeProject();
    expect(project.storyboard[0]?.intent).toBe(STORYBOARD_INTENTS.A);
    expect(directorPlanRequestFromProject(project).startFrameIntent).toBe(STORYBOARD_INTENTS.A);
  });

  it("replaces Plan A image, media identity, and uploaded provenance", () => {
    const project = createWardrobeProject();
    const previous = project.storyboard[0]!;
    const next = projectWithReplacedStartImage(project, {
      mediaId: "upload-cccccccccccccccccccccccccccccccc",
      imageUrl: "/api/runtime-media/upload-cccccccccccccccccccccccccccccccc",
    });
    expect(next.storyboard).toHaveLength(1);
    expect(next.storyboard[0]?.id).toBe("A");
    expect(next.storyboard[0]?.image).toBe(
      "/api/runtime-media/upload-cccccccccccccccccccccccccccccccc",
    );
    expect(next.storyboard[0]?.mediaId).toBe("upload-cccccccccccccccccccccccccccccccc");
    expect(next.storyboard[0]?.imageOrigin).toBe("user");
    expect(next.storyboard[0]?.image).not.toBe(previous.image);
    expect(next.storyboard[0]?.mediaId).not.toBe(TRUSTED_MEDIA_IDS.wardrobeLoopVisionA);
  });

  it("replaces A's media in place without dropping later destinations", () => {
    const project = createWardrobeProject();
    const planned = projectWithDirectorPlan(project, {
      summary: "Leave through the wardrobe.",
      beats: [
        { id: "B", intent: "Enter the wardrobe.", visualDescription: "Coats." },
        { id: "C", intent: "Enter the forest.", visualDescription: "Trees." },
      ],
    });
    const edited = { ...planned, story: "Walk through a greenhouse at night." };
    const next = projectWithReplacedStartImage(edited, {
      mediaId: "upload-dddddddddddddddddddddddddddddddd",
      imageUrl: "/api/runtime-media/upload-dddddddddddddddddddddddddddddddd",
    });
    expect(next.story).toBe("Walk through a greenhouse at night.");
    expect(next.storyboard.map((frame) => frame.id)).toEqual(["A", "B", "C"]);
    expect(next.storyboard[0]?.mediaId).toBe("upload-dddddddddddddddddddddddddddddddd");
    expect(next.storyboard[0]?.id).toBe("A");
    expect(next.storyboard[0]?.label).toBe(planned.storyboard[0]?.label);
    expect(next.destinations).toEqual(project.destinations);
    expect(next.journeys).toEqual(project.journeys);
  });

  it("leaves existing A unchanged when the returned identity is invalid", () => {
    const project = createWardrobeProject();
    const start = project.storyboard[0];
    expect(() =>
      parseStartingFrameUpload({
        mediaId: "camotion/integration/wardrobe-loop-01/canonical/vision/A.jpg",
        imageUrl: "camotion/integration/wardrobe-loop-01/canonical/vision/A.jpg",
      }),
    ).toThrow(/invalid media identity/i);
    expect(project.storyboard[0]).toBe(start);
    expect(project.storyboard[0]?.mediaId).toBe(TRUSTED_MEDIA_IDS.wardrobeLoopVisionA);
  });

  it("builds the Director request from the uploaded A without Wardrobe start intent", () => {
    const project = createWardrobeProject();
    const replaced = projectWithReplacedStartImage(project, {
      mediaId: "upload-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      imageUrl: "/api/runtime-media/upload-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    });
    const withStory = {
      ...replaced,
      story: "Travel forward through a quiet abandoned greenhouse at night.",
    };
    const request = directorPlanRequestFromProject(withStory);
    const prompt = directorUserPrompt(request);
    expect(request).toEqual({
      story: "Travel forward through a quiet abandoned greenhouse at night.",
      agency: project.agency,
      startFrameId: "A",
      startMediaId: "upload-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      startFrameIntent: STORYBOARD_INTENTS.A,
      storyDuration: "auto",
      storyboard: [
        {
          id: "A",
          label: "A",
          specified: true,
          intent: STORYBOARD_INTENTS.A,
          mediaId: "upload-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        },
      ],
    });
    expect(prompt).toMatch(/Opening-beat intent/);
    expect(prompt).toMatch(/abandoned greenhouse/);
    expect(prompt).toMatch(/Authoritative starting frame id: A/);
  });

  it("attaches uploaded media facts when provided and drops stale ones otherwise", () => {
    const forest = createForestProject();
    expect(forest.storyboard[0]?.mediaInfo).toEqual({ width: 1000, height: 558, format: "jpeg" });
    const withFacts = projectWithReplacedStartImage(forest, {
      mediaId: "upload-ffffffffffffffffffffffffffffffff",
      imageUrl: "/api/runtime-media/upload-ffffffffffffffffffffffffffffffff",
      mediaInfo: { width: 1280, height: 720, format: "png" },
    });
    expect(withFacts.storyboard).toHaveLength(6);
    expect(withFacts.storyboard[0]?.mediaInfo).toEqual({ width: 1280, height: 720, format: "png" });
    const withoutFacts = projectWithReplacedStartImage(forest, {
      mediaId: "upload-ffffffffffffffffffffffffffffffff",
      imageUrl: "/api/runtime-media/upload-ffffffffffffffffffffffffffffffff",
    });
    expect(withoutFacts.storyboard[0]?.mediaInfo).toBeUndefined();
  });

  it("replaces destination B in place without changing identity or neighbors", () => {
    const forest = createForestProject();
    const next = projectWithReplacedFrameImage(forest, "B", {
      mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      imageUrl: "/api/runtime-media/upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    expect(next.storyboard.map((frame) => frame.id)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(next.storyboard[1]?.id).toBe("B");
    expect(next.storyboard[1]?.label).toBe(forest.storyboard[1]?.label);
    expect(next.storyboard[1]?.imageOrigin).toBe("user");
    expect(next.storyboard[1]?.mediaId).toBe("upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(next.storyboard[0]).toEqual(forest.storyboard[0]);
    expect(next.storyboard[2]).toEqual(forest.storyboard[2]);
    expect(next.destinations.find((destination) => destination.id === "B")?.image).toBe(
      "/api/runtime-media/upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );
    expect(next.journeys.find((journey) => journey.id === "A-B")?.status).toBe("ready");
    expect(next.journeys.find((journey) => journey.id === "A-B")?.cinematographer).toBeUndefined();
    expect(next.journeys.find((journey) => journey.id === "A-B")?.videoUrl).toBeUndefined();
    expect(next.journeys.find((journey) => journey.id === "B-C")?.status).toBe("ready");
    expect(next.journeys.find((journey) => journey.id === "B-C")?.videoUrl).toBeUndefined();
    expect(next.journeys.find((journey) => journey.id === "C-D")?.status).toBe("rendered");
    expect(next.journeys.find((journey) => journey.id === "C-D")?.videoUrl).toBe(
      forest.journeys.find((journey) => journey.id === "C-D")?.videoUrl,
    );
  });
});

describe("providing starting frame A on a new project", () => {
  it("fills the unresolved opening slot without inventing later destinations", () => {
    const project = createNewProject();
    expect(canProvideStartingFrame(project.storyboard[0]!)).toBe(true);
    const next = projectWithReplacedStartImage(project, {
      mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      imageUrl: "/api/runtime-media/upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(next.storyboard).toHaveLength(1);
    expect(next.storyboard[0]?.id).toBe("A");
    expect(next.storyboard[0]?.imageOrigin).toBe("user");
    expect(next.storyboard[0]?.mediaId).toBe("upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(next.storyboard[0]?.destinationId).toBe("A");
    expect(next.destinations).toEqual([]);
    expect(next.journeys).toEqual([]);
    expect(hasAuthoritativeStartingFrame(next)).toBe(true);
    expect(canProvideStartingFrame(next.storyboard[0]!)).toBe(false);
  });

  it("fills an unresolved later slot without treating it as starting frame A", () => {
    const project = {
      ...createNewProject(),
      storyboard: [
        {
          id: "A",
          label: "A",
          imageOrigin: "user" as const,
          image: "/api/runtime-media/upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        { id: "B", label: "B", imageOrigin: "none" as const },
      ],
    };
    expect(canProvideStartingFrame(project.storyboard[1]!)).toBe(false);
    expect(canUploadStoryboardFrame(project.storyboard[1]!)).toBe(true);
    const next = projectWithReplacedFrameImage(project, "B", {
      mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      imageUrl: "/api/runtime-media/upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    expect(next.storyboard.map((frame) => frame.id)).toEqual(["A", "B"]);
    expect(next.storyboard[0]?.image).toBe(project.storyboard[0]?.image);
    expect(next.storyboard[0]?.mediaId).toBe(project.storyboard[0]?.mediaId);
    expect(next.storyboard[1]).toMatchObject({
      id: "B",
      imageOrigin: "user",
      mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      destinationId: "B",
    });
    expect(next.destinations.map((destination) => destination.id)).toEqual(["A", "B"]);
    expect(next.journeys.map((journey) => journey.id)).toEqual(["A-B"]);
  });
});
