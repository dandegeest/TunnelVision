import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CAMERA_GRAMMARS,
  INVENT_INTERMEDIATE_STRUCTURES_CLAUSE,
  THRESHOLD_CONNECTIVE_CLAUSE,
} from "../src/cinematographer/camera-grammar.ts";
import {
  UNEMBODIED_FIRST_PERSON_POV,
  WORLD_SUBJECTS_MAY_APPEAR,
  LOCOMOTION_PACE_MACRO,
  LOCOMOTION_PACE_PHRASES,
  TUNNELVISION_LOCOMOTION_BASELINE,
  TUNNELVISION_LOCOMOTION_BASELINE_TEMPLATE,
  composeDirectedShootingPrompt,
  composeJourneyShootingPrompt,
  composeShootingPrompt,
  locomotionBaseline,
  splitShootingPrompt,
  extremePaceLeadIn,
  EXTREME_PACE_LEAD_INS,
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
  assert.match(locomotionBaseline("slow-motion"), /in extreme cinematic slow motion throughout/);
  assert.doesNotMatch(locomotionBaseline("slow-motion"), /constant/);
  assert.match(locomotionBaseline("hyperspeed"), /at extreme hyper-speed while still physically traversing space/);
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
  assert.deepEqual(splitShootingPrompt(composed, addition), { paceLeadIn: "", addition, baseline });
  assert.deepEqual(splitShootingPrompt(composed), { paceLeadIn: "", addition, baseline });
  assert.deepEqual(splitShootingPrompt(baseline), { paceLeadIn: "", addition: "", baseline });
  assert.deepEqual(splitShootingPrompt(addition, addition), { paceLeadIn: "", addition, baseline: "" });
});

test("composeShootingPrompt leads with extreme slow-motion and hyper-speed instructions", () => {
  const addition = "Push straight forward down the center of the corridor toward the destination ahead.";
  const slowMo = locomotionBaseline("slow-motion");
  const hyper = locomotionBaseline("hyperspeed");
  const slowLead = EXTREME_PACE_LEAD_INS["slow-motion"];
  const hyperLead = EXTREME_PACE_LEAD_INS.hyperspeed;
  const slowComposed = composeShootingPrompt(slowMo, addition, "slow-motion");
  const hyperComposed = composeShootingPrompt(hyper, addition, "hyperspeed");
  assert.equal(slowComposed, `${slowLead}\n${addition}\n${slowMo}`);
  assert.equal(hyperComposed, `${hyperLead}\n${addition}\n${hyper}`);
  assert.ok(slowComposed.startsWith(slowLead));
  assert.ok(hyperComposed.startsWith(hyperLead));
  assert.match(slowLead, /extreme cinematic slow motion/);
  assert.match(slowLead, /dramatically slowed temporal rate from beginning to end/);
  assert.match(hyperLead, /extreme hyper-speed/);
  assert.match(hyperLead, /dramatically accelerated temporal rate from beginning to end/);
  assert.doesNotMatch(slowLead, /rain|pedestrian|traffic/i);
  assert.doesNotMatch(hyperLead, /rain|pedestrian|traffic/i);
  assert.doesNotMatch(slowComposed, /in continuous slow motion/);
  assert.equal(extremePaceLeadIn("fast"), "");
  assert.equal(composeShootingPrompt(locomotionBaseline("fast"), addition, "fast"), `${addition}\n${locomotionBaseline("fast")}`);
  assert.deepEqual(splitShootingPrompt(slowComposed, addition), {
    paceLeadIn: slowLead,
    addition,
    baseline: slowMo,
  });
  assert.deepEqual(splitShootingPrompt(hyperComposed, addition), {
    paceLeadIn: hyperLead,
    addition,
    baseline: hyper,
  });
  assert.deepEqual(splitShootingPrompt(composeShootingPrompt(slowMo, undefined, "slow-motion")), {
    paceLeadIn: slowLead,
    addition: "",
    baseline: slowMo,
  });
});

test("filmmaker take direction sits between the route and the locomotion baseline", () => {
  const addition = "Track forward through the opening.";
  const baseline = locomotionBaseline("fast");
  const prompt = composeShootingPrompt(baseline, addition, "fast");
  assert.equal(composeDirectedShootingPrompt(prompt, addition, "   "), prompt);
  assert.equal(
    composeDirectedShootingPrompt(prompt, addition, "Hands reach toward the camera as it moves through."),
    `${addition}\nHands reach toward the camera as it moves through.\n${baseline}`,
  );
});

test("composeJourneyShootingPrompt uses the selected grammar baseline, not POV by default for FOLLOW", () => {
  const addition = "Stay behind the receding silver train.";
  const follow = composeJourneyShootingPrompt(addition, "fast", "follow");
  assert.equal(follow, `${addition}\n${locomotionBaseline("fast", "follow")}`);
  assert.match(follow, /Invisible objective camera continuously following/);
  assert.doesNotMatch(follow, /First person POV camera continuously moving forward/);
  const pov = composeJourneyShootingPrompt(addition, "fast", "pov");
  assert.match(pov, /First person POV camera continuously moving forward/);
});

test("pull-forward OFF replaces only the invent-passageways sentence in every grammar baseline", () => {
  for (const grammar of CAMERA_GRAMMARS) {
    const on = locomotionBaseline("fast", grammar);
    const off = locomotionBaseline("fast", grammar, false);
    assert.ok(on.includes(INVENT_INTERMEDIATE_STRUCTURES_CLAUSE));
    assert.doesNotMatch(off, /Do not invent intermediate structures or passageways/);
    assert.ok(off.includes(THRESHOLD_CONNECTIVE_CLAUSE));
    assert.match(off, /Do not dissolve, morph, crossfade, cut, teleport/);
    assert.doesNotMatch(off, /replace one scene with another in place/);
    assert.match(on, /spatially-contiguous environment/);
    assert.match(off, /spatially-contiguous environment/);
    const withoutInvent = on.replace(INVENT_INTERMEDIATE_STRUCTURES_CLAUSE, THRESHOLD_CONNECTIVE_CLAUSE);
    assert.equal(off, withoutInvent);
    if (grammar === "pov") {
      assert.match(off, /retreat, reverse direction/);
      assert.match(off, /First person POV camera continuously moving forward/);
    }
    if (grammar === "follow") {
      assert.match(off, /Invisible objective camera continuously following/);
    }
    if (grammar === "lead") {
      assert.match(off, /physically retreating/);
      assert.match(off, /Continuous forward camera travel is not this grammar/);
    }
    if (grammar === "mounted") {
      assert.match(off, /Camera motion follows the mounted subject's acceleration, turns, banking, and vibration/);
    }
  }
  const composed = composeJourneyShootingPrompt("Advance through the implied doorway.", "fast", "pov", false);
  assert.ok(composed.includes(THRESHOLD_CONNECTIVE_CLAUSE));
  assert.doesNotMatch(composed, /Do not invent intermediate structures or passageways/);
});
