import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  CAMERA_GRAMMARS,
  constructionTravelClause,
  stillViewpointClause,
  type CameraGrammar,
} from "../src/cinematographer/camera-grammar.ts";
import { countPromptOccurrences } from "../src/prompts/assemble.ts";
import {
  CANONICAL_CONSTRUCTION_SECTION_ORDER,
  WORLD_CONTINUITY,
  assembleCanonicalConstructionPrompt,
  assembleCanonicalRepairPrompt,
  assembleOpeningFramePrompt,
  canonicalConstructionSectionStarts,
} from "../src/prompts/canonical-destination.ts";

const snapshotDir = join(dirname(fileURLToPath(import.meta.url)), "snapshots");

const CANYON_CONSTRUCT = {
  intent: "Advance along the twisting canyon road toward the rock tunnel.",
  visualDescription: "The same bright red sports car on a twisting canyon road, red-rock walls closing in.",
  nextDestinationVisual:
    "A narrow rock tunnel blasted through the canyon wall, with a bright opening at the far end.",
};

const FILMMAKER_STORY =
  "Photorealistic high-speed run tracking the same bright red sports car through a dramatic desert canyon. High-end live-action automotive cinematography, natural light, monumental scale.";

function loadSnapshot(name: string): string {
  return readFileSync(join(snapshotDir, name), "utf8").replace(/\n$/, "");
}

test("canonical construction sections follow destination → spatial → route → grammar → world → far-field", () => {
  for (const grammar of CAMERA_GRAMMARS) {
    const prompt = assembleCanonicalConstructionPrompt({
      ...CANYON_CONSTRUCT,
      cameraGrammar: grammar,
    });
    const starts = canonicalConstructionSectionStarts(prompt, grammar);
    const ordered = CANONICAL_CONSTRUCTION_SECTION_ORDER.map((section) => starts[section]);
    assert.ok(ordered.every((index) => index >= 0), `${grammar} missing a section`);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      assert.ok(
        ordered[index]! < ordered[index + 1]!,
        `${grammar} section ${CANONICAL_CONSTRUCTION_SECTION_ORDER[index]} must precede ${CANONICAL_CONSTRUCTION_SECTION_ORDER[index + 1]}`,
      );
    }
    assert.ok(
      prompt
        .trim()
        .endsWith(
          "or drive the composition, lighting, or style of the current destination.",
        ),
    );
  }
});

test("each grammar injects its still law once and keeps filmmaker subject/beats intact", () => {
  const constraints: Record<CameraGrammar, RegExp> = {
    pov: /Maintain an unembodied first-person POV/,
    follow: /invisible objective camera behind a persistent subject/,
    lead: /ahead of a persistent subject, facing that subject/,
    mounted: /physically attached to the moving subject, vehicle, or object/,
  };
  for (const grammar of CAMERA_GRAMMARS) {
    const law = stillViewpointClause(grammar);
    const prompt = assembleCanonicalConstructionPrompt({
      ...CANYON_CONSTRUCT,
      cameraGrammar: grammar,
    });
    assert.equal(countPromptOccurrences(prompt, law), 1, `${grammar} still law must appear once`);
    assert.match(prompt, constraints[grammar]);
    assert.ok(prompt.includes(CANYON_CONSTRUCT.visualDescription));
    assert.ok(prompt.includes(CANYON_CONSTRUCT.intent));
    assert.ok(prompt.includes(WORLD_CONTINUITY));
    assert.ok(prompt.includes(constructionTravelClause(grammar)));
    assert.equal(countPromptOccurrences(prompt, "Camera grammar:"), 0);
  }
});

test("mixed-grammar wording is not introduced into a single construction prompt", () => {
  const follow = assembleCanonicalConstructionPrompt({ ...CANYON_CONSTRUCT, cameraGrammar: "follow" });
  assert.match(follow, /FOLLOW viewpoint/);
  assert.doesNotMatch(follow, /This is a LEAD viewpoint/);
  assert.doesNotMatch(follow, /This is a MOUNTED viewpoint/);
  assert.doesNotMatch(follow, /unembodied first-person POV/);
  const lead = assembleCanonicalConstructionPrompt({ ...CANYON_CONSTRUCT, cameraGrammar: "lead" });
  assert.doesNotMatch(lead, /This is a FOLLOW viewpoint from an invisible objective camera behind/);
  assert.doesNotMatch(lead, /This is a MOUNTED viewpoint/);
  const mounted = assembleCanonicalConstructionPrompt({ ...CANYON_CONSTRUCT, cameraGrammar: "mounted" });
  assert.doesNotMatch(mounted, /This is a FOLLOW viewpoint from an invisible objective camera behind/);
  assert.doesNotMatch(mounted, /This is a LEAD viewpoint from an invisible objective camera/);
});

test("opening prompts keep the filmmaker story and inject grammar law once", () => {
  for (const grammar of CAMERA_GRAMMARS) {
    const prompt = assembleOpeningFramePrompt(FILMMAKER_STORY, grammar);
    const law = stillViewpointClause(grammar);
    assert.equal(countPromptOccurrences(prompt, law), 1);
    assert.ok(prompt.includes(`Journey: ${FILMMAKER_STORY}`));
    assert.doesNotMatch(prompt, /elastic distance|do not overtake|stay behind/i);
  }
});

test("representative canyon construction snapshots", () => {
  for (const grammar of CAMERA_GRAMMARS) {
    const prompt = assembleCanonicalConstructionPrompt({
      ...CANYON_CONSTRUCT,
      cameraGrammar: grammar,
    });
    assert.equal(prompt, loadSnapshot(`canonical-construct-${grammar}.txt`));
  }
});

test("FOLLOW canonical repair keeps pursuit geometry over far-field or aesthetic fixes", () => {
  const prompt = assembleCanonicalRepairPrompt({
    role: "end",
    intent: "Keep following the train through the industrial corridor.",
    visualDescription: "The silver train receding through the industrial yard.",
    instruction: "Restore a continuously shootable route from the station.",
    cameraGrammar: "follow",
  });
  assert.match(prompt, /Preserve FOLLOW geometry/);
  assert.match(prompt, /Do not convert a pursuit still into a lead facing the front/);
  assert.match(prompt, /behind a persistent subject/);
  assert.doesNotMatch(prompt, /SPATIAL PROGRESSION IS PRIMARY/);
});
