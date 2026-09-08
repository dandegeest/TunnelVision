import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { ProjectProvider } from "../project/ProjectProvider";
import { Shell } from "./Shell";

function renderShell(options?: { mediaInfo?: boolean; view?: "plan" | "shoot" }) {
  return renderToStaticMarkup(
    <ProjectProvider
      initialProject={createForestProject()}
      initialMediaInfo={options?.mediaInfo}
      initialView={options?.view}
    >
      <Shell />
    </ProjectProvider>,
  );
}

describe("Shell header chrome", () => {
  it("does not show a supervising caption beside the agency chooser", () => {
    const html = renderShell();
    expect(html).not.toContain("You are supervising");
    expect(html).not.toContain("YOU ARE SUPERVISING");
    expect(html).not.toContain("Live production monitor");
    expect(html).toContain('aria-label="Agency"');
    expect(html).toContain("Directed");
    expect(html).toContain("Autonomous");
  });

  it("places the Media Info icon in the workspace header toolbar", () => {
    const off = renderShell();
    const on = renderShell({ mediaInfo: true });
    expect(off).toContain("workspace-toolbar");
    expect(off).toContain('aria-label="Media info"');
    expect(off).toContain('title="Media info"');
    expect(off).toContain('aria-pressed="false"');
    expect(on).toContain('aria-pressed="true"');
    expect(off).not.toContain(">Media Info<");
    expect(off).not.toContain(">MEDIA INFO<");
    const storyboard = off.slice(off.indexOf('aria-label="Storyboard"'));
    expect(storyboard).not.toContain('aria-label="Media info"');
  });

  it("centers Plan/Shoot in the workspace toolbar grid, not as a viewport heading", () => {
    const html = renderShell();
    expect(html).toContain("workspace-toolbar");
    expect(html).toContain("grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]");
    expect(html).toContain(">Plan<");
    expect(html).toContain(">Shoot<");
  });

  it("keeps the toolbar on Shoot without the supervising caption", () => {
    const html = renderShell({ view: "shoot" });
    expect(html).toContain("workspace-toolbar");
    expect(html).toContain('aria-label="Media info"');
    expect(html).toContain('aria-label="Agency"');
    expect(html).not.toContain("You are supervising");
    expect(html).not.toContain("Live production monitor");
  });
});
