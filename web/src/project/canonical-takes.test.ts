import { describe, expect, it } from "vitest";
import { createNewProject } from "./new-project";
import { frameWithAppendedCanonicalTake, canonicalTakes, locateCanonicalTake, selectedCanonicalTake } from "./canonical-takes";
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

  it("keeps prior uploads when replacing A", () => {
    const once = projectWithReplacedStartImage(createNewProject(), PNG_A);
    const twice = projectWithReplacedStartImage(once, PNG_B);
    const frame = twice.storyboard[0]!;
    expect(canonicalTakes(frame)).toHaveLength(2);
    expect(frame.mediaId).toBe(PNG_B.mediaId);
  });
});
