import { expect, test, type Page } from "@playwright/test";
import {
  composeShootingPrompt,
  locomotionBaseline,
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
  pace: "fast",
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
      nextDestination?: { intent: string; visualDescription: string };
    };
    if (request.beatId === "B") {
      expect(request.nextDestination).toEqual({
        intent: DIRECTOR_PLAN.beats[1]?.intent,
        visualDescription: DIRECTOR_PLAN.beats[1]?.visualDescription,
      });
    } else {
      expect(request.nextDestination).toBeUndefined();
    }
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
      pace: string;
      videoModel: string;
    };
    expect(request.journeyId).toBe("A-B");
    expect(request.startMediaId).toMatch(/^upload-/);
    expect(request.endMediaId).toBe(CONSTRUCTED_B.mediaId);
    expect(request.segmentPromptAddition).toBe(CM_ASSESSMENT.segmentPromptAddition);
    expect(request.pace).toBe(CM_ASSESSMENT.pace);
    expect(request.videoModel).toBe("pruna-p-video");
    expect(request).not.toHaveProperty("endImage");
    const effectivePrompt = composeShootingPrompt(
      locomotionBaseline("fast"),
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
          pace: request.pace,
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
  await expect(page.getByLabel("Generate destination A")).toHaveCount(0);
  await expect(page.getByLabel("Plan movie")).toBeDisabled();
  await expect(page.getByLabel("Add Destination")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Shoot", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Auto blocking")).not.toBeChecked();
  await expect(page.getByLabel("Auto shoot")).not.toBeChecked();
  await expect(page.getByLabel("Video model")).toHaveValue("pruna-p-video");

  await page.getByLabel("Journey story").fill("Travel forward through an imagined interior at night.");
  await expect(page.getByLabel("Destination A actions")).toBeVisible();
  await expect(page.getByLabel("Generate destination A")).toBeVisible();
  await expect(page.getByLabel("Story destinations")).toHaveValue("AUTO");
  await expect(page.getByLabel("Increase destinations")).toBeEnabled();
  await expect(page.getByLabel("Decrease destinations")).toBeDisabled();
  await expect(page.getByLabel("Auto generate starting destination")).toBeChecked();
  await expect(page.getByLabel("Auto generate all destinations")).not.toBeChecked();
  await expect(page.getByLabel("Auto blocking")).not.toBeChecked();
  await expect(page.getByLabel("Auto shoot")).not.toBeChecked();
  await expect(page.getByLabel("Plan movie")).toBeEnabled();

  await page.getByLabel("Increase destinations").click();
  await expect(page.getByLabel("Story destinations")).toHaveValue("2");
  await expect(page.getByLabel("Storyboard B")).toBeVisible();
  await expect(page.getByLabel("Decrease destinations")).toBeEnabled();

  await page.getByLabel("Story destinations").fill("3");
  await page.getByLabel("Story destinations").press("Enter");
  await expect(page.getByLabel("Storyboard B")).toBeVisible();
  await expect(page.getByLabel("Storyboard C")).toBeVisible();

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
  await expect(page.getByLabel("Add Destination")).toBeVisible();
  await expect(page.getByLabel("Plan movie")).toBeEnabled();
  await expect(page.getByLabel("Auto generate starting destination")).not.toBeChecked();
  await expect(page.getByLabel("Auto generate starting destination")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Shoot", exact: true })).toBeEnabled();

  await page.getByRole("button", { name: "Shoot", exact: true }).click();
  await expect(
    page.getByText("Nothing is ready to shoot until the journey has actual adjacent destinations."),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Plan", exact: true }).click();

  await expect(page.getByLabel("Plan movie")).toBeEnabled();
  await page.getByLabel("Plan movie").click();

  await expect(page.getByLabel("Generate destination B")).toBeVisible();
  await expect(page.getByLabel("Add Destination")).toBeVisible();
  await expect(page.getByLabel("Storyboard C")).toBeVisible();
  await expect(page.getByLabel("Generate destination C")).toHaveCount(0);
  await expect(page.getByLabel("Story destinations")).toHaveValue("3");
  await expect(page.getByLabel("Story destinations")).toHaveAttribute("readonly");

  await page.getByLabel("Generate destination B").click();
  await expect(page.locator('[data-destination-card="B"] img')).toHaveAttribute(
    "src",
    CONSTRUCTED_B.imageUrl,
  );
  await expect(page.getByLabel("Generate destination B")).toHaveCount(0);
  await expect(page.getByLabel("Generate destination C")).toBeVisible();
  await expect(page.getByLabel("Add Destination")).toBeVisible();

  await page.getByLabel("Storyboard B").click();
  await page.getByLabel("Destination B prompt").fill("A warmer corridor with an open doorway.");
  await expect(page.getByLabel("Storyboard B, plan changed")).toBeVisible();

  await page.getByLabel("Generate destination C").click();
  await expect(page.locator('[data-destination-card="C"] img')).toHaveAttribute(
    "src",
    CONSTRUCTED_C.imageUrl,
  );
  await expect(page.getByLabel("Generate destination C")).toHaveCount(0);

  await page.getByRole("button", { name: "Shoot", exact: true }).click();
  await expect(page.getByLabel("Journey A-B, Ready to block")).toBeVisible();
  await expect(page.getByLabel("Journey B-C, Ready to block")).toBeVisible();
  await expect(page.getByRole("button", { name: "Destination A", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Destination B", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Destination C", exact: true })).toBeVisible();
  await expect(page.getByLabel("Resize timeline")).toBeVisible();
  await expect(
    page.getByText("Nothing is ready to shoot until the journey has actual adjacent destinations."),
  ).toHaveCount(0);

  await page.getByLabel("Journey A-B, Ready to block").click();
  await expect(page.getByAltText("A-B start A")).toHaveCount(2);
  await expect(page.getByAltText("A-B end B")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Block A-B" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Shoot A-B", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Shoot A-B", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Block A-B" }).click();
  const journeyInspector = page.locator("aside").filter({ has: page.getByRole("heading", { name: "A-B" }) });
  await expect(journeyInspector.getByText("Track forward through the connected volumes.")).toBeVisible();
  await expect(page.getByLabel("Journey A-B, Ready to shoot, clear, Fast")).toBeVisible();
  await expect(page.getByText("Blocked", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Shoot A-B", exact: true })).toHaveCount(1);
  await journeyInspector.locator("summary", { hasText: "Shot" }).click();
  await expect(journeyInspector.getByText("Advance from the current volume into the next.")).toBeVisible();
  await expect(journeyInspector.getByText("Track forward through the visible opening into the next volume.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Shoot A-B", exact: true })).toBeEnabled();

  await page.getByRole("button", { name: "Shoot A-B", exact: true }).click();
  await expect(page.locator("video")).toHaveAttribute("src", MOCK_VIDEO_URL);
  await expect(page.getByLabel("Journey A-B, Ready for edit, clear, Fast")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reshoot A-B", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Shoot A-B", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Block A-B" })).toHaveCount(1);
  await journeyInspector.locator("summary", { hasText: "Take" }).click();
  await expect(journeyInspector.getByAltText("A-B start shooting frame")).toBeVisible();
  await expect(journeyInspector.getByAltText("A-B end shooting frame")).toBeVisible();
  await expect(journeyInspector.getByText("prunaai/p-video")).toBeVisible();
  await expect(journeyInspector.getByText("Duration. 6s")).toBeVisible();
  await expect(
    journeyInspector.getByText("Start shooting frame A′ and end shooting frame B′ were sent as the video start and last-frame conditions."),
  ).toBeVisible();
  await expect(journeyInspector.getByText(/First person POV camera continuously moving forward/)).toBeVisible();

  await page.getByLabel("Journey B-C, Ready to block").click();
  await expect(page.getByRole("button", { name: "Block B-C" })).toHaveCount(1);
  const nextInspector = page.locator("aside").filter({ has: page.getByRole("heading", { name: "B-C" }) });
  await expect(nextInspector.getByText("Track forward through the connected volumes.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Shoot B-C", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Shoot B-C", exact: true })).toBeDisabled();
});

test("project video model selector defaults to Pruna and lists mid-tier and HQ options", async ({
  page,
}) => {
  await page.goto("/");
  const select = page.getByLabel("Video model");
  await expect(select).toHaveValue("pruna-p-video");
  await expect(select.locator("option")).toHaveText([
    "Pruna $",
    "Luma Ray Flash 2 720p $$",
    "Wan 2.2 First/Last Frame $$",
    "Seedance 2.0 Fast $$",
    "Seedance 2.5 $$$",
  ]);
  await select.selectOption("luma-ray-flash-2-720p");
  await expect(select).toHaveValue("luma-ray-flash-2-720p");
  await select.selectOption("seedance-2.5");
  await expect(select).toHaveValue("seedance-2.5");
});
