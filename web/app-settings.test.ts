import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createAppSettingsStore } from "./app-settings.ts";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("application settings", () => {
  it("persists the Projects Folder independently of a project", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tv-settings-"));
    dirs.push(dir);
    const store = createAppSettingsStore(join(dir, "settings.json"));
    expect(await store.read()).toEqual({});
    await store.write({ projectsFolder: "/Users/me/TunnelVision Projects" });
    expect(await store.read()).toEqual({ projectsFolder: "/Users/me/TunnelVision Projects" });
    const raw = await readFile(join(dir, "settings.json"), "utf8");
    expect(raw).toContain("TunnelVision Projects");
  });
});
