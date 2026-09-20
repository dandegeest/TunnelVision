import { execFile } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { promisify } from "node:util";

import { PROJECT_MANIFEST_NAME } from "./src/project/persistence/paths.ts";

const execFileAsync = promisify(execFile);

export function isPathInside(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** Only a real saved project directory may be revealed in the file manager. */
export function revealableProjectPath(
  path: string,
  projectsFolder?: string | null,
): string | null {
  const trimmed = path.trim();
  if (!trimmed) {
    return null;
  }
  const root = resolve(trimmed);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return null;
  }
  if (!existsSync(resolve(root, PROJECT_MANIFEST_NAME))) {
    return null;
  }
  if (projectsFolder && !isPathInside(projectsFolder, root)) {
    return null;
  }
  return root;
}

/** Only a saved project that is a direct child of the Projects Folder may be deleted. */
export function deletableProjectPath(
  path: string,
  projectsFolder?: string | null,
): string | null {
  const revealed = revealableProjectPath(path, projectsFolder);
  if (!revealed || !projectsFolder?.trim()) {
    return null;
  }
  const folder = resolve(projectsFolder);
  if (revealed === folder) {
    return null;
  }
  if (resolve(dirname(revealed)) !== folder) {
    return null;
  }
  return revealed;
}

export async function openPathInFileManager(path: string): Promise<void> {
  if (process.platform === "darwin") {
    await execFileAsync("open", [path]);
    return;
  }
  if (process.platform === "linux") {
    await execFileAsync("xdg-open", [path]);
    return;
  }
  if (process.platform === "win32") {
    await execFileAsync("explorer", [path]);
    return;
  }
  throw new Error("Opening folders is not supported on this platform.");
}
