import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { createWardrobeProject } from "../fixtures/wardrobe-loop";
import { createNewProject } from "../project/new-project";
import { projectWithCinematographerAssessment } from "../project/cinematographer";
import { projectWithSyncedProductionLegs } from "../project/production-legs";
import { projectWithJourneyShotTake } from "../project/shoot";
import type { CinematographerAssessment, JourneyShotTake } from "../project/types";
import { ProjectProvider } from "../project/ProjectProvider";
import { TimelineView } from "./TimelineView";
import { CamotionFrameSwitch } from "./CamotionDiagnostic";
import { CamotionOverlayToggles, CamotionPlanOverlay } from "./CamotionOverlay";
import { DEFAULT_OVERLAY_LAYERS } from "../project/camotion-overlay";
import { JourneyCanonicalPair, PreviewModeSwitch } from "./Preview";

function renderShoot(
  project = createForestProject(),
  selection?: { destinationId: string; occurrenceIndex: number } | { journeyId: string },
) {
  const initialSelection =
    selection && "journeyId" in selection
      ? { kind: "journey" as const, journeyId: selection.journeyId }
      : selection
        ? {
            kind: "destination" as const,
            destinationId: selection.destinationId,
            occurrenceIndex: selection.occurrenceIndex,
          }
        : { kind: "destination" as const, destinationId: "A", occurrenceIndex: 0 };
  return renderToStaticMarkup(
    <ProjectProvider
      initialProject={project}
      initialView="shoot"
      initialSelection={initialSelection}
    >
      <TimelineView />
    </ProjectProvider>,
  );
}

const shootableAB: CinematographerAssessment = {
  shootability: "shootable",
  summary: "Walk through the root gateway into the darker mouth.",
  route: "Advance along the forest path and pass through the trunk opening.",
  threshold: "The dark root-mouth opening slightly right of center.",
  camera: "Track forward along the path, passing between near trunks toward the opening.",
  parallax: "Near trunks the camera can pass beside.",
  transitionStrategy: "Pass through the visible gateway so near trunks sweep past the lens.",
  segmentPromptAddition:
    "Track forward along the path, pass between the near trunks, and move through the visible opening toward the darker mouth.",
  pace: "fast",
  camotionSuitability: "appropriate",
  concerns: [],
};

describe("Shoot boundary continuity UI", () => {
  it("marks completed Forest seams at shared destinations", () => {
    const html = renderShoot();
    expect(html).toContain("Destination B, boundary match Strong, output raster mismatch");
    expect(html).toContain("Destination C, boundary match Good");
    expect(html).toContain("Destination D, boundary match Good");
    expect(html).toContain("Destination E, boundary match Strong");
    expect(html).toContain('aria-label="Destination A"');
    expect(html).toContain('aria-label="Destination F"');
    expect(html).not.toContain("Destination A, boundary match");
    expect(html).not.toContain("Destination F, boundary match");
    expect(html).toContain("Strong · raster");
  });

  it("keeps destination tiles 16:9 and contains source stills without stretching", () => {
    const html = renderShoot();
    expect(html).toContain("media-contain");
    expect(html).toContain("aspect-video");
    expect(html).not.toContain("object-cover");
  });

  it("exposes seam metrics in the inspector without a dashboard", () => {
    const html = renderShoot(createForestProject(), { destinationId: "B", occurrenceIndex: 1 });
    expect(html).toContain("Boundary continuity");
    expect(html).toContain("Strong match at B");
    expect(html).toContain("A-B final ↔ B-C first");
    expect(html).toContain("MAE 1.84");
    expect(html).toContain("SSIM 0.957");
    expect(html).toContain("Output raster mismatch");
    expect(html).toContain("1284×716");
    expect(html).toContain("1306×706");
    expect(html).toContain("Visual boundary match only. Not a traversal or shootability judgment.");
    expect(html).not.toContain("spatial continuity");
    expect(html).not.toContain("seamless");
  });

  it("stays quiet on Wardrobe destinations that have no seam analysis", () => {
    const html = renderShoot(createWardrobeProject(), { destinationId: "B", occurrenceIndex: 1 });
    expect(html).not.toContain("Boundary continuity");
    expect(html).not.toContain("boundary match");
  });

  it("lets Redo regenerate a generated canonical from the destination inspector", () => {
    const html = renderShoot(createForestProject(), { destinationId: "B", occurrenceIndex: 1 });
    expect(html).toContain('aria-label="Redo destination B"');
    expect(html).toContain(">Redo<");
    expect(html).toContain('aria-label="Destination B prompt"');
    expect(html).toContain("Root-tunnel mouth. The dark opening is slightly right of center.");
    expect(html).not.toContain("This is what the generated world actually gave us");
    expect(html).not.toContain("The Cinematographer judges how to shoot");
    const opening = renderShoot();
    expect(opening).not.toContain('aria-label="Redo destination A"');
    expect(opening).toContain("This is the opening destination.");
  });
});

describe("Shoot Cinematographer journey assessment", () => {
  it("keeps a rendered journey complete and shows inspector Ready separately", () => {
    const project = projectWithCinematographerAssessment(createForestProject(), "A-B", shootableAB);
    expect(project.journeys.find((journey) => journey.id === "A-B")?.status).toBe("rendered");
    const html = renderShoot(project, { journeyId: "A-B" });
    expect(html).toContain("Journey A-B, Export, clear, Fast");
    expect(html).toContain('data-journey-pace="fast"');
    expect(html).toContain('data-pace-gutter="A-B"');
    expect(html).toContain("Export · clear");
    expect(html).toContain("bg-[#142014]");
    expect(html).toContain("border-[#3f5a3a]");
    expect(html).toContain("border-2");
    expect(html).toContain("Status: Export");
    expect(html).toContain(">Ready<");
    expect(html).toContain("Walk through the root gateway into the darker mouth. · Fast");
    expect(html).toContain("Camera path.");
    expect(html).toContain("Track forward along the path, passing between near trunks toward the opening.");
    expect(html).toContain('aria-label="Stage A-B"');
    expect(html).toContain(">Stage<");
    expect(html).toContain(">Blocked<");
    expect(html).toContain('aria-label="Generate A-B"');
    expect((html.match(/aria-label="Generate A-B"/g) ?? []).length).toBe(1);
    expect((html.match(/aria-label="Stage A-B"/g) ?? []).length).toBe(1);
    expect(html).toContain(">Generate<");
    expect(html).not.toContain('aria-label="Shoot A-B"');
    expect(html).not.toContain('aria-label="Reshoot A-B"');
    expect(html).not.toContain('aria-label="Block A-B"');
    expect(html).toContain('alt="A-B start A"');
    expect(html).toContain('alt="A-B end B"');
    expect(html).toContain('aria-label="Preview mode"');
    expect(html).toContain('aria-pressed="true" aria-label="Preview video"');
    expect(html).toContain('aria-pressed="false" aria-label="Preview A|B"');
    expect(html).toContain(">Video<");
    expect(html).toContain(">A|B<");
    expect(html).toContain("<video");
    expect(html).not.toContain("preview-leg");
    expect(html).not.toContain("This journey is not a finished movie clip.");
    expect(html).not.toContain("Journey A-B, Ready<");
    expect(html).not.toContain('"shootability"');
    expect(html).not.toContain(">Assess shot<");
  });

  it("draws a pace mark between destination stills and leaves unblocked legs empty", () => {
    const opening = renderShoot();
    expect(opening).not.toContain("data-journey-pace");
    expect(opening).not.toContain("data-pace-gutter");
    for (const pace of ["slow-motion", "slow", "moderate", "fast", "hyperspeed", "variable"] as const) {
      const html = renderShoot(
        projectWithCinematographerAssessment(createForestProject(), "A-B", { ...shootableAB, pace }),
        { journeyId: "A-B" },
      );
      expect(html).toContain(`data-journey-pace="${pace}"`);
      expect(html).toContain('data-pace-gutter="A-B"');
    }
  });

  it("paints hold and no-go outlines without replacing rendered fill", () => {
    const review = projectWithCinematographerAssessment(createForestProject(), "C-D", {
      ...shootableAB,
      shootability: "needs_review",
      summary: "The pair tends to replace C rather than enter D.",
      camotionSuitability: "uncertain",
      concerns: ["Start-frame authority is weak."],
    });
    const blocked = projectWithCinematographerAssessment(review, "E-F", {
      ...shootableAB,
      shootability: "not_shootable",
      summary: "Open void with no traversable corridor.",
      camotionSuitability: "poor_fit",
      concerns: ["Radial-forward Camotion would read as warp."],
    });
    expect(blocked.journeys.find((journey) => journey.id === "C-D")?.status).toBe("rendered");
    expect(blocked.journeys.find((journey) => journey.id === "E-F")?.status).toBe("rendered");
    const cd = renderShoot(blocked, { journeyId: "C-D" });
    const ef = renderShoot(blocked, { journeyId: "E-F" });
    expect(cd).toContain("Journey C-D, Export, hold, Fast");
    expect(cd).toContain('data-journey-pace="fast"');
    expect(cd).toContain('data-pace-gutter="C-D"');
    expect(cd).toContain("Export · hold");
    expect(cd).toContain("border-[#d4b36a]");
    expect(cd).toContain("border-dashed");
    expect(cd).toContain("border-2");
    expect(cd).toContain("bg-[#142014]");
    expect(cd).toContain(">Needs review<");
    expect(ef).toContain("Journey E-F, Export, no go, Fast");
    expect(ef).toContain("Export · no go");
    expect(ef).toContain("border-[#c45c38]");
    expect(ef).toContain("border-2");
    expect(ef).toContain("bg-[#142014]");
    expect(ef).toContain(">Not shootable<");
  });

  it("exposes structured reasoning behind a disclosure, not as raw JSON", () => {
    const project = projectWithCinematographerAssessment(createForestProject(), "D-E", {
      ...shootableAB,
      summary: "Pass through the remaining opening toward the portal corridor.",
      route: "Move forward as the next space becomes visible through the threshold.",
      threshold: "The tall vertical portal remaining in the corridor.",
      camera: "Keep the portal on the forward axis.",
      parallax: "Corridor walls the camera can pass.",
      concerns: ["Keep the previous space from disappearing too early."],
    });
    const html = renderShoot(project, { journeyId: "D-E" });
    expect(html).toContain("Shot");
    expect(html).toContain("Route.");
    expect(html).toContain("Move forward as the next space becomes visible through the threshold.");
    expect(html).toContain("Transition.");
    expect(html).toContain("Prompt addition.");
    expect(html).toContain("Threshold.");
    expect(html).toContain("The tall vertical portal remaining in the corridor.");
    expect(html).toContain("Camera path.");
    expect(html).toContain("Pace.");
    expect(html).toContain("Fast");
    expect(html).toContain("Geometry.");
    expect(html).toContain("Camotion.");
    expect(html).toContain("Appropriate");
    expect(html).toContain("Keep the previous space from disappearing too early.");
    expect(html).toContain("Advisory set analysis. Does not block this journey.");
    expect(html).not.toContain('"camotionSuitability"');
    expect(html).not.toContain("vanishing_point");
  });

  it("does not offer assessment when an endpoint is still FPO", () => {
    const project = {
      ...createForestProject(),
      storyboard: createForestProject().storyboard.map((frame) =>
        frame.id === "B" ? { id: "B", label: "B", imageOrigin: "none" as const } : frame,
      ),
    };
    const html = renderShoot(project, { journeyId: "A-B" });
    expect(html).toContain("Cinematographer needs two actual destinations.");
    expect(html).toContain('aria-label="Stage A-B"');
    expect(html).toContain('aria-label="Generate A-B"');
    expect(html).not.toContain('aria-label="Shoot A-B"');
    expect(html).not.toContain('aria-label="Reshoot A-B"');
    expect(html).not.toContain(">Assess shot<");
  });
});

describe("empty Shoot", () => {
  it("does not assume Forest journeys or media exist", () => {
    const html = renderToStaticMarkup(
      <ProjectProvider initialProject={createNewProject()} initialView="shoot">
        <TimelineView />
      </ProjectProvider>,
    );
    expect(html).toContain("Nothing is ready to shoot until the journey has actual adjacent destinations.");
    expect(html).not.toContain("FOREST A→F");
    expect(html).not.toContain("Destination undefined");
    expect(html).not.toContain(">Assess shot<");
    expect(html).not.toContain('aria-label="Stage');
    expect(html).not.toContain('aria-label="Generate');
    expect(html).not.toContain('aria-label="Destination A"');
    expect(html).not.toContain('aria-label="Preview canonical"');
    expect(html).not.toContain("No Camotion data for this destination");
  });

  it("stays coherent after the opening frame exists but Shoot destinations do not", () => {
    const withStart = {
      ...createNewProject(),
      storyboard: [
        {
          id: "A",
          label: "A",
          imageOrigin: "user" as const,
          image: "/api/runtime-media/upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          destinationId: "A",
        },
      ],
    };
    const html = renderToStaticMarkup(
      <ProjectProvider
        initialProject={withStart}
        initialView="shoot"
        initialSelection={{ kind: "destination", destinationId: "A", occurrenceIndex: 0 }}
      >
        <TimelineView />
      </ProjectProvider>,
    );
    expect(html).toContain("Nothing is ready to shoot until the journey has actual adjacent destinations.");
    expect(html).not.toContain("Cannot read");
    expect(html).not.toContain('aria-label="Stage');
    expect(html).not.toContain('aria-label="Generate');
  });
});

describe("Shoot from a real planned project", () => {
  it("shows actual adjacent canonicals as selectable production legs", () => {
    const project = projectWithSyncedProductionLegs({
      ...createNewProject(),
      storyboard: [
        {
          id: "A",
          label: "A",
          imageOrigin: "user",
          image: "/api/runtime-media/upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          destinationId: "A",
        },
        {
          id: "B",
          label: "B",
          imageOrigin: "generated",
          image: "/api/runtime-media/upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          destinationId: "B",
        },
        {
          id: "C",
          label: "C",
          imageOrigin: "generated",
          image: "/api/runtime-media/upload-cccccccccccccccccccccccccccccccc",
          mediaId: "upload-cccccccccccccccccccccccccccccccc",
          destinationId: "C",
        },
      ],
    });
    const html = renderShoot(project, { journeyId: "A-B" });
    expect(html).toContain("Journey A-B, Stage");
    expect(html).toContain("Journey B-C, Stage");
    expect(html).not.toContain("data-journey-pace");
    expect(html).toContain("Stage");
    expect(html).toContain("border-[#3a342c]");
    expect(html).toContain("bg-transparent");
    expect(html).not.toContain("bg-[#142014]");
    expect(html).toContain("Status: Stage");
    expect(html).toContain('aria-label="Destination A"');
    expect(html).toContain('aria-label="Destination B"');
    expect(html).toContain('aria-label="Destination C"');
    expect(html).toContain('aria-label="Stage A-B"');
    expect((html.match(/aria-label="Stage A-B"/g) ?? []).length).toBe(1);
    expect(html).toContain('aria-label="Generate A-B"');
    expect((html.match(/aria-label="Generate A-B"/g) ?? []).length).toBe(1);
    expect(html).not.toContain('aria-label="Stage B-C"');
    expect(html).not.toContain("This journey is not a finished movie clip.");
    expect(html).toContain('aria-label="Resize timeline"');
    expect(html).toContain("cursor-row-resize");
    expect(html).toContain('alt="A-B end B"');
    expect(html).toContain("preview-leg");
    expect(html).not.toContain('aria-label="Preview video"');
    expect(html).not.toContain('aria-label="Preview mode"');
    expect(html).not.toContain('aria-label="Preview canonical"');
    expect(html).not.toContain("Nothing is ready to shoot");
    expect(html).not.toContain(">Assess shot<");
  });

  it("outlines a blocked hold without filling until the take exists", () => {
    const base = projectWithSyncedProductionLegs({
      ...createNewProject(),
      storyboard: [
        {
          id: "A",
          label: "A",
          imageOrigin: "user",
          image: "/api/runtime-media/upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          destinationId: "A",
        },
        {
          id: "B",
          label: "B",
          imageOrigin: "generated",
          image: "/api/runtime-media/upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          destinationId: "B",
        },
      ],
    });
    const project = projectWithCinematographerAssessment(base, "A-B", {
      ...shootableAB,
      shootability: "needs_review",
    });
    const html = renderShoot(project, { journeyId: "A-B" });
    expect(html).toContain("Journey A-B, Film, hold, Fast");
    expect(html).toContain("Film · hold");
    expect(html).toContain("border-[#d4b36a]");
    expect(html).toContain("border-dashed");
    expect(html).toContain("border-2");
    expect(html).toContain("bg-transparent");
    expect(html).not.toContain("bg-[#142014]");
    expect(html).toContain(">Needs review<");
    expect((html.match(/aria-label="Generate A-B"/g) ?? []).length).toBe(1);
    expect((html.match(/aria-label="Stage A-B"/g) ?? []).length).toBe(1);
  });

  it("animates the segment while BLOCK is running", () => {
    const forest = createForestProject();
    const project = {
      ...forest,
      journeys: forest.journeys.map((journey) =>
        journey.id === "A-B"
          ? { ...journey, status: "ready" as const, videoUrl: undefined }
          : journey,
      ),
    };
    const html = renderToStaticMarkup(
      <ProjectProvider
        initialProject={project}
        initialView="shoot"
        initialSelection={{ kind: "journey", journeyId: "A-B" }}
        initialAssessingJourneyIds={["A-B"]}
      >
        <TimelineView />
      </ProjectProvider>,
    );
    expect(html).toContain("storyboard-generating");
    expect(html).toContain("storyboard-generating-label");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Journey A-B, Stage");
    expect(html).toContain("Staging…");
    expect(html).not.toContain("animate-spin");
    expect(html).toContain("Journey B-C, Export");
  });

  it("animates shooting tiles without a spinner and tracks more than one in-progress shoot", () => {
    const forest = createForestProject();
    const project = {
      ...forest,
      journeys: forest.journeys.map((journey) =>
        journey.id === "A-B" || journey.id === "B-C"
          ? { ...journey, status: "shooting" as const }
          : journey,
      ),
    };
    const html = renderToStaticMarkup(
      <ProjectProvider
        initialProject={project}
        initialView="shoot"
        initialSelection={{ kind: "journey", journeyId: "A-B" }}
        initialShootingJourneyIds={["A-B", "B-C"]}
      >
        <TimelineView />
      </ProjectProvider>,
    );
    expect(html).toContain("storyboard-generating");
    expect(html).toContain("storyboard-generating-label");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Journey A-B, Film");
    expect(html).toContain("Journey B-C, Film");
    expect(html).toContain("Generating…");
    const spinningTiles = html.match(/animate-spin/g) ?? [];
    expect(spinningTiles).toHaveLength(0);
  });
});

describe("Shoot preview mode", () => {
  it("labels the stills tab with the selected journey's canonical pair", () => {
    const html = renderToStaticMarkup(
      <PreviewModeSwitch startLabel="B" endLabel="C" mode="stills" onChange={() => undefined} />,
    );
    expect(html).toContain('aria-label="Preview mode"');
    expect(html).toContain('aria-pressed="true" aria-label="Preview B|C"');
    expect(html).toContain(">B|C<");
    expect(html).toContain('aria-pressed="false" aria-label="Preview video"');
  });

  it("renders the side-by-side canonical pair in the preview monitor", () => {
    const html = renderToStaticMarkup(
      <JourneyCanonicalPair
        journeyId="A-B"
        startLabel="A"
        startImage="/a.jpg"
        endLabel="B"
        endImage="/b.jpg"
      />,
    );
    expect(html).toContain("preview-leg");
    expect(html).toContain('alt="A-B start A"');
    expect(html).toContain('alt="A-B end B"');
    expect(html).toContain('src="/a.jpg"');
    expect(html).toContain('src="/b.jpg"');
  });
});

const diagnosticTake: JourneyShotTake = {
  startShootingFrame: { mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", imageUrl: "/a-prime.png" },
  endShootingFrame: { mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", imageUrl: "/b-prime.png" },
  startPlan: {
    version: 1,
    camera: { vanishing_point: [0.5, 0.5], forward: 1 },
    destination: { point: [0.5, 0.5], protect: true, bbox: [0.25, 0.2, 0.75, 0.8] },
    exposure: { strength: 0.08, samples: 16 },
  },
  endPlan: {
    version: 1,
    camera: { vanishing_point: [0.4, 0.6], forward: 1 },
    destination: { point: [0.4, 0.6], protect: false, bbox: [0.1, 0.1, 0.9, 0.9] },
    exposure: { strength: 0.04, samples: 16 },
  },
  segmentPromptAddition: "Track forward.",
  effectivePrompt: "Track forward.",
  pace: "fast",
  provider: "replicate",
  model: "prunaai/p-video",
  modelVersion: "test",
  durationSeconds: 6,
  videoInputs: { startShootingFrame: true, endShootingFrame: true },
};

describe("Camotion destination diagnostic", () => {
  it("labels the canonical vs primed preview switch", () => {
    const html = renderToStaticMarkup(
      <CamotionFrameSwitch
        destinationLabel="A"
        primedLabel="A′"
        mode="canonical"
        onChange={() => undefined}
      />,
    );
    expect(html).toContain('aria-label="Camotion frame"');
    expect(html).toContain('aria-pressed="true" aria-label="Preview canonical"');
    expect(html).toContain('aria-pressed="false" aria-label="Preview A′"');
  });

  it("offers a read-only Camotion switch on Forest destination A before any take", () => {
    const html = renderShoot();
    expect(html).toContain('aria-label="Preview canonical"');
    expect(html).toContain('aria-label="Preview A′"');
    expect(html).toContain("Canonical A");
    expect(html).toContain("No Camotion data for this destination");
    expect(html).toContain('alt="Destination A"');
    expect(html).not.toContain('aria-label="Toggle overlay"');
    expect(html).not.toContain("vanishing_point");
  });

  it("does not put the destination Camotion switch on a selected journey", () => {
    const html = renderShoot(createForestProject(), { journeyId: "A-B" });
    expect(html).toContain('aria-label="Preview video"');
    expect(html).not.toContain('aria-label="Preview canonical"');
    expect(html).not.toContain("No Camotion data for this destination");
  });

  it("surfaces stored CameraMotionPlan facts for the selected destination occurrence", () => {
    const shot = projectWithJourneyShotTake(createForestProject(), "A-B", {
      take: diagnosticTake,
      videoUrl: "/a-b.mp4",
    });
    const fromA = renderShoot(shot, { destinationId: "A", occurrenceIndex: 0 });
    expect(fromA).toContain('aria-label="Camotion diagnostic"');
    expect(fromA).toContain("A′ · A-B start′");
    expect(fromA).toContain("Vanishing point.");
    expect(fromA).toContain("0.50, 0.50");
    expect(fromA).toContain("Radial forward.");
    expect(fromA).toContain("0.08 · Strong");
    expect(fromA).toContain("/a-prime.png");
    expect(fromA).toContain("upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(fromA).toContain("CameraMotionPlan v1. Read-only take evidence.");
    expect(fromA).toContain("Canonical A");
    expect(fromA).toContain('alt="Destination A"');
    expect(fromA).toContain('aria-label="Toggle overlay"');
    expect(fromA).toContain("camotion-overlay");
    expect(fromA).toContain('data-overlay-layer="path"');
    expect(fromA).toContain('data-overlay-layer="direction"');
    expect(fromA).toContain('data-overlay-layer="points"');
    expect(fromA).toContain(">VP<");
    expect(fromA).not.toContain('alt="A′ · A-B start′"');
    expect(fromA).not.toContain("vanishing_point");
    expect(fromA).not.toContain("No Camotion data for this destination");

    const fromB = renderShoot(shot, { destinationId: "B", occurrenceIndex: 1 });
    expect(fromB).toContain('aria-label="Preview B′"');
    expect(fromB).toContain("A-B end′");
    expect(fromB).toContain("0.04 · Medium");
    expect(fromB).toContain("/b-prime.png");
  });

  it("keeps overlay layer toggles compact and omits raw plan keys", () => {
    const html = renderToStaticMarkup(
      <>
        <CamotionOverlayToggles
          overlay
          layers={DEFAULT_OVERLAY_LAYERS}
          onOverlayChange={() => undefined}
          onLayersChange={() => undefined}
        />
        <CamotionPlanOverlay
          plan={diagnosticTake.startPlan}
          layers={{ path: true, direction: false, points: true }}
          fitted={null}
        />
      </>,
    );
    expect(html).toContain('aria-label="Toggle overlay"');
    expect(html).toContain('aria-label="Travel path"');
    expect(html).toContain('aria-label="Camotion direction"');
    expect(html).toContain('aria-label="Plan points"');
    expect(html).toContain('data-overlay-layer="path"');
    expect(html).toContain('data-overlay-layer="points"');
    expect(html).not.toContain('data-overlay-layer="direction"');
    expect(html).not.toContain("vanishing_point");
  });
});
