import { describe, expect, it } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { createNewProject } from "../project/new-project";
import { createWardrobeProject } from "../fixtures/wardrobe-loop";
import { projectWithDirectorPlan } from "../project/storyboard";
import type { ConversationEntry } from "../project/conversation";
import {
  cinematographerCardCopy,
  cinematographerScores,
  destinationCardCopy,
  destinationDescription,
  formatJourneyArrow,
  groupConversationEntries,
  journeyProgressFromProject,
} from "./conversation-console";

const AT = "2026-09-07T22:03:00.000Z";
const AT2 = "2026-09-07T22:04:00.000Z";

describe("journey progress rail", () => {
  it("hides until a journey with at least two destinations exists", () => {
    expect(journeyProgressFromProject(createNewProject())).toBeNull();
  });

  it("uses storyboard order when a planned journey exists", () => {
    const planned = projectWithDirectorPlan(
      { ...createWardrobeProject(), journeys: [] },
      {
        summary: "Forward.",
        beats: [
          { id: "B", intent: "Enter the next volume.", visualDescription: "A corridor." },
          { id: "C", intent: "Continue.", visualDescription: "Deeper." },
        ],
      },
    );
    const progress = journeyProgressFromProject(planned);
    expect(progress?.nodes.map((node) => node.letter)).toEqual(["A", "B", "C"]);
    expect(progress?.nodes.map((node) => node.status)).toEqual(["complete", "pending", "pending"]);
    expect(progress?.segments.map((segment) => segment.label)).toEqual(["A→B", "B→C"]);
    expect(progress?.segments.every((segment) => segment.status === "pending")).toBe(true);
  });

  it("marks constructed stills and accepted takes separately", () => {
    const forest = createForestProject();
    const complete = journeyProgressFromProject(forest);
    expect(complete?.nodes.every((node) => node.status === "complete")).toBe(true);
    expect(complete?.segments.every((segment) => segment.status === "complete")).toBe(true);

    const shooting = journeyProgressFromProject(forest, { shootingJourneyIds: ["C-D"] });
    expect(shooting?.segments.find((segment) => segment.journeyId === "C-D")?.status).toBe("active");
    expect(shooting?.segments.find((segment) => segment.journeyId === "B-C")?.status).toBe("complete");
    expect(shooting?.nodes.find((node) => node.id === "C")?.status).toBe("complete");

    const constructing = journeyProgressFromProject(forest, { constructingBeatId: "C" });
    expect(constructing?.nodes.find((node) => node.id === "C")?.status).toBe("active");
    expect(constructing?.segments.find((segment) => segment.journeyId === "B-C")?.status).toBe("complete");
  });

  it("falls back to production journeys when the storyboard is only A", () => {
    const wardrobe = createWardrobeProject();
    const progress = journeyProgressFromProject(wardrobe);
    expect(progress?.nodes.map((node) => node.letter)).toEqual(["A", "B", "C", "D", "E"]);
    expect(progress?.segments.map((segment) => segment.label)).toEqual(["A→B", "B→C", "C→D", "D→E"]);
  });

  it("keeps every destination in the rail, including past Z", () => {
    const ids = [
      ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
      "AA",
    ];
    const progress = journeyProgressFromProject({
      ...createNewProject(),
      storyboard: ids.map((id) => ({ id, label: id, imageOrigin: "none" as const })),
    });
    expect(progress?.nodes.map((node) => node.letter)).toEqual(ids);
    expect(progress?.segments).toHaveLength(26);
  });
});

describe("conversation presentation grouping", () => {
  it("groups a cinematographer evaluation with the following blocking turn", () => {
    const entries: ConversationEntry[] = [
      {
        id: "eval",
        createdAt: AT,
        kind: "agent",
        status: "evaluated",
        destinationIds: ["C"],
        journeyId: "B-C",
        setConsistency: 85,
        traversalConfidence: 75,
      },
      {
        id: "block",
        createdAt: AT2,
        kind: "blocking",
        journeyId: "B-C",
        status: "blocked",
        assessment: {
          shootability: "shootable",
          summary: "Track forward.",
          route: "Advance.",
          threshold: "The opening.",
          camera: "Track forward.",
          parallax: "Near walls.",
          transitionStrategy: "Pass through.",
          segmentPromptAddition: "Track forward through the visible opening.",
          pace: "fast",
          setConsistency: 85,
          traversalConfidence: 75,
          concerns: [],
        },
      },
      {
        id: "shoot",
        createdAt: AT2,
        kind: "shooting",
        journeyId: "B-C",
        status: "shooting",
      },
    ];
    const blocks = groupConversationEntries(entries);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      kind: "cinematographer",
      evaluation: { id: "eval" },
      blocking: { id: "block" },
    });
    expect(blocks[1]).toMatchObject({ kind: "entry", entry: { id: "shoot" } });
    expect(cinematographerScores(blocks[0] as Extract<(typeof blocks)[number], { kind: "cinematographer" }>)).toEqual({
      setConsistency: 85,
      traversalConfidence: 75,
    });
    expect(cinematographerCardCopy(blocks[0] as Extract<(typeof blocks)[number], { kind: "cinematographer" }>)).toContain(
      "CINEMATOGRAPHER · B → C",
    );
    expect(cinematographerCardCopy(blocks[0] as Extract<(typeof blocks)[number], { kind: "cinematographer" }>)).toContain(
      "Track forward through the visible opening.",
    );
  });

  it("keeps repair cards and destination copy as distinct presentation", () => {
    expect(formatJourneyArrow("B-C")).toBe("B → C");
    expect(destinationCardCopy("B", "constructed", AT, { imageUrl: "/b.png" })).toContain("DESTINATION B");
    expect(destinationDescription(createForestProject(), "B")).toBe(
      "Root-tunnel mouth. The dark opening is slightly right of center.",
    );
    const repairing: ConversationEntry = {
      id: "r1",
      createdAt: AT,
      kind: "agent",
      status: "repairing",
      destinationIds: ["D"],
      journeyId: "C-D",
      recommendation: "RESHOOT_END",
      instruction: "Keep the destination, strengthen the route.",
      setConsistency: 25,
      traversalConfidence: 45,
    };
    expect(groupConversationEntries([repairing])).toEqual([{ kind: "entry", entry: repairing }]);
  });
});
