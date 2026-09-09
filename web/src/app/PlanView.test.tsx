import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { createWardrobeProject, WARDROBE_USER_PROMPT } from "../fixtures/wardrobe-loop";
import { createNewProject } from "../project/new-project";
import type { ConversationEntry } from "../project/conversation";
import { formatConversationClock } from "../project/conversation";
import { FilmmakingFrame } from "./FilmmakingFrame";
import { DestinationDetailPopover, DestinationMenu, PlanView, PreflightWarningControl, StoryboardFrameMedia, destinationDetailContent, formatDirectorEvidenceJson, formatFpoIntentField } from "./PlanView";
import {
  canConstructDestinationFrame,
  projectWithConstructedDestination,
} from "../project/destination";
import type { DirectorEvidence } from "../project/director";
import { ProjectProvider } from "../project/ProjectProvider";
import { STARTING_FRAME_ACCEPT } from "../project/starting-frame";
import { nextStoryboardSlot, projectWithAddedDestination, projectWithDirectorPlan } from "../project/storyboard";
import { TRUSTED_MEDIA_IDS } from "../project/trusted-media-id";

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
    mediaInfo?: boolean;
    constructingBeatId?: string | null;
  },
) {
  return renderToStaticMarkup(
    <ProjectProvider
      initialProject={project}
      initialConversation={options?.conversation}
      initialComposerDraft={options?.composerDraft}
      initialMediaInfo={options?.mediaInfo}
      initialConstructingBeatId={options?.constructingBeatId}
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
    const html = renderPlan();
    expect(html).toContain('id="project-story"');
    expect(html).toContain('aria-label="Journey story"');
    expect(html).toContain("text-[13px]");
    expect(html).toContain("resize-y");
    expect(html).toContain('aria-label="Resize story panel"');
    expect(html).toContain('aria-label="Resize project panel"');
    expect(html).not.toMatch(/id="project-story"[^>]*\sdisabled(?:[\s>]|$)/);
    expect(html).toContain(WARDROBE_USER_PROMPT);
    expect(html).toContain('aria-label="Plan movie"');
    expect(html).toContain(">PLAN<");
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

  it("does not enable the storyboard while the journey story is empty", () => {
    const html = renderPlan(createNewProject(), { composerDraft: "" });
    expect(html).not.toContain("Filmmaker");
    expect(html).toContain("Enter a journey story in Project to begin.");
    expect(html).not.toContain('aria-label="Destination A actions"');
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
    expect(html).not.toContain("Generate");
    expect(html).not.toContain("CONSTRUCT");
    expect(html).not.toContain("Night forest path toward the tree-trunk / root gateway in mist.");
  });
});

describe("Plan storyboard FPO intent", () => {
  it("overlays Director intent on empty FPO thumbnails in field form", () => {
    const planned = projectWithDirectorPlan(createWardrobeProject(), plannedBeats);
    const html = renderPlan(planned);
    expect(html).toContain("storyboard-fpo-label");
    expect(html).toContain("storyboard-fpo-intent");
    expect(formatFpoIntentField("Move forward into the next space.")).toBe(
      `"intent": "Move forward into the next space."`,
    );
    expect(html).toContain("Move forward into the next space.");
    expect(html).toContain("&quot;intent&quot;");
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

  it("keeps conversation construction activity in the Story panel", () => {
    const html = renderPlan();
    expect(html).toContain("Story");
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
  it("removes redundant Story and Storyboard headings", () => {
    const html = renderPlan(createForestProject());
    expect(html).toContain('aria-label="Story"');
    expect(html).toContain('aria-label="Storyboard"');
    expect(html).not.toMatch(/>Story</);
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

  it("keeps the label strip visible regardless of Media Info", () => {
    const off = renderPlan(createForestProject());
    const on = renderPlan(createForestProject(), { mediaInfo: true });
    expect(off).toContain("storyboard-frame-label");
    expect(on).toContain("storyboard-frame-label");
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

  it("does not keep the Media Info tool in the storyboard canvas", () => {
    const html = renderPlan(createForestProject());
    expect(html).not.toContain('aria-label="Media info"');
    expect(html).not.toContain(">Media Info<");
    expect(html).not.toContain(">MEDIA INFO<");
  });

  it("keeps optional technical media info off until the tool is active", () => {
    const html = renderPlan(createForestProject());
    expect(html).not.toContain("storyboard-media-info");
    expect(html).not.toContain("Uploaded frame");
    expect(html).not.toContain("Derived destination");
    expect(html).not.toContain("~16:9 · 1000×558 · JPG");
  });

  it("reveals provenance, friendly aspect, dimensions, and format when Media Info is on", () => {
    const html = renderPlan(createForestProject(), { mediaInfo: true });
    expect(html).toContain("storyboard-media-info");
    expect(html).toContain('aria-label="Uploaded frame"');
    expect(html).toContain('title="Uploaded frame"');
    expect(html).toContain('aria-label="Derived destination"');
    expect(html).toContain("~16:9 · 1000×558 · JPG");
    expect(html).toContain("~1.85:1 · 1392×752 · PNG");
    expect(html).not.toContain("Night forest path toward the tree-trunk / root gateway in mist.");
  });

  it("keeps an aspect warning on A in both Media Info states, not on healthy B–F", () => {
    const off = renderPlan(createForestProject());
    const on = renderPlan(createForestProject(), { mediaInfo: true });
    for (const html of [off, on]) {
      expect(html).toContain("storyboard-preflight-warning");
      expect(html).toContain('aria-label="Aspect ratio differs"');
      expect(html).toContain("A is ~16:9 (1000×558).");
      expect(html).toContain("Other storyboard frames are ~1.85:1.");
      expect(html).toContain("absolute right-0.5 bottom-0.5");
      expect(html).toContain("pr-1.5");
      expect((html.match(/storyboard-preflight-warning/g) ?? []).length).toBe(1);
    }
    expect(on).toContain("pr-8");
    expect(off).not.toContain("storyboard-media-info");
    expect(on).toContain("storyboard-media-info");
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
    expect(html).not.toContain("Download");
    expect(html).not.toContain("Discover");
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
      <DestinationDetailPopover frame={planned.storyboard[1]!} initiallyOpen />,
    );
    expect(html).toContain("destination-detail");
    expect(html).toContain('aria-label="Destination B details"');
    expect(html).toContain("Move forward into the next space.");
    expect(html).toContain("A corridor continuing the same world.");
    expect(html).toContain("destination-detail-visual");
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
      <DestinationDetailPopover frame={constructedB.storyboard[1]!} initiallyOpen />,
    );
    expect(html).toContain("Move forward into the next space.");
    expect(html).toContain("A corridor continuing the same world.");
  });

  it("does not treat Add Destination or empty frames as destination details", () => {
    const added = projectWithAddedDestination(createForestProject());
    expect(destinationDetailContent(added.storyboard[6]!)).toBeNull();
    const html = renderPlan(createForestProject());
    expect(html).toContain("storyboard-add-destination");
    expect(html).not.toContain("Destination G details");
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
});

describe("new-project Plan", () => {
  it("keeps unresolved A disabled until a journey story exists", () => {
    const html = renderPlan(createNewProject(), { composerDraft: "" });
    expect(html).toContain('data-destination-card="A"');
    expect(html).toContain("storyboard-fpo");
    expect(html).toContain('aria-label="Storyboard A"');
    expect(html).not.toContain('aria-label="Destination A actions"');
    expect(html).not.toContain('aria-label="Generate destination A"');
    expect(html).toContain('placeholder="Describe the journey…"');
    expect(html).toMatch(/disabled[^>]*aria-label="Plan movie"|aria-label="Plan movie"[^>]*disabled/);
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
    expect(html).toContain('aria-label="Increase destinations"');
    expect(html).toContain('aria-label="Decrease destinations"');
    expect(html).toContain('aria-label="Auto generate starting destination"');
    expect(html).toContain('aria-label="Auto generate all destinations"');
    expect(html).not.toMatch(
      /checked[^>]*aria-label="Auto generate all destinations"|aria-label="Auto generate all destinations"[^>]*checked/,
    );
    expect(html).not.toMatch(/<button type="button" aria-label="Plan movie"[^>]*\sdisabled(?:="[^"]*")?[\s>]/);
    expect(html).not.toContain("Add Destination");
  });

  it("keeps PLAN disabled until A exists when auto generate opening is off", () => {
    const html = renderPlan({
      ...createNewProject(),
      story: "Travel forward through an imagined interior at night.",
      autoGenerateOpening: false,
    });
    expect(html).toMatch(/disabled[^>]*aria-label="Plan movie"|aria-label="Plan movie"[^>]*disabled/);
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
