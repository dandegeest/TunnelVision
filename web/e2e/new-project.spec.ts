import { expect, test, type Page } from "@playwright/test";

const STARTING_FRAME_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const CONSTRUCTED_MEDIA_ID = "upload-cccccccccccccccccccccccccccccccc";
const CONSTRUCTED_IMAGE_URL = `/api/runtime-media/${CONSTRUCTED_MEDIA_ID}`;

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
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mediaId: CONSTRUCTED_MEDIA_ID,
        imageUrl: CONSTRUCTED_IMAGE_URL,
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
          predictionId: "pred-e2e-construct",
          elapsedMs: 18,
          outputMediaId: CONSTRUCTED_MEDIA_ID,
          outputUrl: CONSTRUCTED_IMAGE_URL,
        },
      }),
    });
  });

  await page.route(`**/api/runtime-media/${CONSTRUCTED_MEDIA_ID}`, async (route) => {
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

test("new project can plan and generate the next destination", async ({ page }) => {
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
    CONSTRUCTED_IMAGE_URL,
  );
  await expect(page.getByLabel("Generate destination B")).toHaveCount(0);
  await expect(page.getByLabel("Generate destination C")).toBeVisible();
  await expect(page.getByLabel("Add Destination")).toBeVisible();
});
