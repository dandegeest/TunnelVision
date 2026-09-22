/** Agent Session is conversation structure plus project references. Not a Project. */

export const SESSION_ID_PATTERN = /^tvs-[a-f0-9]{16}$/;

export type SessionUserTurn = {
  type: "user";
  id: string;
  timestamp: string;
  text: string;
};

export type SessionJourneyStatus = "planning" | "generating" | "completed" | "failed";

export type SessionContinuedFrom = {
  projectId: string;
  canonicalId: string;
};

export type SessionJourneyTurn = {
  type: "journey";
  id: string;
  timestamp: string;
  projectId: string;
  status: SessionJourneyStatus;
  continuedFrom?: SessionContinuedFrom;
};

export type SessionTurn = SessionUserTurn | SessionJourneyTurn;

export type AgentSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  turns: SessionTurn[];
};

export type SessionJourneyCard = {
  id: string;
  prompt: string;
  createdAt: string;
  journey?: SessionJourneyTurn;
};

export function sessionTimestamp(now = new Date()): string {
  return now.toISOString();
}

export function createSessionId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `tvs-${hex}`;
}

export function isSessionId(value: string): boolean {
  return SESSION_ID_PATTERN.test(value);
}

export function createEmptySession(now = new Date()): AgentSession {
  const at = sessionTimestamp(now);
  return {
    id: createSessionId(),
    createdAt: at,
    updatedAt: at,
    turns: [],
  };
}

export function touchSession(session: AgentSession, now = new Date()): AgentSession {
  return { ...session, updatedAt: sessionTimestamp(now) };
}

export function appendUserTurn(session: AgentSession, text: string, now = new Date()): AgentSession {
  const trimmed = text.trim();
  if (!trimmed) {
    return session;
  }
  const at = sessionTimestamp(now);
  return {
    ...session,
    updatedAt: at,
    turns: [
      ...session.turns,
      {
        type: "user",
        id: nextSessionTurnId(session, "user"),
        timestamp: at,
        text: trimmed,
      },
    ],
  };
}

export function appendJourneyTurn(
  session: AgentSession,
  projectId: string,
  status: SessionJourneyStatus = "planning",
  continuedFrom?: SessionContinuedFrom,
  now = new Date(),
): AgentSession {
  const id = projectId.trim();
  if (!id) {
    return session;
  }
  const at = sessionTimestamp(now);
  return {
    ...session,
    updatedAt: at,
    turns: [
      ...session.turns,
      {
        type: "journey",
        id: nextSessionTurnId(session, "journey"),
        timestamp: at,
        projectId: id,
        status,
        ...(continuedFrom ? { continuedFrom } : {}),
      },
    ],
  };
}

export function lastJourneyTurn(session: AgentSession): SessionJourneyTurn | undefined {
  for (let index = session.turns.length - 1; index >= 0; index -= 1) {
    const turn = session.turns[index];
    if (turn?.type === "journey") {
      return turn;
    }
  }
  return undefined;
}

export function updateJourneyTurn(
  session: AgentSession,
  turnId: string,
  patch: Partial<Pick<SessionJourneyTurn, "projectId" | "status" | "continuedFrom">>,
  now = new Date(),
): AgentSession {
  let changed = false;
  const turns = session.turns.map((turn) => {
    if (turn.type !== "journey" || turn.id !== turnId) {
      return turn;
    }
    const next: SessionJourneyTurn = {
      ...turn,
      ...(patch.projectId?.trim() ? { projectId: patch.projectId.trim() } : {}),
      ...(patch.status ? { status: patch.status } : {}),
      ...("continuedFrom" in patch
        ? patch.continuedFrom
          ? { continuedFrom: patch.continuedFrom }
          : { continuedFrom: undefined }
        : {}),
    };
    if (
      next.projectId === turn.projectId &&
      next.status === turn.status &&
      sameContinuedFrom(next.continuedFrom, turn.continuedFrom)
    ) {
      return turn;
    }
    changed = true;
    return next;
  });
  return changed ? { ...session, updatedAt: sessionTimestamp(now), turns } : session;
}

export function updateLastJourneyForProject(
  session: AgentSession,
  projectId: string,
  patch: Partial<Pick<SessionJourneyTurn, "projectId" | "status" | "continuedFrom">>,
  now = new Date(),
): AgentSession {
  const turn = [...session.turns]
    .reverse()
    .find((item): item is SessionJourneyTurn => item.type === "journey" && item.projectId === projectId);
  if (!turn) {
    return session;
  }
  return updateJourneyTurn(session, turn.id, patch, now);
}

export function rebindJourneyProjectId(
  session: AgentSession,
  fromProjectId: string,
  toProjectId: string,
  now = new Date(),
): AgentSession {
  const from = fromProjectId.trim();
  const to = toProjectId.trim();
  if (!from || !to || from === to) {
    return session;
  }
  let changed = false;
  const turns = session.turns.map((turn) => {
    if (turn.type !== "journey" || turn.projectId !== from) {
      return turn;
    }
    changed = true;
    return { ...turn, projectId: to };
  });
  return changed ? { ...session, updatedAt: sessionTimestamp(now), turns } : session;
}

export function resolveReferenced<T>(
  projectId: string | undefined,
  currentId: string,
  current: T,
  cache: Readonly<Record<string, T>>,
): T | null {
  if (!projectId) {
    return null;
  }
  if (projectId === currentId) {
    return current;
  }
  return cache[projectId] ?? null;
}

export function sessionCardsFromTurns(turns: readonly SessionTurn[]): SessionJourneyCard[] {
  const cards: SessionJourneyCard[] = [];
  for (const turn of turns) {
    if (turn.type === "user") {
      cards.push({
        id: turn.id,
        prompt: turn.text,
        createdAt: turn.timestamp,
      });
      continue;
    }
    const last = cards[cards.length - 1];
    if (last && !last.journey) {
      last.journey = turn;
      continue;
    }
    cards.push({
      id: turn.id,
      prompt: "",
      createdAt: turn.timestamp,
      journey: turn,
    });
  }
  return cards;
}

export function parseAgentSession(value: unknown): AgentSession {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid session.");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !isSessionId(record.id)) {
    throw new Error("Invalid session id.");
  }
  if (typeof record.createdAt !== "string" || !record.createdAt.trim()) {
    throw new Error("Invalid session createdAt.");
  }
  if (typeof record.updatedAt !== "string" || !record.updatedAt.trim()) {
    throw new Error("Invalid session updatedAt.");
  }
  if (!Array.isArray(record.turns)) {
    throw new Error("Invalid session turns.");
  }
  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    turns: record.turns.map((turn, index) => parseSessionTurn(turn, index)),
  };
}

function parseSessionTurn(value: unknown, index: number): SessionTurn {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid session turn ${index}.`);
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id.trim()) {
    throw new Error(`Invalid session turn id ${index}.`);
  }
  if (typeof record.timestamp !== "string" || !record.timestamp.trim()) {
    throw new Error(`Invalid session turn timestamp ${index}.`);
  }
  if (record.type === "user") {
    if (typeof record.text !== "string" || !record.text.trim()) {
      throw new Error(`Invalid user turn text ${index}.`);
    }
    return {
      type: "user",
      id: record.id,
      timestamp: record.timestamp,
      text: record.text,
    };
  }
  if (record.type === "journey") {
    if (typeof record.projectId !== "string" || !record.projectId.trim()) {
      throw new Error(`Invalid journey turn projectId ${index}.`);
    }
    if (!isJourneyStatus(record.status)) {
      throw new Error(`Invalid journey turn status ${index}.`);
    }
    const continuedFrom = parseContinuedFrom(record.continuedFrom, index);
    return {
      type: "journey",
      id: record.id,
      timestamp: record.timestamp,
      projectId: record.projectId.trim(),
      status: record.status,
      ...(continuedFrom ? { continuedFrom } : {}),
    };
  }
  throw new Error(`Unknown session turn type ${index}.`);
}

function parseContinuedFrom(value: unknown, index: number): SessionContinuedFrom | undefined {
  if (value == null) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid continuedFrom ${index}.`);
  }
  const record = value as Record<string, unknown>;
  if (typeof record.projectId !== "string" || !record.projectId.trim()) {
    throw new Error(`Invalid continuedFrom projectId ${index}.`);
  }
  if (typeof record.canonicalId !== "string" || !record.canonicalId.trim()) {
    throw new Error(`Invalid continuedFrom canonicalId ${index}.`);
  }
  return {
    projectId: record.projectId.trim(),
    canonicalId: record.canonicalId.trim(),
  };
}

function isJourneyStatus(value: unknown): value is SessionJourneyStatus {
  return value === "planning" || value === "generating" || value === "completed" || value === "failed";
}

function sameContinuedFrom(left?: SessionContinuedFrom, right?: SessionContinuedFrom): boolean {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return left.projectId === right.projectId && left.canonicalId === right.canonicalId;
}

function nextSessionTurnId(session: AgentSession, prefix: string): string {
  return `${prefix}-${session.turns.length + 1}`;
}
