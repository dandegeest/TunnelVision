import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createForestProject, FOREST_USER_PROMPT } from "../../fixtures/forest-a-to-f";
import { createWardrobeProject } from "../../fixtures/wardrobe-loop";
import { createNewProject } from "../../project/new-project";
import type { ConversationEntry } from "../../project/conversation";
import { ProjectProvider } from "../../project/ProjectProvider";
import { AgentWorkspace } from "./AgentWorkspace";
import { Shell } from "../Shell";

const AT = "2026-09-21T15:00:00.000Z";

const liveConversation: ConversationEntry[] = [
  { id: "f1", createdAt: AT, kind: "filmmaker", text: "Travel the forest." },
  { id: "d1", createdAt: AT, kind: "director", status: "complete", summary: "Root-tunnel mouth." },
  {
    id: "cm1",
    createdAt: AT,
    kind: "blocking",
    journeyId: "B-C",
    status: "blocked",
    assessment: {
      shootability: "needs_review",
      setConsistency: 87,
      traversalConfidence: 62,
      summary: "Spatially coherent, but travel stalls in the tunnel.",
      route: "",
      threshold: "",
      camera: "",
      parallax: "",
      transitionStrategy: "",
      segmentPromptAddition: "",
      pace: "walk",
      concerns: [],
      repairRecommendation: "RESHOOT_END",
      repairInstruction: "Insufficient forward progression.",
    },
  },
  {
    id: "r1",
    createdAt: AT,
    kind: "agent",
    status: "repairing",
    destinationIds: ["C"],
    journeyId: "B-C",
    recommendation: "RESHOOT_END",
    instruction: "Insufficient forward progression.",
    setConsistency: 87,
    traversalConfidence: 62,
  },
];

function renderAgent(conversation: ConversationEntry[] = liveConversation) {
  return renderToStaticMarkup(
    <ProjectProvider
      initialProject={{ ...createForestProject(), agency: "autonomous" }}
      initialView="agent"
      initialConversation={conversation}
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

describe("Agent workspace", () => {
  it("renders an active journey turn from conversation and project stills", () => {
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
    expect(html).toContain('data-path-fit="scale"');
    expect(html).toContain("agent-scroll");
    expect(html).toContain("overflow-x-hidden");
    expect(html).not.toContain('aria-label="Previous locations"');
    expect(html).toContain("Where should we go next?");
    expect(html).toContain('aria-label="Create journey"');
    expect(html).not.toContain("Switching OG");
    expect(html).not.toContain("Plan | Shoot");
    expect(html).toContain("resize-y");
    expect(html).toContain("min-h-[7rem]");
    const composer = html.slice(html.indexOf('id="agent-composer"'));
    expect(composer).not.toContain("Travel the forest.");
  });

  it("keeps completed journeys in history above a later prompt", () => {
    const html = renderToStaticMarkup(
      <ProjectProvider
        initialProject={{ ...createWardrobeProject(), agency: "autonomous" }}
        initialView="agent"
        initialConversation={[
          { id: "f0", createdAt: AT, kind: "filmmaker", text: "Through the wardrobe." },
          {
            id: "a0",
            createdAt: AT,
            kind: "assembly",
            status: "complete",
            videoUrl: "/wardrobe.mp4",
            filename: "wardrobe.mp4",
            complete: true,
          },
          ...liveConversation,
        ]}
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
        initialConversation={[
          { id: "f0", createdAt: AT, kind: "filmmaker", text: "Travel the forest." },
          { id: "d0", createdAt: AT, kind: "director", status: "complete", summary: "A continuous POV descent through the root tunnels." },
          { id: "c0", createdAt: AT, kind: "construction", beatId: "B", status: "constructed" },
          {
            id: "a0",
            createdAt: AT,
            kind: "assembly",
            status: "complete",
            videoUrl: "/forest.mp4",
            filename: "forest.mp4",
            complete: true,
          },
        ]}
        initialComposerDraft=""
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
        initialConversation={liveConversation}
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

  it("keeps unsent Agent composer text on the project so leaving Agent does not clear it", () => {
    const html = renderToStaticMarkup(
      <ProjectProvider
        initialProject={{ ...createForestProject(), agency: "autonomous" }}
        initialView="agent"
        initialComposerDraft=""
        initialAgentComposerDraft={"Keep walking toward the river."}
      >
        <AgentWorkspace />
      </ProjectProvider>,
    );
    const composer = html.slice(html.indexOf('id="agent-composer"'));
    expect(composer).toContain("Keep walking toward the river.");
    expect(html.indexOf("Travel the forest.")).toBeLessThan(html.indexOf('id="agent-composer"'));
  });

  it("shows journey history after reload when conversation was not persisted", () => {
    const html = renderToStaticMarkup(
      <ProjectProvider
        initialProject={{ ...createForestProject(), agency: "autonomous" }}
        initialView="agent"
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
    expect(html).toContain(FOREST_USER_PROMPT);
    expect(html).toContain("Open Journey complete");
    expect(html).toContain('aria-label="Journey movie"');
    expect(html).toContain('src="/forest.mp4"');
    expect(html).toContain('aria-label="Download journey movie"');
    const composer = html.slice(html.indexOf('id="agent-composer"'));
    expect(composer).not.toContain(FOREST_USER_PROMPT);
  });

  it("can create a journey from the Project prompt after Agent chat was cleared", () => {
    const html = renderToStaticMarkup(
      <ProjectProvider
        initialProject={{ ...createNewProject(), agency: "autonomous" }}
        initialView="agent"
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
      <ProjectProvider initialProject={createForestProject()} initialView="agent">
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
      <ProjectProvider initialProject={createForestProject()} initialView="plan">
        <Shell />
      </ProjectProvider>,
    );
    const shoot = renderToStaticMarkup(
      <ProjectProvider initialProject={createForestProject()} initialView="shoot">
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
        initialAgentComposerDraft={unsent}
      >
        <Shell />
      </ProjectProvider>,
    );
    const director = renderToStaticMarkup(
      <ProjectProvider
        initialProject={createForestProject()}
        initialView="plan"
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
