import type { ConversationEntry } from "./conversation";
import type { MovieExportResult } from "./export-movie";
import type { Project } from "./types";

export type AppSettingsResponse = {
  projectsFolder?: string;
  cancelled?: boolean;
};

export type ListedProject = {
  id: string;
  name: string;
  path: string;
  updatedAt: string;
};

export type SavedProjectResponse = {
  path: string;
  project: Project;
  createdAt: string;
  updatedAt: string;
  missingAssets: string[];
};

export type OpenedProjectResponse = SavedProjectResponse & {
  conversation: ConversationEntry[];
  movieExport?: MovieExportResult | null;
};

async function readJson(response: Response): Promise<unknown> {
  return (await response.json()) as unknown;
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return fallback;
}

export async function fetchAppSettings(): Promise<AppSettingsResponse> {
  const response = await fetch("/api/app-settings");
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, "Could not load application settings."));
  }
  return (body ?? {}) as AppSettingsResponse;
}

export async function chooseProjectsFolder(): Promise<AppSettingsResponse> {
  const response = await fetch("/api/app-settings/choose-projects-folder", { method: "POST" });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, "Could not choose a Projects Folder."));
  }
  return body as AppSettingsResponse;
}

export async function setProjectsFolder(projectsFolder: string): Promise<AppSettingsResponse> {
  const response = await fetch("/api/app-settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectsFolder }),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, "Could not save the Projects Folder."));
  }
  return body as AppSettingsResponse;
}

export async function listPersistedProjects(): Promise<{
  projectsFolder: string | null;
  projects: ListedProject[];
}> {
  const response = await fetch("/api/projects");
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, "Could not list projects."));
  }
  const record = (body ?? {}) as { projectsFolder?: string | null; projects?: ListedProject[] };
  return {
    projectsFolder: record.projectsFolder ?? null,
    projects: record.projects ?? [],
  };
}

export async function createPersistedProject(input: {
  name: string;
  project: Project;
  conversation: ConversationEntry[];
}): Promise<SavedProjectResponse> {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readJson(response);
  if (response.status === 409) {
    const error = new Error(errorMessage(body, "Choose a Projects Folder first.")) as Error & {
      code?: string;
    };
    error.code = "projects_folder_required";
    throw error;
  }
  if (!response.ok) {
    throw new Error(errorMessage(body, "Could not create the project."));
  }
  return body as SavedProjectResponse;
}

export async function savePersistedProject(input: {
  path: string;
  project: Project;
  conversation: ConversationEntry[];
  movieExport?: MovieExportResult | null;
  createdAt?: string;
}): Promise<SavedProjectResponse> {
  const response = await fetch("/api/projects/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, "Could not save the project."));
  }
  return body as SavedProjectResponse;
}

export async function renamePersistedProject(input: {
  path: string;
  name: string;
  project: Project;
  conversation: ConversationEntry[];
  movieExport?: MovieExportResult | null;
  createdAt?: string;
}): Promise<SavedProjectResponse> {
  const response = await fetch("/api/projects/rename", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, "Could not rename the project."));
  }
  return body as SavedProjectResponse;
}

export async function openPersistedProject(path: string): Promise<OpenedProjectResponse> {
  const response = await fetch("/api/projects/open", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, "Could not open the project."));
  }
  return body as OpenedProjectResponse;
}

export async function revealPersistedProject(path: string): Promise<{ path: string }> {
  const response = await fetch("/api/projects/reveal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, "Could not open the project folder."));
  }
  return body as { path: string };
}
