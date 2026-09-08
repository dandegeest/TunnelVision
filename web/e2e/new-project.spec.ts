import { expect, test, type Page } from "@playwright/test";
import {
  TUNNELVISION_LOCOMOTION_BASELINE,
  composeShootingPrompt,
} from "../../media/src/cinematographer/shooting-prompt.ts";

const STARTING_FRAME_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function constructedMedia(beatId: string) {
  const token = beatId.toLowerCase().padEnd(32, beatId.toLowerCase()).slice(0, 32);
  const mediaId = `upload-${token}`;
  return { mediaId, imageUrl: `/api/runtime-media/${mediaId}` };
}

const CONSTRUCTED_B = constructedMedia("B");
const CONSTRUCTED_C = constructedMedia("C");
const SHOOTING_A_PRIME = constructedMedia("P");
const SHOOTING_B_PRIME = constructedMedia("Q");
const MOCK_VIDEO_ID = "upload-vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv";
const MOCK_VIDEO_URL = `/api/runtime-media/${MOCK_VIDEO_ID}`;

const DIRECTOR_PLAN = {
  summary: "A continuous forward journey through connected interior volumes.",
  beats: [
    {
      id: "B",
      intent: "Move forward into the next space.",
      visualDescription: "A corridor continuing the same world.",
    },
    {
      id: "C",
      intent: "Continue through the corridor.",
      visualDescription: "Deeper volume ahead.",
    },
  ],
};

const CM_ASSESSMENT = {
  shootability: "shootable",
  summary: "Track forward through the connected volumes.",
  route: "Advance from the current volume into the next.",
  threshold: "The opening ahead.",
  camera: "Track forward along the visible corridor.",
  parallax: "Near walls the camera can pass.",
  transitionStrategy: "Pass through the visible opening.",
  segmentPromptAddition: "Track forward through the visible opening into the next volume.",
  camotionSuitability: "appropriate",
  concerns: [],
};

async function mockProviderBoundaries(page: Page) {
  await page.route("**/api/director/plan", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    const request = route.request().postDataJSON() as {
      story: string;
      agency: "directed" | "autonomous";
      startFrameId: string;
      startMediaId: string;
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        plan: DIRECTOR_PLAN,
        evidence: {
          request: {
            story: request.story,
            agency: request.agency,
            startFrameId: request.startFrameId,
            startMediaId: request.startMediaId,
            systemInstruction: "Director",
            prompt: "Plan forward",
          },
          rawText: JSON.stringify(DIRECTOR_PLAN),
          model: "e2e-mock-director",
          modelVersion: null,
          predictionId: "pred-e2e-director",
          elapsedMs: 12,
        },
      }),
    });
  });

  await page.route("**/api/destination/construct", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    const request = route.request().postDataJSON() as {
      sourceMediaId: string;
      beatId: string;
      intent: string;
      visualDescription: string;
    };
    const constructed = request.beatId === "C" ? CONSTRUCTED_C : CONSTRUCTED_B;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mediaId: constructed.mediaId,
        imageUrl: constructed.imageUrl,
        evidence: {
          request: {
            sourceMediaId: request.sourceMediaId,
            beatId: request.beatId,
            intent: request.intent,
            visualDescription: request.visualDescription,
            prompt: "e2e-mock-construct",
          },
          model: "e2e-mock-image-edit",
          modelVersion: null,
          predictionId: `pred-e2e-construct-${request.beatId}`,
          elapsedMs: 18,
          outputMediaId: constructed.mediaId,
          outputUrl: constructed.imageUrl,
        },
      }),
    });
  });

  for (const constructed of [CONSTRUCTED_B, CONSTRUCTED_C, SHOOTING_A_PRIME, SHOOTING_B_PRIME]) {
    await page.route(`**/api/runtime-media/${constructed.mediaId}`, async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: STARTING_FRAME_PNG,
      });
    });
  }

  await page.route("**/api/cinematographer/assess", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    const request = route.request().postDataJSON() as {
      journeyId: string;
      startMediaId: string;
      endMediaId: string;
    };
    expect(request.journeyId).toBe("A-B");
    expect(request.startMediaId).toMatch(/^upload-/);
    expect(request.endMediaId).toBe(CONSTRUCTED_B.mediaId);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ assessment: CM_ASSESSMENT }),
    });
  });

  await page.route("**/api/journey/shoot", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    const request = route.request().postDataJSON() as {
      journeyId: string;
      startMediaId: string;
      endMediaId: string;
      segmentPromptAddition: string;
    };
    expect(request.journeyId).toBe("A-B");
    expect(request.startMediaId).toMatch(/^upload-/);
    expect(request.endMediaId).toBe(CONSTRUCTED_B.mediaId);
    expect(request.segmentPromptAddition).toBe(CM_ASSESSMENT.segmentPromptAddition);
    expect(request).not.toHaveProperty("endImage");
    const effectivePrompt = composeShootingPrompt(
      TUNNELVISION_LOCOMOTION_BASELINE,
      request.segmentPromptAddition,
    );
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        videoUrl: MOCK_VIDEO_URL,
        take: {
          startShootingFrame: {
            mediaId: SHOOTING_A_PRIME.mediaId,
            imageUrl: SHOOTING_A_PRIME.imageUrl,
          },
          endShootingFrame: {
            mediaId: SHOOTING_B_PRIME.mediaId,
            imageUrl: SHOOTING_B_PRIME.imageUrl,
          },
          startPlan: {
            version: 1,
            camera: { vanishing_point: [0.5, 0.5], forward: 1 },
            destination: { point: [0.5, 0.5], protect: true, bbox: [0.25, 0.2, 0.75, 0.8] },
            exposure: { strength: 0.08, samples: 16 },
          },
          endPlan: {
            version: 1,
            camera: { vanishing_point: [0.5, 0.5], forward: 1 },
            destination: { point: [0.5, 0.5], protect: true, bbox: [0.25, 0.2, 0.75, 0.8] },
            exposure: { strength: 0.08, samples: 16 },
          },
          segmentPromptAddition: request.segmentPromptAddition,
          effectivePrompt,
          provider: "replicate",
          model: "prunaai/p-video",
          modelVersion: "e2e-mock",
          durationSeconds: 6,
          videoInputs: { startShootingFrame: true, endShootingFrame: true },
        },
      }),
    });
  });

  await page.route(`**/api/runtime-media/${MOCK_VIDEO_ID}`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "video/mp4",
      body: Buffer.from("mock-video"),
    });
  });
}

test("new project can plan, prepare, and shoot one journey", async ({ page }) => {
  await mockProviderBoundaries(page);
  await page.goto("/");

  await expect(page.getByLabel("Current project: UNTITLED")).toBeVisible();
  await expect(page.getByText("FOREST A→F")).toHaveCount(0);
  await expect(page.getByText("Travel forward through this night forest")).toHaveCount(0);
  await expect(page.getByText("Not yet planned")).toHaveCount(0);
  await expect(page.getByLabel("Destination A actions")).toBeVisible();
  await expect(page.getByLabel("Plan movie")).toBeDisabled();
  await expect(page.getByLabel("Add Destination")).toHaveCount(0);

  await page.getByRole("button", { name: "Shoot", exact: true }).click();
  await expect(
    page.getByText("Nothing is ready to shoot until the journey has actual adjacent destinations."),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Plan", exact: true }).click();

  await page.getByLabel("Destination A actions").click();
  await expect(page.getByRole("menuitem", { name: "Upload image" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Replace…" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Upload image" }).click();
  await page.locator("#replace-destination-image").setInputFiles({
    name: "start.png",
    mimeType: "image/png",
    buffer: STARTING_FRAME_PNG,
  });
  await expect(page.getByRole("menuitem", { name: "Upload image" })).toHaveCount(0);
  await expect(page.locator('img[src^="/api/runtime-media/upload-"]')).toBeVisible();
  await expect(page.getByLabel("Add Destination")).toHaveCount(0);

  await page.getByRole("button", { name: "Shoot", exact: true }).click();
  await expect(
    page.getByText("Nothing is ready to shoot until the journey has actual adjacent destinations."),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Plan", exact: true }).click();

  await page.locator("#plan-composer").fill("Travel forward through an imagined interior at night.");
  await expect(page.getByLabel("Plan movie")).toBeEnabled();
  await page.getByLabel("Plan movie").click();

  await expect(page.getByLabel("Generate destination B")).toBeVisible();
  await expect(page.getByLabel("Add Destination")).toHaveCount(0);
  await expect(page.getByLabel("Storyboard C")).toBeVisible();
  await expect(page.getByLabel("Generate destination C")).toHaveCount(0);

  await page.getByLabel("Generate destination B").click();
  await expect(page.locator('[data-destination-card="B"] img')).toHaveAttribute(
    "src",
    CONSTRUCTED_B.imageUrl,
  );
  await expect(page.getByLabel("Generate destination B")).toHaveCount(0);
  await expect(page.getByLabel("Generate destination C")).toBeVisible();
  await expect(page.getByLabel("Add Destination")).toBeVisible();

  await page.getByLabel("Generate destination C").click();
  await expect(page.locator('[data-destination-card="C"] img')).toHaveAttribute(
    "src",
    CONSTRUCTED_C.imageUrl,
  );
  await expect(page.getByLabel("Generate destination C")).toHaveCount(0);

  await page.getByRole("button", { name: "Shoot", exact: true }).click();
  await expect(page.getByLabel("Journey A-B, ready")).toBeVisible();
  await expect(page.getByLabel("Journey B-C, ready")).toBeVisible();
  await expect(page.getByLabel("Destination A")).toBeVisible();
  await expect(page.getByLabel("Destination B")).toBeVisible();
  await expect(page.getByLabel("Destination C")).toBeVisible();
  await expect(
    page.getByText("Nothing is ready to shoot until the journey has actual adjacent destinations."),
  ).toHaveCount(0);

  await page.getByLabel("Journey A-B, ready").click();
  await expect(page.getByAltText("A-B start A")).toHaveCount(2);
  await expect(page.getByAltText("A-B end B")).toHaveCount(2);
  await page.getByLabel("Prepare A-B").click();
  await expect(page.getByText("Track forward through the connected volumes.")).toBeVisible();
  await expect(page.getByLabel("Journey A-B, ready, CM Ready")).toBeVisible();
  await expect(page.getByText("Prepared", { exact: true })).toBeVisible();
  await page.locator("summary", { hasText: "Shot" }).click();
  await expect(page.getByText("Advance from the current volume into the next.")).toBeVisible();
  await expect(page.getByText("Track forward through the visible opening into the next volume.")).toBeVisible();
  await expect(page.getByLabel("Shoot A-B")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Shoot This Shot" })).toBeEnabled();

  await page.getByLabel("Shoot A-B").click();
  await expect(page.locator("video")).toHaveAttribute("src", MOCK_VIDEO_URL);
  await expect(page.getByLabel("Journey A-B, rendered, CM Ready")).toBeVisible();
  await page.locator("summary", { hasText: "Take" }).click();
  await expect(page.getByAltText("A-B start shooting frame")).toBeVisible();
  await expect(page.getByAltText("A-B end shooting frame")).toBeVisible();
  await expect(page.getByText("prunaai/p-video")).toBeVisible();
  await expect(page.getByText("Duration. 6s")).toBeVisible();
  await expect(
    page.getByText("Start shooting frame A′ and end shooting frame B′ were sent as the video start and last-frame conditions."),
  ).toBeVisible();
  await expect(page.getByText(/First person POV camera continuously moving forward/)).toBeVisible();

  await page.getByLabel("Journey B-C, ready").click();
  await expect(page.getByLabel("Prepare B-C")).toBeVisible();
  await expect(page.getByText("Track forward through the connected volumes.")).toHaveCount(0);
  await expect(page.getByLabel("Shoot B-C")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Shoot This Shot" })).toBeDisabled();
});
