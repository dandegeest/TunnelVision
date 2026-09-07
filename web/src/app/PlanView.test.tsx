import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createWardrobeProject, WARDROBE_USER_PROMPT } from "../fixtures/wardrobe-loop";
import type { ConversationEntry } from "../project/conversation";
import {
  canConstructDestinationFrame,
  projectWithConstructedDestination,
} from "../project/destination";
import type { DirectorEvidence } from "../project/director";
import { ProjectProvider } from "../project/ProjectProvider";
import { isAuthoritativeStartingFrame } from "../project/starting-frame";
import { projectWithDirectorPlan } from "../project/storyboard";
import { TRUSTED_MEDIA_IDS } from "../project/trusted-media-id";
import { PlanView, StoryboardFrameMedia } from "./PlanView";

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
    rawText: "{}",
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
  },
) {
  return renderToStaticMarkup(
    <ProjectProvider
      initialProject={project}
      initialConversation={options?.conversation}
      initialComposerDraft={options?.composerDraft}
    >
      <PlanView />
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
      canConstruct={false}
      constructDisabled={false}
      onSelect={() => undefined}
      onConstruct={() => undefined}
      {...options}
    />,
  );
}

function fpoIntents(html: string) {
  return [...html.matchAll(/class="storyboard-fpo-intent">([^<]*)<\/span>/g)].map(
    (match) => match[1],
  );
}

describe("Plan composer", () => {
  it("is an editable draft, not a live display of project.story", () => {
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
    expect(html).not.toContain("Filmmaker");
  });

  it("clears the composer after an accepted submission without repopulating from project.story", () => {
    const submitted = "Travel forward through this world...";
    const project = {
      ...createWardrobeProject(),
      story: "Current project story that must not refill the composer.",
    };
    const html = renderPlan(project, {
      composerDraft: "",
      conversation: [
        { id: "f1", kind: "filmmaker", text: submitted },
        { id: "d1", kind: "director", evidence: directorEvidence(submitted, "pred-1") },
      ],
    });
    expect(html).toContain("Filmmaker");
    expect(html).toContain(submitted);
    expect(html).not.toContain("Current project story that must not refill the composer.");
    expect(html).toMatch(/<textarea[^>]*id="plan-composer"[^>]*><\/textarea>/);
    expect(html.match(/<summary[^>]*>Director<\/summary>/g)?.length).toBe(1);
  });

  it("keeps a whitespace draft in the composer and does not append history", () => {
    const html = renderPlan(createWardrobeProject(), { composerDraft: "  \n " });
    expect(html).not.toContain("Filmmaker");
    expect(html).toMatch(/disabled[^>]*aria-label="Plan movie"|aria-label="Plan movie"[^>]*disabled/);
  });

  it("does not offer Replace image on a user-origin frame that is not A", () => {
    expect(isAuthoritativeStartingFrame({ id: "A" })).toBe(true);
    expect(isAuthoritativeStartingFrame({ id: "B" })).toBe(false);
  });
});

describe("Plan storyboard FPO intent", () => {
  it("shows the exact Director intent inside planned FPOs, not visualDescription", () => {
    const planned = projectWithDirectorPlan(createWardrobeProject(), plannedBeats);
    const html = renderPlan(planned);
    expect(fpoIntents(html)).toEqual([
      "Move forward into the next space.",
      "Continue through the corridor.",
      "Emerge into a larger chamber.",
    ]);
    expect(html).toContain("storyboard-fpo-label");
    expect(html).not.toContain("A corridor continuing the same world.");
    expect(html).not.toContain("Deeper volume ahead.");
    expect(html).not.toContain("A cavern continuing the same world.");
  });

  it("shows intent plus CONSTRUCT on the eligible planned frame only", () => {
    const planned = projectWithDirectorPlan(createWardrobeProject(), plannedBeats);
    const html = renderPlan(planned);
    expect(html).toContain("storyboard-fpo-cta");
    expect(html).toContain('aria-label="Construct destination B"');
    expect(html).toContain("CONSTRUCT");
    expect(html.match(/aria-label="Construct destination B"/g)?.length).toBe(1);
    expect(html.match(/storyboard-fpo-cta/g)?.length).toBe(1);
    expect(html).not.toContain("Construct destination C");
    expect(html).not.toMatch(/mt-2[^>]*>Construct</);
    expect(canConstructDestinationFrame(planned, planned.storyboard[1]!)).toBe(true);
    expect(canConstructDestinationFrame(planned, planned.storyboard[2]!)).toBe(false);

    const b = renderFrame(planned.storyboard[1]!, { canConstruct: true });
    expect(b).toContain("Move forward into the next space.");
    expect(b).toContain("CONSTRUCT");
    expect(b).toContain('aria-label="Construct destination B"');
    expect(b).not.toContain("A corridor continuing the same world.");

    const c = renderFrame(planned.storyboard[2]!);
    expect(c).toContain("Continue through the corridor.");
    expect(c).not.toContain("CONSTRUCT");
    expect(c).not.toContain('aria-label="Construct destination C"');
    expect(c).not.toContain("Deeper volume ahead.");
  });

  it("keeps Director intent visible in the generating FPO", () => {
    const planned = projectWithDirectorPlan(createWardrobeProject(), plannedBeats);
    const generating = renderFrame(planned.storyboard[1]!, {
      constructing: true,
      canConstruct: true,
      constructDisabled: true,
    });
    expect(generating).toContain("storyboard-generating");
    expect(generating).toContain("Generating…");
    expect(generating).toContain('aria-label="Generating destination B"');
    expect(generating).toContain("Move forward into the next space.");
    expect(generating).toContain("storyboard-fpo-intent");
    expect(generating).not.toContain("CONSTRUCT");
    expect(generating).not.toContain('aria-label="Construct destination B"');
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
    expect(afterB).not.toContain('aria-label="Construct destination B"');
    expect(afterB).toContain('aria-label="Construct destination C"');
    expect(afterB).not.toContain("Construct destination D");
    expect(afterB.match(/storyboard-fpo-cta/g)?.length).toBe(1);
    expect(fpoIntents(afterB)).toEqual([
      "Continue through the corridor.",
      "Emerge into a larger chamber.",
    ]);
    expect(afterB).toContain("Move forward into the next space.");
    expect(canConstructDestinationFrame(constructedB, constructedB.storyboard[2]!)).toBe(true);
    expect(canConstructDestinationFrame(constructedB, constructedB.storyboard[3]!)).toBe(false);

    const actual = renderFrame(constructedB.storyboard[1]!);
    expect(actual).toContain('src="/api/runtime-media/upload-11111111111111111111111111111111"');
    expect(actual).not.toContain("storyboard-fpo");
    expect(actual).not.toContain("Move forward into the next space.");
    expect(actual).not.toContain("CONSTRUCT");
  });

  it("updates FPO intent from the current storyboard after a later Director plan", () => {
    const first = projectWithDirectorPlan(createWardrobeProject(), plannedBeats);
    const replanned = projectWithDirectorPlan(first, {
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
    expect(fpoIntents(html)).toEqual([
      "Cross the plain and enter the narrow glowing fissure in the monolith.",
      "Follow the fissure inward.",
    ]);
    expect(html).not.toContain("Move forward into the next space.");
    expect(html).not.toContain("Continue through the corridor.");
    expect(html).not.toContain("A replacement visual that must not appear in the FPO.");
    expect(html).toContain('aria-label="Construct destination B"');
    expect(html).not.toContain("Construct destination C");
  });

  it("keeps conversation construction activity in the Story panel", () => {
    const html = renderPlan();
    expect(html).toContain("Story");
    expect(html).toContain('id="plan-composer"');
    expect(html).not.toContain("Constructing");
    expect(html).not.toContain("Constructed B");

    const planned = projectWithDirectorPlan(createWardrobeProject(), plannedBeats);
    const plannedHtml = renderPlan(planned);
    expect(plannedHtml).toContain("Construct destination B");
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
        { id: "f1", kind: "filmmaker", text: firstStory },
        { id: "d1", kind: "director", evidence: directorEvidence(firstStory, "pred-1") },
        {
          id: "b",
          kind: "construction",
          beatId: "B",
          status: "constructed",
          imageUrl: "/api/runtime-media/upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
        {
          id: "c",
          kind: "construction",
          beatId: "C",
          status: "constructing",
        },
        { id: "f2", kind: "filmmaker", text: secondStory },
        { id: "d2", kind: "director", evidence: directorEvidence(secondStory, "pred-2") },
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
    expect(html).not.toContain("Constructed C");
  });

  it("keeps earlier construction history when a later destination starts", () => {
    const html = renderPlan(createWardrobeProject(), {
      composerDraft: "",
      conversation: [
        {
          id: "b",
          kind: "construction",
          beatId: "B",
          status: "constructed",
          imageUrl: "/api/runtime-media/upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
        {
          id: "c",
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
