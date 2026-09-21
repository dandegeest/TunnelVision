import { describe, expect, it } from "vitest";
import { suggestedProjectName, titleFromJourneyPrompt } from "./project-name";

describe("title from journey prompt", () => {
  it("uses a short first line as the title when the story follows", () => {
    expect(
      titleFromJourneyPrompt("Paper Chase\n\nA paper airplane over a marble canyon, then out across open desert."),
    ).toBe("Paper Chase");
    expect(
      titleFromJourneyPrompt(
        "Marble Mountain\n\nA single glass marble begins at the summit of an enormous handcrafted marble run.",
      ),
    ).toBe("Marble Mountain");
  });

  it("creates a short name when the prompt has no title line", () => {
    expect(titleFromJourneyPrompt("Travel forward through this night forest and keep going.")).toBe(
      "Travel forward through this",
    );
    expect(titleFromJourneyPrompt("Travel the forest.")).toBe("Travel the forest");
    expect(titleFromJourneyPrompt("")).toBe("Untitled");
  });

  it("keeps an existing project title", () => {
    expect(
      suggestedProjectName({
        title: "PaperChase",
        story: "Travel forward through this night forest and keep going.",
      }),
    ).toBe("PaperChase");
    expect(
      suggestedProjectName({
        title: "UNTITLED",
        story: "Night Forest\n\nTravel forward through connected volumes.",
      }),
    ).toBe("Night Forest");
  });
});
