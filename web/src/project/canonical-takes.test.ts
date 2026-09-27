import { describe, expect, it } from "vitest";
import { createNewProject } from "./new-project";
import { frameWithAppendedCanonicalTake, canonicalTakes, locateCanonicalTake, projectWithSelectedCanonicalTake, selectedCanonicalTake } from "./canonical-takes";
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
});
