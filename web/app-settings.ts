import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type AppSettings = {
  projectsFolder?: string;
};

export type AppSettingsStore = {
  read(): Promise<AppSettings>;
  write(next: AppSettings): Promise<AppSettings>;
};

function defaultSettingsPath(): string {
  return join(homedir(), ".tunnelvision", "settings.json");
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  const { rename } = await import("node:fs/promises");
  await rename(tmp, path);
}

export function createAppSettingsStore(filePath = defaultSettingsPath()): AppSettingsStore {
  return {
    async read() {
      try {
        const raw = await readFile(filePath, "utf8");
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return {};
        }
        const record = parsed as Record<string, unknown>;
        const projectsFolder =
          typeof record.projectsFolder === "string" && record.projectsFolder.trim()
            ? record.projectsFolder.trim()
            : undefined;
        return projectsFolder ? { projectsFolder } : {};
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return {};
        }
        throw error;
      }
    },
    async write(next) {
      const current = await this.read();
      const merged: AppSettings = { ...current, ...next };
      if (!merged.projectsFolder) {
        delete merged.projectsFolder;
      }
      await writeJsonAtomic(filePath, merged);
      return merged;
    },
  };
}
