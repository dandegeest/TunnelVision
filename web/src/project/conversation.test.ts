import { describe, expect, it } from "vitest";
import { createWardrobeProject } from "../fixtures/wardrobe-loop";
import {
  appendConversationEntry,
  preparePlanSubmission,
  resolveConstructionEntry,
  type ConversationEntry,
  type DirectorConversationEntry,
} from "./conversation";
import type { DirectorEvidence } from "./director";
import { TRUSTED_MEDIA_IDS } from "./trusted-media-id";

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

describe("Plan composer submission", () => {
  it("accepts the exact draft as the Director story", () => {
    const submitted = "Travel forward through this world...\nKeep moving. ";
    const result = preparePlanSubmission(submitted, createWardrobeProject());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.submitted).toBe(submitted);
    expect(result.request.story).toBe(submitted);
  });

  it("rejects whitespace-only drafts without building a request", () => {
    expect(preparePlanSubmission("   \n\t  ", createWardrobeProject())).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(preparePlanSubmission("", createWardrobeProject())).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("rejects drafts that cannot start planning without treating them as empty", () => {
    const project = createWardrobeProject();
    delete project.storyboard[0]!.mediaId;
    const result = preparePlanSubmission("A valid story.", project);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("invalid");
    expect(result.message).toMatch(/trusted media identity/i);
  });
});

describe("Plan conversation history", () => {
  it("appends filmmaker, Director, and construction entries oldest to newest", () => {
    let entries: ConversationEntry[] = [];
    entries = appendConversationEntry(entries, {
      id: "f1",
      kind: "filmmaker",
      text: "First story.",
    });
    entries = appendConversationEntry(entries, {
      id: "d1",
      kind: "director",
      evidence: evidence("First story.", "pred-1"),
    });
    entries = appendConversationEntry(entries, {
      id: "c1",
      kind: "construction",
      beatId: "B",
      status: "constructing",
    });
    entries = appendConversationEntry(entries, {
      id: "f2",
      kind: "filmmaker",
      text: "Second story.",
    });
    expect(entries.map((entry) => entry.id)).toEqual(["f1", "d1", "c1", "f2"]);
    expect(entries[0]).toMatchObject({ kind: "filmmaker", text: "First story." });
    expect((entries[1] as DirectorConversationEntry).evidence?.predictionId).toBe("pred-1");
  });

  it("preserves an earlier filmmaker/Director pair when a later plan is appended", () => {
    let entries: ConversationEntry[] = [
      { id: "f1", kind: "filmmaker", text: "First story." },
      { id: "d1", kind: "director", evidence: evidence("First story.", "pred-1") },
    ];
    entries = appendConversationEntry(entries, {
      id: "f2",
      kind: "filmmaker",
      text: "Revised story.",
    });
    entries = appendConversationEntry(entries, {
      id: "d2",
      kind: "director",
      evidence: evidence("Revised story.", "pred-2"),
    });
    expect(entries).toHaveLength(4);
    expect(entries[0]).toMatchObject({ kind: "filmmaker", text: "First story." });
    expect((entries[1] as DirectorConversationEntry).evidence?.predictionId).toBe("pred-1");
    expect(entries[2]).toMatchObject({ kind: "filmmaker", text: "Revised story." });
    expect((entries[3] as DirectorConversationEntry).evidence?.request.story).toBe("Revised story.");
  });

  it("resolves only the matching construction operation", () => {
    let entries: ConversationEntry[] = [
      { id: "b", kind: "construction", beatId: "B", status: "constructing" },
    ];
    entries = resolveConstructionEntry(entries, "b", {
      status: "constructed",
      imageUrl: "/api/runtime-media/b",
    });
    entries = appendConversationEntry(entries, {
      id: "c",
      kind: "construction",
      beatId: "C",
      status: "constructing",
    });
    expect(entries[0]).toMatchObject({
      id: "b",
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
});
