import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { createWardrobeProject } from "../fixtures/wardrobe-loop";
import { createNewProject } from "../project/new-project";
import { projectWithCinematographerAssessment } from "../project/cinematographer";
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
});

describe("Shoot Cinematographer journey assessment", () => {
  it("keeps a rendered journey rendered and shows CM Ready separately", () => {
    const project = projectWithCinematographerAssessment(createForestProject(), "A-B", shootableAB);
    expect(project.journeys.find((journey) => journey.id === "A-B")?.status).toBe("rendered");
    const html = renderShoot(project, { journeyId: "A-B" });
    expect(html).toContain("Journey A-B, rendered, CM Ready");
    expect(html).toContain("rendered · CM Ready");
    expect(html).toContain(">Ready<");
    expect(html).toContain("Walk through the root gateway into the darker mouth.");
    expect(html).toContain("Camera path.");
    expect(html).toContain("Track forward along the path, passing between near trunks toward the opening.");
    expect(html).not.toContain("Journey A-B, Ready");
    expect(html).not.toContain('"shootability"');
  });

  it("shows CM Needs review and Not shootable separately from rendered operational status", () => {
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
    expect(cd).toContain("Journey C-D, rendered, CM Needs review");
    expect(cd).toContain("rendered · CM Needs review");
    expect(cd).toContain(">Needs review<");
    expect(ef).toContain("Journey E-F, rendered, CM Not shootable");
    expect(ef).toContain("rendered · CM Not shootable");
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
  });
});
