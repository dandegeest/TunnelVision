import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rmSync } from "node:fs";

import { isPathInside, revealableProjectPath } from "./open-path.ts";

const scratch: string[] = [];

async function makeDir(name: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), name));
  scratch.push(root);
  return root;
}

afterEach(() => {
  for (const dir of scratch.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("revealableProjectPath", () => {
  it("accepts a directory that contains project.json inside the Projects Folder", async () => {
    const folder = await makeDir("tv-projects-");
    const projectRoot = join(folder, "PaperChase");
    await mkdir(projectRoot);
    await writeFile(join(projectRoot, "project.json"), "{}");
    expect(revealableProjectPath(projectRoot, folder)).toBe(projectRoot);
  });

  it("rejects a path outside the Projects Folder", async () => {
    const folder = await makeDir("tv-projects-");
    const other = await makeDir("tv-other-");
    const projectRoot = join(other, "PaperChase");
    await mkdir(projectRoot);
    await writeFile(join(projectRoot, "project.json"), "{}");
    expect(revealableProjectPath(projectRoot, folder)).toBeNull();
  });

  it("rejects a directory without a project manifest", async () => {
    const folder = await makeDir("tv-projects-");
    const projectRoot = join(folder, "Empty");
    await mkdir(projectRoot);
    expect(revealableProjectPath(projectRoot, folder)).toBeNull();
  });

  it("rejects a missing path", () => {
    expect(revealableProjectPath("/definitely/missing/tunnelvision-project", null)).toBeNull();
    expect(revealableProjectPath("", null)).toBeNull();
  });
});

describe("isPathInside", () => {
  it("treats the folder itself as inside", () => {
    expect(isPathInside("/Users/me/Projects", "/Users/me/Projects")).toBe(true);
  });

  it("rejects a sibling path that only shares a prefix", () => {
    expect(isPathInside("/Users/me/Projects", "/Users/me/Projects-other/X")).toBe(false);
  });
});
