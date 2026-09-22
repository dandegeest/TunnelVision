import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import {
  createEmptySession,
  isSessionId,
  parseAgentSession,
  type AgentSession,
} from "./src/project/session.ts";

export function defaultSessionsDir(): string {
  return join(homedir(), ".tunnelvision", "sessions");
}

export function sessionFileName(id: string): string {
  if (!isSessionId(id)) {
    throw new Error("Invalid session id.");
  }
  return `${id}.json`;
}

export type SessionStore = {
  createSession(): Promise<AgentSession>;
  readSession(id: string): Promise<AgentSession>;
  writeSession(session: AgentSession): Promise<AgentSession>;
};

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  const { rename } = await import("node:fs/promises");
  await rename(tmp, filePath);
}

export function createSessionStore(sessionsDir = defaultSessionsDir()): SessionStore {
  const fileFor = (id: string) => join(sessionsDir, sessionFileName(id));
  return {
    async createSession() {
      const session = createEmptySession();
      await writeJsonAtomic(fileFor(session.id), session);
      return session;
    },
    async readSession(id) {
      const raw = await readFile(fileFor(id), "utf8");
      return parseAgentSession(JSON.parse(raw) as unknown);
    },
    async writeSession(input) {
      const session = parseAgentSession(input);
      await writeJsonAtomic(fileFor(session.id), session);
      return session;
    },
  };
}
