import assert from "node:assert/strict";
import { test } from "node:test";

import {
  UNEMBODIED_FIRST_PERSON_POV,
  TUNNELVISION_LOCOMOTION_BASELINE,
  composeShootingPrompt,
} from "../src/cinematographer/shooting-prompt.ts";

test("locomotion baseline keeps continuous travel and unembodied first-person POV", () => {
  assert.match(TUNNELVISION_LOCOMOTION_BASELINE, /First person POV camera continuously moving forward/);
  assert.match(TUNNELVISION_LOCOMOTION_BASELINE, /No music, no soundtrack, no dialogue/);
  assert.ok(TUNNELVISION_LOCOMOTION_BASELINE.endsWith(UNEMBODIED_FIRST_PERSON_POV));
  assert.match(UNEMBODIED_FIRST_PERSON_POV, /viewer\/camera operator must never be visible in-frame/);
  assert.match(
    UNEMBODIED_FIRST_PERSON_POV,
    /People, animals, vehicles, objects, and other subjects may appear naturally as part of the world/,
  );
  assert.doesNotMatch(TUNNELVISION_LOCOMOTION_BASELINE, /Do not show a person/);
});

test("composeShootingPrompt appends a segment addition without rewriting the baseline", () => {
  const addition =
    "Push straight forward down the center of the corridor toward the destination ahead.";
  const composed = composeShootingPrompt(TUNNELVISION_LOCOMOTION_BASELINE, addition);
  assert.equal(composed, `${TUNNELVISION_LOCOMOTION_BASELINE}\n${addition}`);
  assert.ok(composed.startsWith(TUNNELVISION_LOCOMOTION_BASELINE));
  assert.ok(composed.endsWith(addition));
});

test("composeShootingPrompt returns the baseline when there is no addition", () => {
  assert.equal(composeShootingPrompt(TUNNELVISION_LOCOMOTION_BASELINE), TUNNELVISION_LOCOMOTION_BASELINE);
  assert.equal(composeShootingPrompt(` ${TUNNELVISION_LOCOMOTION_BASELINE} `, "  "), TUNNELVISION_LOCOMOTION_BASELINE);
});
