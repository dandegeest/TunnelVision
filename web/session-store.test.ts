import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { appendJourneyTurn, appendUserTurn, parseAgentSession } from "./src/project/session.ts";
import { createSessionStore } from "./session-store.ts";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("session store", () => {
  it("creates a new empty session file and does not load a previous one", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tv-sessions-"));
    dirs.push(dir);
    const store = createSessionStore(dir);
    const first = await store.createSession();
    const firstPath = join(dir, `${first.id}.json`);
    const firstRaw = await readFile(firstPath, "utf8");
    expect(JSON.parse(firstRaw)).toMatchObject({ id: first.id, turns: [] });

    const second = await store.createSession();
    expect(second.id).not.toBe(first.id);
    const names = await readdir(dir);
    expect(names.sort()).toEqual([`${first.id}.json`, `${second.id}.json`].sort());
    expect(parseAgentSession(JSON.parse(await readFile(firstPath, "utf8"))).turns).toEqual([]);
  });

  it("writes user and journey turns without duplicating project media", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tv-sessions-"));
    dirs.push(dir);
    const store = createSessionStore(dir);
    const created = await store.createSession();
    const withUser = appendUserTurn(created, "Take me through the forest to an overlook.");
    const withJourney = appendJourneyTurn(withUser, "project-001", "completed");
    const saved = await store.writeSession(withJourney);
    const raw = await readFile(join(dir, `${saved.id}.json`), "utf8");
    expect(raw).toContain("Take me through the forest to an overlook.");
    expect(raw).toContain("project-001");
    expect(raw).not.toMatch(/"storyboard"|"canonicals"|"traversals"|"videoUrl"|"events"/);
    expect(JSON.parse(raw).turns).toHaveLength(2);
  });

  it("reads a previously written session by id", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tv-sessions-"));
    dirs.push(dir);
    const store = createSessionStore(dir);
    const created = await store.createSession();
    const saved = await store.writeSession(appendUserTurn(created, "First Tracks: The Ascent"));
    await expect(store.readSession(saved.id)).resolves.toMatchObject({
      id: saved.id,
      turns: [{ type: "user", text: "First Tracks: The Ascent" }],
    });
  });
});
