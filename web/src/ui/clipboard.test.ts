import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "./clipboard";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("copyTextToClipboard", () => {
  it("writes non-empty text through the clipboard API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(copyTextToClipboard("forward through the canyon gap")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("forward through the canyon gap");
  });

  it("does not copy an empty string", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(copyTextToClipboard("")).resolves.toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to a hidden textarea when the clipboard API is missing", async () => {
    vi.stubGlobal("navigator", {});
    const field = {
      value: "",
      setAttribute: vi.fn(),
      style: { position: "", left: "" },
      select: vi.fn(),
      remove: vi.fn(),
    };
    const exec = vi.fn().mockReturnValue(true);
    vi.stubGlobal("document", {
      createElement: () => field,
      body: { append: vi.fn() },
      execCommand: exec,
    });
    await expect(copyTextToClipboard("forward through the canyon gap")).resolves.toBe(true);
    expect(field.value).toBe("forward through the canyon gap");
    expect(exec).toHaveBeenCalledWith("copy");
    expect(field.remove).toHaveBeenCalled();
  });
});
