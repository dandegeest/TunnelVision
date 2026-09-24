import { describe, expect, it } from "vitest";
import { compileStoryIdea, parseLeadingCameraGrammar } from "./story-idea";

describe("leading camera grammar", () => {
  it("defaults to POV", () => {
    expect(parseLeadingCameraGrammar("a walk through a redwood forest")).toEqual({
      cameraGrammar: "pov",
      brief: "a walk through a redwood forest",
    });
  });

  it("accepts POV and FPOV", () => {
    expect(parseLeadingCameraGrammar("POV explore an abandoned hotel").cameraGrammar).toBe("pov");
    expect(parseLeadingCameraGrammar("FPOV descend into a flooded cave").cameraGrammar).toBe("pov");
    expect(parseLeadingCameraGrammar("POV explore an abandoned hotel").brief).toBe("explore an abandoned hotel");
  });

  it("accepts FOLLOW, LEAD, MOUNT, and MOUNTED", () => {
    expect(parseLeadingCameraGrammar("FOLLOW a skier down an extreme mountain drop")).toMatchObject({
      cameraGrammar: "follow",
      brief: "a skier down an extreme mountain drop",
    });
    expect(parseLeadingCameraGrammar("LEAD an astronaut through a lunar station").cameraGrammar).toBe("lead");
    expect(parseLeadingCameraGrammar("MOUNT a camera to a motorcycle racing through Tokyo").cameraGrammar).toBe(
      "mounted",
    );
    expect(parseLeadingCameraGrammar("MOUNTED on the front of a rally car through the forest").cameraGrammar).toBe(
      "mounted",
    );
  });

  it("ignores incidental grammar words", () => {
    expect(parseLeadingCameraGrammar("enter the cavern and follow the illuminated lights").cameraGrammar).toBe("pov");
    expect(parseLeadingCameraGrammar("walk through a mounted cavalry exhibit").cameraGrammar).toBe("pov");
  });

  it("is case-insensitive and allows leading whitespace", () => {
    expect(parseLeadingCameraGrammar("  follow a paper boat").cameraGrammar).toBe("follow");
    expect(parseLeadingCameraGrammar("\nLead the procession").cameraGrammar).toBe("lead");
  });
});

describe("compileStoryIdea", () => {
  it("sends the stripped brief to Screenwriter and returns the Production Prompt", async () => {
    const calls: Array<{ storyIdea: string; cameraGrammar: string }> = [];
    const compiled = await compileStoryIdea("FOLLOW a skier, 5 destinations, watercolor", async (input) => {
      calls.push(input);
      expect(input.storyIdea).toContain("5 destinations");
      expect(input.storyIdea).toContain("watercolor");
      return {
        productionPrompt: "Five watercolor descents down the mountain.",
        title: "Skier",
      };
    });
    expect(calls).toEqual([{ storyIdea: "a skier, 5 destinations, watercolor", cameraGrammar: "follow" }]);
    expect(compiled.storyIdea).toBe("FOLLOW a skier, 5 destinations, watercolor");
    expect(compiled.productionPrompt).toBe("Five watercolor descents down the mountain.");
    expect(compiled.title).toBe("Skier");
    expect(compiled.cameraGrammar).toBe("follow");
  });

  it("does not invent a Production Prompt when Screenwriter fails", async () => {
    await expect(
      compileStoryIdea("a walk through a redwood forest", async () => {
        throw new Error("Screenwriter unavailable");
      }),
    ).rejects.toThrow(/unavailable/);
  });
});
