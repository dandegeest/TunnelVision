import { describe, expect, it } from "vitest";
import { createForestPartialAnchorProject } from "../fixtures/forest-a-to-f";
import { createWardrobeProject } from "../fixtures/wardrobe-loop";
import { createNewProject } from "./new-project";
import {
  appendConversationEntry,
  conversationTimestamp,
  formatConversationClock,
  prepareDirectorPlan,
  resolveConstructionEntry,
  resolveDirectorEntry,
  resolveBlockingEntry,
  resolveShootingEntry,
  type ConversationEntry,
  type DirectorConversationEntry,
} from "./conversation";
import type { DirectorEvidence } from "./director";
import { TRUSTED_MEDIA_IDS } from "./trusted-media-id";

const AT = "2026-09-07T22:03:00.000Z";
const AT2 = "2026-09-07T22:04:00.000Z";

const evidence = (story: string, predictionId: string): DirectorEvidence => ({
  request: {
    story,
    agency: "directed",
    startFrameId: "A",
    startFrameIntent: "Inside the attic bedroom. Approach the open wardrobe.",
    startMediaId: TRUSTED_MEDIA_IDS.wardrobeLoopVisionA,
    systemInstruction: "Director",
    prompt: "Plan forward",
  },
  rawText: "{}",
  model: "google/gemini-3.1-pro",
  modelVersion: null,
  predictionId,
  elapsedMs: 12,
});

describe("Director plan submission", () => {
  it("uses current Project.story as the Director story", () => {
    const submitted = "Travel forward through this world...\nKeep moving. ";
    const result = prepareDirectorPlan({ ...createWardrobeProject(), story: submitted });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.submitted).toBe(submitted);
    expect(result.request.story).toBe(submitted);
  });

  it("rejects whitespace-only stories without building a request", () => {
    expect(prepareDirectorPlan({ ...createWardrobeProject(), story: "   \n\t  " })).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(prepareDirectorPlan({ ...createWardrobeProject(), story: "" })).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("rejects projects that cannot start planning without treating them as empty", () => {
    const project = createWardrobeProject();
    delete project.storyboard[0]!.mediaId;
    const result = prepareDirectorPlan({ ...project, story: "A valid story." });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("invalid");
    expect(result.message).toMatch(/trusted media identity/i);
  });

  it("rejects a new project that has no starting frame yet", () => {
    const result = prepareDirectorPlan({
      ...createNewProject(),
      story: "Travel forward through an imagined world.",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("invalid");
    expect(result.message).toMatch(/trusted media identity/i);
  });

  it("includes the complete storyboard when the journey is only partially specified", () => {
    const result = prepareDirectorPlan({
      ...createForestPartialAnchorProject(),
      story: "Keep traveling through this night forest.",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.request.story).toBe("Keep traveling through this night forest.");
    expect(result.request.anchors?.map((anchor) => anchor.id)).toEqual(["A", "D", "F"]);
    expect(result.request.storyboard?.map((slot) => slot.id)).toEqual(["A", "D", "F"]);
    expect(result.request.storyboard?.every((slot) => slot.specified)).toBe(true);
    expect(result.request.startMediaId).toBe(TRUSTED_MEDIA_IDS.forestAtoFA);
  });
});

describe("Plan conversation history", () => {
  it("stores createdAt on each entry when that entry is created", () => {
    const createdAt = conversationTimestamp(new Date("2026-09-07T22:03:00.000Z"));
    expect(createdAt).toBe("2026-09-07T22:03:00.000Z");
    const entries = appendConversationEntry([], {
      id: "f1",
      createdAt,
      kind: "filmmaker",
      text: "First story.",
    });
    expect(entries[0]?.createdAt).toBe("2026-09-07T22:03:00.000Z");
    expect(formatConversationClock(entries[0]!.createdAt)).toBe(
      formatConversationClock("2026-09-07T22:03:00.000Z"),
    );
  });

  it("formats stored createdAt and does not invent a render-time clock", () => {
    const createdAt = "2026-09-07T22:03:00.000Z";
    expect(formatConversationClock(createdAt)).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
  });

  it("appends filmmaker, Director, and construction entries oldest to newest", () => {
    let entries: ConversationEntry[] = [];
    entries = appendConversationEntry(entries, {
      id: "f1",
      createdAt: AT,
      kind: "filmmaker",
      text: "First story.",
    });
    entries = appendConversationEntry(entries, {
      id: "d1",
      createdAt: AT2,
      kind: "director",
      status: "complete",
      evidence: evidence("First story.", "pred-1"),
      summary: "A continuous forward journey.",
    });
    entries = appendConversationEntry(entries, {
      id: "c1",
      createdAt: AT2,
      kind: "construction",
      beatId: "B",
      status: "constructing",
    });
    entries = appendConversationEntry(entries, {
      id: "f2",
      createdAt: AT2,
      kind: "filmmaker",
      text: "Second story.",
    });
    expect(entries.map((entry) => entry.id)).toEqual(["f1", "d1", "c1", "f2"]);
    expect(entries[0]).toMatchObject({ kind: "filmmaker", text: "First story.", createdAt: AT });
    expect((entries[1] as DirectorConversationEntry).evidence?.predictionId).toBe("pred-1");
  });

  it("creates a pending Director entry and resolves it in place", () => {
    let entries: ConversationEntry[] = [
      { id: "f1", createdAt: AT, kind: "filmmaker", text: "First story." },
      { id: "d1", createdAt: AT2, kind: "director", status: "planning" },
    ];
    expect((entries[1] as DirectorConversationEntry).status).toBe("planning");
    entries = resolveDirectorEntry(entries, "d1", {
      status: "complete",
      evidence: evidence("First story.", "pred-1"),
      summary: "A continuous forward journey through connected spaces.",
    });
    const director = entries[1] as DirectorConversationEntry;
    expect(director.id).toBe("d1");
    expect(director.createdAt).toBe(AT2);
    expect(director.status).toBe("complete");
    expect(director.summary).toBe("A continuous forward journey through connected spaces.");
    expect(director.evidence?.predictionId).toBe("pred-1");
    expect(entries).toHaveLength(2);
  });

  it("resolves the same Director entry to failed without changing createdAt", () => {
    let entries: ConversationEntry[] = [
      { id: "d1", createdAt: AT2, kind: "director", status: "planning" },
    ];
    entries = resolveDirectorEntry(entries, "d1", {
      status: "failed",
      error: "Director planning failed",
    });
    const director = entries[0] as DirectorConversationEntry;
    expect(director.id).toBe("d1");
    expect(director.createdAt).toBe(AT2);
    expect(director.status).toBe("failed");
    expect(director.error).toBe("Director planning failed");
  });

  it("preserves an earlier filmmaker/Director pair when a later plan is appended", () => {
    let entries: ConversationEntry[] = [
      {
        id: "f1",
        createdAt: AT,
        kind: "filmmaker",
        text: "First story.",
      },
      {
        id: "d1",
        createdAt: AT2,
        kind: "director",
        status: "complete",
        evidence: evidence("First story.", "pred-1"),
        summary: "First journey.",
      },
    ];
    entries = appendConversationEntry(entries, {
      id: "f2",
      createdAt: AT2,
      kind: "filmmaker",
      text: "Revised story.",
    });
    entries = appendConversationEntry(entries, {
      id: "d2",
      createdAt: AT2,
      kind: "director",
      status: "complete",
      evidence: evidence("Revised story.", "pred-2"),
      summary: "Revised journey.",
    });
    expect(entries).toHaveLength(4);
    expect(entries[0]).toMatchObject({ kind: "filmmaker", text: "First story." });
    expect((entries[1] as DirectorConversationEntry).evidence?.predictionId).toBe("pred-1");
    expect(entries[2]).toMatchObject({ kind: "filmmaker", text: "Revised story." });
    expect((entries[3] as DirectorConversationEntry).evidence?.request.story).toBe("Revised story.");
  });

  it("keeps Director evidence including existing-destination anchors when resolving in place", () => {
    const anchored = evidence("Keep traveling through this night forest.", "pred-anchors");
    anchored.request.anchors = [
      { id: "A", label: "A", mediaId: TRUSTED_MEDIA_IDS.forestAtoFA },
      { id: "D", label: "D", mediaId: TRUSTED_MEDIA_IDS.forestAtoFD },
      { id: "F", label: "F", mediaId: TRUSTED_MEDIA_IDS.forestAtoFF },
    ];
    let entries: ConversationEntry[] = [
      { id: "f1", createdAt: AT, kind: "filmmaker", text: "Keep traveling through this night forest." },
      { id: "d1", createdAt: AT2, kind: "director", status: "planning" },
    ];
    entries = resolveDirectorEntry(entries, "d1", {
      status: "complete",
      evidence: anchored,
      summary: "Connect the known forest destinations.",
    });
    const director = entries[1] as DirectorConversationEntry;
    expect(director.status).toBe("complete");
    expect(director.evidence?.request.anchors?.map((anchor) => anchor.id)).toEqual(["A", "D", "F"]);
    expect(director.evidence?.predictionId).toBe("pred-anchors");
    expect(director.createdAt).toBe(AT2);
  });

  it("resolves only the matching construction operation", () => {
    let entries: ConversationEntry[] = [
      { id: "b", createdAt: AT, kind: "construction", beatId: "B", status: "constructing" },
    ];
    entries = resolveConstructionEntry(entries, "b", {
      status: "constructed",
      imageUrl: "/api/runtime-media/b",
    });
    entries = appendConversationEntry(entries, {
      id: "c",
      createdAt: AT2,
      kind: "construction",
      beatId: "C",
      status: "constructing",
    });
    expect(entries[0]).toMatchObject({
      id: "b",
      createdAt: AT,
      beatId: "B",
      status: "constructed",
      imageUrl: "/api/runtime-media/b",
    });
    expect(entries[1]).toMatchObject({ id: "c", beatId: "C", status: "constructing" });

    entries = resolveConstructionEntry(entries, "c", {
      status: "constructed",
      imageUrl: "/api/runtime-media/c",
    });
    entries = appendConversationEntry(entries, {
      id: "d",
      createdAt: AT2,
      kind: "construction",
      beatId: "D",
      status: "constructing",
    });
    entries = resolveConstructionEntry(entries, "d", {
      status: "failed",
      error: "Destination construction failed.",
    });

    expect(entries.map((entry) => ("status" in entry ? entry.status : entry.kind))).toEqual([
      "constructed",
      "constructed",
      "failed",
    ]);
    expect(entries[0]).toMatchObject({ beatId: "B", imageUrl: "/api/runtime-media/b" });
    expect(entries[1]).toMatchObject({ beatId: "C", imageUrl: "/api/runtime-media/c" });
    expect(entries[2]).toMatchObject({
      beatId: "D",
      status: "failed",
      error: "Destination construction failed.",
    });
  });

  it("creates pending Blocking and Shooting entries and resolves them in place", () => {
    const assessment = {
      shootability: "shootable" as const,
      summary: "Track forward through the connected volumes.",
      route: "Advance.",
      threshold: "The opening.",
      camera: "Track forward.",
      parallax: "Near walls.",
      transitionStrategy: "Pass through.",
      segmentPromptAddition: "Track forward.",
      camotionSuitability: "appropriate" as const,
      concerns: [],
    };
    let entries: ConversationEntry[] = [
      { id: "b1", createdAt: AT, kind: "blocking", journeyId: "A-B", status: "blocking" },
      { id: "s1", createdAt: AT2, kind: "shooting", journeyId: "A-B", status: "shooting" },
    ];
    entries = resolveBlockingEntry(entries, "b1", { status: "blocked", assessment });
    expect(entries[0]).toMatchObject({
      id: "b1",
      kind: "blocking",
      status: "blocked",
      assessment,
    });
    entries = resolveShootingEntry(entries, "s1", {
      status: "failed",
      error: "Shoot failed",
    });
    expect(entries[1]).toMatchObject({
      id: "s1",
      kind: "shooting",
      status: "failed",
      error: "Shoot failed",
    });
  });
});
