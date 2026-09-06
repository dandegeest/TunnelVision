import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WARDROBE_USER_PROMPT } from "../fixtures/wardrobe-loop";
import { ProjectProvider } from "../project/ProjectProvider";
import { isAuthoritativeStartingFrame } from "../project/starting-frame";
import { PlanView } from "./PlanView";

describe("Plan composer", () => {
  it("is an editable movie instruction bound to Project.story", () => {
    const html = renderToStaticMarkup(
      <ProjectProvider>
        <PlanView />
      </ProjectProvider>,
    );
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
  });

  it("does not offer Replace image on a user-origin frame that is not A", () => {
    expect(isAuthoritativeStartingFrame({ id: "A" })).toBe(true);
    expect(isAuthoritativeStartingFrame({ id: "B" })).toBe(false);
  });
});
