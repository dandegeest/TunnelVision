import assert from "node:assert/strict";
import { test } from "node:test";

import {
  UNEMBODIED_FIRST_PERSON_POV,
  LOCOMOTION_PACE_MACRO,
  LOCOMOTION_PACE_PHRASES,
  TUNNELVISION_LOCOMOTION_BASELINE,
  TUNNELVISION_LOCOMOTION_BASELINE_TEMPLATE,
  composeShootingPrompt,
  locomotionBaseline,
} from "../src/cinematographer/shooting-prompt.ts";

test("locomotion baseline keeps continuous travel and unembodied first-person POV", () => {
  assert.match(TUNNELVISION_LOCOMOTION_BASELINE, /First person POV camera continuously moving forward/);
  assert.match(TUNNELVISION_LOCOMOTION_BASELINE, /at a constant, fast speed/);
  assert.match(
    TUNNELVISION_LOCOMOTION_BASELINE,
    /physically traveling from the supplied starting location to the supplied ending location along a route appropriate to the visible world, arriving at the supplied ending location in uninterrupted forward motion/,
  );
  assert.match(
    TUNNELVISION_LOCOMOTION_BASELINE,
    /The camera physically follows the available route through the environment, crossing openings, thresholds, tunnels, paths, or open space only when they naturally exist in the supplied world/,
  );
  assert.doesNotMatch(TUNNELVISION_LOCOMOTION_BASELINE, /through openings, tunnels, thresholds, or paths as necessary/);
  assert.doesNotMatch(TUNNELVISION_LOCOMOTION_BASELINE, /The camera physically crosses thresholds and continues moving forward/);
  assert.doesNotMatch(TUNNELVISION_LOCOMOTION_BASELINE, /No music, no soundtrack, no dialogue/);
  assert.ok(TUNNELVISION_LOCOMOTION_BASELINE.endsWith(UNEMBODIED_FIRST_PERSON_POV));
  assert.match(UNEMBODIED_FIRST_PERSON_POV, /viewer\/camera operator must never be visible in-frame/);
  assert.match(
    UNEMBODIED_FIRST_PERSON_POV,
    /People, animals, vehicles, objects, and other subjects may appear naturally as part of the world/,
  );
  assert.doesNotMatch(TUNNELVISION_LOCOMOTION_BASELINE, /Do not show a person/);
});

test("pace is a baseline macro filled per segment", () => {
  assert.match(TUNNELVISION_LOCOMOTION_BASELINE_TEMPLATE, /environment \{pace\}, physically traveling/);
  assert.equal(locomotionBaseline("fast"), TUNNELVISION_LOCOMOTION_BASELINE);
  assert.match(locomotionBaseline("slow"), /at a constant, slow speed/);
  assert.doesNotMatch(locomotionBaseline("slow"), /fast speed/);
  assert.doesNotMatch(locomotionBaseline("moderate"), /fast speed/);
  assert.match(locomotionBaseline("slow-motion"), /in continuous slow motion/);
  assert.doesNotMatch(locomotionBaseline("slow-motion"), /constant/);
  assert.match(locomotionBaseline("hyperspeed"), /at hyperspeed while still physically traversing space/);
  assert.match(locomotionBaseline("variable"), /variable speed that quickens and eases/);
  assert.doesNotMatch(locomotionBaseline("variable"), /constant/);
  assert.equal(LOCOMOTION_PACE_PHRASES.fast, "at a constant, fast speed");
  assert.ok(!TUNNELVISION_LOCOMOTION_BASELINE_TEMPLATE.includes("fast speed"));
  assert.equal(LOCOMOTION_PACE_MACRO, "{pace}");
});

test("composeShootingPrompt puts shot choreography before the paced baseline", () => {
  const addition =
    "Push straight forward down the center of the corridor toward the destination ahead.";
  const slow = locomotionBaseline("slow");
  const composed = composeShootingPrompt(slow, addition);
  assert.equal(composed, `${addition}\n${slow}`);
  assert.ok(composed.startsWith(addition));
  assert.ok(composed.endsWith(slow));
  assert.match(composed, /at a constant, slow speed/);
});

test("composeShootingPrompt returns the baseline when there is no addition", () => {
  assert.equal(composeShootingPrompt(TUNNELVISION_LOCOMOTION_BASELINE), TUNNELVISION_LOCOMOTION_BASELINE);
  assert.equal(composeShootingPrompt(` ${TUNNELVISION_LOCOMOTION_BASELINE} `, "  "), TUNNELVISION_LOCOMOTION_BASELINE);
});
