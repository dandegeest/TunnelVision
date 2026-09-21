import { describe, expect, it } from "vitest";
import { PROJECT_OPEN_MENU_LIMIT, recentListedProjects } from "./recent-projects";

function item(name: string, updatedAt: string) {
  return { path: `/projects/${name}`, name, updatedAt };
}

describe("recentListedProjects", () => {
  it("sorts newest first and caps the Open menu at 10", () => {
    const projects = Array.from({ length: 12 }, (_, index) =>
      item(`P${index}`, `2026-09-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`),
    );
    const recent = recentListedProjects(projects);
    expect(PROJECT_OPEN_MENU_LIMIT).toBe(10);
    expect(recent).toHaveLength(10);
    expect(recent[0]?.name).toBe("P11");
    expect(recent.at(-1)?.name).toBe("P2");
    expect(recent.some((entry) => entry.name === "P0" || entry.name === "P1")).toBe(false);
  });

  it("keeps a short list intact", () => {
    const projects = [item("Old", "2026-01-01T00:00:00.000Z"), item("New", "2026-09-20T00:00:00.000Z")];
    expect(recentListedProjects(projects).map((entry) => entry.name)).toEqual(["New", "Old"]);
  });
});
