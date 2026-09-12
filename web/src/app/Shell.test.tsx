import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import type { ConversationEntry } from "../project/conversation";
import { ProjectProvider } from "../project/ProjectProvider";
import { ProjectRail } from "./ProjectRail";
import { Shell } from "./Shell";

function renderShell(options?: {
  debug?: boolean;
  view?: "plan" | "shoot";
  conversationRailOpen?: boolean;
  projectRailOpen?: boolean;
  agency?: "directed" | "autonomous";
  conversation?: ConversationEntry[];
  composerDraft?: string;
  storyboardReelId?: string | null;
}) {
  const project = {
    ...createForestProject(),
    ...(options?.agency ? { agency: options.agency } : {}),
  };
  return renderToStaticMarkup(
    <ProjectProvider
      initialProject={project}
      initialDebug={options?.debug}
      initialView={options?.view}
      initialConversationRailOpen={options?.conversationRailOpen}
      initialProjectRailOpen={options?.projectRailOpen}
      initialConversation={options?.conversation}
      initialComposerDraft={options?.composerDraft}
      initialStoryboardReelId={options?.storyboardReelId}
    >
      <Shell />
    </ProjectProvider>,
  );
}

describe("default product project", () => {
  it("opens untitled, not Forest A–F", () => {
    const html = renderToStaticMarkup(
      <ProjectProvider>
        <Shell />
      </ProjectProvider>,
    );
    expect(html).toContain('aria-label="Current project: UNTITLED"');
    expect(html).not.toContain("FOREST A→F");
    expect(html).not.toContain("Travel forward through this night forest");
    expect(html).toContain('aria-label="Destination A actions"');
    expect(html).not.toContain('aria-label="Generate destination A"');
    expect(html).not.toContain("Not yet planned");
    expect(html).not.toContain("Provide starting frame");
    expect(html).toContain('placeholder="Describe the journey…"');
    expect(html).toMatch(/disabled[^>]*>Shoot<|>Shoot<[^>]*disabled/);
  });
});

describe("Shell header chrome", () => {
  it("does not show a supervising caption beside the agency chooser", () => {
    const html = renderShell();
    expect(html).not.toContain("You are supervising");
    expect(html).not.toContain("YOU ARE SUPERVISING");
    expect(html).not.toContain("Live production monitor");
    expect(html).toContain('aria-label="Agency"');
    expect(html).toContain("Directed");
    expect(html).toContain("Agent");
    expect(html).not.toContain("Autonomous");
    const agencyStart = html.indexOf('aria-label="Agency"');
    const agency = html.slice(agencyStart, html.indexOf("</nav>", agencyStart) + "</nav>".length);
    expect(agency).toContain('aria-pressed="true"');
    expect(agency).toContain('aria-pressed="false"');
    expect(agency).not.toContain("<select");
    expect(agency).not.toContain("<option");
  });

  it("does not place Debug, Agency, or Media Info in the workspace header toolbar", () => {
    const html = renderShell();
    const toolbar = html.slice(html.indexOf("workspace-toolbar"), html.indexOf("conversation-rail-header"));
    expect(html).toContain("workspace-toolbar");
    expect(toolbar).not.toContain('aria-label="Debug mode"');
    expect(toolbar).not.toContain('aria-label="Project settings"');
    expect(toolbar).not.toContain('aria-label="Agency"');
    expect(toolbar).not.toContain('aria-label="Current project:');
    expect(html).not.toContain('aria-label="Media info"');
    expect(html).not.toContain(">Media Info<");
    expect(html).not.toContain(">MEDIA INFO<");
  });

  it("places Agency at the top of the Project panel and settings behind the gear", () => {
    const html = renderShell();
    const project = html.slice(html.indexOf('id="project-panel"'));
    const storyAt = project.indexOf('id="project-story"');
    const createAt = project.indexOf('aria-label="Create journey"');
    const settingsAt = project.indexOf('aria-label="Project settings"');
    const agencyAt = project.indexOf('aria-label="Agency"');
    expect(project.indexOf(">Project<")).toBeLessThan(project.indexOf('aria-label="Current project:'));
    expect(project.indexOf('aria-label="Current project:')).toBeLessThan(agencyAt);
    expect(agencyAt).toBeLessThan(storyAt);
    expect(createAt).toBeGreaterThan(storyAt);
    expect(settingsAt).toBeGreaterThan(createAt);
    expect(project).toContain(">Journey prompt<");
    expect(project).toContain(">Destinations<");
    expect(project).toContain(">Options<");
    expect(project).toContain("Generate start destination");
    expect(project).toContain("Generate all destinations");
    expect(project).not.toContain("Auto generate");
    expect(project).not.toContain("Auto blocking");
    expect(project).not.toContain("Auto shoot");
    expect(project).not.toContain('aria-label="Video model"');
    expect(project).not.toContain('aria-label="Debug mode"');
    expect(project).not.toContain("DIRECT asks the Director");
    expect(project).toContain(">CREATE JOURNEY<");
    expect(project).toContain("project-rail-header");
    expect(project.indexOf(">Project<")).toBeLessThan(project.indexOf('aria-label="Agency"'));
    expect(project).toContain("text-[13px] font-semibold");
    expect(project).toContain('title="Hide project"');
  });

  it("swaps the Project panel to settings for Video and Debug mode", () => {
    const html = renderToStaticMarkup(
      <ProjectProvider initialProject={createForestProject()} initialDebug={false}>
        <ProjectRail initialSettingsOpen />
      </ProjectProvider>,
    );
    expect(html).toContain(">Project settings<");
    expect(html).toContain('aria-label="Back to project"');
    expect(html).toContain('aria-label="Video model"');
    expect(html).toContain('aria-label="Debug mode"');
    expect(html.indexOf('aria-label="Video model"')).toBeLessThan(
      html.indexOf('aria-label="Back to project"'),
    );
    expect(html).toContain("items-center justify-end px-3 pb-3");
    expect(html).not.toMatch(
      /checked[^>]*aria-label="Debug mode"|aria-label="Debug mode"[^>]*checked/,
    );
    expect(html).toContain("Pruna $");
    expect(html).not.toContain('id="project-story"');
    expect(html).not.toContain(">Options<");
    expect(html).not.toContain('aria-label="Create journey"');
    expect(html).not.toContain('aria-label="Current project:');
  });

  it("hides Options in Agent and keeps Create journey", () => {
    const html = renderShell({ agency: "autonomous" });
    const project = html.slice(html.indexOf('id="project-panel"'));
    expect(project).toContain(">Agent<");
    expect(project).not.toContain(">Options<");
    expect(project).not.toContain("Generate start destination");
    expect(project).toContain('aria-label="Create journey"');
  });

  it("centers Plan/Shoot in the workspace toolbar grid, not as a viewport heading", () => {
    const html = renderShell();
    expect(html).toContain("workspace-toolbar");
    expect(html).toContain("grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]");
    expect(html).toContain(">Plan<");
    expect(html).toContain(">Shoot<");
    const toolbar = html.slice(html.indexOf("workspace-toolbar"), html.indexOf("conversation-rail-header"));
    const logoAt = toolbar.indexOf(">TunnelVision<");
    const planAt = toolbar.indexOf(">Plan<");
    expect(logoAt).toBeGreaterThan(-1);
    expect(logoAt).toBeLessThan(planAt);
    expect(toolbar).not.toContain('aria-label="Current project:');
    expect(toolbar).toContain("text-sm font-semibold");
    expect(html).toContain("workspace-app-header");
    expect(html).toContain("grid-column:1 / -1");
  });

  it("keeps the toolbar on Shoot without the supervising caption", () => {
    const html = renderShell({ view: "shoot" });
    expect(html).toContain("workspace-toolbar");
    expect(html).toContain('aria-label="Agency"');
    expect(html).not.toContain("You are supervising");
    expect(html).not.toContain("Live production monitor");
  });

  it("opens the storyboard reel on Plan and Shoot", () => {
    const plan = renderShell({ storyboardReelId: "A" });
    expect(plan).toContain('aria-label="Storyboard reel, destination A"');
    const shoot = renderShell({ view: "shoot", storyboardReelId: "A" });
    expect(shoot).toContain("storyboard-reel");
    expect(shoot).toContain('aria-label="Storyboard reel, destination A"');
    expect(shoot).toContain(">Plan<");
    expect(shoot).toContain(">Shoot<");
  });
});

describe("Director panel", () => {
  const filmmakerTurn: ConversationEntry[] = [
    {
      id: "f1",
      createdAt: "2026-09-07T22:03:00.000Z",
      kind: "filmmaker",
      text: "Keep this filmmaker turn.",
    },
  ];

  it("hides the rail when collapsed and keeps a control to reopen it", () => {
    const open = renderShell();
    const closed = renderShell({ conversationRailOpen: false });
    const openToolbar = open.slice(
      open.indexOf("workspace-toolbar"),
      open.indexOf("conversation-rail-header"),
    );
    const openHeader = open.slice(
      open.indexOf("conversation-rail-header"),
      open.indexOf('id="project-story"'),
    );
    expect(open).toContain("conversation-rail-header");
    expect(openHeader).toContain("justify-between");
    expect(openHeader).toContain(">Director<");
    expect(openHeader).toContain("text-[13px] font-semibold");
    expect(openHeader).toContain('aria-label="Director"');
    expect(openHeader).toContain('title="Hide director"');
    expect(openToolbar).not.toContain('aria-label="Current project:');
    expect(openToolbar).not.toContain('title="Hide director"');
    expect(open).toContain("workspace-app-header");
    expect(open).toContain("grid-column:1 / -1");
    expect(open).not.toContain("grid-row:1 / span 2");
    expect(open).not.toContain("conversation-rail-reopen");
    expect(open).toContain('aria-label="Director"');
    expect(open).toContain('id="filmmaking-conversation"');
    expect(open).toContain('aria-label="Resize director panel"');
    expect(open).not.toContain("Hide Chat");
    expect(open).not.toContain("chat mode");
    const reopenAt = closed.indexOf("conversation-rail-reopen");
    const reopen = closed.slice(reopenAt, closed.indexOf("</button></div>", reopenAt) + "</button></div>".length);
    expect(closed).toContain("conversation-rail-reopen");
    expect(reopen).toContain("h-9");
    expect(reopen).toContain("h-5 w-5");
    expect(reopen).toContain("border-r border-[#2a2620]");
    expect(reopen).not.toContain("absolute");
    expect(reopen).toContain('title="Show director"');
    expect(reopen).toContain('aria-label="Director"');
    expect(closed).toContain("hidden");
    expect(closed).toContain('id="filmmaking-conversation"');
    expect(closed).not.toContain('aria-label="Resize director panel"');
    expect(closed).toContain('aria-label="Storyboard"');
    expect(closed).not.toContain("Hide Chat");
  });

  it("restores the existing conversation and composer draft when reopened", () => {
    const closed = renderShell({
      conversationRailOpen: false,
      conversation: filmmakerTurn,
      composerDraft: "Draft that must survive collapse.",
    });
    const opened = renderShell({
      conversationRailOpen: true,
      conversation: filmmakerTurn,
      composerDraft: "Draft that must survive collapse.",
    });
    expect(closed).toContain("Keep this filmmaker turn.");
    expect(closed).toContain("Draft that must survive collapse.");
    expect(opened).toContain("Keep this filmmaker turn.");
    expect(opened).toContain("Draft that must survive collapse.");
    expect(opened).toContain('title="Hide director"');
    expect(opened).toContain("conversation-filmmaker");
  });

  it("does not reset rail visibility when switching Plan and Shoot", () => {
    const planClosed = renderShell({ view: "plan", conversationRailOpen: false });
    const shootClosed = renderShell({ view: "shoot", conversationRailOpen: false });
    const planOpen = renderShell({ view: "plan" });
    const shootOpen = renderShell({ view: "shoot" });
    expect(planClosed).toContain('title="Show director"');
    expect(shootClosed).toContain('title="Show director"');
    expect(shootClosed).toContain("conversation-rail-reopen");
    expect(planClosed).toContain("conversation-rail-reopen");
    expect(planClosed).not.toContain('aria-label="Resize director panel"');
    expect(shootClosed).not.toContain('aria-label="Resize director panel"');
    expect(planClosed).toContain('aria-label="Storyboard"');
    expect(shootClosed).not.toContain("Shoot This Shot");
    expect(planOpen).toContain('title="Hide director"');
    expect(shootOpen).toContain('title="Hide director"');
    expect(shootOpen).toContain('title="Hide inspector"');
    expect(planOpen).not.toContain('title="Hide inspector"');
    expect(planOpen).toContain('aria-label="Resize director panel"');
    expect(shootOpen).toContain('aria-label="Resize director panel"');
    expect(shootOpen).toContain('aria-label="Resize timeline"');
    expect(planOpen).not.toContain('aria-label="Resize timeline"');
    expect(shootOpen).not.toContain("Shoot This Shot");
    expect(shootOpen).toContain('aria-label="Director"');
  });

  it("does not let Directed or Autonomous control rail visibility", () => {
    const directedOpen = renderShell({ agency: "directed" });
    const autonomousOpen = renderShell({ agency: "autonomous" });
    const directedClosed = renderShell({ agency: "directed", conversationRailOpen: false });
    const autonomousClosed = renderShell({ agency: "autonomous", conversationRailOpen: false });
    expect(directedOpen).toContain('title="Hide director"');
    expect(autonomousOpen).toContain('title="Hide director"');
    expect(directedOpen).toContain('aria-label="Director"');
    expect(autonomousOpen).toContain('aria-label="Director"');
    expect(directedClosed).toContain('title="Show director"');
    expect(autonomousClosed).toContain('title="Show director"');
    expect(directedClosed).not.toContain('aria-label="Resize director panel"');
    expect(autonomousClosed).not.toContain('aria-label="Resize director panel"');
  });
});

describe("Project rail", () => {
  it("hides the Project panel when collapsed and keeps a control on the right", () => {
    const open = renderShell();
    const closed = renderShell({ projectRailOpen: false });
    expect(open).toContain("project-rail-header");
    expect(open).toContain('aria-label="Project"');
    expect(open).toContain('title="Hide project"');
    expect(open).toContain('aria-label="Resize project panel"');
    expect(open).toContain('id="project-story"');
    expect(closed).toContain("project-rail-reopen");
    expect(closed).toContain('title="Show project"');
    expect(closed).not.toContain('aria-label="Resize project panel"');
    expect(closed).toContain("border-l border-[#2a2620]");
  });
});
