import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { createWardrobeProject, WARDROBE_USER_PROMPT } from "../fixtures/wardrobe-loop";
import { createNewProject } from "../project/new-project";
import type { ConversationEntry } from "../project/conversation";
import { formatConversationClock } from "../project/conversation";
import { FilmmakingFrame } from "./FilmmakingFrame";
import { DestinationMenu, PlanView, PreflightWarningControl, StoryboardFrameMedia, StoryboardReel, destinationDetailContent, formatDirectorEvidenceJson, formatFpoIntentField, storyboardReelFrames } from "./PlanView";
import {
  canConstructDestinationFrame,
  generatedStillNeedsReshoot,
  openingFrameGenerationPrompt,
  projectWithConstructedDestination,
  projectWithGeneratedOpeningFrame,
} from "../project/destination";
import type { DirectorEvidence } from "../project/director";
import { ProjectProvider } from "../project/ProjectProvider";
import { STARTING_FRAME_ACCEPT, projectWithReplacedStartImage } from "../project/starting-frame";
import { nextStoryboardSlot, projectWithAddedDestination, projectWithDirectorPlan, projectWithStoryboardBeatPlan } from "../project/storyboard";
import { projectWithJourneyShotTake } from "../project/shoot";
import { TRUSTED_MEDIA_IDS } from "../project/trusted-media-id";
import type { JourneyShotTake, Selection } from "../project/types";
import { destinationDisplayedStillUrl } from "./DestinationInspector";

const AT = "2026-09-07T22:03:00.000Z";
const AT2 = "2026-09-07T22:04:00.000Z";

const plannedBeats = {
  summary: "A continuous forward journey through connected interior volumes.",
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
    {
      id: "D",
      intent: "Emerge into a larger chamber.",
      visualDescription: "A cavern continuing the same world.",
    },
  ],
};

function directorEvidence(story: string, predictionId: string): DirectorEvidence {
  return {
    request: {
      story,
      agency: "directed",
      startFrameId: "A",
      startFrameIntent: "Inside the attic bedroom. Approach the open wardrobe.",
      startMediaId: TRUSTED_MEDIA_IDS.wardrobeLoopVisionA,
      systemInstruction: "Director",
      prompt: "Plan forward",
    },
    rawText: '{"beats":[{"id":"B","intent":"Enter the next volume.","visualDescription":"A continuing corridor."}]}',
    model: "google/gemini-3.1-pro",
    modelVersion: null,
    predictionId,
    elapsedMs: 1200,
  };
}

function renderPlan(
  project = createWardrobeProject(),
  options?: {
    conversation?: ConversationEntry[];
    composerDraft?: string;
    selection?: Selection;
    constructingBeatId?: string | null;
    assessingJourneyIds?: readonly string[];
    shootingJourneyIds?: readonly string[];
    directorStatus?: "idle" | "planning" | "ready" | "error";
    debug?: boolean;
    storyboardReelId?: string | null;
  },
) {
  return renderToStaticMarkup(
    <ProjectProvider
      initialProject={project}
      initialConversation={options?.conversation}
      initialComposerDraft={options?.composerDraft}
      initialSelection={options?.selection}
      initialDebug={options?.debug}
      initialConstructingBeatId={options?.constructingBeatId}
      initialAssessingJourneyIds={options?.assessingJourneyIds}
      initialShootingJourneyIds={options?.shootingJourneyIds}
      initialDirectorStatus={options?.directorStatus}
      initialStoryboardReelId={options?.storyboardReelId}
    >
      <FilmmakingFrame>
        <PlanView />
      </FilmmakingFrame>
    </ProjectProvider>,
  );
}

function renderFrame(
  frame: Parameters<typeof StoryboardFrameMedia>[0]["frame"],
  options: Partial<Parameters<typeof StoryboardFrameMedia>[0]> = {},
) {
  return renderToStaticMarkup(
    <StoryboardFrameMedia
      frame={frame}
      selected
      constructing={false}
      onSelect={() => undefined}
      {...options}
    />,
  );
}

describe("Plan project story", () => {
  it("edits project story from the Project panel without a Send control", () => {
    const html = renderPlan(undefined, { debug: false });
    expect(html).toContain('id="project-story"');
    expect(html).toContain('aria-label="Journey story"');
    expect(html).not.toMatch(/aria-label="Journey story"[^>]*readOnly=""/);
    expect(html).toContain("text-[11px]");
    expect(html).toContain("resize-y");
    expect(html).toContain("border-[#3a342c]/50");
    expect(html).toContain("focus:bg-[#161410]");
    expect(html).toContain('aria-label="Resize director panel"');
    expect(html).toContain('aria-label="Resize project panel"');
    expect(html).not.toMatch(/id="project-story"[^>]*\sdisabled(?:[\s>]|$)/);
    expect(html).toContain(WARDROBE_USER_PROMPT);
    expect(html).toContain('aria-label="Create journey"');
    expect(html).toContain("relative w-full overflow-hidden rounded");
    expect(html).toContain(">CREATE JOURNEY<");
    expect(html).not.toContain(">Technical<");
    expect(html).not.toContain("Construction: planned. Discovery is not implemented.");
    expect(html).not.toContain("Turn on Debug mode in Project settings");
    expect(html).toContain('aria-label="Project settings"');
    expect(html).toContain('aria-label="Agency"');
    expect(html).not.toContain('aria-label="Send"');
    expect(html).not.toContain("Send is not a filmmaking command yet");
    expect(html).toContain("Add Destination");
    expect(html).toContain('id="replace-destination-image"');
    expect(html).toContain(`accept="${STARTING_FRAME_ACCEPT}"`);
    expect(html).not.toContain("Replace image");
    expect(html).not.toContain("REPLACE IMAGE");
    expect(html).not.toContain("You ·");
    expect(html).not.toContain('aria-label="Construct destination B"');
    expect(html).not.toContain("Filmmaker");
  });

  it("keeps Technical debug copy out of the Project panel", () => {
    const html = renderPlan(createWardrobeProject(), { debug: true });
    expect(html).not.toContain(">Technical<");
    expect(html).not.toContain("Construction: planned. Discovery is not implemented.");
    expect(html).toContain('aria-label="Project settings"');
    expect(html).not.toContain("Session store.");
    expect(html).not.toContain("Canonical A.");
  });

  it("keeps the current story in the Project panel after a Director plan", () => {
    const submitted = "Travel forward through this world...";
    const project = {
      ...createWardrobeProject(),
      story: submitted,
    };
    const html = renderPlan(project, {
      conversation: [
        {
          id: "d1",
          createdAt: AT2,
          kind: "director",
          status: "complete",
          evidence: directorEvidence(submitted, "pred-1"),
          summary: "A continuous forward journey.",
        },
      ],
    });
    expect(html).not.toContain("Filmmaker");
    expect(html).toContain("A continuous forward journey.");
    expect(html).toContain(formatConversationClock(AT2));
    expect(html).not.toContain("Director planning…");
    expect(html).toContain(submitted);
    expect(html.match(/<summary[^>]*>Director<\/summary>/g)?.length).toBe(1);
  });

  it("does not enable later destinations while the journey story is empty", () => {
    const html = renderPlan(createNewProject(), { composerDraft: "" });
    expect(html).not.toContain("Filmmaker");
    expect(html).toContain("Enter a journey story or upload starting frame A.");
    expect(html).toContain('aria-label="Destination A actions"');
    expect(html).not.toContain('aria-label="Generate destination A"');
    expect(html).not.toContain("Add Destination");
  });

  it("keeps Replace… on destination A and does not show a text control under the thumbnail", () => {
    const html = renderPlan(createForestProject());
    expect(html).toContain('aria-label="Destination A actions"');
    expect(html).toContain("destination-menu");
    expect(html).not.toContain("Replace image");
    expect(html).not.toContain("REPLACE IMAGE");
    expect(html).not.toContain("Replace…");
    const storyboard = html.slice(html.indexOf('aria-label="Storyboard"'), html.indexOf('id="project-panel"'));
    expect(storyboard).not.toContain("Generate");
    expect(html).not.toContain("CONSTRUCT");
    expect(html).not.toContain("Night forest path toward the tree-trunk / root gateway in mist.");
  });
});

describe("Plan storyboard FPO intent", () => {
  it("overlays Director intent on empty FPO thumbnails as readable text", () => {
    const planned = projectWithDirectorPlan(createWardrobeProject(), plannedBeats);
    const html = renderPlan(planned);
    expect(html).toContain("storyboard-fpo-label");
    expect(html).toContain("storyboard-fpo-intent");
    expect(formatFpoIntentField("Move forward into the next space.")).toBe(
      "Move forward into the next space.",
    );
    expect(html).toContain("Move forward into the next space.");
    expect(html).not.toContain("&quot;intent&quot;");
    expect(html).not.toContain('"intent":');
    expect(html).not.toContain("A corridor continuing the same world.");
    expect(html).not.toContain("Deeper volume ahead.");
    expect(html).not.toContain("A cavern continuing the same world.");
    expect(planned.storyboard[1]?.intent).toBe("Move forward into the next space.");
    expect(planned.storyboard[1]?.visualDescription).toBe("A corridor continuing the same world.");
    const fpo = renderFrame(planned.storyboard[1]!);
    expect(fpo).toContain("storyboard-fpo-label");
    expect(fpo).toContain("storyboard-fpo-intent");
    expect(fpo).toContain("Move forward into the next space.");
    expect(fpo).not.toContain("A corridor continuing the same world.");
    expect(fpo).not.toContain("Generate");
  });

  it("shows Generate centered beneath the eligible planned thumbnail", () => {
    const planned = projectWithDirectorPlan(createWardrobeProject(), plannedBeats);
    const html = renderPlan(planned);
    expect(html).not.toContain("CONSTRUCT");
    expect(html).not.toContain("storyboard-fpo-cta");
    expect(html).toContain("destination-generate-row");
    expect(html).toContain("justify-center");
    expect(html).toContain("destination-generate");
    expect(html).toContain(">Generate</button>");
    expect(html).toContain('aria-label="Generate destination B"');
    expect(html.match(/aria-label="Generate destination B"/g)?.length).toBe(1);
    expect(html).not.toContain("Generate destination C");
    expect(canConstructDestinationFrame(planned, planned.storyboard[1]!)).toBe(true);
    expect(canConstructDestinationFrame(planned, planned.storyboard[2]!)).toBe(false);

    const fpoAt = html.indexOf("storyboard-fpo-label");
    const generateAt = html.indexOf('aria-label="Generate destination B"');
    expect(fpoAt).toBeGreaterThan(-1);
    expect(generateAt).toBeGreaterThan(fpoAt);
    expect(html.indexOf("destination-generate-row")).toBeGreaterThan(
      html.indexOf("</button>", html.indexOf("storyboard-fpo-copy")),
    );
    expect(html).not.toContain("A corridor continuing the same world.");

    const b = renderFrame(planned.storyboard[1]!);
    expect(b).not.toContain("CONSTRUCT");
    expect(b).not.toContain("Generate");
    expect(b).toContain("Move forward into the next space.");

    const c = renderFrame(planned.storyboard[2]!);
    expect(c).not.toContain("Generate");
    expect(c).toContain("Continue through the corridor.");
    expect(c).not.toContain("Deeper volume ahead.");
  });

  it("keeps the generating FPO overlay without a persistent scene caption", () => {
    const planned = projectWithDirectorPlan(createWardrobeProject(), plannedBeats);
    const generating = renderFrame(planned.storyboard[1]!, {
      constructing: true,
    });
    expect(generating).toContain("storyboard-generating");
    expect(generating).toContain("Generating…");
    expect(generating).toContain('aria-label="Generating destination B"');
    expect(generating).toContain("storyboard-fpo-label");
    expect(generating).toContain("storyboard-fpo-intent");
    expect(generating).toContain("Move forward into the next space.");
    expect(generating).not.toContain("CONSTRUCT");
    expect(generating).not.toContain("Generate");
    expect(generating).not.toContain("A corridor continuing the same world.");
  });

  it("replaces the FPO with the actual image after successful construction", () => {
    const planned = projectWithDirectorPlan(createWardrobeProject(), plannedBeats);
    const constructedB = projectWithConstructedDestination(planned, {
      beatId: "B",
      mediaId: "upload-11111111111111111111111111111111",
      imageUrl: "/api/runtime-media/upload-11111111111111111111111111111111",
    });
    const afterB = renderPlan(constructedB);
    expect(afterB).toContain("/api/runtime-media/upload-11111111111111111111111111111111");
    expect(afterB).not.toContain('aria-label="Generate destination B"');
    expect(afterB).toContain('aria-label="Generate destination C"');
    expect(afterB).toContain("Add Destination");
    expect(afterB).not.toContain("Generate destination D");
    expect(afterB).not.toContain("CONSTRUCT");
    expect(afterB.match(/destination-generate-row/g)?.length).toBe(1);
    expect(afterB).not.toContain("Move forward into the next space.");
    expect(afterB).not.toContain("A corridor continuing the same world.");
    expect(afterB).not.toContain("REPLACE IMAGE");
    expect(constructedB.storyboard[1]?.intent).toBe("Move forward into the next space.");
    expect(constructedB.storyboard[1]?.visualDescription).toBe("A corridor continuing the same world.");
    expect(canConstructDestinationFrame(constructedB, constructedB.storyboard[2]!)).toBe(true);
    expect(canConstructDestinationFrame(constructedB, constructedB.storyboard[3]!)).toBe(false);

    const actual = renderFrame(constructedB.storyboard[1]!);
    expect(actual).toContain('src="/api/runtime-media/upload-11111111111111111111111111111111"');
    expect(actual).not.toContain("storyboard-fpo");
    expect(actual).not.toContain("Move forward into the next space.");
    expect(actual).not.toContain("CONSTRUCT");
    expect(actual).not.toContain("Generate");
  });

  it("updates the FPO overlay when a later Director plan changes stored intent", () => {
    const first = projectWithDirectorPlan(createWardrobeProject(), plannedBeats);
    const replanned = projectWithDirectorPlan(first, {
      summary: "The journey continues through a fissure in the monolith.",
      beats: [
        {
          id: "B",
          intent: "Cross the plain and enter the narrow glowing fissure in the monolith.",
          visualDescription: "A replacement visual that must not appear in the FPO.",
        },
        {
          id: "C",
          intent: "Follow the fissure inward.",
          visualDescription: "Another unused visual.",
        },
      ],
    });
    const html = renderPlan(replanned);
    expect(html).not.toContain("Move forward into the next space.");
    expect(html).not.toContain("Continue through the corridor.");
    expect(html).toContain("Cross the plain and enter the narrow glowing fissure in the monolith.");
    expect(html).toContain("Follow the fissure inward.");
    expect(html).not.toContain("A replacement visual that must not appear in the FPO.");
    expect(replanned.storyboard[1]?.intent).toBe(
      "Cross the plain and enter the narrow glowing fissure in the monolith.",
    );
    expect(replanned.storyboard[1]?.visualDescription).toBe("A replacement visual that must not appear in the FPO.");
    expect(html).toContain('aria-label="Generate destination B"');
    expect(html).not.toContain("Generate destination C");
  });

  it("keeps conversation construction activity in the Director panel", () => {
    const html = renderPlan();
    expect(html).toContain(">Director<");
    expect(html).toContain('id="project-story"');
    expect(html).not.toContain("Constructing");
    expect(html).not.toContain("Constructed B");

    const planned = projectWithDirectorPlan(createWardrobeProject(), plannedBeats);
    const plannedHtml = renderPlan(planned);
    expect(plannedHtml).toContain("Generate destination B");
    expect(plannedHtml).not.toContain("Constructing B");
  });
});

describe("Plan conversation thread", () => {
  const firstStory = "Travel forward through this world...";
  const secondStory = "Now go deeper into the fissure.";

  it("renders filmmaker then Director then construction oldest to newest", () => {
    const html = renderPlan(createWardrobeProject(), {
      composerDraft: "",
      conversation: [
        { id: "f1", createdAt: AT, kind: "filmmaker", text: firstStory },
        {
          id: "d1",
          createdAt: AT2,
          kind: "director",
          status: "complete",
          evidence: directorEvidence(firstStory, "pred-1"),
          summary: "First journey.",
        },
        {
          id: "b",
          createdAt: AT2,
          kind: "construction",
          beatId: "B",
          status: "constructed",
          imageUrl: "/api/runtime-media/upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
        {
          id: "c",
          createdAt: AT2,
          kind: "construction",
          beatId: "C",
          status: "constructing",
        },
        { id: "f2", createdAt: AT2, kind: "filmmaker", text: secondStory },
        {
          id: "d2",
          createdAt: AT2,
          kind: "director",
          status: "complete",
          evidence: directorEvidence(secondStory, "pred-2"),
          summary: "Deeper into the fissure.",
        },
      ],
    });
    const filmmaker = html.indexOf("Filmmaker");
    const first = html.indexOf(firstStory);
    const directorOne = html.indexOf("pred-1");
    const constructedB = html.indexOf("Constructed B");
    const constructingC = html.indexOf("Constructing C");
    const second = html.indexOf(secondStory);
    const directorTwo = html.indexOf("pred-2");
    expect(filmmaker).toBeGreaterThan(-1);
    expect(first).toBeGreaterThan(filmmaker);
    expect(directorOne).toBeGreaterThan(first);
    expect(constructedB).toBeGreaterThan(directorOne);
    expect(constructingC).toBeGreaterThan(constructedB);
    expect(second).toBeGreaterThan(constructingC);
    expect(directorTwo).toBeGreaterThan(second);
    expect(html).toContain("/api/runtime-media/upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(html.match(/<summary[^>]*>Director<\/summary>/g)?.length).toBe(2);
    expect(html).toContain("First journey.");
    expect(html).toContain("Deeper into the fissure.");
    expect(html).toContain(formatConversationClock(AT));
    expect(html).not.toContain("Director planning…");
    expect(html).not.toContain("You ·");
    expect(html).toContain("conversation-filmmaker");
    expect(html).toContain("conversation-director");
    expect(html).toContain("border-l");
    expect(html).not.toContain("Constructed C");
    expect(html).toContain("animate-spin");
    expect(html).toContain('aria-busy="true"');
  });

  it("keeps earlier construction history when a later destination starts", () => {
    const html = renderPlan(createWardrobeProject(), {
      composerDraft: "",
      conversation: [
        {
          id: "b",
          createdAt: AT,
          kind: "construction",
          beatId: "B",
          status: "constructed",
          imageUrl: "/api/runtime-media/upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
        {
          id: "c",
          createdAt: AT2,
          kind: "construction",
          beatId: "C",
          status: "failed",
          error: "Destination construction failed.",
        },
      ],
    });
    expect(html).toContain("Constructed B");
    expect(html).toContain("/api/runtime-media/upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(html).toContain("Destination construction failed.");
    expect(html).not.toContain("Constructing B");
    expect(html.indexOf("Constructed B")).toBeLessThan(html.indexOf("Destination construction failed."));
  });
});

describe("Plan media preflight UI", () => {
  it("stays quiet when storyboard media agrees or is unconstructed", () => {
    expect(renderPlan(createWardrobeProject())).not.toContain("storyboard-preflight-warning");
    expect(renderPlan(createWardrobeProject())).not.toContain("Media preflight");
    const planned = projectWithDirectorPlan(createWardrobeProject(), plannedBeats);
    expect(renderPlan(planned)).not.toContain("storyboard-preflight-warning");
  });

  it("does not show a global preflight banner", () => {
    const html = renderPlan(createForestProject());
    expect(html).not.toContain("Media preflight · 1 warning");
    expect(html).not.toContain("Media preflight");
    expect(html).not.toContain("Forest warning");
  });
});

describe("Plan storyboard chrome", () => {
  it("keeps Director on the conversation header and no Storyboard heading", () => {
    const html = renderPlan(createForestProject());
    expect(html).toContain('aria-label="Director"');
    expect(html).toContain('aria-label="Storyboard"');
    const conversationHeader = html.slice(
      html.indexOf("conversation-rail-header"),
      html.indexOf('aria-label="Storyboard"'),
    );
    expect(conversationHeader).toContain(">Director<");
    expect(html).not.toMatch(/>Storyboard</);
  });

  it("uses a full-width top label strip without a persistent scene caption", () => {
    const html = renderPlan(createForestProject());
    expect(html).toContain("storyboard-frame-label");
    expect(html).toContain("inset-x-0 top-0");
    expect(html).not.toContain("Night forest path toward the tree-trunk / root gateway in mist.");
    expect(html).not.toContain("Root-tunnel mouth. The dark opening is slightly right of center.");
    expect(html).not.toContain("UPLOADED");
    expect(html).not.toContain("Uploaded</span>");
  });

  it("keeps storyboard tiles 16:9 and contains source stills without stretching", () => {
    const html = renderFrame(createForestProject().storyboard[0]!);
    expect(html).toContain("aspect-video");
    expect(html).toContain("media-contain");
    expect(html).not.toContain("object-cover");
  });

  it("keeps the label strip visible with or without media facts", () => {
    const html = renderPlan(createForestProject());
    expect(html).toContain("storyboard-frame-label");
  });

  it("truncates long labels across the top strip so they cannot collide with media info", () => {
    const frame = {
      ...createForestProject().storyboard[0]!,
      label: "This is the first frame of the video",
    };
    const html = renderFrame(frame, { showMediaInfo: true, hasWarning: true });
    expect(html).toContain("This is the first frame of the video");
    expect(html).toContain("storyboard-frame-label");
    expect(html).toContain("min-w-0 truncate");
    expect(html).toContain("storyboard-media-info");
    expect(html.indexOf("storyboard-frame-label")).toBeLessThan(html.indexOf("storyboard-media-info"));
    expect(html).toContain("pr-8");
    expect(html).not.toContain("tracking-[0.22em]");
  });

  it("shows technical media info only on the selected storyboard still", () => {
    const selectedA = renderPlan(createForestProject());
    expect(selectedA).toContain("storyboard-media-info");
    expect(selectedA).toContain('aria-label="Uploaded frame"');
    expect(selectedA).toContain("~16:9 · 1000×558 · JPG");
    expect(selectedA).not.toContain('aria-label="Derived destination"');
    expect(selectedA).not.toContain("~1.85:1 · 1392×752 · PNG");
    const selectedB = renderPlan(createForestProject(), {
      selection: { kind: "storyboard", frameId: "B" },
    });
    expect(selectedB).toContain("storyboard-media-info");
    expect(selectedB).toContain('aria-label="Derived destination"');
    expect(selectedB).toContain("~1.85:1 · 1392×752 · PNG");
    expect(selectedB).not.toContain("~16:9 · 1000×558 · JPG");
  });

  it("does not keep a Media Info toolbar control", () => {
    const html = renderPlan(createForestProject());
    expect(html).not.toContain('aria-label="Media info"');
    expect(html).not.toContain(">Media Info<");
    expect(html).not.toContain(">MEDIA INFO<");
  });

  it("keeps an aspect warning on A whether or not that tile shows media facts, not on healthy B–F", () => {
    const selectedA = renderPlan(createForestProject());
    const selectedB = renderPlan(createForestProject(), {
      selection: { kind: "storyboard", frameId: "B" },
    });
    for (const html of [selectedA, selectedB]) {
      expect(html).toContain("storyboard-preflight-warning");
      expect(html).toContain('aria-label="Aspect ratio differs"');
      expect(html).toContain("A is ~16:9 (1000×558).");
      expect(html).toContain("Other storyboard frames are ~1.85:1.");
      expect(html).toContain("absolute right-0.5 bottom-0.5");
      expect(html).toContain("pr-1.5");
      expect((html.match(/storyboard-preflight-warning/g) ?? []).length).toBe(1);
    }
    expect(selectedA).toContain("pr-8");
    expect(selectedA).toContain("storyboard-media-info");
    expect(selectedB).toContain("storyboard-media-info");
  });

  it("exposes warning detail without hover-only access", () => {
    const html = renderToStaticMarkup(
      <PreflightWarningControl
        initiallyOpen
        warnings={[
          {
            kind: "aspect",
            title: "Aspect ratio differs",
            detail: "A is ~16:9 (1000×558).\nOther storyboard frames are ~1.85:1.",
          },
        ]}
      />,
    );
    expect(html).toContain('role="tooltip"');
    expect(html).toContain("Aspect ratio differs");
    expect(html).toContain("A is ~16:9 (1000×558).");
    expect(html).toContain("sr-only");
    expect(html).not.toContain("Crop");
    expect(html).not.toContain("Normalize");
  });

  it("does not turn resolution-only differences into thumbnail warnings", () => {
    const project = {
      ...createWardrobeProject(),
      storyboard: [
        {
          id: "A",
          label: "A",
          image: "a.jpg",
          imageOrigin: "user" as const,
          mediaInfo: { width: 1920, height: 1080, format: "jpeg" as const },
        },
        {
          id: "B",
          label: "B",
          image: "b.jpg",
          imageOrigin: "generated" as const,
          mediaInfo: { width: 1280, height: 720, format: "jpeg" as const },
        },
      ],
    };
    const html = renderPlan(project);
    expect(html).not.toContain("storyboard-preflight-warning");
    expect(html).not.toContain("Aspect ratio differs");
  });
});

describe("Plan destination affordance and menu", () => {
  it("renders Add Destination after the final configured destination without making it a destination", () => {
    const forest = createForestProject();
    const html = renderPlan(forest);
    expect(html).toContain("storyboard-add-destination");
    expect(html).toContain('aria-label="Add Destination"');
    expect(html.indexOf('aria-label="Storyboard F"')).toBeLessThan(html.indexOf("Add Destination"));
    expect(forest.storyboard.map((frame) => frame.id)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(forest.destinations.map((destination) => destination.id)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
    ]);
    expect(nextStoryboardSlot(forest.storyboard)?.id).toBe("G");
    const added = projectWithAddedDestination(forest);
    expect(added.storyboard.map((frame) => frame.id)).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
    expect(added.storyboard[6]).toMatchObject({ id: "G", label: "G", imageOrigin: "none" });
    expect(added.storyboard[6]?.image).toBeUndefined();
    expect(added.destinations).toEqual(forest.destinations);
    expect(html).not.toContain("storyboard-fpo-label");
    expect(html).not.toMatch(/>G</);
  });

  it("keeps the kebab in the label strip with only Replace…", () => {
    const html = renderToStaticMarkup(
      <DestinationMenu frameId="A" label="A" initiallyOpen onReplace={() => undefined} />,
    );
    expect(html).toContain("destination-menu");
    expect(html).toContain("absolute top-0 right-0");
    expect(html).toContain("Replace…");
    const forest = renderPlan(createForestProject());
    const storyboardA = forest.indexOf('aria-label="Storyboard A"');
    const storyboardAEnd = forest.indexOf("</button>", storyboardA);
    const kebabA = forest.indexOf('aria-label="Destination A actions"');
    expect(kebabA).toBeGreaterThan(storyboardAEnd);
    expect(html).not.toContain("Delete");
    expect(html).not.toContain("Duplicate");
    expect(html).not.toContain("Rename");
    expect(html).not.toContain("Regenerate");
    expect(html).not.toContain("Reshoot");
    expect(html).not.toContain("Download");
    expect(html).not.toContain("Discover");
  });

  it("exposes Reshoot on generated stills", () => {
    const html = renderToStaticMarkup(
      <DestinationMenu
        frameId="B"
        label="B"
        initiallyOpen
        onReshoot={() => undefined}
        onReplace={() => undefined}
        onDelete={() => undefined}
      />,
    );
    expect(html).toContain('aria-label="Reshoot destination B"');
    expect(html).toContain(">Reshoot<");
    expect(html).toContain("Replace…");
    expect(html).toContain("Delete");
    expect(html.indexOf("Reshoot")).toBeLessThan(html.indexOf("Replace…"));
  });

  it("exposes Upload image on unresolved starting frame A", () => {
    const html = renderToStaticMarkup(
      <DestinationMenu
        frameId="A"
        label="A"
        initiallyOpen
        actionLabel="Upload image"
        onReplace={() => undefined}
      />,
    );
    expect(html).toContain("destination-menu");
    expect(html).toContain("Upload image");
    expect(html).not.toContain("Replace…");
    expect(html).not.toContain("Generate");
    expect(html).not.toContain("Derive");
    expect(html).not.toContain("Discover");
    expect(html).not.toContain("Provide starting frame");
  });

  it("truncates the frame label before the kebab", () => {
    const html = renderFrame(createForestProject().storyboard[0]!, { showMediaInfo: true });
    expect(html).toContain("storyboard-frame-label");
    expect(html).toContain("pr-7");
  });
});

describe("Plan storyboard reel", () => {
  function buttonOpenTag(html: string, label: string) {
    const start = html.indexOf(`aria-label="${label}"`);
    const tagStart = html.lastIndexOf("<button", start);
    const tagEnd = html.indexOf(">", start);
    return html.slice(tagStart, tagEnd + 1);
  }

  function isDisabled(html: string, label: string) {
    return /\sdisabled(?:="[^"]*")?[\s>]/.test(buttonOpenTag(html, label));
  }

  it("keeps the reel overlay inside the storyboard, not over the rails", () => {
    const html = renderPlan(createForestProject());
    const storyboard = html.indexOf('aria-label="Storyboard"');
    const sectionOpen = html.lastIndexOf("<section", storyboard);
    expect(html.slice(sectionOpen, storyboard)).toContain("relative");
    expect(html.slice(sectionOpen, storyboard)).toContain("overflow-hidden");
    expect(html).not.toContain("storyboard-reel");
    expect(html).toContain('aria-label="Destination A plan"');
    expect(renderPlan(createForestProject(), { storyboardReelId: "A" })).toContain("storyboard-reel");
    expect(html).toContain('title="View still"');
  });

  it("does not mark unselected stills as view-still", () => {
    const html = renderPlan(createForestProject());
    const a = html.indexOf('aria-label="Storyboard A"');
    const b = html.indexOf('aria-label="Storyboard B"');
    expect(html.slice(a, a + 400)).toContain('title="View still"');
    expect(html.slice(b, b + 400)).not.toContain('title="View still"');
  });

  it("contains the still at the largest scale that fits the storyboard area", () => {
    const forest = createForestProject();
    const html = renderToStaticMarkup(
      <StoryboardReel
        frames={forest.storyboard}
        currentId="B"
        project={forest}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    );
    expect(html).toContain("storyboard-reel");
    expect(html).toContain("absolute inset-0");
    expect(html).not.toContain("fixed inset-0");
    expect(html).toContain('aria-label="Storyboard reel, destination B"');
    expect(html).toContain('alt="Destination B"');
    expect(html).toContain("media-contain");
    expect(html).toContain("max-h-full max-w-full");
    expect(html).not.toContain("object-cover");
    expect(html).toContain('aria-label="Previous destination"');
    expect(html).toContain('aria-label="Next destination"');
    expect(html).toContain('aria-label="Close storyboard reel"');
    expect(html).toContain('aria-label="Inspector - Destination"');
    expect(html).toContain(">Inspector - Destination<");
    expect(html).toContain('aria-label="Destination B intent"');
    expect(html).toContain('aria-label="Destination B source"');
    expect(html).toContain(">Prompt<");
    expect(html).toContain('aria-label="Destination B facts"');
    expect(html).toContain(">Aspect ratio<");
    expect(html).toContain("~1.85:1");
    expect(html).toContain(">Resolution<");
    expect(html).toContain("1392×752");
    expect(html).toContain(">Model<");
    expect(html).toContain("Nano Banana 2 Lite");
    expect(html).not.toContain('aria-label="Camotion frame"');
    expect(isDisabled(html, "Previous destination")).toBe(false);
    expect(isDisabled(html, "Next destination")).toBe(false);
  });

  it("disables previous on the first actual still and next on the last", () => {
    const forest = createForestProject();
    const first = renderToStaticMarkup(
      <StoryboardReel
        frames={forest.storyboard}
        currentId="A"
        project={forest}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    );
    const last = renderToStaticMarkup(
      <StoryboardReel
        frames={forest.storyboard}
        currentId="F"
        project={forest}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    );
    expect(isDisabled(first, "Previous destination")).toBe(true);
    expect(isDisabled(first, "Next destination")).toBe(false);
    expect(isDisabled(last, "Next destination")).toBe(true);
    expect(isDisabled(last, "Previous destination")).toBe(false);
  });

  it("includes unresolved FPO destinations in the reel", () => {
    const planned = projectWithDirectorPlan(createWardrobeProject(), plannedBeats);
    expect(storyboardReelFrames(planned.storyboard).map((frame) => frame.id)).toEqual(["A", "B", "C", "D"]);
    const html = renderToStaticMarkup(
      <StoryboardReel
        frames={planned.storyboard}
        currentId="A"
        project={planned}
        onClose={() => undefined}
        onSelect={() => undefined}
        onShoot={() => undefined}
      />,
    );
    expect(isDisabled(html, "Next destination")).toBe(false);
    const plannedB = renderToStaticMarkup(
      <StoryboardReel
        frames={planned.storyboard}
        currentId="B"
        project={planned}
        onClose={() => undefined}
        onSelect={() => undefined}
        onShoot={() => undefined}
      />,
    );
    expect(plannedB).toContain('aria-label="Storyboard reel, destination B"');
    expect(plannedB).toContain("storyboard-fpo-planned");
    expect(plannedB).toContain("preview-monitor");
    expect(plannedB).toContain("--preview-ar-w:16");
    expect(plannedB).toContain("--preview-ar-h:9");
    expect(plannedB).not.toContain("aspect-video w-full max-w-full");
    expect(plannedB).toContain('aria-label="Shoot destination B"');
    expect(plannedB).toContain(">Shoot<");
    expect(plannedB).not.toContain('aria-label="Reshoot destination B"');
    const forest = createForestProject();
    const forestFpo = {
      ...forest,
      storyboard: forest.storyboard.map((frame) =>
        frame.id === "B"
          ? { ...frame, image: undefined, imageOrigin: "none" as const, mediaId: undefined, mediaInfo: undefined }
          : frame,
      ),
    };
    const forestB = renderToStaticMarkup(
      <StoryboardReel
        frames={forestFpo.storyboard}
        currentId="B"
        project={forestFpo}
        onClose={() => undefined}
        onSelect={() => undefined}
        onShoot={() => undefined}
      />,
    );
    expect(forestB).toContain("--preview-ar-w:1000");
    expect(forestB).toContain("--preview-ar-h:558");
  });

  it("offers A / A′ on the reel when Camotion exists", () => {
    const take: JourneyShotTake = {
      startShootingFrame: { mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", imageUrl: "/a-prime.png" },
      endShootingFrame: { mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", imageUrl: "/b-prime.png" },
      startPlan: {
        version: 1,
        camera: { vanishing_point: [0.5, 0.5], forward: 1 },
        destination: { point: [0.5, 0.5], protect: true, bbox: [0.25, 0.2, 0.75, 0.8] },
        exposure: { strength: 0.08, samples: 16 },
      },
      endPlan: {
        version: 1,
        camera: { vanishing_point: [0.4, 0.6], forward: 1 },
        destination: { point: [0.4, 0.6], protect: false, bbox: [0.1, 0.1, 0.9, 0.9] },
        exposure: { strength: 0.04, samples: 16 },
      },
      segmentPromptAddition: "Track forward.",
      effectivePrompt: "Track forward.",
      pace: "fast",
      provider: "replicate",
      model: "prunaai/p-video",
      modelVersion: "test",
      durationSeconds: 6,
      videoInputs: { startShootingFrame: true, endShootingFrame: true },
    };
    const shot = projectWithJourneyShotTake(createForestProject(), "A-B", { take, videoUrl: "/a-b.mp4" });
    const html = renderToStaticMarkup(
      <StoryboardReel
        frames={shot.storyboard}
        currentId="A"
        project={shot}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    );
    expect(html).toContain('aria-label="Camotion frame"');
    expect(html).toContain('aria-label="Preview source"');
    expect(html).toContain('aria-label="Preview motion"');
    expect(html).toContain(">Source<");
    expect(html).toContain(">Motion<");
    expect(html).toContain('alt="Destination A"');
    expect(html).not.toContain('alt="Destination A′"');
    expect(destinationDisplayedStillUrl(shot.storyboard[0]?.image, "primed", {
      destinationId: "A",
      destinationLabel: "A",
      primedLabel: "A′",
      journeyId: "A-B",
      role: "start",
      shootingFrame: take.startShootingFrame,
      plan: take.startPlan,
    })).toBe("/a-prime.png");
  });
});

describe("Plan destination details", () => {
  it("keeps Director planning data off the persistent storyboard until details open", () => {
    const forest = createForestProject();
    const html = renderPlan(forest);
    expect(html).not.toContain("Night forest path toward the tree-trunk / root gateway in mist.");
    expect(destinationDetailContent(forest.storyboard[0]!)).toEqual({
      label: "A",
      intent: "Night forest path toward the tree-trunk / root gateway in mist.",
    });
    expect(forest.storyboard[0]?.intent).toBe("Night forest path toward the tree-trunk / root gateway in mist.");
  });

  it("exposes identity, distinct intent, and visual description in destination details", () => {
    const planned = projectWithDirectorPlan(createWardrobeProject(), plannedBeats);
    expect(destinationDetailContent(planned.storyboard[1]!)).toEqual({
      label: "B",
      intent: "Move forward into the next space.",
      visualDescription: "A corridor continuing the same world.",
    });
    const html = renderToStaticMarkup(
      <StoryboardReel
        frames={planned.storyboard}
        currentId="B"
        project={planned}
        onClose={() => undefined}
        onSelect={() => undefined}
        onPlanChange={() => undefined}
      />,
    );
    expect(html).toContain('aria-label="Inspector - Destination"');
    expect(html).toContain(">Inspector - Destination<");
    expect(html).toContain("text-2xl\">B<");
    expect(html).toContain("Move forward into the next space.");
    expect(html).toContain("A corridor continuing the same world.");
    expect(html).toContain("destination-detail-visual");
    expect(html).toContain('aria-label="Destination B intent"');
    expect(html).toContain('aria-label="Destination B source"');
    expect(html).toContain(">Prompt<");
    expect(html).not.toMatch(/aria-label="Destination B intent"[^>]*readOnly=""/);
    expect(html).not.toMatch(/aria-label="Destination B source"[^>]*readOnly=""/);
    expect(html).toContain("focus:bg-[#161410]");
    expect(html).not.toContain('aria-label="Destination B details"');
    expect(html).not.toContain("destination-detail absolute");
    const closed = renderPlan(planned);
    expect(closed).toContain("Move forward into the next space.");
    expect(closed).not.toContain("A corridor continuing the same world.");
    expect(closed).toContain("storyboard-fpo-intent");
    expect(closed).toContain('aria-label="Generate destination B"');
    expect(closed).toContain("destination-menu");
  });

  it("keeps details available after a planned destination becomes actual media", () => {
    const planned = projectWithDirectorPlan(createWardrobeProject(), plannedBeats);
    const constructedB = projectWithConstructedDestination(planned, {
      beatId: "B",
      mediaId: "upload-11111111111111111111111111111111",
      imageUrl: "/api/runtime-media/upload-11111111111111111111111111111111",
    });
    expect(constructedB.storyboard[1]?.image).toBeDefined();
    expect(destinationDetailContent(constructedB.storyboard[1]!)).toEqual({
      label: "B",
      intent: "Move forward into the next space.",
      visualDescription: "A corridor continuing the same world.",
    });
    const html = renderToStaticMarkup(
      <StoryboardReel
        frames={constructedB.storyboard}
        currentId="B"
        project={constructedB}
        onClose={() => undefined}
        onSelect={() => undefined}
        onReshoot={() => undefined}
      />,
    );
    expect(html).toContain("Move forward into the next space.");
    expect(html).toContain("A corridor continuing the same world.");
    expect(html).toContain('aria-label="Inspector - Destination"');
    expect(html).toContain('aria-label="Reshoot destination B"');
    expect(html).toContain(">Reshoot<");
    expect(html.indexOf(">Prompt<")).toBeLessThan(html.indexOf('aria-label="Reshoot destination B"'));
  });

  it("marks a generated still when the plan changes before reshoot", () => {
    const planned = projectWithDirectorPlan(createWardrobeProject(), plannedBeats);
    const constructedB = projectWithConstructedDestination(planned, {
      beatId: "B",
      mediaId: "upload-11111111111111111111111111111111",
      imageUrl: "/api/runtime-media/upload-11111111111111111111111111111111",
    });
    expect(generatedStillNeedsReshoot(constructedB, constructedB.storyboard[1]!)).toBe(false);
    const stale = projectWithStoryboardBeatPlan(constructedB, "B", {
      visualDescription: "A warmer corridor with an open doorway.",
    });
    expect(generatedStillNeedsReshoot(stale, stale.storyboard[1]!)).toBe(true);
    const html = renderPlan(stale);
    expect(html).toContain("Plan changed");
    expect(html).toContain("storyboard-plan-changed-flag");
    const flag = html.slice(html.indexOf("storyboard-plan-changed-flag"), html.indexOf("storyboard-plan-changed-flag") + 80);
    expect(flag).not.toContain("bottom-1.5");
    expect(flag).not.toContain("bottom-8");
    expect(html).not.toContain("storyboard-plan-changed-veil");
    expect(html).not.toContain("border-dashed border-[#d4b36a]");
    expect(html).toContain('aria-label="Storyboard B, plan changed"');
    const selectedStale = renderPlan(stale, { selection: { kind: "storyboard", frameId: "B" } });
    expect(selectedStale).toContain('title="The plan changed after this still was generated. Reshoot to update it."');
    expect(selectedStale).toContain('aria-label="Storyboard B, plan changed"');
    expect(renderPlan(constructedB)).not.toContain("Plan changed");
    const nextStale = projectWithStoryboardBeatPlan(constructedB, "C", {
      visualDescription: "A rewritten following destination after B already exists.",
    });
    expect(generatedStillNeedsReshoot(nextStale, nextStale.storyboard[1]!)).toBe(true);
    expect(renderPlan(nextStale)).toContain('aria-label="Storyboard B, plan changed"');
  });

  it("does not treat Add Destination or empty frames as destination details", () => {
    const added = projectWithAddedDestination(createForestProject());
    expect(destinationDetailContent(added.storyboard[6]!)).toBeNull();
    const html = renderPlan(createForestProject());
    expect(html).toContain("storyboard-add-destination");
    expect(html).not.toContain("storyboard-reel");
    expect(html).not.toContain("Inspector - Destination");
    expect(html).not.toContain("Destination G details");
  });

  it("keeps destination details available on actual A even before plan text exists", () => {
    const uploaded = projectWithReplacedStartImage(createNewProject(), {
      mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      imageUrl: "/api/runtime-media/upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(destinationDetailContent(uploaded.storyboard[0]!)).toEqual({ label: "A" });
    const html = renderToStaticMarkup(
      <StoryboardReel
        frames={uploaded.storyboard}
        currentId="A"
        project={uploaded}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    );
    expect(html).toContain('aria-label="Inspector - Destination"');
    expect(html).toContain('aria-label="Destination A intent"');
    expect(html).toContain('aria-label="Destination A story"');
    expect(html).not.toContain(">Prompt<");
  });

  it("stores generated A's opening intent and TunnelVision prompt in destination details", () => {
    const story = "Travel forward through an imagined interior at night.";
    const generated = projectWithGeneratedOpeningFrame(
      { ...createNewProject(), story },
      {
        mediaId: "upload-11111111111111111111111111111111",
        imageUrl: "/api/runtime-media/upload-11111111111111111111111111111111",
      },
    );
    const prompt = openingFrameGenerationPrompt(story);
    expect(destinationDetailContent(generated.storyboard[0]!)).toEqual({
      label: "A",
      intent: story,
      visualDescription: prompt,
    });
    const html = renderToStaticMarkup(
      <StoryboardReel
        frames={generated.storyboard}
        currentId="A"
        project={generated}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    );
    expect(html).toContain('aria-label="Destination A intent"');
    expect(html).toContain('aria-label="Destination A story"');
    expect(html).toContain(">Prompt<");
    expect(html).toContain(">Inspector - Destination<");
    expect(html).toContain(story);
    expect(html).toContain("unembodied first-person POV");
    expect(html).toContain("Nano Banana 2 Lite");
  });
});

describe("Plan Director conversation UI", () => {
  it("renders Director Planning in history, not under the composer", () => {
    const html = renderPlan(createWardrobeProject(), {
      composerDraft: "",
      conversation: [
        { id: "f1", createdAt: AT, kind: "filmmaker", text: "Travel forward." },
        { id: "d1", createdAt: AT2, kind: "director", status: "planning" },
      ],
    });
    expect(html).toContain("Planning…");
    expect(html).toContain("animate-spin");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Filmmaker");
    expect(html).not.toContain("You ·");
    expect(html).not.toContain("Director planning…");
    expect(html.indexOf("Travel forward.")).toBeLessThan(html.indexOf("Planning…"));
    expect(html.indexOf("Planning…")).toBeLessThan(html.indexOf('id="project-story"'));
  });

  it("pretty-prints nested Director JSON in the collapsible evidence card", () => {
    const evidence = directorEvidence("Travel forward.", "pred-1");
    const formatted = formatDirectorEvidenceJson(evidence);
    expect(formatted).toMatch(/\n {2}"request"/);
    expect(formatted).toMatch(/\n {4}"story"/);
    expect(formatted).toMatch(/\n {4}"beats"/);
    expect(formatted).toContain("Enter the next volume.");
    expect(formatted.startsWith("{")).toBe(true);

    const html = renderPlan(createWardrobeProject(), {
      composerDraft: "",
      conversation: [
        {
          id: "d1",
          createdAt: AT2,
          kind: "director",
          status: "complete",
          evidence,
          summary: "Treating this as a continuous forward journey.",
        },
      ],
    });
    expect(html).toContain("director-evidence-json");
    expect(html).toContain("font-mono");
    expect(html).toContain("whitespace-pre-wrap");
    expect(html).toContain("<details");
    expect(html).not.toMatch(/<details[^>]*\sopen(?:[\s>]|$)/);
    expect(html.indexOf("<details")).toBeLessThan(html.indexOf("Treating this as a continuous forward journey."));
  });

  it("shows the collapsible evidence card above the filmmaker-facing summary", () => {
    const html = renderPlan(createWardrobeProject(), {
      composerDraft: "",
      conversation: [
        {
          id: "d1",
          createdAt: AT2,
          kind: "director",
          status: "complete",
          evidence: directorEvidence("Travel forward.", "pred-1"),
          summary: "Treating this as a continuous forward journey.",
        },
      ],
    });
    expect(html).toContain("<summary");
    expect(html).toContain("Treating this as a continuous forward journey.");
    expect(html.indexOf("<details")).toBeLessThan(html.indexOf("Treating this as a continuous forward journey."));
    expect(html).toContain(formatConversationClock(AT2));
    expect(html).toContain("conversation-director");
    expect(html).not.toContain("conversation-filmmaker");
  });

  it("treats filmmaker instruction as marked direction, distinct from Director response", () => {
    const html = renderPlan(createWardrobeProject(), {
      composerDraft: "",
      conversation: [
        { id: "f1", createdAt: AT, kind: "filmmaker", text: "Travel forward through this night forest." },
        {
          id: "d1",
          createdAt: AT2,
          kind: "director",
          status: "complete",
          evidence: directorEvidence("Travel forward through this night forest.", "pred-1"),
          summary: "A continuous forward journey through connected spaces.",
        },
      ],
    });
    expect(html).toContain("Filmmaker");
    expect(html).toContain("Director");
    expect(html).not.toContain("You ·");
    expect(html).toContain("conversation-filmmaker");
    expect(html).toContain("conversation-director");
    expect(html).toContain("border-l border-[#3a342c]");
    expect(html).toContain("text-[13px] leading-relaxed text-[#cfc6b8]");
    expect(html).toContain("text-[15px] leading-relaxed text-[#ece7df]");
    expect(html.indexOf("conversation-filmmaker")).toBeLessThan(html.indexOf("conversation-director"));
    expect(html.indexOf("Travel forward through this night forest.")).toBeLessThan(html.indexOf("<details"));
    expect(html.indexOf("<details")).toBeLessThan(html.indexOf("A continuous forward journey through connected spaces."));
    expect(html).toContain(formatConversationClock(AT));
    expect(html).toContain(formatConversationClock(AT2));
  });

  it("renders Blocking and Shooting cards with collapsible results", () => {
    const html = renderPlan(createWardrobeProject(), {
      composerDraft: "",
      conversation: [
        {
          id: "b1",
          createdAt: AT,
          kind: "blocking",
          journeyId: "A-B",
          status: "blocking",
        },
        {
          id: "b2",
          createdAt: AT2,
          kind: "blocking",
          journeyId: "B-C",
          status: "blocked",
          assessment: {
            shootability: "shootable",
            summary: "Track forward through the connected volumes.",
            route: "Advance from the current volume into the next.",
            threshold: "The opening ahead.",
            camera: "Track forward along the visible corridor.",
            parallax: "Near walls the camera can pass.",
            transitionStrategy: "Pass through the visible opening.",
            segmentPromptAddition: "Track forward through the visible opening.",
            pace: "fast",
            setConsistency: 87,
            traversalConfidence: 74,
            concerns: [],
          },
        },
        {
          id: "s1",
          createdAt: AT2,
          kind: "shooting",
          journeyId: "A-B",
          status: "shooting",
        },
        {
          id: "s2",
          createdAt: AT2,
          kind: "shooting",
          journeyId: "B-C",
          status: "shot",
          videoUrl: "/api/runtime-media/upload-vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv",
          take: {
            startShootingFrame: {
              mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              imageUrl: "/a-prime.png",
            },
            endShootingFrame: {
              mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              imageUrl: "/b-prime.png",
            },
            startPlan: {
              version: 1,
              camera: { vanishing_point: [0.5, 0.5], forward: 1 },
              destination: { point: [0.5, 0.5], protect: true, bbox: [0.25, 0.2, 0.75, 0.8] },
              exposure: { strength: 0.08, samples: 16 },
            },
            endPlan: {
              version: 1,
              camera: { vanishing_point: [0.5, 0.5], forward: 1 },
              destination: { point: [0.5, 0.5], protect: true, bbox: [0.25, 0.2, 0.75, 0.8] },
              exposure: { strength: 0.08, samples: 16 },
            },
            segmentPromptAddition: "Track forward.",
            effectivePrompt: "First person POV camera continuously moving forward.",
            pace: "fast",
            provider: "replicate",
            model: "prunaai/p-video",
            modelVersion: "test",
            durationSeconds: 6,
            videoInputs: { startShootingFrame: true, endShootingFrame: true },
          },
        },
      ],
    });
    expect(html).toContain("Blocking A-B…");
    expect(html).toContain("Shooting A-B…");
    expect(html).toContain("conversation-blocking");
    expect(html).toContain("conversation-shooting");
    expect(html).toContain("Track forward through the connected volumes.");
    expect(html).toContain("Shot B-C.");
    expect(html).toContain("<summary");
    expect(html).toContain("Cinematographer");
    expect(html).toContain("Take");
    expect(html).toContain('data-prompt-role="cm"');
    expect(html).toContain("text-[#e6c36a]");
  });
});

describe("new-project Plan", () => {
  it("lets A be uploaded before a journey story exists", () => {
    const html = renderPlan(createNewProject(), { composerDraft: "" });
    expect(html).toContain('data-destination-card="A"');
    expect(html).toContain("storyboard-fpo");
    expect(html).toContain('aria-label="Storyboard A"');
    expect(html).toContain('aria-label="Destination A actions"');
    expect(html).not.toContain('aria-label="Generate destination A"');
    expect(html).toContain('placeholder="Describe the journey…"');
    expect(html).toMatch(/disabled[^>]*aria-label="Create journey"|aria-label="Create journey"[^>]*disabled/);
    expect(html).toContain("Enter a journey story or upload starting frame A.");
    expect(html).not.toContain("Not yet planned");
    expect(html).not.toContain("Provide starting frame");
    expect(html).not.toContain("FOREST A→F");
    expect(html).not.toContain("Travel forward through this night forest");
    expect(html).not.toContain('aria-label="Generate destination B"');
    expect(html).not.toContain("Add Destination");
    expect(html).not.toContain('src="/api/runtime-media/');
  });

  it("unlocks upload and generate A after a journey story is entered", () => {
    const html = renderPlan({
      ...createNewProject(),
      story: "Travel forward through an imagined interior at night.",
    });
    expect(html).toContain('aria-label="Destination A actions"');
    expect(html).toContain('aria-label="Generate destination A"');
    expect(html).toContain('aria-label="Story destinations"');
    expect(html).not.toContain('aria-label="Video model"');
    const storyAt = html.indexOf('id="project-story"');
    const createAt = html.indexOf('aria-label="Create journey"');
    const settingsAt = html.indexOf('aria-label="Project settings"');
    const agencyAt = html.indexOf('aria-label="Agency"');
    expect(agencyAt).toBeLessThan(storyAt);
    expect(createAt).toBeGreaterThan(storyAt);
    expect(settingsAt).toBeGreaterThan(createAt);
    expect(html).toContain(">Journey prompt<");
    expect(html).toContain(">Options<");
    expect(html).not.toContain("DIRECT generates A from the story");
    expect(html).not.toContain(">Technical<");
    expect(html).toContain('aria-label="Increase destinations"');
    expect(html).toContain('aria-label="Decrease destinations"');
    expect(html).toContain('aria-label="Generate start destination"');
    expect(html).toContain('aria-label="Generate all destinations"');
    expect(html).not.toContain('aria-label="Auto blocking"');
    expect(html).toContain('aria-label="Shoot"');
    expect(html).not.toMatch(
      /checked[^>]*aria-label="Generate all destinations"|aria-label="Generate all destinations"[^>]*checked/,
    );
    expect(html).not.toMatch(
      /checked[^>]*aria-label="Shoot"|aria-label="Shoot"[^>]*checked/,
    );
    expect(html).not.toMatch(/<button type="button" aria-label="Create journey"[^>]*\sdisabled(?:="[^"]*")?[\s>]/);
    expect(html).not.toContain("Add Destination");
  });

  it("keeps PLAN disabled until A exists when auto generate opening is off", () => {
    const html = renderPlan({
      ...createNewProject(),
      story: "Travel forward through an imagined interior at night.",
      autoGenerateOpening: false,
    });
    expect(html).toMatch(/disabled[^>]*aria-label="Create journey"|aria-label="Create journey"[^>]*disabled/);
  });

  it("lets PLAN run when A is actual and the story is empty", () => {
    const withA = {
      ...createNewProject(),
      story: "",
      storyboard: [
        {
          id: "A",
          label: "A",
          imageOrigin: "user" as const,
          image: "/api/runtime-media/upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
    };
    const html = renderPlan(withA, { composerDraft: "" });
    expect(html).not.toMatch(/<button type="button" aria-label="Create journey"[^>]*\sdisabled(?:="[^"]*")?[\s>]/);
    expect(html).not.toContain("Add Destination");
    expect(html).toMatch(
      /disabled[^>]*aria-label="Generate start destination"|aria-label="Generate start destination"[^>]*disabled/,
    );
    expect(html).not.toMatch(
      /checked[^>]*aria-label="Generate start destination"|aria-label="Generate start destination"[^>]*checked/,
    );
  });

  it("shows Add Destination as soon as actual A exists", () => {
    const empty = renderPlan(createNewProject(), { composerDraft: "" });
    expect(empty).not.toContain("Add Destination");

    const withA = {
      ...createNewProject(),
      story: "Travel forward through an imagined interior at night.",
      storyboard: [
        {
          id: "A",
          label: "A",
          imageOrigin: "user" as const,
          image: "/api/runtime-media/upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
    };
    expect(renderPlan(withA)).toContain('aria-label="Add Destination"');
    expect(withA.storyboard.map((frame) => frame.id)).toEqual(["A"]);
    expect(withA.destinations).toEqual([]);
    expect(withA.journeys).toEqual([]);

    const planned = projectWithDirectorPlan(withA, plannedBeats);
    expect(planned.storyboard[1]?.imageOrigin).toBe("none");
    expect(renderPlan(planned)).toContain('aria-label="Add Destination"');
    expect(renderPlan(planned)).not.toMatch(
      /<button[^>]*aria-label="Add Destination"[^>]*\sdisabled(?:="[^"]*")?[\s>]/,
    );
  });

  it("disables Add Destination while planning auto-generation is running", () => {
    const withA = {
      ...createNewProject(),
      story: "Travel forward through an imagined interior at night.",
      storyboard: [
        {
          id: "A",
          label: "A",
          imageOrigin: "user" as const,
          image: "/api/runtime-media/upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
    };
    const html = renderPlan(withA, { constructingBeatId: "B" });
    expect(html).toMatch(
      /<button[^>]*aria-label="Add Destination"[^>]*\sdisabled(?:="[^"]*")?[\s>]|<button[^>]*\sdisabled(?:="[^"]*")?[^>]*aria-label="Add Destination"/,
    );
  });

  it("animates PLAN with the current pipeline stage", () => {
    const withA = {
      ...createNewProject(),
      story: "Travel forward through an imagined interior at night.",
      storyboard: [
        {
          id: "A",
          label: "A",
          imageOrigin: "user" as const,
          image: "/api/runtime-media/upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
    };
    const planning = renderPlan(withA, { directorStatus: "planning" });
    expect(planning).toContain("storyboard-generating");
    expect(planning).toContain("Planning Destinations…");
    expect(planning).not.toContain("Director is planning");
    expect(planning).not.toContain("Directing…");
    const generating = renderPlan(withA, { constructingBeatId: "B" });
    expect(generating).toContain("Generating B…");
    expect(generating).toContain("storyboard-generating");
    expect(generating).not.toContain("Director is");
    const blocking = renderPlan(withA, { assessingJourneyIds: ["A-B"] });
    expect(blocking).toContain("Planning A→B…");
    expect(blocking).not.toContain("Blocking…");
    const shooting = renderPlan(withA, { shootingJourneyIds: ["A-B"] });
    expect(shooting).toContain("Generating A→B…");
    expect(shooting).not.toContain("Shooting…");
  });

  it("exposes Upload image on unresolved destinations added after A", () => {
    const withA = {
      ...createNewProject(),
      story: "Travel forward through an imagined interior at night.",
      storyboard: [
        {
          id: "A",
          label: "A",
          imageOrigin: "user" as const,
          image: "/api/runtime-media/upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
    };
    const added = projectWithAddedDestination(
      projectWithAddedDestination(projectWithAddedDestination(withA)),
    );
    const html = renderPlan(added);
    expect(html).toContain('aria-label="Destination B actions"');
    expect(html).toContain('aria-label="Destination C actions"');
    expect(html).toContain('aria-label="Destination D actions"');
    const openB = renderToStaticMarkup(
      <DestinationMenu
        frameId="B"
        label="B"
        initiallyOpen
        actionLabel="Upload image"
        onReplace={() => undefined}
      />,
    );
    expect(openB).toContain("Upload image");
    expect(openB).not.toContain("Replace…");
  });

  it("exposes Delete on later destinations and not on opening A", () => {
    const html = renderToStaticMarkup(
      <DestinationMenu
        frameId="B"
        label="B"
        initiallyOpen
        onReplace={() => undefined}
        onDelete={() => undefined}
      />,
    );
    expect(html).toContain("Delete");
    expect(html).toContain('aria-label="Delete destination B"');
    const opening = renderToStaticMarkup(
      <DestinationMenu frameId="A" label="A" initiallyOpen onReplace={() => undefined} />,
    );
    expect(opening).toContain("Replace…");
    expect(opening).not.toContain("Delete");
  });
});
