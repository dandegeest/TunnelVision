import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createWardrobeProject, WARDROBE_USER_PROMPT } from "../fixtures/wardrobe-loop";
import {
  canConstructDestinationFrame,
  projectWithConstructedDestination,
} from "../project/destination";
import { ProjectProvider } from "../project/ProjectProvider";
import { isAuthoritativeStartingFrame } from "../project/starting-frame";
import { projectWithDirectorPlan } from "../project/storyboard";
import { PlanView } from "./PlanView";

const plannedBeats = {
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

function renderPlan(project = createWardrobeProject()) {
  return renderToStaticMarkup(
    <ProjectProvider initialProject={project}>
      <PlanView />
    </ProjectProvider>,
  );
}

describe("Plan composer", () => {
  it("is an editable movie instruction bound to Project.story", () => {
    const html = renderPlan();
    expect(html).toContain('id="plan-composer"');
    expect(html).toContain('rows="7"');
    expect(html).toContain('aria-label="Resize story panel"');
    expect(html).not.toMatch(/id="plan-composer"[^>]*\sdisabled(?:[\s>]|$)/);
    expect(html).toContain(WARDROBE_USER_PROMPT);
    expect(html).toContain('aria-label="Plan movie"');
    expect(html).toContain("Replace image");
    expect(html).toContain('id="replace-starting-image"');
    expect(html).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(html).not.toContain("Tell TunnelVision what to change");
    expect(html).not.toContain('aria-label="Construct destination B"');
  });

  it("does not offer Replace image on a user-origin frame that is not A", () => {
    expect(isAuthoritativeStartingFrame({ id: "A" })).toBe(true);
    expect(isAuthoritativeStartingFrame({ id: "B" })).toBe(false);
  });

  it("offers Construct only on planned B", () => {
    const planned = projectWithDirectorPlan(createWardrobeProject(), plannedBeats);
    const html = renderPlan(planned);
    expect(html).toContain('aria-label="Construct destination B"');
    expect(html.match(/aria-label="Construct destination B"/g)?.length).toBe(1);
    expect(html).not.toContain("Construct destination C");
    expect(canConstructDestinationFrame(planned, planned.storyboard[1]!)).toBe(true);
    expect(canConstructDestinationFrame(planned, planned.storyboard[2]!)).toBe(false);

    const constructed = projectWithConstructedDestination(planned, {
      beatId: "B",
      mediaId: "upload-11111111111111111111111111111111",
      imageUrl: "/api/runtime-media/upload-11111111111111111111111111111111",
    });
    const after = renderPlan(constructed);
    expect(after).not.toContain('aria-label="Construct destination B"');
  });
});
