import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import type { ConversationEntry } from "../project/conversation";
import { ProjectProvider } from "../project/ProjectProvider";
import { Shell } from "./Shell";

function renderShell(options?: {
  mediaInfo?: boolean;
  view?: "plan" | "shoot";
  conversationRailOpen?: boolean;
  agency?: "directed" | "autonomous";
  conversation?: ConversationEntry[];
  composerDraft?: string;
}) {
  const project = {
    ...createForestProject(),
    ...(options?.agency ? { agency: options.agency } : {}),
  };
  return renderToStaticMarkup(
    <ProjectProvider
      initialProject={project}
      initialMediaInfo={options?.mediaInfo}
      initialView={options?.view}
      initialConversationRailOpen={options?.conversationRailOpen}
      initialConversation={options?.conversation}
      initialComposerDraft={options?.composerDraft}
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
    expect(html).not.toContain("Not yet planned");
    expect(html).not.toContain("Provide starting frame");
    expect(html).toContain('placeholder="Describe the movie…"');
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

describe("Filmmaking conversation rail", () => {
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
      open.indexOf('id="plan-composer"'),
    );
    expect(open).toContain("conversation-rail-header");
    expect(openHeader).toContain("justify-end");
    expect(openHeader).toContain('aria-label="Filmmaking conversation"');
    expect(openHeader).toContain('title="Hide filmmaking conversation"');
    expect(openToolbar).not.toContain('aria-label="Filmmaking conversation"');
    expect(open).not.toContain("conversation-rail-reopen");
    expect(open).toContain('aria-label="Story"');
    expect(open).toContain('id="filmmaking-conversation"');
    expect(open).toContain('aria-label="Resize story panel"');
    expect(open).not.toContain("Hide Chat");
    expect(open).not.toContain("chat mode");
    const reopenAt = closed.indexOf("conversation-rail-reopen");
    const reopen = closed.slice(reopenAt, closed.indexOf("</button></div>", reopenAt) + "</button></div>".length);
    expect(closed).toContain("conversation-rail-reopen");
    expect(reopen).toContain("h-9");
    expect(reopen).toContain("h-5 w-5");
    expect(reopen).toContain("border-r border-[#2a2620]");
    expect(reopen).not.toContain("absolute");
    expect(reopen).toContain('title="Show filmmaking conversation"');
    expect(reopen).toContain('aria-label="Filmmaking conversation"');
    expect(closed).toContain("hidden");
    expect(closed).toContain('id="filmmaking-conversation"');
    expect(closed).not.toContain('aria-label="Resize story panel"');
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
    expect(opened).toContain('title="Hide filmmaking conversation"');
    expect(opened).toContain("conversation-filmmaker");
  });

  it("does not reset rail visibility when switching Plan and Shoot", () => {
    const planClosed = renderShell({ view: "plan", conversationRailOpen: false });
    const shootClosed = renderShell({ view: "shoot", conversationRailOpen: false });
    const planOpen = renderShell({ view: "plan" });
    const shootOpen = renderShell({ view: "shoot" });
    expect(planClosed).toContain('title="Show filmmaking conversation"');
    expect(shootClosed).toContain('title="Show filmmaking conversation"');
    expect(shootClosed).toContain("conversation-rail-reopen");
    expect(planClosed).toContain("conversation-rail-reopen");
    expect(planClosed).not.toContain('aria-label="Resize story panel"');
    expect(shootClosed).not.toContain('aria-label="Resize story panel"');
    expect(planClosed).toContain('aria-label="Storyboard"');
    expect(shootClosed).toContain("Shoot This Shot");
    expect(planOpen).toContain('title="Hide filmmaking conversation"');
    expect(shootOpen).toContain('title="Hide filmmaking conversation"');
    expect(planOpen).toContain('aria-label="Resize story panel"');
    expect(shootOpen).toContain('aria-label="Resize story panel"');
    expect(shootOpen).toContain("Shoot This Shot");
    expect(shootOpen).toContain('aria-label="Story"');
  });

  it("does not let Directed or Autonomous control rail visibility", () => {
    const directedOpen = renderShell({ agency: "directed" });
    const autonomousOpen = renderShell({ agency: "autonomous" });
    const directedClosed = renderShell({ agency: "directed", conversationRailOpen: false });
    const autonomousClosed = renderShell({ agency: "autonomous", conversationRailOpen: false });
    expect(directedOpen).toContain('title="Hide filmmaking conversation"');
    expect(autonomousOpen).toContain('title="Hide filmmaking conversation"');
    expect(directedOpen).toContain('aria-label="Story"');
    expect(autonomousOpen).toContain('aria-label="Story"');
    expect(directedClosed).toContain('title="Show filmmaking conversation"');
    expect(autonomousClosed).toContain('title="Show filmmaking conversation"');
    expect(directedClosed).not.toContain('aria-label="Resize story panel"');
    expect(autonomousClosed).not.toContain('aria-label="Resize story panel"');
  });
});
