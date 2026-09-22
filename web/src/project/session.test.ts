import { describe, expect, it } from "vitest";
import {
  appendJourneyTurn,
  appendUserTurn,
  createEmptySession,
  lastJourneyTurn,
  parseAgentSession,
  rebindJourneyProjectId,
  sessionCardsFromTurns,
  updateJourneyTurn,
  updateLastJourneyForProject,
  resolveReferenced,
} from "./session";

const AT = new Date("2026-09-21T15:00:00.000Z");

describe("Agent session model", () => {
  it("creates an empty session with a durable id and no project payload", () => {
    const session = createEmptySession(AT);
    expect(session.id).toMatch(/^tvs-[a-f0-9]{16}$/);
    expect(session.createdAt).toBe("2026-09-21T15:00:00.000Z");
    expect(session.turns).toEqual([]);
    expect(JSON.stringify(session)).not.toMatch(/canonical|storyboard|traversal|videoUrl|director/i);
  });

  it("persists a user prompt as a user turn only", () => {
    const session = appendUserTurn(createEmptySession(AT), "Take me through the forest to an overlook.", AT);
    expect(session.turns).toEqual([
      {
        type: "user",
        id: "user-1",
        timestamp: "2026-09-21T15:00:00.000Z",
        text: "Take me through the forest to an overlook.",
      },
    ]);
  });

  it("references a Project from a journey turn without copying project state", () => {
    const started = appendUserTurn(createEmptySession(AT), "Travel the forest.", AT);
    const withJourney = appendJourneyTurn(started, "forest-a-to-f", "completed", undefined, AT);
    const journey = lastJourneyTurn(withJourney);
    expect(journey).toMatchObject({
      type: "journey",
      projectId: "forest-a-to-f",
      status: "completed",
    });
    expect(journey).not.toHaveProperty("story");
    expect(journey).not.toHaveProperty("storyboard");
    expect(JSON.stringify(withJourney)).not.toContain("Travel forward through this night forest");
  });

  it("updates journey status and continuedFrom in place", () => {
    const session = appendJourneyTurn(
      appendUserTurn(createEmptySession(AT), "Descend into the city.", AT),
      "project-002",
      "planning",
      undefined,
      AT,
    );
    const turnId = lastJourneyTurn(session)?.id ?? "";
    const generating = updateJourneyTurn(session, turnId, { status: "generating" }, AT);
    const completed = updateJourneyTurn(
      generating,
      turnId,
      {
        status: "completed",
        continuedFrom: { projectId: "project-001", canonicalId: "E" },
      },
      AT,
    );
    expect(lastJourneyTurn(completed)).toMatchObject({
      status: "completed",
      continuedFrom: { projectId: "project-001", canonicalId: "E" },
    });
  });

  it("rebinds a journey project id after the first durable save", () => {
    const session = appendJourneyTurn(createEmptySession(AT), "untitled", "planning", undefined, AT);
    const rebound = rebindJourneyProjectId(session, "untitled", "tv-abc", AT);
    expect(lastJourneyTurn(rebound)?.projectId).toBe("tv-abc");
    expect(updateLastJourneyForProject(rebound, "tv-abc", { status: "generating" }, AT).turns[0]).toMatchObject({
      status: "generating",
      projectId: "tv-abc",
    });
  });

  it("pairs user prompts with the following journey for Agent cards", () => {
    const session = appendJourneyTurn(
      appendUserTurn(createEmptySession(AT), "Travel the forest.", AT),
      "forest-a-to-f",
      "generating",
      undefined,
      AT,
    );
    expect(sessionCardsFromTurns(session.turns)).toEqual([
      {
        id: "user-1",
        prompt: "Travel the forest.",
        createdAt: "2026-09-21T15:00:00.000Z",
        journey: lastJourneyTurn(session),
      },
    ]);
  });

  it("resolves a journey project from the current project or session cache, not global selection alone", () => {
    const current = { label: "current" };
    const cached = { label: "cached" };
    expect(resolveReferenced("forest-a-to-f", "forest-a-to-f", current, { other: cached })).toBe(current);
    expect(resolveReferenced("other", "forest-a-to-f", current, { other: cached })).toBe(cached);
    expect(resolveReferenced("missing", "forest-a-to-f", current, { other: cached })).toBeNull();
  });

  it("rejects unknown turn types so project documents cannot be stored as a session", () => {
    const empty = createEmptySession(AT);
    expect(() =>
      parseAgentSession({
        ...empty,
        turns: [{ type: "project", id: "p1", timestamp: empty.createdAt, storyboard: [] }],
      }),
    ).toThrow(/Unknown session turn type/);
  });
});
