import { parseAgentSession, type AgentSession } from "./session";

async function readJson(response: Response): Promise<unknown> {
  return (await response.json()) as unknown;
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return fallback;
}

export async function createPersistedAgentSession(): Promise<AgentSession> {
  const response = await fetch("/api/sessions", { method: "POST" });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, "Could not create the Agent session."));
  }
  return parseAgentSession(body);
}

export async function writePersistedAgentSession(session: AgentSession): Promise<AgentSession> {
  const response = await fetch("/api/sessions", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(session),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, "Could not save the Agent session."));
  }
  return parseAgentSession(body);
}
