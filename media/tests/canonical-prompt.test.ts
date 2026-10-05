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
  FAR_FIELD_FUTURE_SPACE,
  PULL_FORWARD_CONTINUITY_OFF,
  WORLD_CONTINUITY,
  assembleCanonicalConstructionPrompt,
  assembleCanonicalRepairPrompt,
  assembleOpeningFramePrompt,
  assembleCharacterRepairPrompt,
  persistentSubjectInstruction,
  canonicalConstructionSectionStarts,
  pullForwardContinuityClause,
  pullForwardReferenceEnabledFromUnknown,
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

test("canonical construction sections follow destination → spatial → route → grammar → pull-forward → far-field", () => {
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
          "keep the subject only at its current location.",
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

test("pull-forward defaults ON and keeps source-image world continuity", () => {
  assert.equal(pullForwardReferenceEnabledFromUnknown(undefined), true);
  assert.equal(pullForwardReferenceEnabledFromUnknown(true), true);
  assert.equal(pullForwardReferenceEnabledFromUnknown(false), false);
  assert.equal(pullForwardContinuityClause({}), WORLD_CONTINUITY);
  const prompt = assembleCanonicalConstructionPrompt(CANYON_CONSTRUCT);
  assert.ok(prompt.includes(WORLD_CONTINUITY));
  assert.equal(prompt.includes(PULL_FORWARD_CONTINUITY_OFF), false);
});

test("pull-forward OFF replaces only visual-inheritance language and keeps grammar, spatial, far-field", () => {
  for (const grammar of CAMERA_GRAMMARS) {
    const prompt = assembleCanonicalConstructionPrompt({
      ...CANYON_CONSTRUCT,
      cameraGrammar: grammar,
      pullForwardReferenceEnabled: false,
    });
    const law = stillViewpointClause(grammar);
    assert.equal(countPromptOccurrences(prompt, law), 1, `${grammar} still law must appear once`);
    assert.ok(prompt.includes(constructionTravelClause(grammar)));
    assert.match(prompt, /SPATIAL PROGRESSION IS PRIMARY/);
    assert.ok(prompt.includes(CANYON_CONSTRUCT.visualDescription));
    assert.ok(prompt.includes(CANYON_CONSTRUCT.intent));
    assert.match(prompt, /Far-field continuity:/);
    assert.ok(prompt.includes(PULL_FORWARD_CONTINUITY_OFF));
    assert.equal(prompt.includes(WORLD_CONTINUITY), false);
    assert.doesNotMatch(prompt, /Preserve the same physical world, materials, lighting character/);
    assert.doesNotMatch(prompt, /Keeping the source composition and substituting new content is a failure/);
    const starts = canonicalConstructionSectionStarts(prompt, grammar);
    assert.ok(starts.destinationIntent >= 0);
    assert.ok(starts.spatialProgression >= 0);
    assert.ok(starts.cameraGrammarLaw >= 0);
    assert.ok(starts.pullForwardContinuity >= 0);
    assert.ok(starts.farFieldContinuity >= 0);
    assert.ok(starts.spatialProgression < starts.cameraGrammarLaw);
    assert.ok(starts.cameraGrammarLaw < starts.pullForwardContinuity);
    assert.ok(starts.pullForwardContinuity < starts.farFieldContinuity);
  }
});

test("far-field continuity is future space and does not pre-position the persistent subject", () => {
  const withFarField = assembleCanonicalConstructionPrompt(CANYON_CONSTRUCT);
  assert.ok(withFarField.includes(FAR_FIELD_FUTURE_SPACE));
  assert.ok(withFarField.indexOf("Far-field continuity:") < withFarField.indexOf(FAR_FIELD_FUTURE_SPACE));
  const pullForwardOff = assembleCanonicalConstructionPrompt({
    ...CANYON_CONSTRUCT,
    pullForwardReferenceEnabled: false,
  });
  assert.ok(pullForwardOff.includes(FAR_FIELD_FUTURE_SPACE));
  const withoutFarField = assembleCanonicalConstructionPrompt({
    intent: CANYON_CONSTRUCT.intent,
    visualDescription: CANYON_CONSTRUCT.visualDescription,
  });
  assert.equal(withoutFarField.includes("Far-field continuity:"), false);
  assert.equal(withoutFarField.includes(FAR_FIELD_FUTURE_SPACE), false);
  const repair = assembleCanonicalRepairPrompt({
    role: "end",
    intent: CANYON_CONSTRUCT.intent,
    visualDescription: CANYON_CONSTRUCT.visualDescription,
    instruction: "Keep the same car on the road and open a route into the tunnel.",
  });
  assert.equal(repair.includes("Far-field continuity:"), false);
  assert.equal(repair.includes(FAR_FIELD_FUTURE_SPACE), false);
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
  assert.match(prompt, /Reshoot scope: TRAVERSAL/);
  const held = assembleCanonicalRepairPrompt({
    role: "end",
    intent: "Follow the robot.",
    visualDescription: "The robot climbs the airship rail.",
    instruction: "Move the camera closer to the hatch.",
    cameraGrammar: "follow",
    holdSubject: { description: "Cream capsule body, orange stripe, ribbed arms." },
  });
  assert.match(held, /Hold the persistent subject's identity/);
  assert.match(held, /Cream capsule body/);
  assert.match(held, /Reshoot scope: TRAVERSAL/);
  assert.match(prompt, /Do not convert a pursuit still into a lead-facing view of the subject/);
  assert.doesNotMatch(prompt, /nose|headlights|bumper|hood/);
  assert.match(prompt, /behind a persistent subject/);
  assert.doesNotMatch(prompt, /SPATIAL PROGRESSION IS PRIMARY/);
});

test("persistent subject copy is omitted unless a subject sheet is attached", () => {
  const opening = assembleOpeningFramePrompt(FILMMAKER_STORY, "pov");
  const construct = assembleCanonicalConstructionPrompt(CANYON_CONSTRUCT);
  assert.equal(opening.includes("PERSISTENT SUBJECT:"), false);
  assert.equal(construct.includes("PERSISTENT SUBJECT:"), false);
});

test("opening subject copy treats the sheet as identity and not scene continuity", () => {
  const prompt = assembleOpeningFramePrompt(FILMMAKER_STORY, "pov", {
    description: "Giant golden puppy parade balloon with caramel floppy ears.",
  });
  assert.ok(prompt.includes("PERSISTENT SUBJECT:\nGiant golden puppy parade balloon with caramel floppy ears."));
  assert.ok(prompt.includes("authoritative visual definition of the persistent subject"));
  assert.ok(prompt.includes("Do not copy the reference image's background"));
  assert.equal(prompt.includes("previous canonical defines WHERE"), false);
  assert.ok(prompt.indexOf("PERSISTENT SUBJECT:") < prompt.indexOf(`Journey: ${FILMMAKER_STORY}`));
});

test("later canonical construction does not inject subject-sheet language", () => {
  const prompt = assembleCanonicalConstructionPrompt(CANYON_CONSTRUCT);
  assert.equal(prompt.includes("PERSISTENT SUBJECT:"), false);
  assert.equal(prompt.includes("authoritative visual definition"), false);
});

test("character repair asks to keep the candidate and correct identity only", () => {
  const prompt = assembleCharacterRepairPrompt({
    description: "Giant golden puppy parade balloon with caramel floppy ears and a red collar.",
    visualDescription: "The balloon is nearly horizontal in the wind above the avenue.",
    instruction: "The floppy ears became short and upright. Restore the long caramel ears and red collar.",
  });
  assert.ok(prompt.includes("CHARACTER CONSISTENCY REPAIR"));
  assert.ok(prompt.includes("authoritative identity reference"));
  assert.ok(prompt.includes("nearly horizontal in the wind"));
  assert.ok(prompt.includes("Restore the long caramel ears and red collar."));
  assert.ok(prompt.includes("Do not reproduce the pose or composition of the character reference sheet."));
  assert.ok(prompt.includes("Do not turn the subject around"));
  assert.ok(prompt.includes("ignore that part of the instruction"));
  const follow = assembleCharacterRepairPrompt({
    description: "A small retro robot.",
    visualDescription: "The robot runs away along the monorail roof.",
    instruction: "Add the head antennae.",
    cameraGrammar: "follow",
  });
  assert.match(follow, /FOLLOW grammar/);
  assert.match(follow, /behind or beside the subject/);
  assert.match(follow, /Keep that angle/);
  assert.match(prompt, /Reshoot scope: CHARACTER/);
  const both = assembleCharacterRepairPrompt({
    description: "A small retro robot.",
    visualDescription: "The robot runs away along the monorail roof.",
    instruction: "Add the head antennae.",
    cameraGrammar: "follow",
    spatialInstruction: "Show the robot farther ahead on the roof.",
  });
  assert.match(both, /Reshoot scope: BOTH/);
  assert.match(both, /Show the robot farther ahead on the roof/);
  assert.match(both, /Do not move the subject back/);
  assert.equal(prompt.includes("SPATIAL PROGRESSION IS PRIMARY"), false);
});

test("subject copy uses identity wording and not scene continuity", () => {
  const prompt = persistentSubjectInstruction({
    description: "A red collar and gold tag.",
  });
  assert.ok(prompt.includes("authoritative visual definition"));
  assert.equal(prompt.includes("previous canonical defines WHERE"), false);
});
