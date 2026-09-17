import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { downloadClipToFile } from "./export-movie.ts";
import {
  getActiveRuntimeMediaRegistry,
  type RuntimeMediaRecord,
} from "./runtime-media.ts";
import { resolveTrustedMedia, UntrustedMediaError } from "./trusted-media.ts";
import type { ConversationEntry } from "./src/project/conversation.ts";
import type { MovieExportResult } from "./src/project/export-movie.ts";
import { createNewProject } from "./src/project/new-project.ts";
import {
  conversationEventsPath,
  isSafeProjectRelativePath,
  PROJECT_MANIFEST_NAME,
  relativePosix,
  sanitizeProjectFolderName,
  TRAVERSALS_DIR,
  uniqueProjectFolderName,
} from "./src/project/persistence/paths.ts";
import { ensureDurableProjectId } from "./src/project/persistence/ids.ts";
import { parseManifest, ProjectSchemaError } from "./src/project/persistence/schema.ts";
import {
  conversationEventsText,
  hydrateProject,
  parseConversationEvents,
  serializeProjectDocuments,
} from "./src/project/persistence/serialize.ts";
import type { Project } from "./src/project/types.ts";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export type ListedProject = {
  id: string;
  name: string;
  path: string;
  updatedAt: string;
};

export type SavedProjectResult = {
  path: string;
  project: Project;
  createdAt: string;
  updatedAt: string;
  missingAssets: string[];
};

export type OpenedProjectResult = SavedProjectResult & {
  conversation: ConversationEntry[];
  movieExport?: MovieExportResult | null;
};

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

const TRAVERSAL_TAKE_ASSET = /^take-\d+\.(mp4|webm)$/i;

async function pruneUnreferencedTraversalTakes(
  projectRoot: string,
  keepRelativePaths: ReadonlySet<string>,
): Promise<void> {
  const traversalsRoot = join(projectRoot, TRAVERSALS_DIR);
  let journeys: string[] = [];
  try {
    journeys = await readdir(traversalsRoot);
  } catch {
    return;
  }
  const registry = getActiveRuntimeMediaRegistry();
  for (const journeyId of journeys) {
    const dir = join(traversalsRoot, journeyId);
    let files: string[] = [];
    try {
      files = await readdir(dir);
    } catch {
      continue;
    }
    for (const name of files) {
      if (!TRAVERSAL_TAKE_ASSET.test(name)) {
        continue;
      }
      const relativePath = relativePosix(TRAVERSALS_DIR, journeyId, name);
      if (keepRelativePaths.has(relativePath) || !isSafeProjectRelativePath(relativePath)) {
        continue;
      }
      const abs = join(projectRoot, relativePath);
      await rm(abs, { force: true });
      if (!registry) {
        continue;
      }
      for (const record of registry.list()) {
        if (record.filePath === abs) {
          registry.drop(record.mediaId);
        }
      }
    }
  }
}

function mimeForPath(filePath: string): string {
  return MIME_BY_EXT[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export type ProjectStoreOptions = {
  repoRoot: string;
  origin?: string;
};

export type ProjectStore = {
  listProjects(projectsFolder: string): Promise<ListedProject[]>;
  createProjectDirectory(projectsFolder: string, name: string): Promise<string>;
  saveProject(input: {
    projectRoot: string;
    project: Project;
    conversation?: ConversationEntry[];
    movieExport?: MovieExportResult | null;
    createdAt?: string;
  }): Promise<SavedProjectResult>;
  renameProject(input: {
    projectRoot: string;
    name: string;
    project: Project;
    conversation?: ConversationEntry[];
    movieExport?: MovieExportResult | null;
    createdAt?: string;
  }): Promise<SavedProjectResult>;
  openProject(projectRoot: string): Promise<OpenedProjectResult>;
};

async function copyMediaIntoProject(
  options: ProjectStoreOptions,
  projectRoot: string,
  mediaId: string,
  relativePath: string,
  sourceUrl?: string,
): Promise<void> {
  if (!isSafeProjectRelativePath(relativePath)) {
    throw new ProjectSchemaError(`Unsafe project asset path: ${relativePath}`);
  }
  const dest = join(projectRoot, relativePath);
  if (await pathExists(dest)) {
    return;
  }
  await mkdir(dirname(dest), { recursive: true });
  const runtime = getActiveRuntimeMediaRegistry()?.get(mediaId);
  if (runtime) {
    await copyFile(runtime.filePath, dest);
    return;
  }
  try {
    const trusted = resolveTrustedMedia(options.repoRoot, mediaId);
    if (trusted.kind === "file") {
      await copyFile(trusted.path, dest);
      return;
    }
  } catch (error) {
    if (!(error instanceof UntrustedMediaError)) {
      throw error;
    }
  }
  if (sourceUrl) {
    if (sourceUrl.startsWith("/api/runtime-media/")) {
      const record = getActiveRuntimeMediaRegistry()?.get(sourceUrl.slice("/api/runtime-media/".length));
      if (record) {
        await copyFile(record.filePath, dest);
        return;
      }
    }
    const absolute =
      sourceUrl.startsWith("http://") || sourceUrl.startsWith("https://")
        ? sourceUrl
        : sourceUrl.startsWith("/")
          ? new URL(sourceUrl, options.origin ?? "http://127.0.0.1").href
          : pathToFileURL(sourceUrl).href;
    await downloadClipToFile(absolute, dest);
    return;
  }
  throw new Error(`Missing media ${mediaId} for ${relativePath}`);
}

function adoptProjectMedia(projectRoot: string, mediaId: string, relativePath: string) {
  const registry = getActiveRuntimeMediaRegistry();
  if (!registry) {
    return;
  }
  const filePath = join(projectRoot, relativePath);
  const record: RuntimeMediaRecord = {
    mediaId,
    filePath,
    mimeType: mimeForPath(filePath),
  };
  registry.adopt(record);
}

export function createProjectStore(options: ProjectStoreOptions): ProjectStore {
  const store: ProjectStore = {
    async listProjects(projectsFolder) {
      const listed: ListedProject[] = [];
      let entries: string[] = [];
      try {
        entries = await readdir(projectsFolder);
      } catch {
        return [];
      }
      for (const name of entries) {
        const projectRoot = join(projectsFolder, name);
        const manifestPath = join(projectRoot, PROJECT_MANIFEST_NAME);
        try {
          const raw = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
          const manifest = parseManifest(raw);
          listed.push({
            id: manifest.id,
            name: manifest.name,
            path: projectRoot,
            updatedAt: manifest.updatedAt,
          });
        } catch {
          // Skip non-projects.
        }
      }
      listed.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return listed;
    },

    async createProjectDirectory(projectsFolder, name) {
      await mkdir(projectsFolder, { recursive: true });
      const existing = await readdir(projectsFolder).catch(() => [] as string[]);
      const folder = uniqueProjectFolderName(name, existing);
      const projectRoot = join(projectsFolder, folder);
      await mkdir(projectRoot, { recursive: true });
      return projectRoot;
    },

    async saveProject(input) {
      const projectRoot = resolve(input.projectRoot);
      const createdAt = input.createdAt;
      const documents = serializeProjectDocuments({
        project: {
          ...input.project,
          id: ensureDurableProjectId(input.project.id),
        },
        createdAt,
        movieExport: input.movieExport,
      });
      if (createdAt) {
        documents.manifest.createdAt = createdAt;
      }
      const missingAssets: string[] = [];
      for (const copy of documents.mediaCopies) {
        try {
          await copyMediaIntoProject(options, projectRoot, copy.mediaId, copy.relativePath, copy.sourceUrl);
        } catch {
          missingAssets.push(copy.relativePath);
        }
      }
      if (input.movieExport?.filename) {
        const exportRelative = `exports/${input.movieExport.filename}`;
        try {
          await copyMediaIntoProject(
            options,
            projectRoot,
            `export-${documents.manifest.id}`,
            exportRelative,
            input.movieExport.videoUrl,
          );
          documents.manifest.exports = [
            {
              filename: input.movieExport.filename,
              path: exportRelative,
              complete: input.movieExport.complete,
            },
          ];
        } catch {
          missingAssets.push(exportRelative);
        }
      }
      if (missingAssets.length > 0) {
        documents.manifest.missingAssets = missingAssets;
      } else {
        delete documents.manifest.missingAssets;
      }
      for (const [frameId, body] of Object.entries(documents.canonicals)) {
        await writeJsonAtomic(join(projectRoot, "canonicals", frameId, "canonical.json"), body);
      }
      for (const [journeyId, body] of Object.entries(documents.traversals)) {
        await writeJsonAtomic(join(projectRoot, "traversals", journeyId, "traversal.json"), body);
      }
      for (const [journeyId, body] of Object.entries(documents.shootingFrames)) {
        await writeJsonAtomic(join(projectRoot, "shooting-frames", journeyId, "metadata.json"), body);
      }
      if (input.conversation) {
        const eventsPath = join(projectRoot, conversationEventsPath());
        await mkdir(dirname(eventsPath), { recursive: true });
        await writeFile(eventsPath, conversationEventsText(input.conversation), "utf8");
      }
      await writeJsonAtomic(join(projectRoot, PROJECT_MANIFEST_NAME), documents.manifest);
      await pruneUnreferencedTraversalTakes(
        projectRoot,
        new Set(documents.mediaCopies.map((copy) => copy.relativePath)),
      );
      for (const [mediaId, relativePath] of Object.entries(documents.manifest.media)) {
        if (await pathExists(join(projectRoot, relativePath))) {
          adoptProjectMedia(projectRoot, mediaId, relativePath);
        }
      }
      return {
        path: projectRoot,
        project: { ...input.project, id: documents.manifest.id, title: documents.manifest.name },
        createdAt: documents.manifest.createdAt,
        updatedAt: documents.manifest.updatedAt,
        missingAssets,
      };
    },

    async openProject(projectRoot) {
      const root = resolve(projectRoot);
      const manifest = parseManifest(JSON.parse(await readFile(join(root, PROJECT_MANIFEST_NAME), "utf8")) as unknown);
      const canonicals: Record<string, unknown> = {};
      const traversals: Record<string, unknown> = {};
      for (const item of manifest.canonicals) {
        if (!isSafeProjectRelativePath(item.file)) {
          continue;
        }
        try {
          canonicals[item.id] = JSON.parse(await readFile(join(root, item.file), "utf8")) as unknown;
        } catch {
          canonicals[item.id] = { id: item.id, label: item.label, takes: [] };
        }
      }
      for (const item of manifest.traversals) {
        if (!isSafeProjectRelativePath(item.file)) {
          continue;
        }
        try {
          traversals[item.id] = JSON.parse(await readFile(join(root, item.file), "utf8")) as unknown;
        } catch {
          traversals[item.id] = { id: item.id, takes: [] };
        }
      }
      const hydrated = hydrateProject({
        manifest,
        canonicals,
        traversals,
        assetExists: (relativePath) => existsSync(join(root, relativePath)),
      });
      for (const [mediaId, relativePath] of Object.entries(manifest.media ?? {})) {
        if (!isSafeProjectRelativePath(relativePath)) {
          continue;
        }
        if (await pathExists(join(root, relativePath))) {
          adoptProjectMedia(root, mediaId, relativePath);
        }
      }
      let conversation: ConversationEntry[] = [];
      try {
        conversation = parseConversationEvents(await readFile(join(root, conversationEventsPath()), "utf8"));
      } catch {
        conversation = [];
      }
      const exportEntry = manifest.exports?.[0];
      const movieExport =
        exportEntry && (await pathExists(join(root, exportEntry.path)))
          ? {
              videoUrl: `/api/runtime-media/export-${manifest.id}`,
              filename: exportEntry.filename,
              complete: exportEntry.complete ?? true,
              includedJourneyIds: [],
              missingJourneyIds: [],
            }
          : null;
      if (exportEntry && movieExport) {
        adoptProjectMedia(root, `export-${manifest.id}`, exportEntry.path);
      }
      return {
        path: root,
        project: hydrated.project,
        conversation,
        movieExport,
        createdAt: manifest.createdAt,
        updatedAt: manifest.updatedAt,
        missingAssets: [...hydrated.warnings.missingAssets, ...(manifest.missingAssets ?? [])],
      };
    },

    async renameProject(input) {
      const projectRoot = resolve(input.projectRoot);
      const parent = dirname(projectRoot);
      const currentFolder = basename(projectRoot);
      const siblings = (await readdir(parent).catch(() => [] as string[])).filter(
        (item) => item !== currentFolder,
      );
      const folder = uniqueProjectFolderName(input.name, siblings);
      const title = sanitizeProjectFolderName(input.name);
      let nextRoot = projectRoot;
      if (folder !== currentFolder) {
        nextRoot = join(parent, folder);
        if (folder.toLowerCase() === currentFolder.toLowerCase()) {
          const staging = join(parent, `${currentFolder}.renaming-${process.pid}`);
          await rename(projectRoot, staging);
          await rename(staging, nextRoot);
        } else {
          if (await pathExists(nextRoot)) {
            throw new Error(`A project named ${folder} already exists.`);
          }
          await rename(projectRoot, nextRoot);
        }
      }
      return store.saveProject({
        ...input,
        projectRoot: nextRoot,
        project: { ...input.project, title },
      });
    },
  };
  return store;
}

export function emptyUnsavedProject(): Project {
  return createNewProject();
}
