import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createRuntimeMediaRegistry, setActiveRuntimeMediaRegistry } from "./runtime-media.ts";
import { createProjectStore } from "./project-store.ts";
import { createNewProject } from "./src/project/new-project.ts";
import { frameWithAppendedCanonicalTake } from "./src/project/canonical-takes.ts";
import { persistedTakeVideoMediaId } from "./src/project/persistence/ids.ts";
import { parseConversationEvents } from "./src/project/persistence/serialize.ts";
import type { CameraMotionPlanV1, JourneyShotTake, Project } from "./src/project/types.ts";

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8ffff3f0005fe02fedccc59e70000000049454e44ae426082",
  "hex",
);

const PLAN: CameraMotionPlanV1 = {
  version: 1,
  camera: { vanishing_point: [0.5, 0.5], forward: 1 },
  destination: { point: [0.5, 0.5], protect: true, bbox: [0.2, 0.2, 0.8, 0.8] },
  exposure: { strength: 0.1, samples: 8 },
};

const dirs: string[] = [];

afterEach(async () => {
  setActiveRuntimeMediaRegistry(undefined);
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

function videoTake(number: number, mediaId: string, videoUrl: string): JourneyShotTake {
  return {
    id: `A-B:take:${number}`,
    number,
    videoUrl,
    videoMediaId: mediaId,
    startCanonicalMediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    endCanonicalMediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    startShootingFrame: {
      mediaId: "upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      imageUrl: "/api/runtime-media/upload-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
    endShootingFrame: {
      mediaId: "upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      imageUrl: "/api/runtime-media/upload-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    },
    startPlan: PLAN,
    endPlan: PLAN,
    segmentPromptAddition: "guidance",
    effectivePrompt: "guidance",
    pace: "moderate",
    provider: "replicate",
    model: "pruna-p-video",
    modelVersion: null,
    durationSeconds: 5,
    videoInputs: { startShootingFrame: true, endShootingFrame: true },
  };
}

describe("project store round-trip", () => {
  it("creates unique folders, preserves takes, and reopens without events", async () => {
    const root = await tempDir("tv-projects-");
    const runtimeDir = await tempDir("tv-runtime-");
    const registry = createRuntimeMediaRegistry(runtimeDir);
    setActiveRuntimeMediaRegistry(registry);
    const stillA1 = registry.register(PNG);
    const stillA2 = registry.register(PNG);
    const stillB = registry.register(PNG);
    const take1 = registry.adopt({
      mediaId: "upload-vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv",
      filePath: stillA1.filePath,
      mimeType: "video/mp4",
    });
    const take2 = registry.adopt({
      mediaId: "upload-wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
      filePath: stillB.filePath,
      mimeType: "video/mp4",
    });

    const store = createProjectStore({ repoRoot: root });
    const first = await store.createProjectDirectory(root, "Glowing Koi");
    const second = await store.createProjectDirectory(root, "Glowing Koi");
    expect(first.endsWith("GlowingKoi")).toBe(true);
    expect(second.endsWith("GlowingKoi2")).toBe(true);

    let project: Project = createNewProject();
    project = {
      ...project,
      title: "Glowing Koi",
      story: "Follow the glowing koi.",
      imageModel: "nano-banana-2-lite",
      imageOutputFormat: "png",
      imageResolution: "1K",
      videoModel: "pruna-p-video",
      storyboard: [
        frameWithAppendedCanonicalTake(
          frameWithAppendedCanonicalTake(project.storyboard[0]!, {
            mediaId: stillA1.mediaId,
            imageUrl: stillA1.imageUrl,
            origin: "user",
            source: "upload",
          }),
          {
            mediaId: stillA2.mediaId,
            imageUrl: stillA2.imageUrl,
            origin: "generated",
            source: "repair",
            reason: "Agent repair",
          },
        ),
        {
          id: "B",
          label: "B",
          imageOrigin: "generated",
          mediaId: stillB.mediaId,
          image: stillB.imageUrl,
        },
      ],
      journeys: [
        {
          id: "A-B",
          startDestinationId: "A",
          endDestinationId: "B",
          durationSeconds: 5,
          status: "rendered",
          cinematographer: {
            shootability: "shootable",
            setConsistency: 85,
            traversalConfidence: 72,
            summary: "ok",
            route: "forward",
            threshold: "none",
            camera: "fpov",
            parallax: "trees",
            transitionStrategy: "continue",
            segmentPromptAddition: "guidance",
            pace: "moderate",
            concerns: [],
          },
          takes: [videoTake(1, take1.mediaId, take1.imageUrl), videoTake(2, take2.mediaId, take2.imageUrl)],
          selectedTakeId: "A-B:take:2",
        },
      ],
    };

    const conversation = [
      {
        id: "filmmaker-1",
        createdAt: "2026-09-17T12:00:00.000Z",
        kind: "filmmaker" as const,
        text: "Follow the glowing koi.",
      },
    ];
    const saved = await store.saveProject({
      projectRoot: first,
      project,
      conversation,
    });
    expect(saved.project.id.startsWith("tv-")).toBe(true);
    const manifest = JSON.parse(await readFile(join(first, "project.json"), "utf8")) as { media: Record<string, string> };
    expect(Object.values(manifest.media).every((path) => !path.startsWith("/"))).toBe(true);

    setActiveRuntimeMediaRegistry(createRuntimeMediaRegistry(await tempDir("tv-runtime-open-")));
    const opened = await store.openProject(first);
    expect(opened.project.title).toBe("Glowing Koi");
    expect(opened.project.story).toBe("Follow the glowing koi.");
    expect(opened.project.storyboard[0]?.takes).toHaveLength(2);
    expect(opened.project.storyboard[0]?.mediaId).toBe(stillA2.mediaId);
    expect(opened.project.journeys[0]?.takes).toHaveLength(2);
    expect(opened.project.journeys[0]?.selectedTakeId).toBe("A-B:take:2");
    expect(opened.project.journeys[0]?.cinematographer?.setConsistency).toBe(85);
    expect(opened.conversation).toEqual(conversation);

    await rm(join(first, "conversation"), { recursive: true, force: true });
    const withoutEvents = await store.openProject(first);
    expect(withoutEvents.conversation).toEqual([]);
    expect(parseConversationEvents("")).toEqual([]);

    await writeFile(join(first, "canonicals", "A", "take-01.png"), PNG);
    await rm(join(first, "canonicals", "A", "take-02.png"));
    const missing = await store.openProject(first);
    expect(missing.missingAssets.some((item) => item.includes("take-02.png"))).toBe(true);
    expect(missing.project.storyboard[0]?.takes).toHaveLength(2);
  });

  it("deletes unreferenced traversal take files on save", async () => {
    const root = await tempDir("tv-projects-prune-takes-");
    const runtimeDir = await tempDir("tv-runtime-prune-takes-");
    const registry = createRuntimeMediaRegistry(runtimeDir);
    setActiveRuntimeMediaRegistry(registry);
    const stillA = registry.register(PNG);
    const stillB = registry.register(PNG);
    const take1 = registry.adopt({
      mediaId: "upload-vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv",
      filePath: stillA.filePath,
      mimeType: "video/mp4",
    });
    const take2 = registry.adopt({
      mediaId: "upload-wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
      filePath: stillB.filePath,
      mimeType: "video/mp4",
    });
    const store = createProjectStore({ repoRoot: root });
    const projectRoot = await store.createProjectDirectory(root, "PruneTakes");
    const project: Project = {
      ...createNewProject(),
      title: "PruneTakes",
      storyboard: [
        {
          id: "A",
          label: "A",
          imageOrigin: "user",
          mediaId: stillA.mediaId,
          image: stillA.imageUrl,
        },
        {
          id: "B",
          label: "B",
          imageOrigin: "generated",
          mediaId: stillB.mediaId,
          image: stillB.imageUrl,
        },
      ],
      journeys: [
        {
          id: "A-B",
          startDestinationId: "A",
          endDestinationId: "B",
          durationSeconds: 5,
          status: "rendered",
          takes: [videoTake(1, take1.mediaId, take1.imageUrl), videoTake(2, take2.mediaId, take2.imageUrl)],
          selectedTakeId: "A-B:take:2",
        },
      ],
    };
    const saved = await store.saveProject({ projectRoot, project, conversation: [] });
    expect(existsSync(join(projectRoot, "traversals", "A-B", "take-01.mp4"))).toBe(true);
    expect(existsSync(join(projectRoot, "traversals", "A-B", "take-02.mp4"))).toBe(true);
    await store.saveProject({
      projectRoot,
      project: {
        ...project,
        id: saved.project.id,
        journeys: [
          {
            ...project.journeys[0]!,
            takes: [videoTake(1, take1.mediaId, take1.imageUrl)],
            selectedTakeId: "A-B:take:1",
          },
        ],
      },
      conversation: [],
    });
    expect(existsSync(join(projectRoot, "traversals", "A-B", "take-01.mp4"))).toBe(true);
    expect(existsSync(join(projectRoot, "traversals", "A-B", "take-02.mp4"))).toBe(false);
    expect(registry.get(persistedTakeVideoMediaId(saved.project.id, "A-B", 2))).toBeUndefined();
  });

  it("copies a new Take from its source clip, not a colliding same-name registry entry", async () => {
    const root = await tempDir("tv-projects-video-identity-");
    const runtimeDir = await tempDir("tv-runtime-video-identity-");
    const registry = createRuntimeMediaRegistry(runtimeDir);
    setActiveRuntimeMediaRegistry(registry);
    const stillA = registry.register(PNG);
    const stillB = registry.register(PNG);
    const wrongBytes = Buffer.from("wrong-take-bytes");
    const rightBytes = Buffer.from("right-take-bytes");
    const wrongPath = join(runtimeDir, "wrong.mp4");
    const rightPath = join(runtimeDir, "right.mp4");
    await writeFile(wrongPath, wrongBytes);
    await writeFile(rightPath, rightBytes);
    const projectId = "tv-cccccccccccccccc";
    const uniqueId = persistedTakeVideoMediaId(projectId, "A-B", 1);
    registry.adopt({ mediaId: uniqueId, filePath: wrongPath, mimeType: "video/mp4" });
    const right = registry.adopt({
      mediaId: "upload-vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv",
      filePath: rightPath,
      mimeType: "video/mp4",
    });
    const store = createProjectStore({ repoRoot: root });
    const projectRoot = await store.createProjectDirectory(root, "UniqueTakes");
    await store.saveProject({
      projectRoot,
      project: {
        ...createNewProject(),
        id: projectId,
        title: "UniqueTakes",
        storyboard: [
          { id: "A", label: "A", imageOrigin: "user", mediaId: stillA.mediaId, image: stillA.imageUrl },
          { id: "B", label: "B", imageOrigin: "generated", mediaId: stillB.mediaId, image: stillB.imageUrl },
        ],
        journeys: [
          {
            id: "A-B",
            startDestinationId: "A",
            endDestinationId: "B",
            durationSeconds: 5,
            status: "rendered",
            takes: [videoTake(1, uniqueId, right.imageUrl)],
            selectedTakeId: "A-B:take:1",
          },
        ],
      },
      conversation: [],
    });
    const saved = await readFile(join(projectRoot, "traversals", "A-B", "take-01.mp4"));
    expect(saved.equals(rightBytes)).toBe(true);
    expect(saved.equals(wrongBytes)).toBe(false);
    const opened = await store.openProject(projectRoot);
    expect(opened.project.journeys[0]?.takes?.[0]?.videoMediaId).toBe(uniqueId);
    expect(opened.project.journeys[0]?.takes?.[0]?.videoUrl).toBe(`/api/runtime-media/${uniqueId}`);
  });
});

describe("project store rename", () => {
  it("moves the folder, updates the title, and suffixes collisions", async () => {
    const root = await tempDir("tv-projects-rename-");
    const store = createProjectStore({ repoRoot: root });
    const glowing = await store.createProjectDirectory(root, "GlowingKoi");
    const glowingProject = { ...createNewProject(), title: "GlowingKoi" };
    await store.saveProject({ projectRoot: glowing, project: glowingProject, conversation: [] });
    const silver = await store.createProjectDirectory(root, "SilverKoi");
    await store.saveProject({
      projectRoot: silver,
      project: { ...createNewProject(), title: "SilverKoi" },
      conversation: [],
    });

    const moved = await store.renameProject({
      projectRoot: glowing,
      name: "Chernobyl",
      project: glowingProject,
      conversation: [],
    });
    expect(moved.path.endsWith("Chernobyl")).toBe(true);
    expect(moved.project.title).toBe("Chernobyl");
    expect(existsSync(glowing)).toBe(false);
    expect(existsSync(moved.path)).toBe(true);
    const reopened = await store.openProject(moved.path);
    expect(reopened.project.title).toBe("Chernobyl");

    const collided = await store.renameProject({
      projectRoot: moved.path,
      name: "SilverKoi",
      project: reopened.project,
      conversation: [],
    });
    expect(collided.path.endsWith("SilverKoi2")).toBe(true);
    expect(collided.project.title).toBe("SilverKoi");
    expect(existsSync(moved.path)).toBe(false);

    const same = await store.renameProject({
      projectRoot: collided.path,
      name: "SilverKoi",
      project: collided.project,
      conversation: [],
    });
    expect(same.path).toBe(collided.path);
  });

  it("copies a local movie export file into the project exports folder", async () => {
    const root = await tempDir("tv-projects-export-local-");
    const store = createProjectStore({ repoRoot: root });
    const projectRoot = await store.createProjectDirectory(root, "Export Local");
    const source = join(root, "cut.mp4");
    await writeFile(source, Buffer.from("fake-mp4"));
    await store.saveProject({
      projectRoot,
      project: { ...createNewProject(), title: "Export Local" },
      movieExport: {
        videoUrl: source,
        filename: "ExportLocal_v1.mp4",
        complete: true,
        includedJourneyIds: [],
        missingJourneyIds: [],
      },
    });
    expect(existsSync(join(projectRoot, "exports", "ExportLocal_v1.mp4"))).toBe(true);
    const manifest = JSON.parse(await readFile(join(projectRoot, "project.json"), "utf8")) as {
      missingAssets?: string[];
    };
    expect(manifest.missingAssets ?? []).not.toContain("exports/ExportLocal_v1.mp4");
  });
});
