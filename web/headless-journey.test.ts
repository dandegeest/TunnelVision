import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { setActiveRuntimeMediaRegistry } from "./runtime-media.ts";
import { runHeadlessJourney } from "./headless-journey.ts";
import { parseManifest } from "./src/project/persistence/schema.ts";

const dirs: string[] = [];
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

afterEach(async () => {
  setActiveRuntimeMediaRegistry(undefined);
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("headless journey runner", () => {
  it("creates and saves a project without generation", async () => {
    const projectsFolder = await mkdtemp(join(tmpdir(), "tv-headless-projects-"));
    dirs.push(projectsFolder);
    const result = await runHeadlessJourney({
      repoRoot,
      name: "Grammar Test - POV Canyon Run",
      story: "Photorealistic cinematic POV high-speed journey through a dramatic desert canyon.",
      grammar: "pov",
      takeIntent: "quality",
      projectsFolder,
      saveOnly: true,
    });
    expect(result.projectRoot.startsWith(projectsFolder)).toBe(true);
    expect(result.project.title).toBe("Grammar Test - POV Canyon Run");
    expect(result.project.cameraGrammar).toBe("pov");
    expect(result.project.defaultTakeIntent).toBe("quality");
    expect(result.project.durationMode).toBe("adaptive");
    expect(result.project.agency).toBe("autonomous");
    expect(result.snapshot.phase).toBe("IDLE");
    const raw = JSON.parse(await readFile(join(result.projectRoot, "project.json"), "utf8")) as unknown;
    const manifest = parseManifest(raw);
    expect(manifest.settings.cameraGrammar).toBe("pov");
    expect(manifest.settings.defaultTakeIntent).toBe("quality");
    expect(manifest.journey.initialPrompt).toMatch(/desert canyon/);
  });

  it("uses unique folders when the name already exists", async () => {
    const projectsFolder = await mkdtemp(join(tmpdir(), "tv-headless-collide-"));
    dirs.push(projectsFolder);
    const first = await runHeadlessJourney({
      repoRoot,
      name: "Grammar Test - FOLLOW Canyon Run",
      story: "Follow the red car.",
      grammar: "follow",
      takeIntent: "quality",
      projectsFolder,
      saveOnly: true,
    });
    const second = await runHeadlessJourney({
      repoRoot,
      name: "Grammar Test - FOLLOW Canyon Run",
      story: "Follow the red car.",
      grammar: "follow",
      takeIntent: "quality",
      projectsFolder,
      saveOnly: true,
    });
    expect(second.projectRoot).not.toBe(first.projectRoot);
    expect(second.projectRoot.startsWith(projectsFolder)).toBe(true);
  });
});
