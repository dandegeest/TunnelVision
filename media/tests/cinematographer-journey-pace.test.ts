import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCinematographerAssessmentRequest } from "../src/cinematographer/assess-journey.ts";
import {
  buildCinematographerJourneyPaceRequest,
  parseCinematographerJourneyPace,
} from "../src/cinematographer/journey-pace.ts";
import { MediaGenerationError } from "../src/errors.ts";

test("journey-pace request asks CM for one story-level pace", () => {
  const request = buildCinematographerJourneyPaceRequest("Descend the long ridge without rushing.");
  assert.match(request.systemInstruction, /ONE apparent camera speed for the entire journey/);
  assert.match(request.systemInstruction, /slow-motion/);
  assert.match(request.systemInstruction, /hyperspeed/);
  assert.match(request.prompt, /Descend the long ridge/);
  assert.match(request.prompt, /journey-level pace/);
  assert.equal(request.payload.story, "Descend the long ridge without rushing.");
  assert.equal(request.images, undefined);
});

test("journey-pace parse accepts the locomotion vocabulary and rejects others", () => {
  assert.equal(parseCinematographerJourneyPace('{ "pace": "moderate" }'), "moderate");
  assert.equal(parseCinematographerJourneyPace('{ "pace": "slow-motion" }'), "slow-motion");
  assert.throws(() => parseCinematographerJourneyPace('{ "pace": "normal" }'), MediaGenerationError);
});

test("segment assessment prompt locks journey pace instead of choosing per segment", () => {
  const request = buildCinematographerAssessmentRequest({
    journeyId: "A-B",
    story: "Travel the ridge.",
    start: { id: "A", image: { kind: "file", path: "/tmp/a.jpg" } },
    end: { id: "B", image: { kind: "file", path: "/tmp/b.jpg" } },
    journeyPace: "slow",
  });
  assert.match(request.prompt, /Project journey pace is locked: slow/);
  assert.match(request.prompt, /Do not choose a per-segment pace/);
  assert.doesNotMatch(request.prompt, /Filmmaker locked pace/);
});

test("filmmaker pace lock wins over journey pace in the segment prompt", () => {
  const request = buildCinematographerAssessmentRequest({
    journeyId: "A-B",
    start: { id: "A", image: { kind: "file", path: "/tmp/a.jpg" } },
    end: { id: "B", image: { kind: "file", path: "/tmp/b.jpg" } },
    filmmakerPace: "fast",
    journeyPace: "slow",
  });
  assert.match(request.prompt, /Filmmaker locked pace: fast/);
  assert.doesNotMatch(request.prompt, /Project journey pace is locked/);
});
