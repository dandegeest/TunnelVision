import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CAMERA_GRAMMARS,
  DEFAULT_CAMERA_GRAMMAR,
  FOLLOW_LOCOMOTION_BASELINE_TEMPLATE,
  LEAD_LOCOMOTION_BASELINE_TEMPLATE,
  MOUNTED_LOCOMOTION_BASELINE_TEMPLATE,
  cameraGrammarFromUnknown,
  cinematographerBaselineDescription,
  cinematographerGrammarInstruction,
  cinematographerNotShootableCaveat,
  cinematographerPairUserLines,
  constructionTravelClause,
  directorGrammarBodyConstraint,
  directorGrammarResearchPrinciple,
  isCameraGrammar,
  locomotionBaselineTemplate,
  stillViewpointClause,
} from "../src/cinematographer/camera-grammar.ts";
import { cinematographerAssessmentSystemInstruction } from "../src/cinematographer/assessment-prompts.ts";
import { directorSystemInstruction } from "../src/director/prompts.ts";
import { locomotionBaseline, UNEMBODIED_FIRST_PERSON_POV } from "../src/cinematographer/shooting-prompt.ts";

test("legacy and unknown grammar values load as POV without mutation helpers inventing other modes", () => {
  assert.equal(DEFAULT_CAMERA_GRAMMAR, "pov");
  assert.deepEqual([...CAMERA_GRAMMARS], ["pov", "follow", "lead", "mounted"]);
  assert.equal(cameraGrammarFromUnknown(undefined), "pov");
  assert.equal(cameraGrammarFromUnknown("fp_follow"), "pov");
  assert.equal(isCameraGrammar("lead"), true);
  assert.equal(isCameraGrammar("orbit"), false);
});

test("POV baseline remains unembodied forward travel and follows the physical path", () => {
  const pov = locomotionBaseline("fast", "pov");
  assert.match(pov, /First person POV camera continuously moving forward/);
  assert.match(pov, /When the visible route turns, the camera physically turns and banks/);
  assert.ok(pov.endsWith(UNEMBODIED_FIRST_PERSON_POV));
  assert.match(stillViewpointClause("pov"), /unembodied first-person POV/);
});

test("FOLLOW baseline preserves relationship, not a fixed distance", () => {
  const follow = locomotionBaselineTemplate("follow");
  assert.match(follow, /Invisible objective camera continuously following a persistent subject/);
  assert.match(follow, /Stay behind the subject's travel/);
  assert.match(follow, /keep the subject ahead of the camera, receding/);
  assert.match(follow, /Following distance may expand and contract naturally/);
  assert.match(follow, /subject may pull farther ahead/);
  assert.match(follow, /lag, catch up, drift, or bank/);
  assert.match(follow, /Do not overtake into a lead-facing view of the subject/);
  assert.doesNotMatch(follow, /nose|headlights|bumper|hood/);
  assert.doesNotMatch(follow, /First person POV camera continuously moving forward/);
  assert.doesNotMatch(follow, /fixed distance of/);
  assert.match(follow, /Do not lock a fixed distance/);
  assert.match(follow, /Do not introduce a visible camera operator or a second traveler/);
  assert.match(directorGrammarResearchPrinciple("follow"), /not a fixed following distance/);
  assert.match(directorGrammarResearchPrinciple("follow"), /from behind/);
  assert.match(cinematographerGrammarInstruction("follow"), /preserves the relationship, not a fixed distance/i);
  assert.match(cinematographerGrammarInstruction("follow"), /LEAD, not elastic FOLLOW/);
  assert.match(stillViewpointClause("follow"), /behind a persistent subject/);
  assert.match(stillViewpointClause("follow"), /rear, aft, or trailing side/);
  assert.match(stillViewpointClause("follow"), /Do not convert this into a lead-facing view of the subject/);
  assert.doesNotMatch(stillViewpointClause("follow"), /nose|headlights|bumper|hood/);
  assert.match(constructionTravelClause("follow"), /remains behind the same persistent subject/);
  assert.match(constructionTravelClause("follow"), /Do not overtake the subject into a lead-facing view/);
  assert.doesNotMatch(directorGrammarResearchPrinciple("follow"), /nose|headlights|bumper|hood/);
  assert.doesNotMatch(directorGrammarBodyConstraint("follow"), /nose|headlights|bumper|hood/);
  assert.doesNotMatch(cinematographerGrammarInstruction("follow"), /nose|headlights|bumper|hood/);
  assert.doesNotMatch(cinematographerBaselineDescription("follow"), /nose|headlights|bumper|hood/);
  assert.doesNotMatch(cinematographerPairUserLines("follow").join("\n"), /nose|headlights|bumper|hood/);
  assert.doesNotMatch(cinematographerNotShootableCaveat("follow"), /nose|headlights|bumper|hood/);
  assert.doesNotMatch(constructionTravelClause("follow"), /nose|headlights|bumper|hood/);
});

test("LEAD baseline is not rewritten by forward-only POV conditioning", () => {
  const lead = locomotionBaseline("fast", "lead");
  assert.match(lead, /ahead of a persistent subject while facing that subject/);
  assert.match(lead, /physically retreating/);
  assert.match(lead, /Do not convert this shot into first-person POV/);
  assert.match(lead, /Continuous forward camera travel is not this grammar/);
  assert.doesNotMatch(lead, /Do not dissolve, morph, crossfade, cut, teleport, retreat, reverse direction/);
  assert.doesNotMatch(lead, /The camera never stops advancing/);
  assert.doesNotMatch(lead, /First person POV camera continuously moving forward/);
  const director = directorSystemInstruction("lead");
  assert.match(director, /LEAD grammar/);
  assert.doesNotMatch(director, /Continuous forward locomotion matters/);
  const cm = cinematographerAssessmentSystemInstruction("lead");
  assert.match(cm, /LEAD grammar/);
  assert.doesNotMatch(cm, /Both stills are first-person POV from the same continuously forward-moving camera/);
  assert.match(cm, /Do not rewrite this pair into continuous forward POV/);
});

test("MOUNTED baseline allows persistent mount geometry", () => {
  const mounted = MOUNTED_LOCOMOTION_BASELINE_TEMPLATE;
  assert.match(mounted, /Camera physically mounted/);
  assert.match(mounted, /Persistent foreground geometry belonging to the mount/);
  assert.match(mounted, /hood, handlebars, vehicle frame/);
  assert.doesNotMatch(mounted, /unembodied first-person POV\. Never show/);
  assert.match(stillViewpointClause("mounted"), /Persistent foreground geometry belonging to the mount may remain visible/);
  assert.match(constructionTravelClause("mounted"), /Mount geometry may persist/);
});

test("grammar templates stay distinct", () => {
  assert.notEqual(FOLLOW_LOCOMOTION_BASELINE_TEMPLATE, LEAD_LOCOMOTION_BASELINE_TEMPLATE);
  assert.notEqual(LEAD_LOCOMOTION_BASELINE_TEMPLATE, locomotionBaselineTemplate("pov"));
  assert.notEqual(MOUNTED_LOCOMOTION_BASELINE_TEMPLATE, locomotionBaselineTemplate("follow"));
});
