import { describe, expect, it } from "vitest";
import { createForestProject } from "../../fixtures/forest-a-to-f";
import type { ConversationEntry } from "../../project/conversation";
import {
  agentGeneratingLabel,
  cinematographerScanLine,
  compactLettersFromTurn,
  directorScanLine,
  journeyTurnsFromConversation,
  restoreAgentJourneyTurns,
  repairScanLine,
  turnPrompt,
  turnReasoningLines,
} from "./journey-turns";

const AT = "2026-09-21T15:00:00.000Z";

const conversation: ConversationEntry[] = [
  { id: "f1", createdAt: AT, kind: "filmmaker", text: "Through the wardrobe." },
  { id: "d1", createdAt: AT, kind: "director", status: "complete", summary: "Attic into snow." },
  { id: "c1", createdAt: AT, kind: "construction", beatId: "A", status: "constructed" },
  { id: "c2", createdAt: AT, kind: "construction", beatId: "B", status: "constructed" },
  {
    id: "a1",
    createdAt: AT,
    kind: "assembly",
    status: "complete",
    videoUrl: "/wardrobe.mp4",
    filename: "wardrobe.mp4",
    complete: true,
  },
  { id: "f2", createdAt: AT, kind: "filmmaker", text: "Travel the forest." },
  { id: "d2", createdAt: AT, kind: "director", status: "complete", summary: "Root-tunnel mouth." },
  { id: "c3", createdAt: AT, kind: "construction", beatId: "C", status: "constructing" },
  {
    id: "cm1",
    createdAt: AT,
    kind: "blocking",
    journeyId: "B-C",
    status: "blocked",
    assessment: {
      shootability: "needs_review",
      setConsistency: 87,
      traversalConfidence: 62,
      summary: "Spatially coherent, but travel stalls in the tunnel.",
      route: "",
      threshold: "",
      camera: "",
      parallax: "",
      transitionStrategy: "",
      segmentPromptAddition: "",
      pace: "walk",
      concerns: [],
      repairRecommendation: "RESHOOT_END",
      repairInstruction: "Insufficient forward progression.",
    },
  },
  {
    id: "r1",
    createdAt: AT,
    kind: "agent",
    status: "repairing",
    destinationIds: ["C"],
    journeyId: "B-C",
    recommendation: "RESHOOT_END",
    instruction: "Insufficient forward progression.",
    setConsistency: 87,
    traversalConfidence: 62,
  },
];

describe("journey turns from conversation", () => {
  it("groups filmmaker prompts into complete and active turns", () => {
    const turns = journeyTurnsFromConversation(conversation);
    expect(turns).toHaveLength(2);
    expect(turns[0]?.prompt).toBe("Through the wardrobe.");
    expect(turns[0]?.complete).toBe(true);
    expect(turns[0]?.videoUrl).toBe("/wardrobe.mp4");
    expect(compactLettersFromTurn(turns[0]!)).toEqual(["A", "B"]);
    expect(turns[1]?.prompt).toBe("Travel the forest.");
    expect(turns[1]?.complete).toBe(false);
  });

  it("surfaces scan-length Director, Cinematographer, and reshoot copy", () => {
    const turns = journeyTurnsFromConversation(conversation);
    const live = turns[1]!;
    expect(directorScanLine(live.entries, createForestProject())).toBe("Root-tunnel mouth.");
    expect(cinematographerScanLine(live.entries)).toMatchObject({
      pair: "B→C",
      summary: "Spatially coherent, but travel stalls in the tunnel.",
      traversalConfidence: 62,
    });
    expect(repairScanLine(live.entries)).toMatchObject({
      letters: "C",
      travel: 62,
      reason: "Insufficient forward progression.",
      recommendation: "RESHOOT END",
    });
  });

  it("labels the generating destination from live agent activity", () => {
    expect(agentGeneratingLabel("C", { phase: "CONSTRUCTING", activity: { message: "generating destination C", destinationId: "C" }, events: [] })).toBe(
      "Generating C…",
    );
    expect(
      agentGeneratingLabel(null, {
        phase: "REPAIRING_CANONICALS",
        activity: { message: "reshooting destination C", destinationId: "C" },
        events: [],
      }),
    ).toBe("Generating C′…");
    expect(
      agentGeneratingLabel(null, {
        phase: "PLANNING_MOTION",
        activity: { message: "blocking B-C", journeyId: "B-C" },
        events: [],
      }),
    ).toBe("Planning B→C…");
    expect(agentGeneratingLabel(null, { phase: "DIRECTING", activity: null, events: [] }, { directorPlanning: true })).toBe(
      "Planning…",
    );
  });

  it("keeps the submitted prompt and lists Director, beat, cinematographer, and reshoot reasoning", () => {
    const turns = journeyTurnsFromConversation(conversation);
    expect(turnPrompt(turns[0]!)).toBe("Through the wardrobe.");
    const complete = turnReasoningLines(turns[0]!.entries, createForestProject());
    expect(complete.map((line) => line.role)).toEqual(["Director", "A", "B"]);
    expect(complete[0]?.text).toBe("Attic into snow.");
    const live = turnReasoningLines(turns[1]!.entries, createForestProject());
    expect(live.some((line) => line.role === "Director" && line.text === "Root-tunnel mouth.")).toBe(true);
    expect(live.some((line) => line.role === "Cinematographer · B→C")).toBe(true);
    expect(live.some((line) => line.role === "Reshoot · C")).toBe(true);
  });

  it("rebuilds a completed journey turn after reload when conversation is empty", () => {
    const project = createForestProject();
    const turns = restoreAgentJourneyTurns([], project, {
      videoUrl: "/forest.mp4",
      filename: "forest.mp4",
      complete: true,
    }, { idle: true });
    expect(turns).toHaveLength(1);
    expect(turns[0]?.prompt).toBe(project.story);
    expect(turns[0]?.complete).toBe(true);
    expect(turns[0]?.videoUrl).toBe("/forest.mp4");
    expect(turns[0]?.filename).toBe("forest.mp4");
  });

  it("does not treat an in-progress journey as complete while the agent is busy", () => {
    const project = createForestProject();
    const turns = restoreAgentJourneyTurns(
      [{ id: "f1", createdAt: AT, kind: "filmmaker", text: "Travel the forest." }],
      project,
      null,
      { idle: false },
    );
    expect(turns[0]?.complete).toBe(false);
    expect(turns[0]?.videoUrl).toBeUndefined();
  });
});
