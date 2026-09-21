export const PROJECT_OPEN_MENU_LIMIT = 10;

export type RecentProjectLike = {
  path: string;
  name: string;
  updatedAt: string;
};

/** Newest `updatedAt` first, then capped for the project Open menu. */
export function recentListedProjects<T extends RecentProjectLike>(
  projects: readonly T[],
  limit = PROJECT_OPEN_MENU_LIMIT,
): T[] {
  return [...projects]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, Math.max(0, limit));
}
