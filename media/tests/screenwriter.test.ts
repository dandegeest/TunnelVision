import assert from "node:assert/strict";
import { test } from "node:test";

import { MediaGenerationError } from "../src/errors.ts";
import type { ReasoningProvider } from "../src/reasoning/types.ts";
import {
  DEFAULT_GEMINI_31_PRO_SETTINGS,
  toGemini31ProInput,
} from "../src/replicate/gemini-3.1-pro.ts";
import {
  SCREENWRITER_SYSTEM_INSTRUCTION,
  SCREENWRITER_THINKING_LEVEL,
  conditionStory,
  parseScreenwriterCondition,
  screenwriterUserPrompt,
} from "../src/screenwriter/condition-story.ts";

const reasoning = (text: string): ReasoningProvider => ({
  async complete() {
    return {
      provider: "test",
      model: "test-model",
      modelVersion: null,
      predictionId: "pred",
      status: "succeeded",
      text,
      metadata: {},
      startedAt: "2026-09-24T00:00:00.000Z",
      completedAt: "2026-09-24T00:00:00.100Z",
      elapsedMs: 100,
    };
  },
});

test("screenwriter prompt preserves destination counts and style, and defaults photoreal only when unspecified", () => {
  const counted = screenwriterUserPrompt({
    storyIdea: "a walk in the redwood forest, 5 destinations, add some turns and elevation gains",
    cameraGrammar: "pov",
  });
  assert.match(counted, /5 destinations/);
  assert.match(counted, /elevation gains/);
  const styled = screenwriterUserPrompt({
    storyIdea: "watercolor journey through a flooded library",
    cameraGrammar: "pov",
  });
  assert.match(styled, /watercolor/);
  assert.match(SCREENWRITER_SYSTEM_INSTRUCTION, /destination count/);
  assert.match(SCREENWRITER_SYSTEM_INSTRUCTION, /cinematic photorealism/);
  assert.match(SCREENWRITER_SYSTEM_INSTRUCTION, /do not force photorealism/);
  assert.match(SCREENWRITER_SYSTEM_INSTRUCTION, /end with a concise style line/);
  assert.doesNotMatch(SCREENWRITER_SYSTEM_INSTRUCTION, /only when useful/);
  assert.match(SCREENWRITER_SYSTEM_INSTRUCTION, /only in the title field/);
  assert.doesNotMatch(SCREENWRITER_SYSTEM_INSTRUCTION, /title on the first line/);
  assert.match(SCREENWRITER_SYSTEM_INSTRUCTION, /Do not write Camotion/);
});

test("representative redwood idea keeps title out of the production prompt and ends with style", () => {
  const idea =
    "A walk in the redwoods of california that ends at a cliff overlooking the pacific ocean at sunset";
  const user = screenwriterUserPrompt({ storyIdea: idea, cameraGrammar: "pov" });
  assert.match(user, /redwoods of california/);
  assert.match(user, /pacific ocean at sunset/);
  const parsed = parseScreenwriterCondition(
    JSON.stringify({
      title: "Pacific Edge",
      productionPrompt: [
        "Pacific Edge",
        "",
        "A journey through the redwood forest, eventually reaching a cliff overlooking the Pacific Ocean at sunset.",
        "",
        "Photorealistic live-action, natural light, realistic materials, atmospheric depth.",
      ].join("\n"),
    }),
  );
  assert.equal(parsed.title, "Pacific Edge");
  assert.equal(parsed.productionPrompt.startsWith("Pacific Edge"), false);
  assert.match(parsed.productionPrompt, /redwood forest/);
  assert.match(parsed.productionPrompt, /Pacific Ocean at sunset/);
  assert.match(parsed.productionPrompt, /Photorealistic live-action, natural light/);
});

test("overall journey duration stays story intent and is not turned into shot timing", async () => {
  assert.match(
    SCREENWRITER_SYSTEM_INSTRUCTION,
    /include requested constraints \(overall journey duration, destination count, turns, elevation, ending, motifs\) in story language/,
  );
  assert.match(SCREENWRITER_SYSTEM_INSTRUCTION, /Preserve requested overall journey duration as story intent/);
  assert.match(SCREENWRITER_SYSTEM_INSTRUCTION, /Do not assign individual shot\/traversal durations/);
  assert.doesNotMatch(SCREENWRITER_SYSTEM_INSTRUCTION, /journeyDurationSeconds|targetDuration|shotDuration|destinationCount/);
  assert.match(SCREENWRITER_SYSTEM_INSTRUCTION, /Camera grammar is already chosen/);

  const seen: { systemInstruction?: string; prompt?: string }[] = [];
  const capturing: ReasoningProvider = {
    async complete(input) {
      seen.push({ systemInstruction: input.systemInstruction, prompt: input.prompt });
      const idea = input.prompt ?? "";
      const productionPrompt = /around 30 seconds/.test(idea)
        ? "A roughly 30-second journey through the haunted mansion.\n\nCinematic photorealism."
        : "Follow the mouse on a journey of about a minute through the walls of Paris.\n\nCinematic photorealism.";
      return {
        provider: "test",
        model: "test-model",
        modelVersion: null,
        predictionId: "pred",
        status: "succeeded",
        text: JSON.stringify({ productionPrompt, title: "Duration" }),
        metadata: {},
        startedAt: "2026-09-24T00:00:00.000Z",
        completedAt: "2026-09-24T00:00:00.100Z",
        elapsedMs: 100,
      };
    },
  };

  const seconds = await conditionStory({
    reasoning: capturing,
    storyIdea: "a journey through a haunted mansion, around 30 seconds",
    cameraGrammar: "pov",
  });
  const minute = await conditionStory({
    reasoning: capturing,
    storyIdea: "FOLLOW a mouse through the walls of Paris, about a minute long",
    cameraGrammar: "follow",
  });

  assert.match(seen[0]?.prompt ?? "", /around 30 seconds/);
  assert.match(seen[0]?.systemInstruction ?? "", /overall journey duration/);
  assert.match(seconds.productionPrompt, /30-second/);
  assert.doesNotMatch(seconds.productionPrompt, /destinations of|shot duration|traversal duration/i);
  assert.match(seen[1]?.prompt ?? "", /about a minute long/);
  assert.match(seen[1]?.prompt ?? "", /Camera grammar \(already selected, do not change\): follow/);
  assert.match(minute.productionPrompt, /about a minute/);
  assert.equal(minute.productionPrompt.includes("6 seconds"), false);
});

test("an explicit style stays in the prompt and is not replaced by the photoreal default", () => {
  const parsed = parseScreenwriterCondition(
    JSON.stringify({
      title: "Flooded Library",
      productionPrompt: "Rooms fill with water as the shelves recede.\n\nWatercolor on cold-press paper.",
    }),
  );
  assert.match(parsed.productionPrompt, /Watercolor/);
  assert.equal(parsed.productionPrompt.includes("photoreal"), false);
  assert.match(SCREENWRITER_SYSTEM_INSTRUCTION, /do not force photorealism/);
});

test("screenwriter reasoning is low and the shared Gemini default stays high", () => {
  assert.equal(SCREENWRITER_THINKING_LEVEL, "low");
  assert.equal(DEFAULT_GEMINI_31_PRO_SETTINGS.thinkingLevel, "high");
  const screenwriter = toGemini31ProInput(
    { prompt: "compile this idea" },
    [],
    { thinkingLevel: SCREENWRITER_THINKING_LEVEL },
  );
  const director = toGemini31ProInput({ prompt: "plan this journey" }, []);
  assert.equal(screenwriter.thinking_level, "low");
  assert.equal(director.thinking_level, "high");
});

test("parseScreenwriterCondition requires a production prompt", () => {
  assert.equal(
    parseScreenwriterCondition('{"productionPrompt":"Redwoods\\n\\nFive places.","title":"Redwoods"}').title,
    "Redwoods",
  );
  assert.throws(() => parseScreenwriterCondition('{"productionPrompt":"  "}'), MediaGenerationError);
});

test("conditionStory returns the production prompt and does not call Director planning", async () => {
  const result = await conditionStory({
    reasoning: reasoning('{"productionPrompt":"Night Library\\n\\nWatercolor rooms.","title":"Night Library"}'),
    storyIdea: "watercolor journey through a flooded library",
    cameraGrammar: "pov",
  });
  assert.equal(result.productionPrompt, "Watercolor rooms.");
  assert.equal(result.title, "Night Library");
});
