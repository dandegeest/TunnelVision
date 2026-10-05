import assert from "node:assert/strict";
import { test } from "node:test";

import {
  characterConsistencyFromModelText,
  characterConsistencyFromScore,
} from "../src/cinematographer/character-consistency.ts";
import { characterConsistencyUserPrompt } from "../src/cinematographer/character-consistency-prompts.ts";

test("character consistency passes at 60 and repairs below it", () => {
  const passing = characterConsistencyFromScore(60, ["Collar matches."], ["Ignore this."]);
  assert.equal(passing.status, "GOOD");
  assert.equal(passing.repairNeeded, false);
  assert.equal(passing.repairInstructions, undefined);

  const drifting = characterConsistencyFromScore(59, ["Ears shortened."], ["Restore the long ears."]);
  assert.equal(drifting.status, "DRIFTING");
  assert.equal(drifting.repairNeeded, true);
  assert.deepEqual(drifting.repairInstructions, ["Restore the long ears."]);

  const failed = characterConsistencyFromScore(39, ["Different breed."], []);
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.repairNeeded, true);
});

test("character consistency derives the gate from the score", () => {
  const consistency = characterConsistencyFromModelText(
    '{"score":45,"status":"GOOD","observations":["Ears became short."],"repairInstructions":["Restore the caramel ears."]}',
  );
  assert.equal(consistency.status, "DRIFTING");
  assert.equal(consistency.repairNeeded, true);
  assert.deepEqual(consistency.observations, ["Ears became short."]);
});

test("character consistency prompt stays on identity", () => {
  const prompt = characterConsistencyUserPrompt("Red collar and caramel ears.", "follow");
  assert.match(prompt, /Image 1 is the authoritative persistent subject reference/);
  assert.match(prompt, /Score image 2 from its own camera angle/);
  assert.match(prompt, /Red collar and caramel ears/);
  assert.match(prompt, /not visible from this angle/);
  assert.match(prompt, /Do not ask for a repair that turns the subject around/);
  assert.match(prompt, /from behind or from the side/);
  assert.match(prompt, /A part hidden by that angle is not identity drift/);
  assert.doesNotMatch(prompt, /front details are expected to be hidden/);
  assert.doesNotMatch(prompt, /traversal|set consistency|shootable/i);
  assert.doesNotMatch(characterConsistencyUserPrompt("A red collar.", "lead"), /from behind or from the side/);
});
