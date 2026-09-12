import assert from "node:assert/strict";
import { test } from "node:test";

import {
  UNEMBODIED_FIRST_PERSON_POV,
  WORLD_SUBJECTS_MAY_APPEAR,
  LOCOMOTION_PACE_MACRO,
  LOCOMOTION_PACE_PHRASES,
  TUNNELVISION_LOCOMOTION_BASELINE,
  TUNNELVISION_LOCOMOTION_BASELINE_TEMPLATE,
  composeShootingPrompt,
  locomotionBaseline,
  splitShootingPrompt,
} from "../src/cinematographer/shooting-prompt.ts";

test("locomotion baseline keeps continuous travel and unembodied first-person POV", () => {
  assert.match(TUNNELVISION_LOCOMOTION_BASELINE, /First person POV camera continuously moving forward/);
  assert.match(TUNNELVISION_LOCOMOTION_BASELINE, /at a constant, fast speed/);
  assert.match(
    TUNNELVISION_LOCOMOTION_BASELINE,
    /physically traveling from the supplied starting location to the supplied ending location along the route described above, arriving at the supplied ending location in uninterrupted forward motion/,
  );
  assert.match(TUNNELVISION_LOCOMOTION_BASELINE, /Maintain continuous physical travel through the visible environment/);
  assert.match(TUNNELVISION_LOCOMOTION_BASELINE, /Do not invent intermediate structures or passageways/);
  assert.match(
    TUNNELVISION_LOCOMOTION_BASELINE,
    /Do not dissolve, morph, crossfade, cut, teleport, retreat, reverse direction, or replace one scene with another/,
  );
  assert.doesNotMatch(TUNNELVISION_LOCOMOTION_BASELINE, /along a route appropriate to the visible world/);
  assert.doesNotMatch(TUNNELVISION_LOCOMOTION_BASELINE, /The camera physically follows the available route/);
  assert.doesNotMatch(TUNNELVISION_LOCOMOTION_BASELINE, /\btunnels?\b/);
  assert.doesNotMatch(TUNNELVISION_LOCOMOTION_BASELINE, /\bthresholds?\b/);
  assert.doesNotMatch(TUNNELVISION_LOCOMOTION_BASELINE, /\bopenings?\b/);
  assert.doesNotMatch(TUNNELVISION_LOCOMOTION_BASELINE, /\bpaths?\b/);
  assert.doesNotMatch(TUNNELVISION_LOCOMOTION_BASELINE, /through openings, tunnels, thresholds, or paths as necessary/);
  assert.doesNotMatch(TUNNELVISION_LOCOMOTION_BASELINE, /The camera physically crosses thresholds and continues moving forward/);
  assert.doesNotMatch(TUNNELVISION_LOCOMOTION_BASELINE, /No music, no soundtrack, no dialogue/);
  assert.ok(TUNNELVISION_LOCOMOTION_BASELINE.endsWith(UNEMBODIED_FIRST_PERSON_POV));
  assert.match(
    UNEMBODIED_FIRST_PERSON_POV,
    /Never show the viewer\/camera operator, their body, shadow, reflection, or FPS-style objects/,
  );
  assert.doesNotMatch(UNEMBODIED_FIRST_PERSON_POV, /must never be visible in-frame/);
  assert.doesNotMatch(UNEMBODIED_FIRST_PERSON_POV, /hands, arms, legs, feet/);
  assert.doesNotMatch(UNEMBODIED_FIRST_PERSON_POV, /weapons, phones, or camera equipment/);
  assert.doesNotMatch(
    TUNNELVISION_LOCOMOTION_BASELINE,
    /People, animals, vehicles, objects, and other subjects may appear naturally as part of the world/,
  );
  assert.match(
    WORLD_SUBJECTS_MAY_APPEAR,
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
  assert.match(composed, /along the route described above/);
  assert.ok(composed.endsWith(UNEMBODIED_FIRST_PERSON_POV));
});

test("composeShootingPrompt keeps CM doorway, open, and positive-boundary route language ahead of the baseline", () => {
  const doorway =
    "Advance across the room and pass directly through the existing open doorway into the visible room beyond.";
  const openAir = "Continue forward through open air toward the distant structure.";
  const pool =
    "Push steadily forward low over the surface of the teal pool, traveling directly across the open water toward the misty base of the waterfall. Remain entirely within the open pool and arrive directly at the base of the falls.";
  const baseline = locomotionBaseline("fast");
  for (const addition of [doorway, openAir, pool]) {
    const composed = composeShootingPrompt(baseline, addition);
    assert.equal(composed, `${addition}\n${baseline}`);
    assert.ok(composed.startsWith(addition));
    assert.ok(composed.endsWith(baseline));
    assert.doesNotMatch(composed.slice(addition.length), /\btunnels?\b/);
  }
  assert.match(composeShootingPrompt(baseline, doorway), /existing open doorway/);
  assert.match(composeShootingPrompt(baseline, openAir), /through open air/);
  assert.doesNotMatch(composeShootingPrompt(baseline, openAir), /invent a tunnel|create a doorway/);
  assert.match(composeShootingPrompt(baseline, pool), /Remain entirely within the open pool/);
  assert.doesNotMatch(composeShootingPrompt(baseline, pool).split("\n")[0] ?? "", /do not invent|tunnel|cave/i);
});

test("composeShootingPrompt returns the baseline when there is no addition", () => {
  assert.equal(composeShootingPrompt(TUNNELVISION_LOCOMOTION_BASELINE), TUNNELVISION_LOCOMOTION_BASELINE);
  assert.equal(composeShootingPrompt(` ${TUNNELVISION_LOCOMOTION_BASELINE} `, "  "), TUNNELVISION_LOCOMOTION_BASELINE);
});

test("splitShootingPrompt keeps CM addition ahead of the global baseline", () => {
  const addition = "Pedestrians and traffic continue naturally through the street.";
  const baseline = locomotionBaseline("fast");
  const composed = composeShootingPrompt(baseline, addition);
  assert.deepEqual(splitShootingPrompt(composed, addition), { addition, baseline });
  assert.deepEqual(splitShootingPrompt(composed), { addition, baseline });
  assert.deepEqual(splitShootingPrompt(baseline), { addition: "", baseline });
  assert.deepEqual(splitShootingPrompt(addition, addition), { addition, baseline: "" });
});
