import { describe, expect, it } from "vitest";
import { createNewProject } from "./new-project";
import { characterCheckForTake } from "./character-consistency";
import { frameWithAppendedCanonicalTake, canonicalTakes, locateCanonicalTake, projectWithCanonicalCharacterCheck, projectWithReshootInstruction, projectWithSelectedCanonicalTake, selectedCanonicalTake } from "./canonical-takes";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { projectWithReplacedStartImage } from "./starting-frame";

const PNG_A = {
  mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  imageUrl: "/api/runtime-media/upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};
const PNG_B = {
  mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  imageUrl: "/api/runtime-media/upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

describe("canonical takes", () => {
  it("synthesizes take 1 from a legacy single still", () => {
    const frame = {
      id: "A",
      label: "A",
      imageOrigin: "user" as const,
      image: PNG_A.imageUrl,
      mediaId: PNG_A.mediaId,
    };
    const takes = canonicalTakes(frame);
    expect(takes).toHaveLength(1);
    expect(takes[0]?.mediaId).toBe(PNG_A.mediaId);
    expect(selectedCanonicalTake(frame)?.number).toBe(1);
  });

  it("appends a reshoot without destroying the first still", () => {
    const empty = createNewProject().storyboard[0]!;
    const first = frameWithAppendedCanonicalTake(empty, { ...PNG_A, origin: "user", source: "upload" });
    const second = frameWithAppendedCanonicalTake(first, { ...PNG_B, origin: "generated", source: "repair" });
    expect(canonicalTakes(second)).toHaveLength(2);
    expect(second.mediaId).toBe(PNG_B.mediaId);
    expect(canonicalTakes(second)[0]?.mediaId).toBe(PNG_A.mediaId);
    expect(selectedCanonicalTake(second)?.id).toBe("A:canonical:2");
  });

  it("locates a take on its destination", () => {
    const empty = { ...createNewProject().storyboard[0]!, id: "B", label: "B" };
    const first = frameWithAppendedCanonicalTake(empty, { ...PNG_A, origin: "user", source: "upload" });
    const second = frameWithAppendedCanonicalTake(first, { ...PNG_B, origin: "generated", source: "repair" });
    const located = locateCanonicalTake([second], "B:canonical:1");
    expect(located?.frame.id).toBe("B");
    expect(located?.index).toBe(0);
    expect(located?.takes).toHaveLength(2);
    expect(locateCanonicalTake([second], "missing")).toBeUndefined();
  });

  it("selects an earlier still without reordering or dropping takes", () => {
    const forest = createForestProject();
    const project = {
      ...forest,
      storyboard: forest.storyboard.map((frame) =>
        frame.id === "B"
          ? frameWithAppendedCanonicalTake(frame, { ...PNG_B, origin: "generated", source: "repair" })
          : frame,
      ),
    };
    const before = canonicalTakes(project.storyboard.find((frame) => frame.id === "B")!);
    const selected = projectWithSelectedCanonicalTake(project, "B:canonical:1");
    const frame = selected.storyboard.find((item) => item.id === "B")!;
    const after = canonicalTakes(frame);
    expect(after.map((take) => take.id)).toEqual(before.map((take) => take.id));
    expect(after.map((take) => take.mediaId)).toEqual(before.map((take) => take.mediaId));
    expect(frame.selectedTakeId).toBe("B:canonical:1");
    expect(frame.mediaId).toBe(before[0]?.mediaId);
    expect(frame.image).toBe(before[0]?.imageUrl);
    expect(selected.destinations.find((destination) => destination.id === "B")?.image).toBe(before[0]?.imageUrl);
    expect(projectWithSelectedCanonicalTake(selected, "B:canonical:1")).toBe(selected);
    expect(projectWithSelectedCanonicalTake(selected, "missing")).toBe(selected);
  });

  it("keeps prior uploads when replacing A", () => {
    const once = projectWithReplacedStartImage(createNewProject(), PNG_A);
    const twice = projectWithReplacedStartImage(once, PNG_B);
    const frame = twice.storyboard[0]!;
    expect(canonicalTakes(frame)).toHaveLength(2);
    expect(frame.mediaId).toBe(PNG_B.mediaId);
  });

  it("keeps a character check on the take it scored", () => {
    const project = projectWithReplacedStartImage(createNewProject(), PNG_A);
    const takeId = selectedCanonicalTake(project.storyboard[0]!)!.id;
    const checked = projectWithCanonicalCharacterCheck(project, takeId, {
      score: 42,
      status: "DRIFTING",
      observations: ["Stripe moved."],
      repairInstructions: ["Restore the orange stripe."],
      repairNeeded: true,
    });
    const noted = projectWithReshootInstruction(checked, "A", "Keep the low angle.");
    expect(selectedCanonicalTake(noted.storyboard[0]!)?.characterConsistency?.score).toBe(42);
    expect(noted.storyboard[0]?.reshootInstruction).toBe("Keep the low angle.");
    expect(projectWithReshootInstruction(noted, "A", "  ").storyboard[0]?.reshootInstruction).toBeUndefined();
  });

  it("reads an earlier character log when the take has no stored check", () => {
    const take = { mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" };
    const check = characterCheckForTake(take, [
      {
        id: "character-1",
        createdAt: "2026-10-05T15:00:00.000Z",
        kind: "character",
        beatId: "B",
        status: "drift",
        score: 35,
        consistencyStatus: "FAILED",
        observations: ["The flag is missing."],
        repairInstructions: ["Add the red flag."],
        candidateMediaId: take.mediaId,
      },
      {
        id: "character-2",
        createdAt: "2026-10-05T15:01:00.000Z",
        kind: "character",
        beatId: "B",
        status: "pass",
        score: 85,
        consistencyStatus: "GOOD",
        candidateMediaId: "upload-cccccccccccccccccccccccccccccccc",
      },
    ]);
    expect(check).toEqual({
      score: 35,
      status: "FAILED",
      observations: ["The flag is missing."],
      repairInstructions: ["Add the red flag."],
      repairNeeded: true,
    });
    expect(
      characterCheckForTake(
        { mediaId: take.mediaId, characterConsistency: { score: 42, status: "DRIFTING", observations: [], repairInstructions: [], repairNeeded: true } },
        [],
      )?.score,
    ).toBe(42);
  });
});
