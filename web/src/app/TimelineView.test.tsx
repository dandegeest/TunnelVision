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
import { JourneyCanonicalPair } from "./Preview";

function renderShoot(
  project = createForestProject(),
  selection?: { destinationId: string; occurrenceIndex: number } | { journeyId: string; band?: "motion" | "footage" },
  options?: {
    inspectorOpen?: boolean;
    debug?: boolean;
    constructingBeatId?: string | null;
    storyboardReelId?: string | null;
  },
) {
  const initialSelection =
    selection && "journeyId" in selection
      ? { kind: "journey" as const, journeyId: selection.journeyId, band: selection.band ?? "motion" }
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
      initialInspectorOpen={options?.inspectorOpen}
      initialDebug={options?.debug}
      initialConstructingBeatId={options?.constructingBeatId}
      initialStoryboardReelId={options?.storyboardReelId}
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
  setConsistency: 87,
  traversalConfidence: 74,
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

  it("shows the Plan storyboard reel over Shoot when a selected still is opened", () => {
    const html = renderShoot(createForestProject(), { destinationId: "B", occurrenceIndex: 1 }, { storyboardReelId: "B" });
    expect(html).toContain("storyboard-reel");
    expect(html).toContain('aria-label="Storyboard reel, destination B"');
    expect(html).toContain('aria-label="Close storyboard reel"');
    expect(html).toContain(">Inspector - Destination<");
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

  it("lets Reshoot regenerate a generated canonical from the destination inspector", () => {
    const html = renderShoot(createForestProject(), { destinationId: "B", occurrenceIndex: 1 });
    expect(html).toContain('aria-label="Reshoot destination B"');
    expect(html).toContain(">Reshoot<");
    expect(html.indexOf(">Prompt<")).toBeLessThan(html.indexOf('aria-label="Reshoot destination B"'));
    expect(html.indexOf('aria-label="Reshoot destination B"')).toBeLessThan(
      html.indexOf('aria-label="Destination B facts"'),
    );
    expect(html).toContain('aria-label="Destination B source"');
    expect(html).toContain('aria-label="Destination B intent"');
    expect(html).toContain("Root-tunnel mouth. The dark opening is slightly right of center.");
    expect(html).toContain('aria-label="Destination B facts"');
    expect(html).toContain("~1.85:1");
    expect(html).toContain("1392×752");
    expect(html).toContain("FLUX Kontext Pro");
    expect(html).not.toContain("This is what the generated world actually gave us");
    expect(html).not.toContain("The Cinematographer judges how to shoot");
    const opening = renderShoot();
    expect(opening).toContain(">Inspector - Destination<");
    expect(opening).toContain("text-2xl\">A<");
    expect(opening).toContain('aria-label="Destination A intent"');
    expect(opening).toContain("rows=\"3\"");
    expect(opening).toContain('aria-label="Destination A story"');
    expect(opening).toContain(">Prompt<");
    expect(opening).toContain("<details");
    expect(opening).not.toMatch(/<details[^>]*\sopen/);
    expect(opening).not.toMatch(/aria-label="Destination A intent"[^>]*readOnly=""/);
    expect(opening).not.toMatch(/aria-label="Destination A story"[^>]*readOnly=""/);
    expect(opening).toContain("~16:9");
    expect(opening).toContain("1000×558");
    expect(opening).not.toContain("FLUX 1.1 Pro Ultra");
    expect(opening).toContain("focus:bg-[#161410]");
    expect(opening).not.toContain('aria-label="Reshoot destination A"');
    expect(opening).not.toContain("This is the opening destination.");
    expect(opening).not.toContain("Status: ready");
    expect(opening).not.toContain("tracking-[0.22em] text-[#9a8f7e] uppercase\">Destination<");
  });
});

describe("Shoot Cinematographer journey assessment", () => {
  it("keeps a rendered journey complete without inspector Status or Ready", () => {
    const project = projectWithCinematographerAssessment(createForestProject(), "A-B", shootableAB);
    expect(project.journeys.find((journey) => journey.id === "A-B")?.status).toBe("rendered");
    const html = renderShoot(project, { journeyId: "A-B" });
    expect(html).toContain('aria-label="Motion A-B"');
    expect(html).toContain('aria-label="Footage A-B"');
    expect(html).toContain(">MOTION<");
    expect(html).toContain(">FOOTAGE<");
    expect(html).toContain('data-journey-pace="fast"');
    expect(html).toContain('data-pace-gutter="A-B"');
    expect(html).not.toContain("A-B ·");
    expect(html).toContain("bg-[#142014]");
    expect(html).toContain("border-[#3f5a3a]");
    expect(html).toContain("border-2");
    expect(html).toContain(">Inspector - Motion<");
    expect(html).toContain('text-2xl">A→B<');
    expect(html).not.toContain('text-2xl">A-B<');
    expect(html).not.toContain("Status: Film");
    expect(html).not.toContain(">Ready<");
    expect(html).toContain("Set consistency");
    expect(html).toContain("Traversal conf.");
    expect(html).toContain("Walk through the root gateway into the darker mouth. · Fast");
    expect(html).toContain("Camera path.");
    expect(html).toContain("Track forward along the path, passing between near trunks toward the opening.");
    expect(html).not.toContain('aria-label="Plan A-B"');
    expect(html).not.toContain(">Plan<");
    expect(html).toContain(">Cinematographer Motion Plan<");
    expect(html).toContain('aria-label="Generate A-B"');
    expect((html.match(/aria-label="Generate A-B"/g) ?? []).length).toBe(1);
    expect((html.match(/aria-label="Plan A-B"/g) ?? []).length).toBe(0);
    expect(html).toContain(">Generate<");
    expect(html).not.toContain('aria-label="Shoot A-B"');
    expect(html).not.toContain('aria-label="Reshoot A-B"');
    expect(html).not.toContain('aria-label="Block A-B"');
    expect(html).toContain('alt="A-B start A"');
    expect(html).toContain('alt="A-B end B"');
    expect(html).toContain("preview-leg");
    expect(html).toContain("preview-monitor-pair");
    expect(html).toContain('data-preview-aspect="2000/558"');
    expect(html).toContain("media-contain");
    expect(html).toContain("Preview · Motion A-B");
    expect(html).toContain('id="shoot-inspector"');
    expect(html).toContain('title="Hide inspector"');
    expect(html).not.toContain("inspector-reopen");
    expect(html).not.toContain('title="Hide preview"');
    expect(html).not.toContain('aria-label="Preview mode"');
    expect(html).not.toContain('aria-label="Preview video"');
    expect(html).not.toContain('aria-label="Preview A|B"');
    expect(html).not.toContain("<video");
    expect(html).not.toContain("This journey is not a finished movie clip.");
    expect(html).not.toContain("Journey A-B, Ready<");
    expect(html).not.toContain('"shootability"');
    expect(html).not.toContain(">Assess shot<");
  });

  it("sizes the motion preview to square stills instead of forcing 16:9", () => {
    const forest = createForestProject();
    const square = {
      ...forest,
      canonicalAspectRatio: { width: 800, height: 800 },
      storyboard: forest.storyboard.map((frame) =>
        frame.mediaInfo ? { ...frame, mediaInfo: { ...frame.mediaInfo, width: 800, height: 800 } } : frame,
      ),
    };
    const html = renderShoot(square, { journeyId: "A-B", band: "motion" });
    expect(html).toContain("preview-monitor-pair");
    expect(html).toContain('data-preview-aspect="1600/800"');
    expect(html).toContain("media-contain");
    expect(html).not.toContain('data-preview-aspect="32/9"');
  });

  it("opens footage for a rendered take without Video|A|B tabs", () => {
    const project = projectWithCinematographerAssessment(createForestProject(), "A-B", shootableAB);
    const html = renderShoot(project, { journeyId: "A-B", band: "footage" });
    expect(html).toContain("Preview · Footage A-B");
    expect(html).toContain("<video");
    expect(html).toContain(">Inspector - Footage<");
    expect(html).toContain('text-2xl">A→B<');
    expect(html).not.toContain('text-2xl">A-B<');
    expect(html).not.toContain("A → B");
    expect(html).not.toContain("This take is available in the preview.");
    expect(html).toContain('aria-label="Footage A-B"');
    expect(html).toContain('aria-label="Reshoot A-B"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('aria-label="Preview mode"');
    expect(html).not.toContain('aria-label="Preview video"');
    expect(html).not.toContain('aria-label="Preview A|B"');
    expect(html).not.toContain('aria-label="Plan A-B"');
    expect(html).toContain('aria-label="Generate A-B"');
    expect(html).not.toContain("preview-leg");
    expect(html).not.toContain("Status: Film");
    expect(html).not.toContain("Status: Export");
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

  it("paints hold as a solid gold filled band and no-go as a rust outline", () => {
    const review = projectWithCinematographerAssessment(createForestProject(), "C-D", {
      ...shootableAB,
      shootability: "needs_review",
      summary: "The pair tends to replace C rather than enter D.",
      setConsistency: 61,
      traversalConfidence: 44,
      concerns: ["Start-frame authority is weak."],
    });
    const blocked = projectWithCinematographerAssessment(review, "E-F", {
      ...shootableAB,
      shootability: "not_shootable",
      summary: "Open void with no traversable corridor.",
      setConsistency: 38,
      traversalConfidence: 19,
      concerns: ["The void offers no traversable corridor."],
    });
    expect(blocked.journeys.find((journey) => journey.id === "C-D")?.status).toBe("rendered");
    expect(blocked.journeys.find((journey) => journey.id === "E-F")?.status).toBe("rendered");
    const cd = renderShoot(blocked, { journeyId: "C-D" });
    const ef = renderShoot(blocked, { journeyId: "E-F" });
    expect(cd).toContain('aria-label="Motion C-D"');
    expect(cd).toContain('data-journey-pace="fast"');
    expect(cd).toContain('data-pace-gutter="C-D"');
    expect(cd).toContain("border-2 border-[#d4b36a] bg-[#443922]");
    expect(cd).not.toContain("border-[#d4b36a] border-dashed");
    expect(cd).not.toContain(">Needs review<");
    expect(ef).toContain('aria-label="Motion E-F"');
    expect(ef).toContain("border-[#c45c38]");
    expect(ef).toContain("border-2");
    expect(ef).toContain("bg-[#142014]");
    expect(ef).not.toContain(">Not shootable<");
  });

  it("keeps Motion Inspector scores, concerns, and path without a Shot disclosure", () => {
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
    expect(html).toContain("Set consistency");
    expect(html).toContain("87");
    expect(html).toContain("Traversal conf.");
    expect(html).toContain("74");
    expect(html).toContain("rounded-full px-2.5 py-0.5");
    expect(html).toContain("border border-[#3f5a3a] bg-[#142014] text-[#d7e7cf]");
    expect(html).toContain(">Concerns<");
    expect(html).toContain("Keep the previous space from disappearing too early.");
    expect(html).toContain("Camera path.");
    expect(html).toContain("Pace.");
    expect(html).toContain("Fast");
    expect(html).not.toContain(">Shot<");
    expect(html).not.toContain("Route.");
    expect(html).not.toContain("Transition.");
    expect(html).not.toContain("Prompt addition.");
    expect(html).not.toContain("Threshold.");
    expect(html).not.toContain("Geometry.");
    expect(html).not.toContain("Advisory set analysis. Does not block this journey.");
    expect(html).not.toContain("Camotion.");
    expect(html).not.toContain('"camotionSuitability"');
    expect(html).not.toContain("vanishing_point");
  });

  it("does not show CM travel targets in the Motion Inspector", () => {
    const project = projectWithCinematographerAssessment(createForestProject(), "D-E", {
      ...shootableAB,
      travel: {
        start: {
          vanishingPoint: [0.62, 0.41],
          destinationPoint: [0.62, 0.41],
          label: "corridor mouth left of center",
        },
        end: {
          vanishingPoint: [0.71, 0.36],
          destinationPoint: [0.71, 0.36],
          label: "fantasy portal, not the surrounding wall",
        },
        direction: "forward through the left-of-center opening as the corridor bends right",
        confidence: "high",
      },
    });
    const html = renderShoot(project, { journeyId: "D-E" });
    expect(html).not.toContain("Start target.");
    expect(html).not.toContain("End target.");
    expect(html).not.toContain("Travel confidence.");
    expect(html).not.toContain("corridor mouth left of center (0.62, 0.41)");
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
    expect(html).not.toContain("Motion Plan is created automatically from this actual adjacent pair.");
    expect(html).not.toContain('aria-label="Plan A-B"');
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
    expect(html).not.toContain('aria-label="Preview source"');
    expect(html).not.toContain("No Camotion data for this destination");
  });

  it("stays coherent after the opening frame exists but Shoot destinations do not", () => {
    const withStart = projectWithSyncedProductionLegs({
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
    });
    const html = renderToStaticMarkup(
      <ProjectProvider
        initialProject={withStart}
        initialView="shoot"
        initialSelection={{ kind: "destination", destinationId: "A", occurrenceIndex: 0 }}
      >
        <TimelineView />
      </ProjectProvider>,
    );
    expect(html).toContain('aria-label="Destination A"');
    expect(html).toContain('aria-label="Plan destination B"');
    expect(html).toContain("storyboard-fpo");
    expect(html).not.toContain("Nothing is ready to shoot until the journey has actual adjacent destinations.");
    expect(html).not.toContain("Cannot read");
    expect(html).not.toContain('aria-label="Stage');
    expect(html).not.toContain('aria-label="Generate');
    expect(html).not.toContain("aria-busy");
    const generating = renderToStaticMarkup(
      <ProjectProvider
        initialProject={withStart}
        initialView="shoot"
        initialSelection={{ kind: "destination", destinationId: "A", occurrenceIndex: 0 }}
        initialConstructingBeatId="B"
      >
        <TimelineView />
      </ProjectProvider>,
    );
    expect(generating).toContain('aria-label="Plan destination B"');
    expect(generating).toMatch(/aria-label="Plan destination B"[^>]*aria-busy="true"/);
    expect(generating).not.toMatch(/aria-label="Destination A"[^>]*aria-busy/);
    expect(generating).toContain("storyboard-generating");
    expect(generating).toContain("storyboard-generating-label");
  });
});

describe("Shoot destination generating", () => {
  it("shimmers an actual destination slot while Plan is generating that beat", () => {
    const html = renderShoot(createForestProject(), { destinationId: "B", occurrenceIndex: 1 }, { constructingBeatId: "B" });
    expect(html).toMatch(/aria-label="Destination B[^"]*"[^>]*aria-busy="true"/);
    expect(html).not.toMatch(/aria-label="Destination A[^"]*"[^>]*aria-busy/);
    expect(html).not.toMatch(/aria-label="Destination C[^"]*"[^>]*aria-busy/);
    expect(html).toContain("storyboard-generating");
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
    expect(html).toContain('aria-label="Motion A-B"');
    expect(html).toContain('aria-label="Motion B-C"');
    expect(html).toContain('aria-label="Footage A-B"');
    expect(html).toContain('aria-label="Footage B-C"');
    expect(html).not.toContain("data-journey-pace");
    expect(html).not.toContain(">Plan<");
    expect(html).toContain("border-[#3a342c]");
    expect(html).toContain("bg-transparent");
    expect(html).not.toContain("bg-[#142014]");
    expect(html).not.toContain("Status: Stage");
    expect(html).toContain("Motion Plan is created automatically from this actual adjacent pair.");
    expect(html).toContain('aria-label="Destination A"');
    expect(html).toContain('aria-label="Destination B"');
    expect(html).toContain('aria-label="Destination C"');
    expect(html).not.toContain('aria-label="Plan A-B"');
    expect(html).not.toContain('aria-label="Retry A-B"');
    expect((html.match(/aria-label="Plan A-B"/g) ?? []).length).toBe(0);
    expect(html).toContain('aria-label="Generate A-B"');
    expect((html.match(/aria-label="Generate A-B"/g) ?? []).length).toBe(1);
    expect(html).not.toContain('aria-label="Plan B-C"');
    expect(html).toContain('aria-label="Generate B-C"');
    expect(html).not.toContain("This journey is not a finished movie clip.");
    expect(html).toContain('aria-label="Resize timeline"');
    expect(html).toContain("cursor-row-resize");
    expect(html).toContain('alt="A-B end B"');
    expect(html).toContain("preview-leg");
    expect(html).not.toContain('aria-label="Preview video"');
    expect(html).not.toContain('aria-label="Preview mode"');
    expect(html).not.toContain('aria-label="Preview source"');
    expect(html).not.toContain("Nothing is ready to shoot");
    expect(html).not.toContain(">Assess shot<");
  });

  it("offers Retry on MOTION after that segment's automatic Motion Plan fails", () => {
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
    const project = {
      ...base,
      journeys: base.journeys.map((journey) =>
        journey.id === "A-B" ? { ...journey, motionPlanError: "Motion Plan failed" } : journey,
      ),
    };
    const html = renderShoot(project, { journeyId: "A-B" });
    expect(html).toContain('aria-label="Retry A-B"');
    expect(html).toContain(">Retry<");
    expect(html).toContain("Motion Plan failed");
    expect(html).not.toContain('aria-label="Plan A-B"');
    expect((html.match(/aria-label="Retry A-B"/g) ?? []).length).toBe(2);
  });

  it("fills a blocked hold after a Motion Plan with the same treatment as completed footage", () => {
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
    expect(html).toContain('aria-label="Motion A-B"');
    expect(html).toContain("border-2 border-[#d4b36a] bg-[#443922]");
    expect(html).not.toContain("border-[#d4b36a] border-dashed");
    expect(html).not.toContain(">Needs review<");
    expect((html.match(/aria-label="Generate A-B"/g) ?? []).length).toBe(1);
    expect((html.match(/aria-label="Plan A-B"/g) ?? []).length).toBe(0);
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
        initialSelection={{ kind: "journey", journeyId: "A-B", band: "motion" }}
        initialAssessingJourneyIds={["A-B"]}
      >
        <TimelineView />
      </ProjectProvider>,
    );
    expect(html).toContain("storyboard-generating");
    expect(html).toContain("storyboard-generating-label");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Motion A-B");
    expect(html).toContain("Planning…");
    expect(html).toContain("Planning this traversal…");
    expect(html).not.toContain("Status: Planning");
    expect(html).not.toContain("animate-spin");
    expect(html).toContain('aria-label="Motion B-C"');
    expect(html).toContain('aria-label="Footage B-C"');
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
        initialSelection={{ kind: "journey", journeyId: "A-B", band: "motion" }}
        initialShootingJourneyIds={["A-B", "B-C"]}
      >
        <TimelineView />
      </ProjectProvider>,
    );
    expect(html).toContain("storyboard-generating");
    expect(html).toContain("storyboard-generating-label");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Motion A-B"');
    expect(html).toContain('aria-label="Motion B-C"');
    expect(html).toContain('aria-label="Footage A-B"');
    expect(html).toContain('aria-label="Footage B-C"');
    expect(html).toContain("Generating…");
    const spinningTiles = html.match(/animate-spin/g) ?? [];
    expect(spinningTiles).toHaveLength(0);
  });
});

describe("Shoot preview mode", () => {
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
  effectivePrompt: "Track forward.\nFirst person POV camera continuously moving forward.",
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
    expect(html).toContain('aria-pressed="true" aria-label="Preview source"');
    expect(html).toContain('aria-pressed="false" aria-label="Preview motion"');
    expect(html).toContain(">Source<");
    expect(html).toContain(">Motion<");
  });

  it("offers a read-only Camotion switch on Forest destination A before any take", () => {
    const html = renderShoot();
    expect(html).toContain('aria-label="Preview source"');
    expect(html).toContain('aria-label="Preview motion"');
    expect(html).toContain("Canonical A");
    expect(html).toContain("Awaiting next destination");
    expect(html).not.toContain("No Camotion data for this destination");
    expect(html).toContain('alt="Destination A"');
    expect(html).not.toContain('aria-label="Toggle overlay"');
    expect(html).not.toContain("vanishing_point");
  });

  it("does not put the destination Camotion switch on a selected journey", () => {
    const html = renderShoot(createForestProject(), { journeyId: "A-B" });
    expect(html).toContain("preview-leg");
    expect(html).toContain("Preview · Motion A-B");
    expect(html).not.toContain('aria-label="Preview video"');
    expect(html).not.toContain("No Camotion data for this destination");
    expect(html).not.toContain("Awaiting next destination");
  });

  it("surfaces stored CameraMotionPlan facts for the selected destination occurrence", () => {
    const shot = projectWithJourneyShotTake(createForestProject(), "A-B", {
      take: diagnosticTake,
      videoUrl: "/a-b.mp4",
    });
    const fromA = renderShoot(shot, { destinationId: "A", occurrenceIndex: 0 });
    expect(fromA.match(/aria-label="Preview motion"/g)).toHaveLength(2);
    expect(fromA).toContain('aria-label="Camotion diagnostic"');
    expect(fromA).toContain("A′ · A→B START");
    expect(fromA).toContain(">Direction<");
    expect(fromA).toContain("Forward");
    expect(fromA).toContain(">Vanishing point<");
    expect(fromA).toContain("0.50, 0.50");
    expect(fromA).toContain(">Destination<");
    expect(fromA).toContain(">Protected<");
    expect(fromA).toContain("0.080 · Hyperspeed");
    expect(fromA).not.toContain("Radial forward.");
    expect(fromA).not.toContain("Bounding box");
    expect(fromA).not.toContain("Samples");
    expect(fromA).not.toContain("Media id");
    expect(fromA).not.toContain("CameraMotionPlan v1. Read-only Motion Plan evidence.");
    expect(fromA).not.toContain("/a-prime.png");
    expect(fromA).not.toContain("upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
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
    expect(fromA).not.toContain("Awaiting next destination");

    const fromB = renderShoot(shot, { destinationId: "B", occurrenceIndex: 1 });
    expect(fromB).toContain('aria-label="Preview motion"');
    expect(fromB).toContain("B′ · A→B END");
    expect(fromB).toContain("0.040 · Moderate");
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
    expect(html).toContain('aria-label="Motion points"');
    expect(html).toContain('data-overlay-layer="path"');
    expect(html).toContain('data-overlay-layer="points"');
    expect(html).not.toContain('data-overlay-layer="direction"');
    expect(html).not.toContain("vanishing_point");
    expect(html).toContain('data-vanishing-point="0.5,0.5"');
    expect(html).toContain('data-destination-point="0.5,0.5"');
    expect(html).toContain("data-overlay-halo");
    expect(html).toContain('data-overlay-label="vp"');
    expect(html).toContain("bg-black/70");
    expect(html).not.toContain("text-white/80");
  });

  it("draws the stored per-segment VP on the overlay, including off-center plans", () => {
    const html = renderToStaticMarkup(
      <CamotionPlanOverlay
        plan={diagnosticTake.endPlan}
        layers={DEFAULT_OVERLAY_LAYERS}
        fitted={null}
      />,
    );
    expect(html).toContain('data-vanishing-point="0.4,0.6"');
    expect(html).toContain('data-destination-point="0.4,0.6"');
    expect(html).toContain(">VP<");
  });
});

describe("Shoot footage inspector", () => {
  it("uses a single arrow heading, collapsed prompt, and debug-only model", () => {
    const assessed = projectWithCinematographerAssessment(createForestProject(), "A-B", {
      ...shootableAB,
      travel: { direction: "Forward, veering right", confidence: "high" },
    });
    const shot = projectWithJourneyShotTake(assessed, "A-B", {
      take: { ...diagnosticTake, model: "bytedance/seedance-2.0-fast", seed: 70 },
      videoUrl: "/a-b.mp4",
    });
    const html = renderShoot(shot, { journeyId: "A-B", band: "footage" });
    expect(html).toContain(">Inspector - Footage<");
    expect(html).toContain('text-2xl">A→B<');
    expect(html).not.toContain('text-2xl">A-B<');
    expect(html).not.toContain("A → B");
    expect(html).not.toContain(">Take<");
    expect(html).toContain("Start′");
    expect(html).toContain("End′");
    expect(html).toContain(">Pace<");
    expect(html).toContain("Fast");
    expect(html).toContain(">Shot direction<");
    expect(html).toContain("Forward, veering right");
    expect(html).toContain("<details");
    expect(html).toContain(">Prompt<");
    expect(html).toContain("Track forward.");
    expect(html).toContain('data-prompt-role="cm"');
    expect(html).toContain('data-prompt-role="baseline"');
    expect(html).toContain("text-[#e6c36a]");
    expect(html).toContain("First person POV camera continuously moving forward.");
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toContain(">Model<");
    expect(html).toContain("Seedance 2.0 Fast");
    expect(html).not.toContain("bytedance/seedance-2.0-fast");
    expect(html).not.toContain("seed 70");
    expect(html).not.toContain("Duration.");
    expect(html).not.toContain("This take is available in the preview.");
    expect(html).not.toContain("last-frame conditioning");
    expect(html).toContain('aria-label="Reshoot A-B"');
    expect(html).toContain(">Reshoot<");
    const hidden = renderShoot(shot, { journeyId: "A-B", band: "footage" }, { debug: false });
    expect(hidden).not.toContain(">Model<");
    expect(hidden).not.toContain("Seedance 2.0 Fast");
  });

  it("colors CM prompt addition in the Motion Inspector", () => {
    const shot = projectWithJourneyShotTake(createForestProject(), "A-B", {
      take: diagnosticTake,
      videoUrl: "/a-b.mp4",
    });
    const html = renderShoot(shot, { journeyId: "A-B", band: "motion" });
    expect(html).toContain(">Inspector - Motion<");
    expect(html).toContain(">Prompt<");
    expect(html).toContain('data-prompt-role="cm"');
    expect(html).toContain('data-prompt-role="baseline"');
    expect(html).toContain("text-[#e6c36a]");
  });
});

describe("Shoot inspector panel", () => {
  it("does not show Technical or Debug sections in the inspector", () => {
    const html = renderShoot();
    expect(html).not.toContain(">Technical<");
    expect(html).not.toMatch(/<summary[^>]*>Technical<\/summary>/);
    expect(html).not.toContain("Construction: planned. Discovery is not implemented.");
    expect(html).not.toContain("Session store.");
    expect(html).not.toContain("Turn on Debug mode in Project settings");
    const debugOff = renderShoot(createForestProject(), { destinationId: "A", occurrenceIndex: 0 }, { debug: false });
    expect(debugOff).not.toContain(">Technical<");
    expect(debugOff).not.toContain("Turn on Debug mode in Project settings");
  });

  it("hides the inspector when collapsed and keeps a control to reopen it", () => {
    const open = renderShoot(createForestProject(), { journeyId: "A-B" });
    const closed = renderShoot(createForestProject(), { journeyId: "A-B" }, { inspectorOpen: false });
    expect(open).toContain('id="shoot-inspector"');
    expect(open).toContain('title="Hide inspector"');
    expect(open).toContain('aria-label="Inspector"');
    expect(open).toContain('aria-controls="shoot-inspector"');
    expect(open).not.toContain("inspector-reopen");
    expect(open).toContain('aria-label="Resize timeline"');
    expect(open).toContain('aria-label="Resize inspector"');
    expect(open).toContain("cursor-col-resize");
    expect(open).toContain("preview-monitor-pair");
    expect(open).toContain("inspector-header");
    expect(open).toContain(">Inspector - Motion<");
    expect(open).toContain("text-[13px] font-semibold");
    expect(closed).toContain("inspector-reopen");
    expect(closed).toContain("h-9 w-full");
    expect(closed).toContain("h-5 w-5");
    expect(closed).toContain("border-l border-[#2a2620]");
    const reopenAt = closed.indexOf("inspector-reopen");
    const reopen = closed.slice(reopenAt, reopenAt + 280);
    expect(reopen).toContain("flex-col");
    expect(reopen).not.toContain("items-center justify-center border-l");
    expect(closed).toContain('title="Show inspector"');
    expect(closed).toContain('aria-label="Inspector"');
    expect(closed).toContain("hidden");
    expect(closed).toContain('id="shoot-inspector"');
    expect(closed).toContain('aria-label="Resize timeline"');
    expect(closed).not.toContain('aria-label="Resize inspector"');
    expect(closed).toContain("preview-monitor-pair");
    expect(closed).toContain('aria-label="Motion A-B"');
    expect(closed).not.toContain("preview-reopen");
    expect(closed).not.toContain('title="Hide preview"');
  });
});
