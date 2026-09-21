import { describe, expect, it } from "vitest";
import { appleScriptChooseFolder } from "./choose-directory.ts";

describe("appleScriptChooseFolder", () => {
  it("starts in the Projects Folder when a default path is given", () => {
    expect(appleScriptChooseFolder("Open TunnelVision project", "/Users/me/TV Projects")).toBe(
      'POSIX path of (choose folder with prompt "Open TunnelVision project" default location POSIX file "/Users/me/TV Projects")',
    );
  });

  it("omits the default location when none is set", () => {
    expect(appleScriptChooseFolder("Choose TunnelVision Projects Folder")).toBe(
      'POSIX path of (choose folder with prompt "Choose TunnelVision Projects Folder")',
    );
  });
});
