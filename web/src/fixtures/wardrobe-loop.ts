import visionA from "../../../camotion/integration/wardrobe-loop-01/canonical/vision/A.jpg";
import visionB from "../../../camotion/integration/wardrobe-loop-01/canonical/vision/B.jpg";
import visionC from "../../../camotion/integration/wardrobe-loop-01/canonical/vision/C.jpg";
import visionD from "../../../camotion/integration/wardrobe-loop-01/canonical/vision/D.jpg";
import visionE from "../../../camotion/integration/wardrobe-loop-01/canonical/vision/E.jpg";
import videoAB from "../../../camotion/integration/wardrobe-loop-01/videos/A-B.mp4";
import videoBC from "../../../camotion/integration/wardrobe-loop-01/videos/B-C.mp4";
import videoCD from "../../../camotion/integration/wardrobe-loop-01/videos/C-D.mp4";
import videoDE from "../../../camotion/integration/wardrobe-loop-01/videos/D-E.mp4";
import story from "../../../camotion/integration/wardrobe-loop-01/story.json";
import type { Project } from "../project/types";
import { TRUSTED_MEDIA_IDS } from "../project/trusted-media-id";
import { DEFAULT_DURATION_SECONDS } from "../timeline/geometry";

export { ARRIVAL_BLOCKED_COPY as LOOP_ARRIVAL_COPY } from "../project/policy";

export const EA_SHOOTABILITY_NOTE =
  "E→A is not shootable as a continuous journey. The closed cavern door has no traversable volume, and arriving through it would not match this wardrobe-facing pose at A. Historical research clip E-A.mp4 is not a product shot.";

/** Fixture initialization only. Not runtime Director authority. */
export const WARDROBE_USER_PROMPT =
  "Make a first-person POV journey through an impossible world at night. Start in a cozy attic bedroom and travel through the wardrobe into another world. Keep the camera continuously moving forward through real spatial thresholds and distinct locations. Eventually find a route that loops back into the original bedroom. The viewer should feel like a child exploring, but never show the child.";

export const STORYBOARD_INTENTS = {
  A: "Inside the attic bedroom. Approach the open wardrobe.",
} as const;

export function createWardrobeProject(): Project {
  return {
    id: story.id,
    title: story.title,
    story: WARDROBE_USER_PROMPT,
    agency: "directed",
    construction: "planned",
    storyDuration: "auto",
    autoGenerateOpening: false,
    autoGenerateAllDestinations: false,
    autoBlockShots: false,
    autoShoot: false,
    videoModel: "pruna-p-video",
    storyDurationLocked: false,
    storyboard: [
      {
        id: "A",
        label: "A",
        intent: STORYBOARD_INTENTS.A,
        image: visionA,
        imageOrigin: "user",
        mediaId: TRUSTED_MEDIA_IDS.wardrobeLoopVisionA,
        destinationId: "A",
      },
    ],
    destinations: [
      { id: "A", label: "A", image: visionA, status: "ready" },
      { id: "B", label: "B", image: visionB, status: "ready" },
      { id: "C", label: "C", image: visionC, status: "ready" },
      { id: "D", label: "D", image: visionD, status: "ready" },
      { id: "E", label: "E", image: visionE, status: "ready" },
    ],
    journeys: [
      {
        id: "A-B",
        startDestinationId: "A",
        endDestinationId: "B",
        durationSeconds: DEFAULT_DURATION_SECONDS,
        status: "rendered",
        videoUrl: videoAB,
      },
      {
        id: "B-C",
        startDestinationId: "B",
        endDestinationId: "C",
        durationSeconds: DEFAULT_DURATION_SECONDS,
        status: "rendered",
        videoUrl: videoBC,
      },
      {
        id: "C-D",
        startDestinationId: "C",
        endDestinationId: "D",
        durationSeconds: DEFAULT_DURATION_SECONDS,
        status: "rendered",
        videoUrl: videoCD,
        shootabilityNote: "This rendered shot needs review: the forest-to-ruins passage reads mixed or dissolve-like.",
      },
      {
        id: "D-E",
        startDestinationId: "D",
        endDestinationId: "E",
        durationSeconds: DEFAULT_DURATION_SECONDS,
        status: "rendered",
        videoUrl: videoDE,
      },
      {
        id: "E-A",
        startDestinationId: "E",
        endDestinationId: "A",
        durationSeconds: DEFAULT_DURATION_SECONDS,
        status: "ready",
        shootabilityNote: EA_SHOOTABILITY_NOTE,
      },
    ],
  };
}
