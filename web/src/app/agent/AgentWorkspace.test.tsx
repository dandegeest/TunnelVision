import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createForestProject, FOREST_USER_PROMPT } from "../../fixtures/forest-a-to-f";
import { createWardrobeProject } from "../../fixtures/wardrobe-loop";
import { createNewProject } from "../../project/new-project";
import type { AgentSession, SessionTurn } from "../../project/session";
import { ProjectProvider } from "../../project/ProjectProvider";
import { AgentCollapsedStrip } from "./AgentJourneyPath";
import { AgentWorkspace } from "./AgentWorkspace";
import { Shell } from "../Shell";

const AT = "2026-09-21T15:00:00.000Z";

function testSession(turns: SessionTurn[]): AgentSession {
  return {
    id: "tvs-0123456789abcdef",
    createdAt: AT,
    updatedAt: AT,
    turns,
  };
}

const forestLiveSession = testSession([
  { type: "user", id: "user-1", timestamp: AT, text: "Travel the forest." },
  { type: "journey", id: "journey-1", timestamp: AT, projectId: "forest-a-to-f", status: "generating" },
]);

const forestCompleteSession = testSession([
  { type: "user", id: "user-1", timestamp: AT, text: "Travel the forest." },
  { type: "journey", id: "journey-1", timestamp: AT, projectId: "forest-a-to-f", status: "completed" },
]);

function renderAgent(session: AgentSession = forestLiveSession) {
  return renderToStaticMarkup(
    <ProjectProvider
      initialProject={{ ...createForestProject(), agency: "autonomous" }}
      initialView="agent"
      initialAgentSession={session}
      initialComposerDraft=""
      initialJourneyAgent={{
        phase: "REPAIRING_CANONICALS",
        activity: { message: "reshooting destination C", destinationId: "C" },
        events: [],
      }}
    >
      <AgentWorkspace />
    </ProjectProvider>,
  );
}

describe("Agent completed still strip", () => {
  it("packs thumbs instead of stretching them across the chat width", () => {
    const html = renderToStaticMarkup(
      <AgentCollapsedStrip frames={createForestProject().storyboard} onSelect={() => undefined} />,
    );
    expect(html).toContain("data-collapsed-path");
    expect(html).toContain("w-max");
    expect(html).toContain("w-[3.5rem]");
    expect(html).not.toContain("flex-1");
  });

  it("makes each completed still a control that can open the destination viewer", () => {
    const html = renderToStaticMarkup(
      <AgentCollapsedStrip
        frames={createForestProject().storyboard}
        selectedId="C"
        onSelect={() => undefined}
        onOpenReel={() => undefined}
      />,
    );
    expect(html).toContain('aria-label="Storyboard A"');
    expect(html).toContain('aria-label="Storyboard C"');
    expect(html).toContain("View still");
  });
});

describe("Agent workspace", () => {
  it("renders an active journey turn from the session and referenced project stills", () => {
    const html = renderAgent();
    expect(html).toContain("Travel the forest.");
    expect(html.indexOf("Travel the forest.")).toBeLessThan(html.indexOf("Generating C′…"));
    expect(html).toContain("Generating C′…");
    expect(html).not.toContain("Root-tunnel mouth.");
    expect(html).not.toContain("Spatially coherent, but travel stalls in the tunnel.");
    expect(html).not.toContain("Insufficient forward progression.");
    expect(html).not.toContain("RESHOOT END");
    expect(html).toContain('aria-label="Journey path"');
    expect(html).toContain("View still");
    expect(html).toContain("max-w-[10.5rem]");
    expect(html).toContain("Night forest path toward the tree-trunk / root gateway in mist.");
    expect(html).toContain('data-path-fit="pack"');
    expect(html).toContain("agent-scroll");
    expect(html).toContain("overflow-x-hidden");
    expect(html).not.toContain('aria-label="Previous locations"');
    expect(html).toContain("Where should we go next?");
    expect(html).toContain('aria-label="Create journey"');
    expect(html).toContain('aria-label="New Session"');
    expect(html).not.toContain("Switching OG");
    expect(html).not.toContain("Plan | Shoot");
    expect(html).toContain("resize-y");
    expect(html).toContain("min-h-[7rem]");
    const composer = html.slice(html.indexOf('id="agent-composer"'));
    expect(composer).not.toContain("Travel the forest.");
  });

  it("keeps completed journeys in history above a later prompt", () => {
    const wardrobe = createWardrobeProject();
    const html = renderToStaticMarkup(
      <ProjectProvider
        initialProject={{ ...createForestProject(), agency: "autonomous" }}
        initialView="agent"
        initialAgentSession={testSession([
          { type: "user", id: "user-1", timestamp: AT, text: "Through the wardrobe." },
          { type: "journey", id: "journey-1", timestamp: AT, projectId: wardrobe.id, status: "completed" },
          { type: "user", id: "user-2", timestamp: AT, text: "Travel the forest." },
          { type: "journey", id: "journey-2", timestamp: AT, projectId: "forest-a-to-f", status: "generating" },
        ])}
        initialAgentSessionProjects={{
          [wardrobe.id]: {
            project: wardrobe,
            movieExport: {
              videoUrl: "/wardrobe.mp4",
              filename: "wardrobe.mp4",
              complete: true,
              includedJourneyIds: [],
              missingJourneyIds: [],
            },
          },
        }}
      >
        <AgentWorkspace />
      </ProjectProvider>,
    );
    expect(html).toContain("Through the wardrobe.");
    expect(html).toContain("Travel the forest.");
    expect(html.indexOf("Through the wardrobe.")).toBeLessThan(html.indexOf("Travel the forest."));
    expect(html).toContain("Journey complete");
    expect(html).toContain("Where should we go next?");
  });

  it("keeps the original prompt on a completed journey and starts Journey complete collapsed", () => {
    const html = renderToStaticMarkup(
      <ProjectProvider
        initialProject={{ ...createForestProject(), agency: "autonomous" }}
        initialView="agent"
        initialAgentSession={forestCompleteSession}
        initialComposerDraft=""
        initialMovieExport={{
          videoUrl: "/forest.mp4",
          filename: "forest.mp4",
          complete: true,
          includedJourneyIds: [],
          missingJourneyIds: [],
        }}
      >
        <AgentWorkspace />
      </ProjectProvider>,
    );
    expect(html.indexOf("Travel the forest.")).toBeLessThan(html.indexOf("Journey complete"));
    expect(html).toContain("Open Journey complete");
    expect(html).not.toContain("Collapse Journey complete");
    expect(html).not.toContain("A continuous POV descent through the root tunnels.");
    expect(html).not.toContain("data-collapsed-path");
    expect(html).not.toContain("bg-[#5c6b3d]");
    expect(html).toContain('aria-label="Journey movie"');
    expect(html).toContain('aria-label="Download journey movie"');
    expect(html).toContain(">Download<");
    expect(html).toContain('download="forest.mp4"');
    const composer = html.slice(html.indexOf('id="agent-composer"'));
    expect(composer).not.toContain("Travel the forest.");
    expect(html).not.toContain("Created in");
  });

  it("shows wall-clock creation time on a completed journey", () => {
    const html = renderToStaticMarkup(
      <ProjectProvider
        initialProject={{ ...createForestProject(), agency: "autonomous" }}
        initialView="agent"
        initialAgentSession={testSession([
          { type: "user", id: "user-1", timestamp: AT, text: "Travel the forest." },
          {
            type: "journey",
            id: "journey-1",
            timestamp: AT,
            projectId: "forest-a-to-f",
            status: "completed",
            startedAt: AT,
            completedAt: "2026-09-21T15:18:40.000Z",
            elapsedMs: 18 * 60 * 1000 + 40 * 1000,
          },
        ])}
        initialMovieExport={{
          videoUrl: "/forest.mp4",
          filename: "forest.mp4",
          complete: true,
          includedJourneyIds: [],
          missingJourneyIds: [],
        }}
      >
        <AgentWorkspace />
      </ProjectProvider>,
    );
    expect(html).toContain("Journey complete");
    expect(html).toContain("Created in 18m 40s");
    expect(html).toContain("Open Journey complete");
  });

  it("keeps a titled prompt collapsed after the journey completes", () => {
    const prompt =
      "The Linking Isle\n\nArrive in first-person on the rocky shore of a mysterious deserted island.";
    const html = renderToStaticMarkup(
      <ProjectProvider
        initialProject={{ ...createForestProject(), agency: "autonomous" }}
        initialView="agent"
        initialAgentSession={testSession([
          { type: "user", id: "user-1", timestamp: AT, text: prompt },
          { type: "journey", id: "journey-1", timestamp: AT, projectId: "forest-a-to-f", status: "completed" },
        ])}
        initialMovieExport={{
          videoUrl: "/forest.mp4",
          filename: "forest.mp4",
          complete: true,
          includedJourneyIds: [],
          missingJourneyIds: [],
        }}
      >
        <AgentWorkspace />
      </ProjectProvider>,
    );
    expect(html).toContain("The Linking Isle");
    expect(html).toContain("Open The Linking Isle");
    expect(html).not.toContain("Collapse The Linking Isle");
    expect(html).not.toContain("Arrive in first-person on the rocky shore");
    expect(html).toContain("Journey complete");
  });

  it("shows a titled prompt body while the journey is still generating", () => {
    const prompt =
      "The Linking Isle\n\nArrive in first-person on the rocky shore of a mysterious deserted island.";
    const html = renderToStaticMarkup(
      <ProjectProvider
        initialProject={{ ...createForestProject(), agency: "autonomous" }}
        initialView="agent"
        initialAgentSession={testSession([
          { type: "user", id: "user-1", timestamp: AT, text: prompt },
          { type: "journey", id: "journey-1", timestamp: AT, projectId: "forest-a-to-f", status: "generating" },
        ])}
      >
        <AgentWorkspace />
      </ProjectProvider>,
    );
    expect(html).toContain("Collapse The Linking Isle");
    expect(html).toContain("Arrive in first-person on the rocky shore");
  });

  it("uses location chevrons when a journey has 10 or more stops", () => {
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    const html = renderToStaticMarkup(
      <ProjectProvider
        initialProject={{
          ...createForestProject(),
          agency: "autonomous",
          storyboard: letters.map((id) => ({ id, label: id, imageOrigin: "none" as const })),
        }}
        initialView="agent"
        initialAgentSession={forestLiveSession}
        initialComposerDraft=""
        initialJourneyAgent={{
          phase: "CONSTRUCTING",
          activity: { message: "generating destination C", destinationId: "C" },
          events: [],
        }}
        initialConstructingBeatId="C"
      >
        <AgentWorkspace />
      </ProjectProvider>,
    );
    expect(html).toContain('data-path-fit="scroll"');
    expect(html).toContain('aria-label="Previous locations"');
    expect(html).toContain('aria-label="Next locations"');
    expect(html).toContain("overflow-x-auto");
  });

  it("keeps unsent Agent composer text so leaving Agent does not clear it", () => {
    const html = renderToStaticMarkup(
      <ProjectProvider
        initialProject={{ ...createForestProject(), agency: "autonomous" }}
        initialView="agent"
        initialAgentSession={null}
        initialComposerDraft=""
        initialAgentComposerDraft={"Keep walking toward the river."}
      >
        <AgentWorkspace />
      </ProjectProvider>,
    );
    const composer = html.slice(html.indexOf('id="agent-composer"'));
    expect(composer).toContain("Keep walking toward the river.");
    expect(html).not.toContain(FOREST_USER_PROMPT);
  });

  it("does not reconstruct Agent history from a loaded Project", () => {
    const html = renderToStaticMarkup(
      <ProjectProvider
        initialProject={{ ...createForestProject(), agency: "autonomous" }}
        initialView="agent"
        initialAgentSession={null}
        initialConversation={[]}
        initialComposerDraft=""
        initialMovieExport={{
          videoUrl: "/forest.mp4",
          filename: "forest.mp4",
          complete: true,
          includedJourneyIds: [],
          missingJourneyIds: [],
        }}
      >
        <AgentWorkspace />
      </ProjectProvider>,
    );
    expect(html).not.toContain(FOREST_USER_PROMPT);
    expect(html).not.toContain("Journey complete");
    expect(html).not.toContain('aria-label="Journey movie"');
    expect(html).toContain("Where should we go next?");
    expect(html).toContain('aria-label="New Session"');
  });

  it("can create a journey from the Project prompt after Agent chat was cleared", () => {
    const html = renderToStaticMarkup(
      <ProjectProvider
        initialProject={{ ...createNewProject(), agency: "autonomous" }}
        initialView="agent"
        initialAgentSession={null}
        initialComposerDraft={"Gardens of the Current\n\nDive alongside a small group of sea turtles."}
        initialAgentComposerDraft=""
      >
        <AgentWorkspace />
      </ProjectProvider>,
    );
    const send = html.match(/<button[^>]*aria-label="Create journey"[^>]*>/)?.[0] ?? "";
    expect(send).toContain('aria-label="Create journey"');
    expect(send).not.toMatch(/(?:^|\s)disabled(?:=|\s|>)/);
  });

  it("opens the storyboard reel from a selected Agent still", () => {
    const html = renderToStaticMarkup(
      <ProjectProvider
        initialProject={{ ...createForestProject(), agency: "autonomous" }}
        initialView="agent"
        initialAgentSession={forestCompleteSession}
        initialStoryboardReelId="B"
      >
        <AgentWorkspace />
      </ProjectProvider>,
    );
    expect(html).toContain("storyboard-reel");
    expect(html).toContain('aria-label="Storyboard reel, destination B"');
    expect(html).toContain('aria-label="Close storyboard reel"');
  });

  it("lets a new Agent prompt send after a loaded journey is already complete", () => {
    const html = renderToStaticMarkup(
      <ProjectProvider
        initialProject={{ ...createForestProject(), agency: "autonomous" }}
        initialView="agent"
        initialAgentSession={null}
        initialAgentComposerDraft={"Walk the redline at dusk."}
      >
        <AgentWorkspace />
      </ProjectProvider>,
    );
    const send = html.match(/<button[^>]*aria-label="Create journey"[^>]*>/)?.[0] ?? "";
    expect(send).not.toMatch(/(?:^|\s)disabled(?:=|\s|>)/);
  });
});

describe("Agent surface in Shell", () => {
  it("keeps Director and Shoot while Agent is a workspace view", () => {
    const html = renderToStaticMarkup(
      <ProjectProvider initialProject={createForestProject()} initialView="agent" initialAgentSession={null}>
        <Shell />
      </ProjectProvider>,
    );
    expect(html).toContain(">Director<");
    expect(html).toContain(">Agent<");
    expect(html).toContain(">Shoot<");
    expect(html).toContain('aria-label="Agent"');
    expect(html).toContain(">Project - Agent<");
    expect(html).toContain("Where should we go next?");
    expect(html).not.toContain('aria-label="Storyboard"');
    expect(html).not.toContain("conversation-rail-header");
  });

  it("still opens Plan storyboard and Shoot timeline", () => {
    const plan = renderToStaticMarkup(
      <ProjectProvider initialProject={createForestProject()} initialView="plan" initialAgentSession={null}>
        <Shell />
      </ProjectProvider>,
    );
    const shoot = renderToStaticMarkup(
      <ProjectProvider initialProject={createForestProject()} initialView="shoot" initialAgentSession={null}>
        <Shell />
      </ProjectProvider>,
    );
    expect(plan).toContain('aria-label="Storyboard"');
    expect(plan).toContain(">Director<");
    expect(shoot).toContain('aria-label="Play current cut"');
    expect(shoot).toContain(">Shoot<");
  });

  it("renders unsent Agent composer text from project state", () => {
    const unsent = "Keep walking toward the river.";
    const agent = renderToStaticMarkup(
      <ProjectProvider
        initialProject={{ ...createForestProject(), agency: "autonomous" }}
        initialView="agent"
        initialAgentSession={null}
        initialAgentComposerDraft={unsent}
      >
        <Shell />
      </ProjectProvider>,
    );
    const director = renderToStaticMarkup(
      <ProjectProvider
        initialProject={createForestProject()}
        initialView="plan"
        initialAgentSession={null}
        initialAgentComposerDraft={unsent}
      >
        <Shell />
      </ProjectProvider>,
    );
    expect(agent.slice(agent.indexOf('id="agent-composer"'))).toContain(unsent);
    expect(director).not.toContain('id="agent-composer"');
    expect(director).toContain(">Director<");
  });
});
