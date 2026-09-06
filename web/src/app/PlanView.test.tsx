import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WARDROBE_USER_PROMPT } from "../fixtures/wardrobe-loop";
import { ProjectProvider } from "../project/ProjectProvider";
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
    expect(html).not.toContain("Tell TunnelVision what to change");
  });
});
