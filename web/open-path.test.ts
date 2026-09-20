import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rmSync } from "node:fs";

import { deletableProjectPath, isPathInside, revealableProjectPath } from "./open-path.ts";

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

describe("deletableProjectPath", () => {
  it("accepts a saved project that is a direct child of the Projects Folder", async () => {
    const folder = await makeDir("tv-delete-ok-");
    const projectRoot = join(folder, "Marbles");
    await mkdir(projectRoot);
    await writeFile(join(projectRoot, "project.json"), "{}");
    expect(deletableProjectPath(projectRoot, folder)).toBe(projectRoot);
  });

  it("rejects a path outside the Projects Folder", async () => {
    const folder = await makeDir("tv-delete-folder-");
    const other = await makeDir("tv-delete-other-");
    const projectRoot = join(other, "Marbles");
    await mkdir(projectRoot);
    await writeFile(join(projectRoot, "project.json"), "{}");
    expect(deletableProjectPath(projectRoot, folder)).toBeNull();
  });

  it("rejects the Projects Folder itself even when it has a manifest", async () => {
    const folder = await makeDir("tv-delete-self-");
    await writeFile(join(folder, "project.json"), "{}");
    expect(deletableProjectPath(folder, folder)).toBeNull();
  });

  it("rejects a nested project that is not a direct child", async () => {
    const folder = await makeDir("tv-delete-nested-");
    const nested = join(folder, "Parent", "Child");
    await mkdir(nested, { recursive: true });
    await writeFile(join(nested, "project.json"), "{}");
    expect(deletableProjectPath(nested, folder)).toBeNull();
  });

  it("rejects a directory without a project manifest", async () => {
    const folder = await makeDir("tv-delete-empty-");
    const projectRoot = join(folder, "Empty");
    await mkdir(projectRoot);
    expect(deletableProjectPath(projectRoot, folder)).toBeNull();
  });

  it("rejects when no Projects Folder is configured", async () => {
    const folder = await makeDir("tv-delete-none-");
    const projectRoot = join(folder, "Marbles");
    await mkdir(projectRoot);
    await writeFile(join(projectRoot, "project.json"), "{}");
    expect(deletableProjectPath(projectRoot, null)).toBeNull();
    expect(deletableProjectPath(projectRoot, "")).toBeNull();
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
