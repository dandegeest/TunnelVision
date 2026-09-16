import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GENERATION_INTENT_MARK } from "../project/generation-intent";
import { GenerationIntentMenu, generationIntentActionLabel, intentMenuAppliesChoice } from "./GenerationIntentMenu";

describe("GenerationIntentMenu", () => {
  it("shows the default intent on the primary action and keeps the chooser on the arrow", () => {
    const html = renderToStaticMarkup(
      <GenerationIntentMenu
        label="+ NEW TAKE"
        ariaLabel="New take A-B"
        defaultIntent="fast"
        buttonClass="test-cta"
        onChoose={() => undefined}
      />,
    );
    expect(html).toContain(generationIntentActionLabel("+ NEW TAKE", "fast"));
    expect(html).toContain(`+ NEW TAKE · ${GENERATION_INTENT_MARK.fast}`);
    expect(html).toContain('aria-label="New take A-B"');
    expect(html).toContain('aria-label="New take A-B intent chooser"');
    expect(html).toContain(">Fast · Default<");
    expect(html).toContain(">Balanced<");
    expect(html).toContain(">Quality<");
    expect(html.indexOf('aria-label="New take A-B"')).toBeLessThan(
      html.indexOf('aria-label="New take A-B intent chooser"'),
    );
    expect(html).toContain("w-max");
    expect(html).toContain("self-start");
    expect(html).toContain("top-full");
  });

  it("opens the chooser upward when placed in the footer", () => {
    const html = renderToStaticMarkup(
      <GenerationIntentMenu
        label="+ NEW TAKE ALL"
        ariaLabel="New take all"
        defaultIntent="fast"
        buttonClass="test-cta"
        menuPlacement="up"
        onChoose={() => undefined}
      />,
    );
    expect(html).toContain("bottom-full");
    expect(html).not.toContain("top-full");
  });

  it("generates on the first NEW TAKE ALL click when the intent did not change", () => {
    expect(intentMenuAppliesChoice("fast", "fast", true)).toBe("choose");
    expect(intentMenuAppliesChoice("quality", "fast", true)).toBe("pick");
    expect(intentMenuAppliesChoice("quality", "fast", false)).toBe("choose");
  });

  it("lets NEW TAKE ALL pick an intent without generating", () => {
    const chosen: string[] = [];
    const picked: string[] = [];
    const html = renderToStaticMarkup(
      <GenerationIntentMenu
        label="+ NEW TAKE ALL"
        ariaLabel="New take all"
        defaultIntent="fast"
        buttonClass="test-cta"
        onChoose={(intent) => {
          chosen.push(intent);
        }}
        onPickIntent={(intent) => {
          picked.push(intent);
        }}
      />,
    );
    expect(html).toContain("The arrow changes intent without generating unless that intent is already selected.");
    expect(html).toContain(">Quality<");
    expect(chosen).toEqual([]);
    expect(picked).toEqual([]);
  });

  it("does not open a chooser when the control is disabled", () => {
    const html = renderToStaticMarkup(
      <GenerationIntentMenu
        label="+ NEW TAKE"
        ariaLabel="New take A-B"
        defaultIntent="quality"
        disabled
        buttonClass="test-cta"
        onChoose={() => undefined}
      />,
    );
    expect(html).toContain(`+ NEW TAKE · ${GENERATION_INTENT_MARK.quality}`);
    expect(html).toContain('aria-label="New take A-B"');
    expect(html).not.toContain('aria-label="New take A-B intent chooser"');
    expect(html).not.toContain("role=\"menu\"");
  });
});
