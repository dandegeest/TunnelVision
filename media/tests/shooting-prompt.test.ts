import assert from "node:assert/strict";
import { test } from "node:test";

import {
  TUNNELVISION_LOCOMOTION_BASELINE,
  composeShootingPrompt,
} from "../src/cinematographer/shooting-prompt.ts";

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
