import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import type { Plugin } from "vite";

import { createAppSettingsStore } from "./app-settings.ts";
import { chooseNativeDirectory } from "./choose-directory.ts";
import { createProjectStore } from "./project-store.ts";
import type { ConversationEntry } from "./src/project/conversation.ts";
import type { MovieExportResult } from "./src/project/export-movie.ts";
import type { Project } from "./src/project/types.ts";

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw.trim()) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(raw) as unknown);
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

export function projectStorePlugin(repoRoot: string): Plugin {
  const settings = createAppSettingsStore();
  let origin = "http://127.0.0.1:5173";
  let store = createProjectStore({ repoRoot: resolve(repoRoot), origin });

  return {
    name: "tunnelvision-project-store",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const host = req.headers.host;
        if (host) {
          const nextOrigin = `${req.headers["x-forwarded-proto"] === "https" ? "https" : "http"}://${host}`;
          if (nextOrigin !== origin) {
            origin = nextOrigin;
            store = createProjectStore({ repoRoot: resolve(repoRoot), origin });
          }
        }
        void handleProjectStoreRequest(req, res, { origin, settings, store }).then((handled) => {
          if (!handled) {
            next();
          }
        });
      });
    },
  };
}

export async function handleProjectStoreRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: {
    origin: string;
    settings: ReturnType<typeof createAppSettingsStore>;
    store: ReturnType<typeof createProjectStore>;
  },
): Promise<boolean> {
  const url = req.url?.split("?")[0] ?? "";
  try {
    if (req.method === "GET" && url === "/api/app-settings") {
      sendJson(res, 200, await deps.settings.read());
      return true;
    }
    if (req.method === "PUT" && url === "/api/app-settings") {
      const body = (await readJsonBody(req)) as { projectsFolder?: unknown };
      const projectsFolder =
        typeof body.projectsFolder === "string" && body.projectsFolder.trim()
          ? body.projectsFolder.trim()
          : undefined;
      sendJson(res, 200, await deps.settings.write({ projectsFolder }));
      return true;
    }
    if (req.method === "POST" && url === "/api/app-settings/choose-projects-folder") {
      const chosen = await chooseNativeDirectory("Choose TunnelVision Projects Folder");
      if (!chosen) {
        sendJson(res, 200, { cancelled: true, ...(await deps.settings.read()) });
        return true;
      }
      sendJson(res, 200, await deps.settings.write({ projectsFolder: chosen }));
      return true;
    }
    if (req.method === "GET" && url === "/api/projects") {
      const current = await deps.settings.read();
      if (!current.projectsFolder) {
        sendJson(res, 200, { projects: [], projectsFolder: null });
        return true;
      }
      sendJson(res, 200, {
        projectsFolder: current.projectsFolder,
        projects: await deps.store.listProjects(current.projectsFolder),
      });
      return true;
    }
    if (req.method === "POST" && url === "/api/projects") {
      const body = (await readJsonBody(req)) as {
        name?: unknown;
        project?: Project;
        conversation?: ConversationEntry[];
      };
      const current = await deps.settings.read();
      if (!current.projectsFolder) {
        sendJson(res, 409, { error: "Choose a Projects Folder first.", code: "projects_folder_required" });
        return true;
      }
      const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : body.project?.title ?? "Untitled";
      if (!body.project) {
        sendJson(res, 400, { error: "Missing project." });
        return true;
      }
      const projectRoot = await deps.store.createProjectDirectory(current.projectsFolder, name);
      const saved = await deps.store.saveProject({
        projectRoot,
        project: { ...body.project, title: name },
        conversation: body.conversation ?? [],
      });
      sendJson(res, 200, saved);
      return true;
    }
    if (req.method === "POST" && url === "/api/projects/save") {
      const body = (await readJsonBody(req)) as {
        path?: unknown;
        project?: Project;
        conversation?: ConversationEntry[];
        movieExport?: MovieExportResult | null;
        createdAt?: string;
      };
      if (typeof body.path !== "string" || !body.path.trim() || !body.project) {
        sendJson(res, 400, { error: "Missing project path." });
        return true;
      }
      const saved = await deps.store.saveProject({
        projectRoot: body.path,
        project: body.project,
        conversation: body.conversation,
        movieExport: body.movieExport,
        createdAt: body.createdAt,
      });
      sendJson(res, 200, saved);
      return true;
    }
    if (req.method === "POST" && url === "/api/projects/rename") {
      const body = (await readJsonBody(req)) as {
        path?: unknown;
        name?: unknown;
        project?: Project;
        conversation?: ConversationEntry[];
        movieExport?: MovieExportResult | null;
        createdAt?: string;
      };
      if (typeof body.path !== "string" || !body.path.trim() || !body.project) {
        sendJson(res, 400, { error: "Missing project path." });
        return true;
      }
      const name =
        typeof body.name === "string" && body.name.trim() ? body.name.trim() : body.project.title;
      const renamed = await deps.store.renameProject({
        projectRoot: body.path,
        name,
        project: body.project,
        conversation: body.conversation,
        movieExport: body.movieExport,
        createdAt: body.createdAt,
      });
      sendJson(res, 200, renamed);
      return true;
    }
    if (req.method === "POST" && url === "/api/projects/open") {
      const body = (await readJsonBody(req)) as { path?: unknown };
      if (typeof body.path !== "string" || !body.path.trim()) {
        sendJson(res, 400, { error: "Missing project path." });
        return true;
      }
      const opened = await deps.store.openProject(body.path);
      sendJson(res, 200, opened);
      return true;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Project persistence failed.";
    sendJson(res, 500, { error: message });
    return true;
  }
  return false;
}
