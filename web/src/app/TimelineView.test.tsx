import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { createWardrobeProject } from "../fixtures/wardrobe-loop";
import { createNewProject } from "../project/new-project";
import { projectWithCinematographerAssessment } from "../project/cinematographer";
import { projectWithSyncedProductionLegs } from "../project/production-legs";
import type { CinematographerAssessment } from "../project/types";
import { ProjectProvider } from "../project/ProjectProvider";
import { TimelineView } from "./TimelineView";

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
    expect(html).toContain("Journey A-B, Ready for edit, clear");
    expect(html).toContain("Ready for edit · clear");
    expect(html).toContain("bg-[#142014]");
    expect(html).toContain("border-[#3f5a3a]");
    expect(html).toContain("border-2");
    expect(html).toContain("Status: Ready for edit");
    expect(html).toContain(">Ready<");
    expect(html).toContain("Walk through the root gateway into the darker mouth.");
    expect(html).toContain("Camera path.");
    expect(html).toContain("Track forward along the path, passing between near trunks toward the opening.");
    expect(html).toContain('aria-label="Block A-B"');
    expect(html).toContain(">Block<");
    expect(html).toContain(">Blocked<");
    expect(html).toContain('aria-label="Shoot A-B"');
    expect((html.match(/aria-label="Shoot A-B"/g) ?? []).length).toBe(1);
    expect((html.match(/aria-label="Block A-B"/g) ?? []).length).toBe(1);
    expect(html).toContain(">Shoot<");
    expect(html).toContain('alt="A-B start A"');
    expect(html).toContain('alt="A-B end B"');
    expect(html).not.toContain("Journey A-B, Ready<");
    expect(html).not.toContain('"shootability"');
    expect(html).not.toContain(">Assess shot<");
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
    expect(cd).toContain("Journey C-D, Ready for edit, hold");
    expect(cd).toContain("Ready for edit · hold");
    expect(cd).toContain("border-[#d4b36a]");
    expect(cd).toContain("border-dashed");
    expect(cd).toContain("border-2");
    expect(cd).toContain("bg-[#142014]");
    expect(cd).toContain(">Needs review<");
    expect(ef).toContain("Journey E-F, Ready for edit, no go");
    expect(ef).toContain("Ready for edit · no go");
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
    expect(html).not.toContain('aria-label="Block A-B"');
    expect(html).not.toContain('aria-label="Shoot A-B"');
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
    expect(html).not.toContain('aria-label="Block');
    expect(html).not.toContain('aria-label="Destination A"');
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
    expect(html).not.toContain('aria-label="Block');
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
    expect(html).toContain("Journey A-B, Ready to block");
    expect(html).toContain("Journey B-C, Ready to block");
    expect(html).toContain("Ready to block");
    expect(html).toContain("border-[#3a342c]");
    expect(html).toContain("bg-transparent");
    expect(html).not.toContain("bg-[#142014]");
    expect(html).toContain("Status: Ready to block");
    expect(html).toContain('aria-label="Destination A"');
    expect(html).toContain('aria-label="Destination B"');
    expect(html).toContain('aria-label="Destination C"');
    expect(html).toContain('aria-label="Block A-B"');
    expect((html.match(/aria-label="Block A-B"/g) ?? []).length).toBe(2);
    expect(html).not.toContain('aria-label="Block B-C"');
    expect(html).not.toContain('aria-label="Shoot A-B"');
    expect(html).toContain('aria-label="Resize timeline"');
    expect(html).toContain("cursor-row-resize");
    expect(html).toContain('alt="A-B end B"');
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
    expect(html).toContain("Journey A-B, Ready to shoot, hold");
    expect(html).toContain("Ready to shoot · hold");
    expect(html).toContain("border-[#d4b36a]");
    expect(html).toContain("border-dashed");
    expect(html).toContain("border-2");
    expect(html).toContain("bg-transparent");
    expect(html).not.toContain("bg-[#142014]");
    expect(html).toContain(">Needs review<");
    expect((html.match(/aria-label="Shoot A-B"/g) ?? []).length).toBe(2);
    expect((html.match(/aria-label="Block A-B"/g) ?? []).length).toBe(1);
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
    expect(html).toContain("Journey A-B, Ready to block");
    expect(html).not.toContain("animate-spin");
    expect(html).toContain("Journey B-C, Ready for edit");
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
    expect(html).toContain("Journey A-B, Ready to shoot");
    expect(html).toContain("Journey B-C, Ready to shoot");
    const spinningTiles = html.match(/animate-spin/g) ?? [];
    expect(spinningTiles).toHaveLength(0);
  });
});
